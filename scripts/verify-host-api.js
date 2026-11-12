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
 assert.equal(RouterConfig.dict.policy.meta.volatile,true);
 const unwrap=config=>Object.fromEntries(Object.entries(config).map(([k,v])=>[k,isVolatile(v)?v.get():v]));
 const base=JSON.parse(await readFile(join(root,'examples/ui-glm.json'),'utf8'));
 assert.equal(compilePluginConfig(unwrap(RouterConfig({}))).policy.enabled,false);
 assert.equal(RouterConfig({policy:{enabled:false}}).ui.get(),undefined);
 const parent=Object.freeze({id:'detached-root',options:Object.freeze({provider:'unchanged-parent',model:'unchanged-model'}),session:{header:{origin:'user'},requestHeader:()=>({config:{provider:'unchanged-parent',model:'unchanged-model',reasoningEffort:'high'}})}});
 const {createLifecycleEmitter}=await import(new URL('./types/lifecycle.js',pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-subagent'))).href);
 const results=[];
 {
  const compiled=compilePluginConfig(unwrap(RouterConfig({...base,ui:{...base.ui,enabled:true,teams:{enabled:false}},auditFile:join(tmp,'ordinary.jsonl')})));
  const registered=[];const handlers=new Map();const fiber={};
  const childSession={id:'detached-child',header:{id:'detached-child',origin:'subagent',parentSession:parent.id},requestHeader:()=>undefined};
  const ctx={sessionProjections:{register:async()=>({stateOf:()=>compiled.policy.presets.map(({provider,model})=>({provider,model}))})},tools:{register:tool=>registered.push(tool),executable:()=>undefined},agents:{get:id=>id===parent.id?parent:undefined},llm:{},get:name=>name==='sessions'?{get:id=>id===childSession.id?childSession:undefined}:undefined,fiber,on:(name,fn)=>handlers.set(name,fn),effect:fn=>cleanup.push(fn()),logger:{error(){}}};
  const instance=Object.create(Router.prototype);
  Object.defineProperties(instance,{ctx:{value:ctx},policy:{value:compiled.policy},auditFile:{value:compiled.auditFile},configSource:{value:{ui:createVolatile({...base.ui,enabled:true,teams:{enabled:false}}),auditFile:compiled.auditFile}}});
  await instance[Service.init]();
  const status=await registered.find(t=>t.name==='router_status').execute({}, {agent:parent});
  assert.deepEqual(status.parentRoute,{provider:'unchanged-parent',model:'unchanged-model',effort:'high'});
  assert.deepEqual(registered.map(t=>t.name),['router_status','router_reconcile','delegation_routes','routed_subagent']);
  assert.throws(()=>handlers.get('internal/config')(fiber,()=>({ui:{schemaVersion:2,enabled:true,presets:[]},auditFile:compiled.auditFile})),{code:'INVALID_CONFIG'});
  assert.equal(instance.configuration().policy.enabled,true);
  instance.manager.inFlight++;
  assert.throws(()=>handlers.get('internal/config')(fiber,()=>({...base,ui:{...base.ui,enabled:true,teams:{enabled:false},limits:{maxPendingStarts:1}},auditFile:compiled.auditFile})),{code:'CONFIG_BUSY'});
  instance.manager.inFlight--;
  const settled=[];const originalSettle=instance.manager.settle;
  instance.manager.settle=(pid,id)=>settled.push([pid,id]);
  // rc.1/rc.2 SubagentRunInfo shape, supplied by this detached harness, NOT a manager activation.
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
 const inheritedParent={id:'detached-inherited-root',options:Object.freeze({provider:'stale-created',model:'stale-model'}),session:{header:{origin:'user'},requestHeader:()=>({config:{provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'max'}})}};
 const {createDefaultPresets}=await import('../src/default-presets.js');
 const inheritedConfig={ui:{schemaVersion:2,enabled:true,presets:createDefaultPresets(),defaultPreset:'default-high',teams:{enabled:false}},auditFile:join(tmp,'inherited.jsonl')};
 const inheritedTools=[];const resolved=[];const preflights=[];
 const inheritedCtx={sessionProjections:{register:async()=>({stateOf:()=>null})},tools:{register:tool=>inheritedTools.push(tool)},agents:{get:id=>id===inheritedParent.id?inheritedParent:undefined},llm:{async resolveModelInfo(provider,model){resolved.push({provider,model});return {provider,model,inputModalities:['text'],contextWindow:200000,reasoning:{efforts:[{id:'low'},{id:'high'},{id:'max'}]}};},async resolveCallConfig(options){preflights.push(options);return options;}},get:()=>undefined,on(){},effect:fn=>cleanup.push(fn()),logger:{error(){}}};
 const inheritedInstance=Object.create(Router.prototype);Object.defineProperties(inheritedInstance,{ctx:{value:inheritedCtx},configSource:{value:inheritedConfig},policy:{value:compilePluginConfig(inheritedConfig).policy},auditFile:{value:inheritedConfig.auditFile}});await inheritedInstance[Service.init]();
 const listing=await inheritedTools.find(t=>t.name==='delegation_routes').execute({}, {agent:inheritedParent,signal:new AbortController().signal});
 assert.equal(listing.defaultPreset,'default-high');assert.equal(listing.presets.length,3);assert.deepEqual(listing.presets[1].resolvedModel,{provider:'openai-codex',model:'gpt-6.1-sol'});assert.equal(listing.presets[1].effort,'high');assert.equal('selected' in listing,false);assert.deepEqual(resolved,[]);assert.deepEqual(preflights,[]);assert.equal(listing.policy_revision,inheritedInstance.runtime.revision);
 // Exercise the actual creation planner separately; this validates host metadata/options without dispatching a child.
 const plan=await inheritedInstance.runtime.plan(inheritedParent,{prompt:'Detached creation plan validation',description:'Host API check',policy_revision:listing.policy_revision},new AbortController().signal);
 assert.deepEqual(plan.options,{provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'high'});assert.equal(plan.route.reason,'default-preset');assert.deepEqual(preflights,[plan.options]);assert.deepEqual(resolved,[{provider:'openai-codex',model:'gpt-6.1-sol'}]);assert.equal(inheritedParent.options.model,'stale-model');
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
 assert.equal(nativeOutput.type,'object');
 const nativeDispatchCompatible=nativeOutput.properties?.subagentId?.type==='string' && nativeOutput.required?.includes('subagentId')===true;
 let detachedNativeOutputContractRejected=false;
 const pipelineCalls={prepare:0,dispatch:0,complete:0};
 if(!nativeDispatchCompatible){
  assert.equal(nativeOutput.additionalProperties,false);
  assert.deepEqual(Object.keys(nativeOutput.properties).sort(),['kind','name']);
  assert.deepEqual([...nativeOutput.required].sort(),['kind','name']);
  assert.deepEqual(nativeOutput.properties.kind,{type:'string',const:'activation'});
  assert.deepEqual(nativeOutput.properties.name,{type:'string'});
  // Exercise the plugin's fail-closed boundary with the real registered definition,
  // not execute() or a fabricated legacy subagentId. No staged pipeline is entered.
  const {createNativeInvoker}=await import('../src/native-adapter.js');
  const pipeline=Object.fromEntries(Object.keys(pipelineCalls).map(key=>[key,()=>{pipelineCalls[key]++;throw Error('Native pipeline must not run');}]));
  const invoke=createNativeInvoker({tools:{executable:()=>nativeDefinition,schemas:()=>[{name:'subagent',parameters:nativeDefinition.parameters}]}},pipeline);
  await assert.rejects(invoke({}, {agent:inheritedParent,token:{},toolSet:{},signal:new AbortController().signal,callId:'detached-output-contract'}),
   {code:'NATIVE_OUTPUT_CONTRACT_UNSUPPORTED',definitelyNotStarted:true});
  assert.deepEqual(pipelineCalls,{prepare:0,dispatch:0,complete:0});
  detachedNativeOutputContractRejected=true;
 }
 assert.equal(nativeStarts,0);
 const nativeOutputContract={fields:Object.keys(nativeOutput.properties),additionalProperties:nativeOutput.additionalProperties,
  nativeDispatchCompatible,detachedNativeOutputContractRejected,rejectionCode:detachedNativeOutputContractRejected?'NATIVE_OUTPUT_CONTRACT_UNSUPPORTED':null,
  nativeToolExecuted:false,nativeActivationsStarted:nativeStarts,pipelineCalls};
 assert.deepEqual(sideEffects,{networkAttempts:0,processAttempts:0});
 console.log(JSON.stringify({hostVersion:JSON.parse(await readFile(resolve(process.argv[2]),'utf8')).version,realHostSchemaAndToolLibrary:true,detachedServiceHarness:true,nativeOutputContract,nativeDispatchCompatible,results,inheritedCapturedRequestRatherThanStaleOptions:true,exactDefaultHighRatherThanParentMax:true,liveCordisMount:false,realManagerActivation:false,agentsCreated:0,profileChanged:false,...sideEffects,paidCalls:0},null,2));
}finally{
 for(const dispose of cleanup)if(typeof dispose==='function')dispose();
 hook.deregister();
 if(!tmp.startsWith(join(root,'.host-api-check-')))throw Error('Unexpected temporary preflight path');
 await rm(tmp,{recursive:true,force:true});
 for(const restore of restores.reverse())restore();
 syncBuiltinESMExports();
}
