import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const schemaStub = 'const node = new Proxy(function(){return node},{get(){return node},apply(_target,receiver,args){return receiver===undefined && args[0] && typeof args[0]==="object" ? args[0] : node}}); export default node; export const z=node;';
const modules = {
  '@deepseek-ai/cordis': 'export class Service { static init=Symbol.for("router-test-init"); constructor(ctx,name){this.ctx=ctx; ctx.services.set(name,this);} }',
  '@deepseek-ai/schemastery': schemaStub,
  '@deepseek-ai/cosmokit': 'export const isVolatile=x=>!!x&&x.__volatile===true;',
  zod: schemaStub,
  '@deepseek-ai/dsh-subagent': 'export function parentAgentOptionsForDelegation(parent){ const c=parent.session.requestHeader()?.config; if(!c)return {...parent.options}; const {provider,model,reasoningEffort,...rest}=parent.options; return {...rest,provider:c.provider,model:c.model,...(c.reasoningEffort===undefined?{}:{reasoningEffort:c.reasoningEffort})}; }',
  '@deepseek-ai/dsh-tools': 'export function defineTool(o){const check=s=>{if(!s||typeof s!=="object")return;if(Object.hasOwn(s,"required")&&s.required!==true)throw Error("required must be true or absent");for(const v of Object.values(s))check(v)};check(o.parameters);check(o.output.schema);if(!o.output || !o.output.schema || typeof o.output.render!=="function")throw Error("real output contract required");if(o.parameters.type)throw Error("implicit property map required");return {...o,parameters:{type:"object",properties:o.parameters}};}',
  '@deepseek-ai/dsh-tools/pipeline': 'export class ToolExecutionPipeline { constructor(ctx){this.ctx=ctx;} async prepare(input){this.ctx.stages.push("prepare");this.ctx.lastInput=input;await this.ctx.beforePrepared?.(input);return this.ctx.denied?{kind:"post-result",exec:input,result:{isError:true,error:{message:"guard denied"},content:[]}}:{kind:"dispatch",exec:input};} async dispatch(exec){this.ctx.stages.push("dispatch");try{return {kind:"post-result",result:{isError:false,value:await this.ctx.nativeBody(exec.arguments,exec),content:[{type:"text",text:"native rendered"}]}};}catch(error){return {kind:"post-result",result:{isError:true,error:{message:error.message},content:[]}};}} async complete(exec,outcome){this.ctx.stages.push("complete");await this.ctx.completeHook?.();return this.ctx.mapResult?this.ctx.mapResult(outcome.result):outcome.result;} }'
};
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (Object.hasOwn(modules, specifier)) return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
  return next(specifier, context);
} });
after(() => hooks.deregister());
const { default: RouterService } = await import('../src/plugin.js');
const { authorizationProjection, createAuthorizationReader } = await import('../src/authorization.js');
const { createNativeInvoker } = await import('../src/native-adapter.js');
const init = Symbol.for('router-test-init');
const directory = await mkdtemp(path.join(tmpdir(), 'dsh-router-host-'));
const allEffects = [];
after(async () => {
  for (const effects of allEffects) for (const dispose of effects) dispose();
  await rm(directory, { recursive: true, force: true });
});
let sequence = 0;
const metadata = { inputModalities: ['text'], contextWindow: 200000, reasoning: { efforts: [{ id: 'low' }, { id: 'high' }], defaultEffort: 'low' } };
const model = { id: 'primary', name:'Fast', provider: 'p', model: 'm', effort:'low', description:'Fast route' };
function makeHost({ native = true, authorized = null, extraModels = [] } = {}) {
  const events = [], handlers = new Map(), services = new Map(), definitions = new Map(), effects = [];
  allEffects.push(effects);
  const parent = {
    id: 'parent', options: Object.freeze({ provider: 'created', model: 'stale' }),
    session: { header: Object.freeze({ origin: 'interactive' }), requestHeader: () => ({ config: { provider: 'p', model: 'm' } }), append(type, data) { events.push({ type, data }); } }
  };
  const sessions=new Map([['child',{id:'child',header:{origin:'subagent',parentSession:parent.id},requestHeader:()=>undefined}]]);
  services.set('sessions',{get:id=>sessions.get(id)});
  const schema = { name: 'subagent', parameters: { type: 'object', properties: { provider: {}, model: {}, reasoning_effort: {}, name: {type:'string'} } } };
  const nativeDefinition = { output: { schema: { type: 'object', required: ['kind', 'name'], properties: { kind: { type: 'string', const: 'activation' }, name: { type: 'string' } } } }, execute() { throw Error('must never call raw execute'); } };
  const ctx = {
    services, stages: [], metadataLookups: 0, preflights: [], events,
    logger: { error: (...args) => events.push({ type: "logger/error", args }) },
    agents: { get: id => id === parent.id ? parent : undefined },
    get: name => services.get(name),
    tools: {
      register(definition, options) { definitions.set(definition.name, { definition, options }); return () => definitions.delete(definition.name); },
      executable(name, agent, set) { assert.equal(agent, parent); assert.ok(set); return native && name === 'subagent' ? nativeDefinition : undefined; },
      schemas: () => [schema]
    },
    subagents: {}, catalog: [],
    sessionQuery:{async observeSession(id){
      if(id===parent.id)return {header:{id:parent.id},projections:{values:{subagentCatalog:ctx.catalog}},[Symbol.dispose](){}};
      const session=services.get('sessions')?.get(id);
      if(!session)throw Object.assign(Error('Unknown child'),{code:'CHILD_SCOPE'});
      return {source:'live',header:{id:session.id,...session.header},inheritedEventCount:0,get events(){const config=session.requestHeader?.()?.config;return session.events??(config?[{seq:0,type:'request/header',data:{header:{config}}}]:[]);},[Symbol.dispose](){}};
    }},
    llm: {
      async resolveModelInfo(provider, id, signal) { signal.throwIfAborted(); ctx.metadataLookups++; return metadata; },
      async resolveCallConfig(options, signal) { signal?.throwIfAborted(); ctx.preflights.push(options); return options; }
    },
    sessionProjections: { async register(definition) { ctx.projection = definition; return { stateOf: () => authorized }; } },
    on(name, fn) { handlers.set(name, fn); },
    effect(fn) { effects.push(fn()); },
    nativeBody: async args => {ctx.catalog.push({id:'child',name:args.name});return {kind:'activation',name:args.name};}
  };
  const config = { ui: { schemaVersion: 3, enabled: true, candidates: [model, ...extraModels], defaultCandidateId:'primary' }, auditFile: path.join(directory, 'audit-' + ++sequence + '.jsonl') };
  const exec = { agent: parent, token: {}, toolSet: {}, callId: 'call-' + sequence, rootCallId: 'root', signal: new AbortController().signal, deferContext() {}, concludeTurn() {} };
  return { ctx, parent, config, exec, definitions, handlers, effects, events, services, sessions, nativeDefinition };
}
const request = { prompt: 'Independent useful work', description: 'Do useful work' };

