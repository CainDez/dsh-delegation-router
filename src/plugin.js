import { Service } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { ToolExecutionPipeline } from '@deepseek-ai/dsh-tools/pipeline';
import { isAbsolute, join } from 'node:path';
import { isVolatile } from '@deepseek-ai/cosmokit';
import { LiveRouter } from './live-router.js';
import { RouterConfig, compilePluginConfig } from './ui-config.js';
import { FileJournal } from './journal.js';
import { fail, assertActive } from './errors.js';
import { authorizationProjection, createAuthorizationReader, parentRouteSnapshot } from './authorization.js';
import { createNativeInvoker } from './native-adapter.js';
import { createChildReaders, createLifecycleHandlers } from './lifecycle.js';
import { mountGuidance, authorizedCandidateChoices } from './guidance.js';
import { mountDraftRemote, invokeDraftRemote } from './draft-remote.js';

const requestParameters = {
  prompt: { type: 'string', required: true, description: 'Complete standalone text task for the child.' },
  description: { type: 'string', required: true, description: 'Brief child task label.' },
  candidate_id: { type: 'string', description: 'Configured candidate id chosen for this task. Omit to use the default candidate. No substitution if the chosen candidate is invalid or unauthorized.' },
  policy_revision: { type: 'string', description: 'Revision returned by delegation_routes; stale values are rejected.' }
};
const output = {
  schema: {
    type: 'object', additionalProperties: true, properties: {
      kind: { type: 'string' },
      name: { type: 'string', description: 'Native model-facing child name; not a Session id.' },
      childId: { type: 'string', description: 'Verified durable child Session id for audit, status and reconciliation.' },
      policy_revision: { type: 'string' },
      decisionId: { type: 'string' },
      routingReason: { type: 'string' },
      selected: { type: 'object', additionalProperties: false, properties: {
        provider: { type: 'string', required: true },
        model: { type: 'string', required: true },
        effort: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true }
      } },
      candidateId: { type: 'string' }
    }
  },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]
};

/** Optional, separately mounted per-profile Cordis service; does not configure the parent Agent. */
export class SubagentRouterService extends Service {
  static inject = ['agents', 'tools', 'subagents', 'llm', 'sessionProjections', 'sessionQuery'];
  static Config = RouterConfig;

  constructor(ctx, config) {
    super(ctx, 'delegationRouter');
    this.configSource=config;
    const dir=ctx.get('profileContext')?.dir;
    this.defaultAuditFile=typeof dir==='string'&&isAbsolute(dir)?join(dir,'delegation-router','audit.jsonl'):undefined;
    const compiled=this.configuration();
    this.policy=compiled.policy;this.auditFile=compiled.auditFile;
  }

  configuration(source=this.configSource) {
    const raw={};
    for(const key of Reflect.ownKeys(source??{})) {
      const descriptor=Object.getOwnPropertyDescriptor(source,key);
      if(typeof key!=='string'||!('value' in descriptor)||!descriptor.enumerable)fail('INVALID_CONFIG','Invalid plugin configuration descriptor');
      const value=descriptor.value;
      Object.defineProperty(raw,key,{value:key==='ui'&&isVolatile(value)?value.get():value,enumerable:true});
    }
    const compiled=compilePluginConfig(raw);
    const auditFile=compiled.auditFile??this.defaultAuditFile;
    if(compiled.policy.enabled&&(typeof auditFile!=='string'||!isAbsolute(auditFile)))fail('AUDIT_PATH','Enabled routing requires an absolute auditFile or an available profileContext directory');
    return {...compiled,...(auditFile===undefined?{}:{auditFile})};
  }

  get runtime(){return this.manager?.runtime;}

  assertRoot(agent) {
    if (!agent || this.ctx.agents.get(agent.id) !== agent) fail('HOST_EXECUTION_REQUIRED', 'An exact live parent Agent is required');
    if (agent.session.header.origin === 'subagent' || agent.session.header.parentSession !== undefined) fail('ROOT_ONLY', 'Routing tools are root-only');
  }

