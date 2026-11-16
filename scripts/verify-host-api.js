/** Actual host libraries; detached fake services only. Never installs or delegates. */
import {createRequire,registerHooks,syncBuiltinESMExports} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.argv[2])throw Error('Pass the matching DSH runtime package.json path; use the Desktop Electron executable in Node mode for ASAR hosts.');
const hostRequire=createRequire(resolve(process.argv[2]));
// Process-local fail-closed boundary, installed before importing host libraries.
// No credentials, profile, live LLM, or Agent creation/loading service is connected.
const sideEffects={networkAttempts:0,processAttempts:0};
const restores=[];
function block(object,key,counter){
 const original=object[key];
 object[key]=()=>{sideEffects[counter]++;throw Error('Forbidden detached preflight side effect: '+key);};
 restores.push(()=>{object[key]=original;});
}
block(globalThis,'fetch','networkAttempts');
for(const mod of [http,https])for(const key of ['request','get'])block(mod,key,'networkAttempts');
for(const key of ['connect','createConnection'])block(net,key,'networkAttempts');
block(net.Socket.prototype,'connect','networkAttempts');block(tls,'connect','networkAttempts');
block(dgram.Socket.prototype,'send','networkAttempts');
for(const key of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork'])block(childProcess,key,'processAttempts');
syncBuiltinESMExports();

const source=new URL('../src/',import.meta.url).href;
const hook=registerHooks({resolve(specifier,context,next){
 if(context.parentURL?.startsWith(source)&&(specifier.startsWith('@deepseek-ai/')||specifier==='zod'))return next(pathToFileURL(hostRequire.resolve(specifier)).href,context);
 return next(specifier,context);
}});
const tmp=await mkdtemp(join(root,'.host-api-check-'));
const cleanup=[];
try {
 const {default:Router}=await import('../src/plugin.js');
 const {RouterConfig,compilePluginConfig}=await import('../src/ui-config.js');
 const {Service}=await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/cordis')).href);
 const {createVolatile,isVolatile}=await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/cosmokit')).href);
 assert.equal(RouterConfig.dict.ui.meta.volatile,true);
 assert.equal(RouterConfig.dict.policy,undefined,'single ui entry; the policy alias stays removed');
 const unwrap=config=>Object.fromEntries(Object.entries(config).map(([k,v])=>[k,isVolatile(v)?v.get():v]));
 const base=JSON.parse(await readFile(join(root,'examples/candidates.json'),'utf8'));
 const emptyEntry=compilePluginConfig(unwrap(RouterConfig({})));
 assert.equal(emptyEntry.policy.schemaVersion,3);assert.equal(emptyEntry.policy.enabled,false);assert.deepEqual(emptyEntry.policy.candidates,[]);
 const parent=Object.freeze({id:'detached-root',options:Object.freeze({provider:'unchanged-parent',model:'unchanged-model'}),session:{header:{origin:'user'},requestHeader:()=>({config:{provider:'unchanged-parent',model:'unchanged-model',reasoningEffort:'high'}})}});
 const {createLifecycleEmitter}=await import(new URL('./types/lifecycle.js',pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-subagent'))).href);
 const results=[];
 {
  const compiled=compilePluginConfig(unwrap(RouterConfig({...base,ui:{...base.ui,enabled:true},auditFile:join(tmp,'ordinary.jsonl')})));
  const registered=[];const handlers=new Map();const fiber={};
  const childSession={id:'detached-child',header:{id:'detached-child',origin:'subagent',parentSession:parent.id},requestHeader:()=>undefined};
  const ctx={sessionProjections:{register:async()=>({stateOf:()=>compiled.policy.candidates.map(({provider,model})=>({provider,model}))})},tools:{register:tool=>registered.push(tool),executable:()=>undefined},agents:{get:id=>id===parent.id?parent:undefined},llm:{},get:name=>name==='sessions'?{get:id=>id===childSession.id?childSession:undefined}:undefined,fiber,on:(name,fn)=>handlers.set(name,fn),effect:fn=>cleanup.push(fn()),logger:{error(){}}};
  const instance=Object.create(Router.prototype);
  Object.defineProperties(instance,{ctx:{value:ctx},policy:{value:compiled.policy},auditFile:{value:compiled.auditFile},configSource:{value:{ui:createVolatile({...base.ui,enabled:true}),auditFile:compiled.auditFile}}});
  await instance[Service.init]();
  const status=await registered.find(t=>t.name==='router_status').execute({}, {agent:parent});
  assert.deepEqual(status.parentRoute,{provider:'unchanged-parent',model:'unchanged-model',effort:'high'});
  assert.deepEqual(registered.map(t=>t.name),['router_status','router_reconcile','delegation_routes','routed_subagent']);
  assert.throws(()=>handlers.get('internal/config')(fiber,()=>({ui:{schemaVersion:3,enabled:true,candidates:[]},auditFile:compiled.auditFile})),{code:'INVALID_CONFIG'});
  assert.equal(instance.configuration().policy.enabled,true);
  instance.manager.inFlight++;
  assert.throws(()=>handlers.get('internal/config')(fiber,()=>({...base,ui:{...base.ui,enabled:true,limits:{maxPendingStarts:1}},auditFile:compiled.auditFile})),{code:'CONFIG_BUSY'});
  instance.manager.inFlight--;
  const settled=[];const originalSettle=instance.manager.settle;
  instance.manager.settle=(pid,id)=>settled.push([pid,id]);
  // Detached lifecycle event fixture; no manager activation or real child is created.
  const info=Object.freeze({runId:'detached-api-run',provider:'local',parentSessionId:parent.id,id:childSession.id,local:true});
  const carrier={agent:parent};const dispatched=[],pending=[],warnings=[];
  assert.equal(typeof createLifecycleEmitter,'function','Host must expose createLifecycleEmitter; no version skip');
  const emit=createLifecycleEmitter({events:{dispatch:(mode,args)=>{
   assert.equal(mode,'emit');assert.equal(args[0],carrier);assert.equal(args.length,3);
   dispatched.push({name:args[1],info:args[2]});
   const handler=handlers.get(args[1]);assert.equal(typeof handler,'function');
   return [(...values)=>{assert.equal(values.length,1);assert.equal(values[0],args[2]);const result=handler(...values);pending.push(Promise.resolve(result));return result;}];
  }},logger:{warn:message=>warnings.push(message)}},root=>{assert.equal(root,parent);return carrier;});
  emit('subagent/start',info,parent);
  emit('subagent/end',Object.freeze({...info,stopReason:'completed'}),parent);
  await Promise.all(pending);
  assert.deepEqual(warnings,[]);
  assert.deepEqual(dispatched,[{name:'subagent/start',info},{name:'subagent/end',info:{...info,stopReason:'completed'}}]);
  assert.deepEqual(settled,[[parent.id,childSession.id]]);
  instance.manager.settle=originalSettle;
  results.push({shippedLifecycleEmitter:true,detachedLifecyclePayloadDispatch:true,singlePayloadCallback:true,ownedSessionSettlement:true,registered:registered.map(t=>t.name),parentRoute:status.parentRoute,realRefRead:true,preSaveVeto:true});
 }
 // Fixed-candidate planning block: with no native model-selection policy the only authorized
 // route is the captured parent request route, so this candidate is deliberately equal to it.
 const rootParent={id:'detached-fixed-root',options:Object.freeze({provider:'stale-created',model:'stale-model'}),session:{header:{origin:'user'},requestHeader:()=>({config:{provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'max'}})}};
 const fixedCandidate={id:'candidate-main',name:'Main analysis',provider:'openai-codex',model:'gpt-6.1-sol',effort:'high',description:'Exact fixed route checked against current host metadata'};
 const fixedConfig={ui:{schemaVersion:3,enabled:true,candidates:[fixedCandidate],defaultCandidateId:'candidate-main'},auditFile:join(tmp,'fixed-candidate.jsonl')};
 const fixedTools=[];const resolved=[];const preflights=[];
 const fixedCtx={sessionProjections:{register:async()=>({stateOf:()=>null})},tools:{register:tool=>fixedTools.push(tool)},agents:{get:id=>id===rootParent.id?rootParent:undefined},llm:{async resolveModelInfo(provider,model){resolved.push({provider,model});return {provider,model,inputModalities:['text'],contextWindow:200000,reasoning:{efforts:[{id:'low'},{id:'high'},{id:'max'}]}};},async resolveCallConfig(options){preflights.push(options);return options;}},get:()=>undefined,on(){},effect:fn=>cleanup.push(fn()),logger:{error(){}}};
 const fixedInstance=Object.create(Router.prototype);Object.defineProperties(fixedInstance,{ctx:{value:fixedCtx},configSource:{value:fixedConfig},policy:{value:compilePluginConfig(fixedConfig).policy},auditFile:{value:fixedConfig.auditFile}});await fixedInstance[Service.init]();
 const listing=await fixedTools.find(t=>t.name==='delegation_routes').execute({}, {agent:rootParent,signal:new AbortController().signal});
 assert.equal(listing.defaultCandidateId,'candidate-main');assert.equal(listing.candidates.length,1);
 assert.equal(listing.candidates[0].id,'candidate-main');assert.equal(listing.candidates[0].provider,'openai-codex');assert.equal(listing.candidates[0].model,'gpt-6.1-sol');assert.equal(listing.candidates[0].effort,'high');
 assert.equal('selected' in listing,false);assert.deepEqual(resolved,[]);assert.deepEqual(preflights,[]);assert.equal(listing.policy_revision,fixedInstance.runtime.revision);
 // Exercise the actual creation planner separately; this validates host metadata/options without dispatching a child.
 const plan=await fixedInstance.runtime.plan(rootParent,{prompt:'Detached creation plan validation',description:'Host API check',policy_revision:listing.policy_revision},new AbortController().signal);
 assert.deepEqual(plan.options,{provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'high'});assert.equal(plan.route.candidateId,'candidate-main');assert.equal(plan.route.reason,'default-candidate');assert.deepEqual(preflights,[plan.options]);assert.deepEqual(resolved,[{provider:'openai-codex',model:'gpt-6.1-sol'}]);assert.equal(rootParent.options.model,'stale-model');
 // Capture the shipped tool definition in detached registration services; never execute it.
 const {apply:registerNativeTool}=await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-tool-subagent')).href);
 const nativeDefinitions=[];let nativeStarts=0;
 const provider=Object.freeze({name:'spawn',inheritsParentContext:false,capabilities:{agentOptions:true,agentPreset:true,depthLimit:true}});
 await registerNativeTool({
  sessionProjections:{register:async()=>({stateOf:()=>undefined})},
  subagents:{getProvider:name=>name===provider.name?provider:undefined,resolveMaxDepth:()=>undefined,
   startActivation(){nativeStarts++;throw Error('Real or fake native activation must not be dispatched');}},
  tools:{register:definition=>{nativeDefinitions.push(definition);return ()=>{};}},
  systemPrompt:{section(){},context(){},getSectionOrder:()=>0,getContextOrder:()=>0},
  on(){},effect:fn=>{const dispose=fn();cleanup.push(dispose);return dispose;},logger:{info(){}}
 },{provider:'spawn',modelSelection:true});
 const nativeDefinition=nativeDefinitions.find(tool=>tool.name==='subagent');
 assert.ok(nativeDefinition,'Actual host must register its native tool definition; no version skip');
 const nativeOutput=nativeDefinition.output.schema;
 assert.equal(nativeOutput.type,'object');assert.equal(nativeOutput.additionalProperties,false);
 assert.deepEqual(Object.keys(nativeOutput.properties).sort(),['kind','name']);
 assert.deepEqual([...nativeOutput.required].sort(),['kind','name']);
 assert.deepEqual(nativeOutput.properties.kind,{type:'string',const:'activation'});
 assert.deepEqual(nativeOutput.properties.name,{type:'string'});
 // Run the shipped staged pipeline with a definition carrying the shipped output
 // schema, but a detached body. Never execute the real native creation body.
 const {ToolExecutionPipeline}=await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-tools/pipeline')).href);
 const {createNativeInvoker}=await import('../src/native-adapter.js');
 const pipelineCalls={prepare:0,dispatch:0,complete:0};const catalog=[];let observationCloses=0,detachedBodies=0;
 const childId='detached-receipt-session-id';
 const detachedDefinition={...nativeDefinition,execute:async args=>{
  detachedBodies++;catalog.push({id:childId,name:args.name,mode:'continuable',label:'detached',createdAt:1});
  return {kind:'activation',name:args.name};
 }};
 const detachedCtx={
  tools:{executable:()=>detachedDefinition,schemas:()=>[{name:'subagent',parameters:nativeDefinition.parameters}],checkGuards:()=>undefined},
  sessionQuery:{async observeSession(id){return {
   header:id===rootParent.id?{id}:{id,origin:'subagent',parentSession:rootParent.id},
   projections:{values:{subagentCatalog:catalog}},[Symbol.dispose](){observationCloses++;}
  };}},
  async waterfall(...args){return args.at(-1)();},events:{dispatch:()=>[]},logger:{warn:message=>{throw Error(message);}}
 };
 const realPipeline=new ToolExecutionPipeline(detachedCtx);
 const pipeline=Object.fromEntries(Object.keys(pipelineCalls).map(stage=>[stage,async(...args)=>{pipelineCalls[stage]++;return realPipeline[stage](...args);} ]));
 const invoke=createNativeInvoker(detachedCtx,pipeline);
 const receipt=await invoke({prompt:'Detached receipt contract only',description:'No child creation',provider:'p',model:'m',reasoning_effort:'high'},
  {agent:rootParent,token:{},toolSet:{},signal:new AbortController().signal,callId:'detached-output-contract'});
 assert.deepEqual(receipt,{kind:'activation',name:catalog[0].name,childId});
 assert.match(receipt.name,/^router-[a-f0-9]{24}$/);assert.notEqual(receipt.name,receipt.childId);
 assert.deepEqual(pipelineCalls,{prepare:1,dispatch:1,complete:1});assert.equal(observationCloses,3);assert.equal(detachedBodies,1);
 assert.equal(nativeStarts,0);
 const nativeDispatchCompatible=true;
 const nativeOutputContract={fields:Object.keys(nativeOutput.properties),additionalProperties:nativeOutput.additionalProperties,
  nativeDispatchCompatible,detachedNameReceiptMapped:true,shippedPipeline:true,verifiedOwnedSessionId:true,observationCloses,
  nativeToolExecuted:false,detachedBodies,nativeActivationsStarted:nativeStarts,pipelineCalls};
 assert.deepEqual(sideEffects,{networkAttempts:0,processAttempts:0});
 console.log(JSON.stringify({hostVersion:JSON.parse(await readFile(resolve(process.argv[2]),'utf8')).version,realHostSchemaAndToolLibrary:true,detachedServiceHarness:true,nativeOutputContract,nativeDispatchCompatible,results,capturedRequestRouteRatherThanStaleOptions:true,exactCandidateEffortRatherThanParentEffort:true,fixedCandidateAuthorizedByParentRouteFallback:true,liveCordisMount:false,realManagerActivation:false,agentsCreated:0,profileChanged:false,...sideEffects,paidCalls:0},null,2));
}finally{
 for(const dispose of cleanup)if(typeof dispose==='function')dispose();
 hook.deregister();
 if(!tmp.startsWith(join(root,'.host-api-check-')))throw Error('Unexpected temporary preflight path');
 await rm(tmp,{recursive:true,force:true});
 for(const restore of restores.reverse())restore();
 syncBuiltinESMExports();
}