test('fixed candidate discovery and dispatch ignore stale parent creation options',async()=>{
  const h=makeHost();h.config.ui.candidates=[{id:'review',name:'Review',provider:'p',model:'m',effort:'high'}];h.config.ui.defaultCandidateId='review';
  const service=new RouterService(h.ctx,h.config);await service[init]();
  const listing=await h.definitions.get('delegation_routes').definition.execute({},h.exec);
  assert.equal(listing.defaultCandidateId,'review');assert.equal(h.ctx.metadataLookups,0);assert.equal(h.ctx.preflights.length,0);
  assert.deepEqual(listing.candidates[0],h.config.ui.candidates[0]);
  const result=await h.definitions.get('routed_subagent').definition.execute({...request,policy_revision:listing.policy_revision},h.exec);
  assert.deepEqual(result.selected,{provider:'p',model:'m',effort:'high'});assert.equal(result.parentRouteUnchanged,true);
  assert.equal(h.ctx.lastInput.arguments.provider,'p');assert.equal(h.ctx.lastInput.arguments.model,'m');assert.equal(h.ctx.lastInput.arguments.reasoning_effort,'high');
  assert.deepEqual(h.parent.options,{provider:'created',model:'stale'});
});

test('parent route changes do not rebind a fixed candidate while authorization remains valid',async()=>{
  const h=makeHost({authorized:[{provider:'p',model:'m'},{provider:'q',model:'n'}]});
  h.ctx.beforePrepared=async()=>{await Promise.resolve();h.parent.session.requestHeader=()=>({config:{provider:'q',model:'n',reasoningEffort:'low'}});};
  const service=new RouterService(h.ctx,h.config);await service[init]();
  const result=await h.definitions.get('routed_subagent').definition.execute(request,h.exec);
  assert.deepEqual(result.selected,{provider:'p',model:'m',effort:'low'});assert.equal(result.parentRouteUnchanged,false);
  assert.deepEqual(h.ctx.stages,['prepare','dispatch','complete']);
});

test('authorization projection reads first native policy only without mutating it', () => {
  assert.notEqual(authorizationProjection.key, 'subagentModelSelectionPolicy');
  const event = { type: 'subagent/model-selection-policy', data: { allowedModels: [{ provider: 'p', model: 'm' }] } };
  const state = authorizationProjection.apply(null, event);
  assert.deepEqual(state, event.data.allowedModels); assert.notEqual(state, event.data.allowedModels);
  const later = { type: event.type, data: { allowedModels: [{ provider: 'evil', model: 'evil' }] } };
  assert.equal(authorizationProjection.apply(state, later), state);
  assert.equal(authorizationProjection.apply(null, { type: 'other' }), null);
  assert.throws(() => authorizationProjection.apply(null, { type: event.type, data: { allowedModels: [] } }), { code: 'AUTHORIZATION_INVALID' });
  const duplicate = [...event.data.allowedModels, ...event.data.allowedModels];
  assert.throws(() => authorizationProjection.apply(null, { type: event.type, data: { allowedModels: duplicate } }), { code: 'AUTHORIZATION_INVALID' });
});

test('absent native policy uses captured parent delegation route, not stale creation defaults', () => {
  const { parent } = makeHost();
  assert.deepEqual(createAuthorizationReader({ stateOf: () => null })(parent), [{ provider: 'p', model: 'm' }]);
  const state = [{ provider: 'allowed', model: 'allowed' }];
  const read = createAuthorizationReader({ stateOf: () => state });
  read(parent)[0].provider = 'mutated'; assert.equal(state[0].provider, 'allowed');
  assert.throws(() => createAuthorizationReader({ stateOf: () => undefined })(parent), { code: 'AUTHORIZATION_UNAVAILABLE' });
});

test('native bridge preserves prepare dispatch complete, token scope, canonical value, deferred context and logs',async()=>{
  const h=makeHost(),calls=[],canonical={kind:'activation',name:''},context={content:'deferred'};let concluded=false;
  h.exec.deferContext=value=>calls.push(value);h.exec.concludeTurn=()=>{concluded=true;};
  const pipeline={
    async prepare(input){calls.push('prepare');assert.equal(input.agent,h.parent);assert.equal(input.parent,h.exec.token);assert.equal(input.toolSet,h.exec.toolSet);canonical.name=input.arguments.name;return {kind:'dispatch',exec:input};},
    async dispatch(){calls.push('dispatch');h.ctx.catalog.push({id:'child',name:canonical.name});return {kind:'post-result'};},
    async complete(){calls.push('complete');return {isError:false,value:canonical,content:[{type:'text',text:'native rendered'}],additionalContexts:[context],concludesTurn:true};}
  };
  const logNested=async(exec,input,result)=>{assert.equal(exec,h.exec);assert.equal(result.value,canonical);h.events.push({type:'test/nested',data:{parentCallId:input.callId}});};
  const result=await createNativeInvoker(h.ctx,pipeline,logNested)(request,h.exec);
  assert.deepEqual(result,{kind:'activation',name:canonical.name,childId:'child'});
  assert.deepEqual(calls,['prepare','dispatch','complete',context]);assert.equal(concluded,true);
  assert.equal(h.events[0].type,'test/nested');assert.equal(h.events[0].data.parentCallId,h.exec.callId+':router');
});

test('native bridge cannot bypass missing admitted native tool or disabled model selection', async () => {
  const h = makeHost({ native: false });
  await assert.rejects(createNativeInvoker(h.ctx, {})(request, h.exec), { code: 'NATIVE_TOOL_UNAVAILABLE', definitelyNotStarted: true });
  h.ctx.tools.executable = () => ({}); h.ctx.tools.schemas = () => [{ name: 'subagent', parameters: { properties: {} } }];
  await assert.rejects(createNativeInvoker(h.ctx, {})(request, h.exec), { code: 'NATIVE_MODEL_SELECTION_DISABLED', definitelyNotStarted: true });
  await assert.rejects(createNativeInvoker(h.ctx, {})(request, {}), { code: 'HOST_EXECUTION_REQUIRED' });
});