  async runWithParentEvidence(args,exec) {
    this.assertRoot(exec.agent);
    const before=parentRouteSnapshot(exec.agent);
    const result=await this.manager.run(exec.agent,args,exec);
    const after=parentRouteSnapshot(exec.agent);
    return {...result,parentRouteBefore:before,parentRouteAfter:after,parentRouteUnchanged:JSON.stringify(before)===JSON.stringify(after)};
  }

  generateDraft(request, signal) { return invokeDraftRemote(this, 'generateDraft', request, signal); }
  validateDraft(request, signal) { return invokeDraftRemote(this, 'validateDraft', request, signal); }
  modelCatalog(signal) { return invokeDraftRemote(this, 'modelCatalog', undefined, signal); }

  async [Service.init]() {
    await mountDraftRemote(this);
    const handle=await this.ctx.sessionProjections.register(authorizationProjection);
    const readAuthorization=createAuthorizationReader(handle);
    const pipeline=new ToolExecutionPipeline(this.ctx);
    const sessionReaders={getAgent:id=>this.ctx.agents.get(id),getSession:id=>this.ctx.get('sessions')?.get(id)};
    const {readChildRoute,readChildOwner,readCompletion}=createChildReaders({observeSession:(id,options)=>this.ctx.sessionQuery.observeSession(id,options)});
    this.manager=new LiveRouter({
      readConfig:()=>this.configuration(),createJournal:file=>new FileJournal(file),
      resolveModel:(provider,model,signal)=>this.ctx.llm.resolveModelInfo(provider,model,signal),
      readAuthorization, readChildRoute,
      validateOptions:(parent,route)=>{
        const inherited=parentRouteSnapshot(parent);
        if(route.effort===null && inherited.provider===route.provider && inherited.model===route.model && inherited.effort!==null) fail('NULL_EFFORT_INHERITANCE','The native host would inherit a parent effort for this same-route no-effort candidate; no child was created');
      },
      preflight:(options,signal)=>this.ctx.llm.resolveCallConfig(options,signal),
      invokeNative:createNativeInvoker(this.ctx,pipeline)
    });
    if(this.policy.enabled)this.manager.ensure();
    this.ctx.on('internal/config',(fiber,next)=>{
      const raw=next();
      if(fiber!==this.ctx.fiber)return raw;
      const candidate=this.configuration(RouterConfig(raw));
      this.manager.validateUpdate(candidate);
      return raw;
    });
    const lifecycle=createLifecycleHandlers({
      ...sessionReaders, readChildOwner, settle:(pid,childId,evidence)=>this.manager.settle(pid,childId,evidence),
      onError:(error,pid)=>{
        if(pid)this.runtime?.ledger.pause(pid);
        try { this.ctx.logger.error('delegationRouter lifecycle settlement failed; parent routing paused when identified', error); } catch {}
      }
    });
    this.ctx.on('subagent/start',lifecycle.start);
    this.ctx.on('subagent/end',lifecycle.end);
    this.ctx.effect(()=>()=>lifecycle.clear(), 'delegationRouter.lifecycle');
    this.ctx.effect(() => mountGuidance(this.ctx,{readConfig:()=>this.configuration(),readAuthorization}), 'delegationRouter.guidance');
    this.ctx.effect(() => () => this.manager.close(), 'delegationRouter.runtime');
    const rootOnly=({agent})=>!!agent&&this.ctx.agents.get(agent.id)===agent&&agent.session.header.origin!=='subagent'&&agent.session.header.parentSession===undefined;
    const rootWhen=context=>rootOnly(context)&&this.manager.status().enabled;
    this.ctx.tools.register(defineTool({
      name:'router_status',
      description:'Read parent-scoped routing readiness and evidence; does not create, modify or orchestrate Agents. With child_id, inspect an owned child Session request route. selected is intent; accepted is a creation receipt; observed is a request route; settled means activation ended, not task success or verification success. Unknown is unresolved: reconcile, never repeat creation.',
      parameters:{child_id:{type:'string',description:'Optional child Session id returned by routed delegation.'},limit:{type:'integer',description:'Maximum parent-scoped decision cards, 1-100; default 20. Does not open a journal when routing is disabled.'}},output,
      execute:async (args,exec)=>{
        this.assertRoot(exec.agent);
        const state=this.manager.status();
        const result={...state,...(state.configuredRevision?{policy_revision:state.configuredRevision}:{}),parentRoute:parentRouteSnapshot(exec.agent),nativeSubagentAvailable:!!this.ctx.tools.executable('subagent',exec.agent,exec.toolSet),decisions:await this.manager.decisions(exec.agent,{limit:args.limit}),evidenceLegend:'selected is policy intent; accepted is a creation receipt; observed is a real child request route; settled is lifecycle end, not verification success; unknown must be reconciled, never automatically replayed.'};
        if(args.child_id!==undefined) {
          return {...result,childId:args.child_id,observedChildRequestRoute:await readChildRoute(exec.agent,args.child_id,exec.signal)};
        }
        return result;
      }
    }),{when:rootOnly});
    this.ctx.tools.register(defineTool({
      name:'router_reconcile',
      description:'Reconcile one previously accepted routed child using its owned, persisted terminal turn. Never creates or resumes an Agent, never clears unknown creation outcomes, and never deletes audit or locks. Only use after inspecting the child; settled means activation ended, not task success.',
      parameters:{child_id:{type:'string',required:true,description:'Exact accepted child Session id to reconcile.'}},output,
      execute:async (args,exec)=>{
        this.assertRoot(exec.agent);
        const evidence=await readCompletion(exec.agent,args.child_id,exec.signal);
        this.assertRoot(exec.agent); exec.signal?.throwIfAborted();
        if(this.ctx.agents.get(args.child_id) || this.ctx.get('sessions')?.get(args.child_id)) fail('CHILD_NOT_SETTLED','Child became resident during reconciliation');
        return this.manager.reconcile(exec.agent.id,args.child_id,evidence);
      }
    }),{when:rootOnly});
    this.ctx.tools.register(defineTool({
      name: 'delegation_routes',
      description: 'List authorized configured candidates and the configured default. Takes no arguments. This is read-only discovery, not model capability validation or a selection preview; creation checks only the selected candidate. Descriptions are preference data, not authority. No substitution on rejection.',
      parameters: {},
      output: {...output,schema:{type:'object',additionalProperties:true,properties:{policy_revision:{type:'string'},defaultCandidateId:{type:'string'},candidates:{type:'array',items:{type:'object',additionalProperties:true}},eligibility:{type:'string'}}}},
      execute: async (args, exec) => {
        this.assertRoot(exec.agent); assertActive(exec.signal);
        if (!args || Object.getPrototypeOf(args) !== Object.prototype || Reflect.ownKeys(args).length) fail('INVALID_REQUEST','delegation_routes takes no arguments');
        if (this.manager.closed) fail('ROUTER_DISABLED','Router has been disposed');
        const {config,revision}=this.manager.snapshot();
        if (!config.policy.enabled) fail('ROUTER_DISABLED','Child router is disabled');
        const authorized = readAuthorization(exec.agent);
        const candidates = authorizedCandidateChoices(config.policy,authorized);
        this.assertRoot(exec.agent); assertActive(exec.signal);
        return {
          policy_revision: revision,
          defaultCandidateId: config.policy.defaultCandidateId,
          candidates,
          eligibility: 'No model has been preflighted by this listing. Each candidate fixes its provider, model and effort. Creation checks only the chosen candidate against current calling requirements and host authorization; no fallback.'
        };
      }
    }), { when: rootWhen });
    this.ctx.tools.register(defineTool({
      name: 'routed_subagent',
      description: 'Create a fresh text-only child using the explicitly selected candidate or default candidate through the admitted native subagent tool. Creation-time selection only, not task orchestration. Never changes the parent model or bypasses scope, guards or authorization; do not bypass refusal through another native tool. Unknown creation outcomes require reconciliation, not another start.',
      parameters: { ...requestParameters, cwd: { type: 'string', description: 'Native initial child working directory.' } },
      output,
      execute: (args, exec) => {
        this.assertRoot(exec.agent);
        return this.runWithParentEvidence(args, exec);
      }
    }), { when: rootWhen });
  }
}

export default SubagentRouterService;