test('native bridge rejects missing and ambiguous identity output contracts before prepare', async () => {
  const invalid = [
    undefined,
    { type:'object',required:['kind','subagentId'],properties:{kind:{type:'string',const:'activation'},subagentId:{type:'string'}} },
    { type: 'object', required: ['kind'], properties: { kind: { type: 'string', const: 'activation' }, name: { type: 'string' } } },
    { type: 'object', required: ['kind'], properties: { kind: { type: 'string', const: 'activation' }, subagentId: { type: 'string' } } },
    { type: 'object', required: ['kind', 'subagentId'], properties: { kind: { type: 'string', const: 'activation' }, subagentId: { type: 'number' } } },
    { type: 'object', required: ['kind', 'subagentId'], properties: { kind: { type: 'string', enum: ['activation', 'queued'] }, subagentId: { type: 'string' } } }
  ];
  for (const schema of invalid) {
    const h = makeHost(); h.nativeDefinition.output.schema = schema;
    const service = new RouterService(h.ctx, h.config); await service[init]();
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request, h.exec),
      { code: 'NATIVE_OUTPUT_CONTRACT_UNSUPPORTED', definitelyNotStarted: true });
    assert.deepEqual(h.ctx.stages, []);
    assert.deepEqual(service.runtime.journal.load().map(row => row.status), ['intent', 'rejected']);
    assert.equal(service.runtime.ledger.state(h.parent.id).paused, false);
    assert.equal(service.runtime.ledger.state(h.parent.id).active.size, 0);
  }
});

test('native bridge rechecks output identity and tool definition after awaited preparation', async () => {
  for (const replace of [true, false]) {
    const h = makeHost();
    h.ctx.beforePrepared = async () => {
      await Promise.resolve();
      if (replace) h.ctx.tools.executable = () => ({ ...h.nativeDefinition });
      else h.nativeDefinition.output.schema.required = ['kind'];
    };
    const service = new RouterService(h.ctx, h.config); await service[init]();
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request, h.exec),
      { code: replace ? 'NATIVE_TOOL_CHANGED' : 'NATIVE_OUTPUT_CONTRACT_UNSUPPORTED', definitelyNotStarted: true });
    assert.deepEqual(h.ctx.stages, ['prepare', 'complete']);
    assert.deepEqual(service.runtime.journal.load().map(row => row.status), ['intent', 'rejected']);
    assert.equal(service.runtime.ledger.state(h.parent.id).paused, false);
  }
});



test('native receipts bind the requested name to a verified Session id',async()=>{
  const h=makeHost();let closes=0;
  const observe=h.ctx.sessionQuery.observeSession.bind(h.ctx.sessionQuery);
  h.ctx.sessionQuery.observeSession=async(...args)=>{const source=await observe(...args);return {...source,[Symbol.dispose](){closes++;}};};
  h.ctx.subagents.resolveName=()=>assert.fail('name resolver permits id fallback and must not be used');
  const service=new RouterService(h.ctx,h.config);await service[init]();
  const value=await h.definitions.get('routed_subagent').definition.execute(request,h.exec);
  assert.match(value.name,/^router-[a-f0-9]{24}$/);assert.equal(value.name,h.ctx.lastInput.arguments.name);
  assert.notEqual(value.name,'child');assert.equal(value.childId,'child');assert.equal(Object.hasOwn(value,'subagentId'),false);
  assert.equal(service.runtime.journal.load().find(row=>row.status==='accepted').childId,'child');
  assert.deepEqual(h.ctx.stages,['prepare','dispatch','complete']);assert.equal(closes,3);
});

test('native receipt rejects substituted, absent, malformed, duplicate and preexisting catalog identities without replay',async()=>{
  for(const scenario of ['other-name','missing-name','lead','path','missing-row','duplicate','old-id','old-name','bad-id','self','cross-parent','wrong-header-id','wrong-origin','missing-child','missing-post-catalog']){
    const h=makeHost();
    if(scenario==='old-id')h.ctx.catalog.push({id:'child',name:'existing'});
    const original=h.ctx.nativeBody;
    h.ctx.nativeBody=async args=>{
      if(scenario==='old-name'){
        // The host snapshot before dispatch is detached; changing an old row cannot
        // manufacture an unused child Session id.
        h.ctx.catalog.push({id:'old',name:args.name});h.sessions.set('old',{id:'old',header:{origin:'subagent',parentSession:h.parent.id}});
        return {kind:'activation',name:args.name};
      }
      const value=await original(args);
      if(scenario==='other-name')value.name='another-child';
      if(scenario==='missing-name')delete value.name;
      if(scenario==='lead')value.name='lead';
      if(scenario==='path')value.name='branch/child';
      if(scenario==='missing-row')h.ctx.catalog=[];
      if(scenario==='duplicate')h.ctx.catalog.push({id:'another-id',name:args.name});
      if(scenario==='bad-id')h.ctx.catalog[0].id=' ';
      if(scenario==='self')h.ctx.catalog[0].id=h.parent.id;
      if(scenario==='cross-parent')h.sessions.get('child').header.parentSession='foreign';
      if(scenario==='wrong-header-id')h.sessions.get('child').header.id='not-child';
      if(scenario==='wrong-origin')h.sessions.get('child').header.origin='user';
      if(scenario==='missing-child')h.sessions.delete('child');
      if(scenario==='missing-post-catalog')h.ctx.sessionQuery.observeSession=async()=>({header:{id:h.parent.id},projections:{values:{}},[Symbol.dispose](){}});
      // An injected subagentId must never override the catalog identity.
      value.subagentId='forged';return value;
    };
    if(scenario==='old-name'){
      const observe=h.ctx.sessionQuery.observeSession.bind(h.ctx.sessionQuery);
      let read=0;
      h.ctx.sessionQuery.observeSession=async(...args)=>{const source=await observe(...args);if(args[0]===h.parent.id&&read++===0)source.projections.values.subagentCatalog=[{id:'old',name:'old-name'}];return source;};
    }
    const service=new RouterService(h.ctx,h.config);await service[init]();
    const tool=h.definitions.get('routed_subagent').definition;
    await assert.rejects(tool.execute(request,h.exec));
    assert.deepEqual(h.ctx.stages,['prepare','dispatch','complete'],scenario);
    const records=service.runtime.journal.load();assert.deepEqual(records.map(row=>row.status),['intent','unknown'],scenario);
    assert.equal(records.some(row=>row.childId==='forged'),false);assert.equal(service.runtime.ledger.state(h.parent.id).paused,true);
    await assert.rejects(tool.execute(request,h.exec));assert.deepEqual(h.ctx.stages,['prepare','dispatch','complete']);
  }
});

test('forged subagentId in a native value is ignored in favor of catalog and owned Session evidence',async()=>{
  const h=makeHost(),native=h.ctx.nativeBody;h.ctx.nativeBody=async args=>({...await native(args),subagentId:'forged-id',childId:'forged-too'});
  const service=new RouterService(h.ctx,h.config);await service[init]();
  const result=await h.definitions.get('routed_subagent').definition.execute(request,h.exec);
  assert.equal(result.childId,'child');assert.equal(Object.hasOwn(result,'subagentId'),false);
  assert.equal(service.runtime.journal.load().at(-1).childId,'child');
});

test('missing host identity observation, parent catalog and admitted name refuse before preparation',async()=>{
  for(const scenario of ['observer','catalog','parent-id','name-parameter']){
    const h=makeHost();
    if(scenario==='catalog')h.ctx.sessionQuery.observeSession=async()=>({header:{id:h.parent.id},[Symbol.dispose](){}});
    if(scenario==='parent-id')h.ctx.sessionQuery.observeSession=async()=>({header:{id:'foreign'},projections:{values:{subagentCatalog:[]}},[Symbol.dispose](){}});
    if(scenario==='name-parameter')h.ctx.tools.schemas=()=>[{name:'subagent',parameters:{properties:{provider:{},model:{},reasoning_effort:{}}}}];
    const service=new RouterService(h.ctx,h.config);await service[init]();
    if(scenario==='observer')delete h.ctx.sessionQuery; // Also fence disappearance after startup.
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),{code:'NATIVE_IDENTITY_UNAVAILABLE',definitelyNotStarted:true});
    assert.deepEqual(h.ctx.stages,[]);assert.deepEqual(service.runtime.journal.load().map(row=>row.status),['intent','rejected']);
  }
});

test('native preparation cannot replace the generated child name and still completes denial',async()=>{
  const h=makeHost();h.ctx.beforePrepared=async input=>{input.arguments.name='replaced-name';};
  const service=new RouterService(h.ctx,h.config);await service[init]();
  await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),{code:'NATIVE_TOOL_CHANGED',definitelyNotStarted:true});
  assert.deepEqual(h.ctx.stages,['prepare','complete']);assert.deepEqual(service.runtime.journal.load().map(row=>row.status),['intent','rejected']);
});

test('native preparation cannot replace the selected provider, model or effort',async()=>{
  for(const key of ['provider','model','reasoning_effort']){
    const h=makeHost();h.ctx.beforePrepared=async input=>{input.arguments[key]='substituted';};
    const service=new RouterService(h.ctx,h.config);await service[init]();
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),{code:'NATIVE_ROUTE_CHANGED',definitelyNotStarted:true});
    assert.deepEqual(h.ctx.stages,['prepare','complete']);assert.equal(h.ctx.catalog.length,0);
    assert.equal(service.runtime.journal.load().at(-1).status,'rejected');assert.equal(service.runtime.ledger.state(h.parent.id).paused,false);
  }
});

test('parallel starts use distinct bound names and audit only their own real Session identities',async()=>{
  const h=makeHost();let number=0;h.config.ui.limits={maxActivePerModel:4};
  h.ctx.nativeBody=async args=>{const id='parallel-'+ ++number;h.ctx.catalog.push({id,name:args.name});h.sessions.set(id,{id,header:{origin:'subagent',parentSession:h.parent.id}});await Promise.resolve();return {kind:'activation',name:args.name};};
  const service=new RouterService(h.ctx,h.config);await service[init]();const tool=h.definitions.get('routed_subagent').definition;
  const values=await Promise.all([tool.execute(request,{...h.exec,callId:'one'}),tool.execute(request,{...h.exec,callId:'two'})]);
  assert.equal(new Set(values.map(value=>value.name)).size,2);assert.deepEqual(values.map(value=>value.childId).sort(),['parallel-1','parallel-2']);
  assert.deepEqual(service.runtime.journal.load().filter(row=>row.status==='accepted').map(row=>row.childId).sort(),['parallel-1','parallel-2']);
});

test('native bridge accepts a normalized single-value enum activation contract', async () => {
  const h = makeHost(); h.nativeDefinition.output.schema.properties.kind = { type: 'string', enum: ['activation'] };
  const service = new RouterService(h.ctx, h.config); await service[init]();
  assert.equal((await h.definitions.get('routed_subagent').definition.execute(request, h.exec)).childId, 'child');
  assert.deepEqual(h.ctx.stages, ['prepare', 'dispatch', 'complete']);
});

test('guard denial still completes and proves no dispatch; post-dispatch errors stay uncertain', async () => {
  for (const dispatched of [false, true]) {
    const h = makeHost(); const stages = [];
    const result = { isError: true, error: { message: 'denied' }, content: [] };
    const pipeline = {
      async prepare(exec) { stages.push('prepare'); return { kind: dispatched ? 'dispatch' : 'post-result', exec, result }; },
      async dispatch() { stages.push('dispatch'); return { kind: 'post-result', result }; },
      async complete(exec, outcome) { stages.push('complete'); return outcome.result; }
    };
    await assert.rejects(createNativeInvoker(h.ctx, pipeline)(request, h.exec), error => {
      assert.equal(error.definitelyNotStarted, dispatched ? undefined : true); return true;
    });
    assert.deepEqual(stages, dispatched ? ['prepare', 'dispatch', 'complete'] : ['prepare', 'complete']);
  }
});

test('disabled plugin hides delegation tools and opens no journal; status remains read-only', async () => {
  const h = makeHost();
  const disabled = new RouterService(h.ctx, { ui: { schemaVersion:3, enabled:false, candidates:[] } }); await disabled[init]();
  assert.equal(h.definitions.size, 4);
  assert.equal(h.definitions.get('routed_subagent').options.when({agent:h.parent}),false);
  assert.equal(h.definitions.get('router_status').options.when({agent:h.parent}),true);
  assert.equal(disabled.runtime,undefined);
  for(const dispose of h.effects)dispose();
  assert.throws(() => new RouterService(h.ctx, { ui: h.config.ui }), { code: 'AUDIT_PATH' });
  assert.throws(() => new RouterService(h.ctx, { ...h.config, auditFile: 'relative.jsonl' }), { code: 'AUDIT_PATH' });
});

test('unsupported configuration shapes reject before initialization',async()=>{
  for(const configuration of [
    {policy:{schemaVersion:3,enabled:false,candidates:[]}},
    {ui:{schemaVersion:1,enabled:false}},
    {ui:{schemaVersion:0,enabled:false}},
    {ui:{schemaVersion:3,enabled:false,candidates:[],teams:{enabled:false}}}
  ]){
    const h=makeHost(),before=structuredClone(configuration);
    assert.throws(()=>new RouterService(h.ctx,configuration),{code:'INVALID_CONFIG'});
    assert.deepEqual(configuration,before);assert.deepEqual(h.ctx.stages,[]);
    await assert.rejects(access(h.config.auditFile),{code:'ENOENT'});
  }
});

test('plugin registration is root-only, preserves deep-frozen parent, and uses native canonical outcome', async () => {
  const h = makeHost(); const service = new RouterService(h.ctx, h.config); await service[init]();
  assert.equal(h.services.get('delegationRouter'), service);
  assert.deepEqual([...h.definitions.keys()], ['router_status', 'router_reconcile', 'delegation_routes', 'routed_subagent']);
  const registration = h.definitions.get('routed_subagent');
  assert.equal(registration.options.when({ agent: h.parent }), true);
  const child = { id: 'child', session: { header: { parentSession: h.parent.id, origin: 'subagent' } } };
  assert.equal(registration.options.when({ agent: child }), false);
  assert.throws(() => registration.definition.execute(request, { ...h.exec, agent: child }), { code: 'HOST_EXECUTION_REQUIRED' });
  const before = JSON.stringify(h.parent.options);
  const value = await registration.definition.execute(request, h.exec);
  assert.equal(value.childId, 'child'); assert.equal(value.selected.effort, 'low');
  assert.equal(value.parentRouteUnchanged,true);
  assert.deepEqual(value.parentRouteBefore,{provider:'p',model:'m',effort:null});
  assert.deepEqual(value.parentRouteAfter,value.parentRouteBefore);
  assert.equal(JSON.stringify(h.parent.options), before);
  assert.deepEqual(h.ctx.stages, ['prepare', 'dispatch', 'complete']);
  assert.equal(h.ctx.lastInput.arguments.reasoning_effort, 'low');
  assert.deepEqual(registration.definition.output.render(request, value), [{ type: 'text', text: JSON.stringify(value) }]);
  assert.ok(h.ctx.projection.key === 'delegationRouterAuthorization');
  for (const dispose of h.effects) dispose();
});

test('structured UI configuration mounts the same guarded router and preserves parent options', async () => {
  const h=makeHost();
  const service=new RouterService(h.ctx,{ui:{schemaVersion:3,enabled:true,candidates:h.config.ui.candidates,defaultCandidateId:'primary'},auditFile:h.config.auditFile});
  await service[init]();
  assert.equal(service.policy.enabled,true);
  assert.equal(service.policy.defaultCandidateId,'primary');
  const status=await h.definitions.get('router_status').definition.execute({},h.exec);
  assert.deepEqual(status.parentRoute,{provider:'p',model:'m',effort:null});
  assert.equal(Object.hasOwn(status,'teamRoutingAvailable'),false);
  assert.deepEqual(h.ctx.stages,[]);
  for(const dispose of h.effects)dispose();
});

test('volatile UI values remain editable while disabled and use pre-save validation before committing',async()=>{
 const h=makeHost();h.ctx.fiber={};
 let ui={schemaVersion:3,enabled:false,candidates:h.config.ui.candidates,defaultCandidateId:'primary'};
 const ref={__volatile:true,get:()=>ui};
 const service=new RouterService(h.ctx,{ui:ref,auditFile:h.config.auditFile});await service[init]();
 assert.equal(service.runtime,undefined);
 const edit=next=>{const value=h.handlers.get('internal/config')(h.ctx.fiber,()=>({ui:next,auditFile:h.config.auditFile}));ui=value.ui;};
 assert.throws(()=>edit({schemaVersion:3,enabled:true,candidates:[]}),{code:'INVALID_CONFIG'});
 assert.equal(ui.enabled,false);assert.equal(service.runtime,undefined);
 edit({...ui,enabled:true});
 assert.equal(h.definitions.get('routed_subagent').options.when({agent:h.parent}),true);
 const result=await h.definitions.get('routed_subagent').definition.execute(request,h.exec);
 assert.equal(result.selected.model,'m');
 assert.throws(()=>edit({...ui,defaultCandidateId:'primary',limits:{maxPendingStarts:1}}),{code:'CONFIG_BUSY'});
 assert.equal(ui.limits,undefined);
 edit({...ui,enabled:false});
 assert.equal(h.definitions.get('routed_subagent').options.when({agent:h.parent}),false);
 await h.handlers.get('subagent/end')({id:'child',runId:'epoch',local:true});
 edit({...ui,enabled:true,limits:{maxPendingStarts:1}});
 assert.equal(h.definitions.get('delegation_routes').options.when({agent:h.parent}),true);
 for(const dispose of h.effects)dispose();
});

test('default audit journal is profile-local and is not acquired merely by showing the UI',async()=>{
 const h=makeHost();h.services.set('profileContext',{dir:directory});
 const service=new RouterService(h.ctx,{ui:{schemaVersion:3,enabled:false,candidates:[]}});await service[init]();
 assert.equal(service.auditFile,path.join(directory,'delegation-router','audit.jsonl'));
 assert.equal(service.runtime,undefined);
 for(const dispose of h.effects)dispose();
});

test('router status reads owned live child request headers without fallback or cross-parent disclosure',async()=>{
 const h=makeHost();const service=new RouterService(h.ctx,h.config);await service[init]();
 const sessions=new Map([
  ['owned',{id:'owned',header:{origin:'subagent',parentSession:h.parent.id},requestHeader:()=>({config:{provider:'actual',model:'actual-model',reasoningEffort:'high',apiKey:'hidden'}})}],
  ['pending',{id:'pending',header:{origin:'subagent',parentSession:h.parent.id},requestHeader:()=>undefined}],
  ['other',{id:'other',header:{origin:'subagent',parentSession:'foreign'},requestHeader:()=>{throw Error('must not read')}}],
  ['wrong-id',{id:'different',header:{origin:'subagent',parentSession:h.parent.id},requestHeader:()=>{throw Error('must not read')}}]
 ]);
 h.services.set('sessions',{get:id=>sessions.get(id)});
 const status=args=>h.definitions.get('router_status').definition.execute(args,h.exec);
 assert.deepEqual((await status({child_id:'owned'})).observedChildRequestRoute,{provider:'actual',model:'actual-model',effort:'high'});
 assert.equal((await status({child_id:'pending'})).observedChildRequestRoute,null);
 for(const child_id of ['other','missing','wrong-id'])await assert.rejects(status({child_id}),{code:'CHILD_SCOPE'});
 assert.deepEqual(h.ctx.stages,[]);
 for(const dispose of h.effects)dispose();
});

test('discovery reads one current snapshot and returns detached authorized rows with zero preparation effects',async()=>{
  const h=makeHost({extraModels:[{...model,id:'forbidden',provider:'other',model:'other'}]});
  h.config.ui.enabled=false;const service=new RouterService(h.ctx,h.config);await service[init]();h.config.ui.enabled=true;
  h.ctx.llm.resolveModelInfo=()=>assert.fail('discovery must not resolve metadata');h.ctx.llm.resolveCallConfig=()=>assert.fail('discovery must not preflight');
  service.manager.createJournal=()=>assert.fail('discovery must not open a journal');service.manager.ensure=()=>assert.fail('discovery must not acquire a runtime');
  const configuration=service.configuration.bind(service);let reads=0;service.configuration=()=>{reads++;return configuration();};
  const registration=h.definitions.get('delegation_routes'),list=()=>registration.definition.execute({},h.exec);
  assert.deepEqual(registration.definition.parameters.properties,{});
  const value=await list();assert.equal(reads,1);assert.equal(value.defaultCandidateId,'primary');
  assert.deepEqual(value.candidates,[model]);assert.match(value.eligibility,/No model has been preflighted/);
  for(const key of ['selected','candidateId','routingReason','evidenceStage','catalog'])assert.equal(Object.hasOwn(value,key),false);
  assert.throws(()=>{value.candidates[0].name='changed';},TypeError);value.candidates.push({id:'fake'});
  assert.deepEqual((await list()).candidates,[model]);assert.equal(h.config.ui.candidates[0].name,'Fast');
  assert.equal(service.runtime,undefined);assert.equal(service.manager.journal,undefined);assert.equal(service.manager.inFlight,0);assert.equal(service.manager.calls.size,0);assert.equal(service.manager.latest.size,0);
  assert.equal(h.ctx.metadataLookups,0);assert.deepEqual(h.ctx.preflights,[]);assert.deepEqual(h.ctx.stages,[]);
  await assert.rejects(access(h.config.auditFile+'.lock'),{code:'ENOENT'});
});

test('unavailable catalog and unsupported default effort do not prevent listing but still refuse creation',async()=>{
  for(const unavailable of [false,true]){
    const h=makeHost();h.config.ui.candidates=[{...model,effort:'unsupported'}];
    const service=new RouterService(h.ctx,h.config);await service[init]();
    if(unavailable)h.ctx.llm.resolveModelInfo=async()=>undefined;
    const value=await h.definitions.get('delegation_routes').definition.execute({},h.exec);
    assert.equal(value.candidates[0].effort,'unsupported');assert.equal(value.defaultCandidateId,'primary');assert.equal(h.ctx.metadataLookups,0);
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute({...request,policy_revision:value.policy_revision},h.exec),{code:'NO_ROUTE'});
    assert.deepEqual(h.ctx.stages,[]);assert.deepEqual(h.ctx.preflights,[]);assert.deepEqual(service.runtime.journal.load(),[]);
  }
});

test('cold discovery revision is the creation revision and stale listing cannot create a child',async()=>{
  const h=makeHost();h.config.ui.enabled=false;const service=new RouterService(h.ctx,h.config);await service[init]();h.config.ui.enabled=true;
  const list=()=>h.definitions.get('delegation_routes').definition.execute({},h.exec);
  const first=await list();assert.equal(service.runtime,undefined);assert.equal(first.policy_revision,service.manager.status().configuredRevision);
  h.config.ui.candidates=[{...model,name:'Updated'}];const latest=await list();assert.notEqual(latest.policy_revision,first.policy_revision);assert.equal(service.runtime,undefined);
  await assert.rejects(h.definitions.get('routed_subagent').definition.execute({...request,policy_revision:first.policy_revision},h.exec),{code:'STALE_POLICY'});
  assert.equal(service.runtime.revision,latest.policy_revision);assert.equal(h.ctx.metadataLookups,0);assert.deepEqual(h.ctx.stages,[]);
  const result=await h.definitions.get('routed_subagent').definition.execute({...request,policy_revision:latest.policy_revision},{...h.exec,callId:'fresh'});
  assert.equal(result.selected.model,'m');assert.equal(h.ctx.metadataLookups,1);assert.equal(h.ctx.preflights.length,1);
});

test('subagent/end event bridges exact parent and child identity before native receipt', async () => {
  const h = makeHost(); const service = new RouterService(h.ctx, h.config); await service[init]();
  const observe = h.ctx.sessionQuery.observeSession.bind(h.ctx.sessionQuery);
  h.ctx.sessionQuery.observeSession = async (id, options) => id === 'early-child' && !h.sessions.has(id) ? {source:'prepared',header:{id,origin:'subagent',parentSession:h.parent.id},[Symbol.dispose](){}} : observe(id,options);
  h.ctx.nativeBody = async args => {
    h.ctx.catalog.push({id:'early-child',name:args.name});
    h.sessions.set('early-child',{id:'early-child',header:{id:'early-child',origin:'subagent',parentSession:h.parent.id}});
    h.handlers.get('subagent/start')({id:'early-child',runId:'early',local:true});
    h.sessions.delete('early-child');
    await h.handlers.get('subagent/end')({id:'early-child',runId:'early',local:true});
    return {kind:'activation',name:args.name};
  };
  const value = await h.definitions.get('routed_subagent').definition.execute(request, h.exec);
  assert.equal(value.childId, 'early-child');
  assert.deepEqual(service.runtime.journal.load().map(record => record.status), ['intent', 'accepted', 'settled']);
});

test('default native logging does not append private events or prompts into host Session', async () => {
  const h = makeHost(); const service = new RouterService(h.ctx, h.config); await service[init]();
  await h.definitions.get('routed_subagent').definition.execute(request, h.exec);
  assert.deepEqual(h.events, []);
});

test('incompatible core host leaves no tools, RPCs, or audit effects', async () => {
  for (const capability of ['sessionQuery', 'sessionProjections', 'tools', 'llm']) {
    const h = makeHost();
    h.services.set('typert', { register() { assert.fail('Do not mount RPCs on an inactive core'); } });
    delete h.ctx[capability];
    const before = structuredClone(h.config);
    const service = new RouterService(h.ctx, h.config);
    await assert.rejects(service[init](), { code: 'HOST_INCOMPATIBLE' });
    assert.equal(h.definitions.size, 0);
    assert.equal(h.handlers.size, 0);
    assert.deepEqual(h.config, before);
    await assert.rejects(access(h.config.auditFile + '.lock'), { code: 'ENOENT' });
    assert.equal(service.runtime, undefined);
  }
});

test('incompatible settings registry warns without disabling routing', async () => {
  const h = makeHost();
  h.ctx.logger.warn = message => h.events.push(message);
  h.services.set('typert', {});
  const service = new RouterService(h.ctx, h.config);
  await service[init]();
  assert.match(h.events[0], /SETTINGS_RPC_UNAVAILABLE/);
  assert.equal(service.draftService, undefined);
  assert.equal((await h.definitions.get('routed_subagent').definition.execute(request, h.exec)).childId, 'child');
});

test('runtime recovery failure closes journal ownership before initialization rejects', async () => {
  const h = makeHost();
  await writeFile(h.config.auditFile, JSON.stringify({ status: 'invalid' }) + '\n');
  const service = new RouterService(h.ctx, h.config);
  await assert.rejects(service[init](), { code: 'AUDIT_CORRUPT' });
  await assert.rejects(access(h.config.auditFile + '.lock'), { code: 'ENOENT' });
});

test('lifecycle settlement errors pause parent routing and never escape host event emitter', async () => {
  const h = makeHost(); const service = new RouterService(h.ctx, h.config); await service[init]();
  service.runtime.settle = () => { throw new Error('audit disk failure'); };
  await assert.doesNotReject(h.handlers.get('subagent/end')({ id: 'child',runId:'e',local:true }));
  assert.equal(service.runtime.ledger.state(h.parent.id).paused, true);
  assert.equal(h.events[0].type, 'logger/error');
  h.ctx.logger.error = () => { throw Error('logger failure'); };
  await assert.doesNotReject(h.handlers.get('subagent/end')({ id: 'child',runId:'e',local:true }));
});

test('status cards distinguish acceptance, observed request, and end even after disabling routing',async()=>{
  const h=makeHost();const service=new RouterService(h.ctx,h.config);await service[init]();
  const status=args=>h.definitions.get('router_status').definition.execute(args??{},h.exec);
  assert.deepEqual((await status()).decisions,[]);
  await h.definitions.get('routed_subagent').definition.execute({...request,candidate_id:'primary'},h.exec);
  let card=(await status({limit:1})).decisions[0];assert.equal(card.status,'accepted');assert.equal(card.accepted,true);assert.equal(card.observed,null);assert.equal(card.settled,false);
  h.sessions.get('child').requestHeader=()=>({config:{provider:'p',model:'m',reasoningEffort:'low',apiKey:'DO_NOT_EXPOSE'}});
  card=(await status()).decisions[0];assert.equal(card.status,'observed');assert.deepEqual(card.observed,{provider:'p',model:'m',effort:'low'});
  h.config.ui.enabled=false;await h.handlers.get('subagent/end')({id:'child',runId:'epoch',local:true});await h.handlers.get('subagent/end')({id:'child',runId:'epoch',local:true});
  card=(await status()).decisions[0];assert.equal(card.status,'settled');assert.equal(card.settled,true);
  const records=service.runtime.journal.load();assert.equal(records.filter(row=>row.status==='settled').length,1);
  assert.doesNotMatch(JSON.stringify(await status()),/DO_NOT_EXPOSE|Independent useful work|Do useful work/);
  for(const limit of [0,101,1.2,'1'])await assert.rejects(status({limit}),{code:'INVALID_REQUEST'});
});

test('discovery rejects unexpected arguments, nonlive roots and cancellation without preparing a route',async()=>{
  const h=makeHost(),service=new RouterService(h.ctx,h.config);await service[init]();
  const definition=h.definitions.get('delegation_routes').definition;
  let invoked=0;const getter=Object.defineProperty({},'prompt',{enumerable:true,get(){invoked++;return 'unsafe';}});
  for(const args of [{candidate_id:'primary'},{prompt:'task'},{description:'task'},{selection_reason:'old'},{policy_revision:'old'},{lane:'review'},getter,[],null,Object.create({}),{[Symbol('s')]:1}])await assert.rejects(definition.execute(args,h.exec),{code:'INVALID_REQUEST'});
  assert.equal(invoked,0);
  await assert.rejects(definition.execute({},{...h.exec,agent:{...h.parent}}),{code:'HOST_EXECUTION_REQUIRED'});
  for(const header of [{origin:'subagent'},{origin:'interactive',parentSession:'ancestor'}]){
    const root={...h.parent,session:{...h.parent.session,header}};h.ctx.agents.get=()=>root;
    await assert.rejects(definition.execute({},{...h.exec,agent:root}),{code:'ROOT_ONLY'});
  }
  h.ctx.agents.get=()=>h.parent;
  const abort=new AbortController();abort.abort();await assert.rejects(definition.execute({},{...h.exec,signal:abort.signal}),{code:'CANCELLED'});
  assert.equal(h.ctx.metadataLookups,0);assert.deepEqual(h.ctx.preflights,[]);assert.deepEqual(h.ctx.stages,[]);assert.deepEqual(service.runtime.journal.load(),[]);
});

test('discovery rechecks cancellation and live root identity after synchronous authorization reads',async()=>{
  for(const action of ['cancel','replace']){
    const h=makeHost(),controller=new AbortController();h.exec.signal=controller.signal;
    h.ctx.sessionProjections.register=async()=>({stateOf:()=>{if(action==='cancel')controller.abort();else h.ctx.agents.get=()=>undefined;return null;}});
    const service=new RouterService(h.ctx,h.config);await service[init]();
    await assert.rejects(h.definitions.get('delegation_routes').definition.execute({},h.exec),{code:action==='cancel'?'CANCELLED':'HOST_EXECUTION_REQUIRED'});
    assert.equal(h.ctx.metadataLookups,0);assert.deepEqual(h.ctx.preflights,[]);assert.deepEqual(h.ctx.stages,[]);
  }
});

test('discovery lists only authorized rows even when configured default is unauthorized and fails closed without authority',async()=>{
  const h=makeHost({authorized:[{provider:'q',model:'n'}],extraModels:[{...model,id:'allowed',provider:'q',model:'n'}]});
  const service=new RouterService(h.ctx,h.config);await service[init]();
  const value=await h.definitions.get('delegation_routes').definition.execute({},h.exec);
  assert.equal(value.defaultCandidateId,'primary');assert.deepEqual(value.candidates.map(row=>row.id),['allowed']);assert.equal(h.ctx.metadataLookups,0);
  const missing=makeHost();missing.ctx.sessionProjections.register=async()=>({stateOf:()=>undefined});
  const other=new RouterService(missing.ctx,missing.config);await other[init]();
  await assert.rejects(missing.definitions.get('delegation_routes').definition.execute({},missing.exec),{code:'AUTHORIZATION_UNAVAILABLE'});
});

test('plugin mounts optional bounded root guidance without acquiring runtime on disabled configuration',async()=>{
  const h=makeHost(),sections=[];let removed=0;
  h.services.set('systemPrompt',{section:value=>{sections.push(value);return ()=>removed++;}});
  h.config.ui.enabled=false;
  const service=new RouterService(h.ctx,h.config);await service[init]();
  assert.equal(sections.length,1);assert.equal(sections[0].text({agent:h.parent}),'');assert.equal(service.runtime,undefined);
  const status=await h.definitions.get('router_status').definition.execute({},h.exec);assert.deepEqual(status.decisions,[]);assert.equal(service.manager.journal,undefined);
  h.config.ui.enabled=true;assert.match(sections[0].text({agent:h.parent}),/DELEGATION_ROUTER/);assert.equal(service.runtime,undefined);
  assert.equal(sections[0].text({agent:{...h.parent}}),'');h.config.ui.enabled=false;assert.equal(sections[0].text({agent:h.parent}),'');
  for(const dispose of h.effects)dispose();assert.equal(removed,1);
});

test('native prepare await rechecks authorization before dispatch and records rejected not unknown',async()=>{
 const h=makeHost();const service=new RouterService(h.ctx,h.config);await service[init]();
 const original=service.runtime.readAuthorization;let revoked=false;service.runtime.readAuthorization=parent=>revoked?[]:original(parent);
 h.ctx.beforePrepared=async()=>{await Promise.resolve();revoked=true;};
 await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),error=>error.definitelyNotStarted===true);
 assert.deepEqual(h.ctx.stages,['prepare','complete']);assert.deepEqual(service.runtime.journal.load().map(row=>row.status),['intent','rejected']);assert.equal(service.runtime.ledger.state(h.parent.id).paused,false);
});

test('disable or cancellation while native prepare awaits cannot dispatch and still completes',async()=>{
  for(const action of ['disable','cancel']){
    const h=makeHost();const service=new RouterService(h.ctx,h.config);await service[init]();
    const controller=new AbortController();h.exec.signal=controller.signal;
    h.ctx.beforePrepared=async()=>{await Promise.resolve();if(action==='disable')h.config.ui.enabled=false;else controller.abort();};
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),error=>error.definitelyNotStarted===true);
    assert.deepEqual(h.ctx.stages,['prepare','complete']);assert.deepEqual(service.runtime.journal.load().map(row=>row.status),['intent','rejected']);
  }
});

test('fence rejection preserves primary cause and rejected audit despite cleanup or postprocessing failures',async()=>{
  for(const stage of ['complete','defer','conclude','log']){
    const h=makeHost();const service=new RouterService(h.ctx,h.config);await service[init]();
    h.ctx.beforePrepared=async()=>{await Promise.resolve();h.config.ui.enabled=false;};
    const fail=()=>{throw Error(stage+' failed');};
    if(stage==='complete')h.ctx.completeHook=fail;
    if(stage==='defer'){h.ctx.mapResult=result=>({...result,additionalContexts:[{}]});h.exec.deferContext=fail;}
    if(stage==='conclude'){h.ctx.mapResult=result=>({...result,concludesTurn:true});h.exec.concludeTurn=fail;}
    if(stage==='log'){
      const {ToolExecutionPipeline}=await import('@deepseek-ai/dsh-tools/pipeline');
      service.runtime.invokeNative=createNativeInvoker(h.ctx,new ToolExecutionPipeline(h.ctx),fail);
    }
    await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),error=>{
      assert.equal(error.code,'STALE_CONFIG');assert.equal(error.definitelyNotStarted,true);
      assert.equal(stage==='complete'?error.completionFailed:error.postProcessingFailed,true);return true;
    });
    assert.deepEqual(h.ctx.stages,['prepare','complete']);assert.deepEqual(service.runtime.journal.load().map(row=>row.status),['intent','rejected']);assert.equal(service.runtime.ledger.state(h.parent.id).paused,false);
  }
});

test('ordinary guard denial plus postprocessing error still proves no dispatch',async()=>{
  const h=makeHost();const service=new RouterService(h.ctx,h.config);await service[init]();h.ctx.denied=true;
  h.ctx.mapResult=result=>({...result,additionalContexts:[{}]});h.exec.deferContext=()=>{throw Error('context failed');};
  await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),error=>error.definitelyNotStarted===true);
  assert.deepEqual(h.ctx.stages,['prepare','complete']);assert.deepEqual(service.runtime.journal.load().map(row=>row.status),['intent','rejected']);
});

test('bridge rejects asynchronous admission hook instead of silently dispatching',async()=>{
  const h=makeHost(),steps=[];
  const pipeline={async prepare(input){steps.push('prepare');return {kind:'dispatch',exec:input};},async dispatch(){steps.push('dispatch');throw Error('must not dispatch');},async complete(_exec,outcome){steps.push('complete');return outcome.result;}};
  await assert.rejects(createNativeInvoker(h.ctx,pipeline)(request,h.exec,async()=>{throw Error('late denial');}),{code:'INVALID_ADMISSION_HOOK',definitelyNotStarted:true});
  assert.deepEqual(steps,['prepare','complete']);
});

test('null candidate cannot silently inherit parent effort on the same native route',async()=>{
 for(const when of ['initial','after-prepare']){
  const h=makeHost();h.config.ui.candidates=h.config.ui.candidates.map(p=>({...p,effort:null}));
  h.ctx.llm.resolveModelInfo=async()=>({inputModalities:['text'],contextWindow:200000});
  const inherited=()=>({config:{provider:'p',model:'m',reasoningEffort:'high'}});
  if(when==='initial')h.parent.session.requestHeader=inherited;
  else h.ctx.beforePrepared=async()=>{h.parent.session.requestHeader=inherited;};
  const service=new RouterService(h.ctx,h.config);await service[init]();
  await assert.rejects(h.definitions.get('routed_subagent').definition.execute(request,h.exec),{code:'NULL_EFFORT_INHERITANCE'});
  assert.equal(h.ctx.stages.includes('dispatch'),false);
  assert.deepEqual(service.runtime.journal.load().map(row=>row.status),when==='initial'?[]:['intent','rejected']);
 }
});
