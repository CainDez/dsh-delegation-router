/** Actual shipped Typert registry/Gateway/client; isolated fake LLM, never a live profile.
 * Run with matching Desktop Electron in ELECTRON_RUN_AS_NODE=1 mode, followed by host package.json.
 */
import assert from 'node:assert/strict';
import {createRequire, registerHooks, syncBuiltinESMExports} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';

if (process.argv.length !== 3) throw Error('Pass exactly one matching DSH runtime package.json; ASAR hosts require Electron Node mode.');
const hostRequire = createRequire(resolve(process.argv[2]));
const counts = {networkAttempts:0, processAttempts:0, metadata:0, fakePreparations:0, fakeStreams:0, accessDecisions:0, businessCalls:0};
const restores = [];
function block(object, key, counter) {
  const original = object[key];
  object[key] = () => { counts[counter]++; throw Error('Forbidden detached preflight side effect: ' + key); };
  restores.push(() => { object[key] = original; });
}
block(globalThis, 'fetch', 'networkAttempts');
for (const mod of [http, https]) for (const key of ['request','get']) block(mod,key,'networkAttempts');
for (const key of ['connect','createConnection']) block(net,key,'networkAttempts');
block(net.Socket.prototype,'connect','networkAttempts'); block(tls,'connect','networkAttempts');
block(dgram.Socket.prototype,'send','networkAttempts');
for (const key of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) block(childProcess,key,'processAttempts');
syncBuiltinESMExports();
const source = new URL('../src/',import.meta.url).href;
const hook = registerHooks({resolve(specifier,context,next) {
  if (context.parentURL?.startsWith(source) && (specifier.startsWith('@deepseek-ai/') || specifier === 'zod')) {
    return next(pathToFileURL(hostRequire.resolve(specifier)).href,context);
  }
  return next(specifier,context);
}});
const hostImport = name => import(pathToFileURL(hostRequire.resolve(name)).href);
let host, client, unmount;
try {
  const {Context,Service} = await hostImport('@deepseek-ai/cordis');
  const {TypertRegistry} = await hostImport('@deepseek-ai/dsh-typert-registry');
  const {TypertGatewayService} = await hostImport('@deepseek-ai/dsh-api-gateway');
  const {apply:applyClient} = await hostImport('@deepseek-ai/dsh-api-gateway/client');
  const {draftDescriptors,catalogDescriptors,mountDraftRemote,invokeDraftRemote} = await import('../src/draft-remote.js');
  const generator = {provider:'detached-generator',model:'generator',effort:'high'};
  const scope = [{provider:'detached-worker',model:'worker',effort:'low'}];
  const request = {generator,scope,requirements:'Recommend a bounded daily-work profile.'};
  const generated = {profiles:[{ref:'scope-1',name:'Daily',description:'Suitable for daily work; not guaranteed for hard tasks; exact requested effort.'}],defaultRef:'scope-1',warnings:[]};
  const expected = {candidates:[{id:'scope-1',name:'Daily',...scope[0],description:generated.profiles[0].description}],defaultCandidateId:'scope-1',warnings:[]};
  let adapterError = false;
  const llm = {
    listProviders() { return [{id:'detached-worker',name:'Detached worker'}]; },
    async listModels() { return [{id:'worker',name:'Worker'}]; },
    async resolveModelInfo(provider,model,signal) {
      counts.metadata++; signal?.throwIfAborted();
      return {provider,id:model,model,inputModalities:['text'],reasoning:{efforts:[{id:'low',name:'Low'},{id:'high',name:'High'}]}};
    },
    async prepareCall(config,signal) {
      counts.fakePreparations++; signal?.throwIfAborted();
      assert.deepEqual(config,{provider:generator.provider,model:generator.model,reasoningEffort:'high',maxTokens:8192});
      if (adapterError) throw Error('private-adapter-detail-must-not-cross-wire');
      return {config:{...config},inputModalities:['text'],stream(options) {
        counts.fakeStreams++; assert.equal(options.signal,signal);
        assert.equal(options.messages.length,1); assert.equal(options.messages[0].role,'user');
        for (const key of ['tools','agent','session','cwd']) assert.equal(Object.hasOwn(options,key),false);
        return (async function* () {
          yield {type:'block-end',index:0,block:{type:'text',text:JSON.stringify(generated)}};
          yield {type:'finish',reason:{kind:'stop'}};
        })();
      }};
    },
  };
  host = new Context();
  host.provide('llm',llm);
  let allowNonOwner = false;
  host.provide('remoteAccess',{decide() { counts.accessDecisions++; return allowNonOwner ? {kind:'allow'} : {kind:'deny',reason:'no-grant'}; }});
  new TypertRegistry(host);
  let capturedRpc;
  const rpcReady = new Promise(resolveReady => {
    host.provide('connection',{rpc:{intercept(channel,matches,handler) {
      assert.equal(channel,'/api'); capturedRpc = {matches,handler}; resolveReady(); return () => {};
    }}});
  });
  const gateway = new TypertGatewayService(host,{});
  class DetachedDraftReceiver extends Service {
    constructor(ctx) { super(ctx,'delegationRouter'); }
    generateDraft(value,signal) { counts.businessCalls++; return invokeDraftRemote(this,'generateDraft',value,signal); }
    validateDraft(value,signal) { counts.businessCalls++; return invokeDraftRemote(this,'validateDraft',value,signal); }
    modelCatalog(signal) { counts.businessCalls++; return invokeDraftRemote(this,'modelCatalog',undefined,signal); }
  }
  const receiver = new DetachedDraftReceiver(host);
  await mountDraftRemote(receiver);
  await rpcReady;
  assert.equal(host.typert.local.list().length,3);
  for (const descriptor of [...draftDescriptors(),...catalogDescriptors()]) {
    const registered = host.typert.local.get(descriptor.namespace + '/' + descriptor.method);
    assert.ok(registered); assert.equal(registered.result.mode,'strict');
    if (registered.parameters.length) assert.equal(registered.parameters[0].codec.mode,'strict');
    assert.equal(capturedRpc.matches(descriptor.namespace + '/' + descriptor.method),true);
  }
  const owner = {principal:{kind:'owner'},signal:new AbortController().signal};
  const guest = {principal:{kind:'detached-guest'},signal:new AbortController().signal};
  const signal = new AbortController().signal;
  const rpc = (method,args,peer=owner,callSignal=signal) => capturedRpc.handler('delegationRouter/' + method,{args},callSignal,peer);
  const direct = await gateway.invoke({namespace:'delegationRouter',method:'generateDraft',args:{request},signal,peer:owner});
  assert.deepEqual(direct,expected);
  assert.equal(counts.accessDecisions,0,'owner bypasses non-owner policy');
  const ownerEnvelope = await rpc('generateDraft',{request});
  assert.equal(ownerEnvelope.ok,true,JSON.stringify(ownerEnvelope)); assert.deepEqual(ownerEnvelope.value,expected);
  let before = counts.fakePreparations;
  const denied = await rpc('generateDraft',{request},guest);
  assert.equal(denied.ok,false); assert.equal(denied.error.code,'remote-access/denied');
  assert.equal(counts.fakePreparations,before);
  allowNonOwner = true;
  const ownerOnly = await rpc('generateDraft',{request},guest);
  assert.equal(ownerOnly.ok,false); assert.equal(ownerOnly.error.code,'gateway/forbidden');
  assert.equal(counts.fakePreparations,before,'business owner guard rejects even a policy grant');
  const invalid = await rpc('generateDraft',{request:{...request,requirements:''}});
  assert.equal(invalid.ok,false); assert.equal(counts.fakePreparations,before);
  const extra = await rpc('generateDraft',{request,unexpected:true});
  assert.equal(extra.ok,false); assert.equal(counts.fakePreparations,before);
  const draft = {scope,candidates:expected.candidates,defaultCandidateId:expected.defaultCandidateId};
  const validation = await rpc('validateDraft',{request:draft});
  assert.equal(validation.ok,true,JSON.stringify(validation));
  assert.deepEqual(validation.value,{candidates:expected.candidates,defaultCandidateId:expected.defaultCandidateId});
  assert.equal(counts.fakePreparations,before,'validation never generates');

  // The actual browser factory only gets React; no Zod, DOM, rendering, settings, or live connection.
  let factory;
  runInNewContext(await readFile(new URL('../client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load(definition) { assert.equal(definition.id,'dsh-delegation-router'); factory=definition.factory; }}}
  },{filename:'detached-draft-client',timeout:1000,codeGeneration:{strings:false,wasm:false}});
  const browser = factory(name => { assert.equal(name,'react'); return {createElement(type,props,...children) { return {type,props:{...props,children}}; }}; });
  assert.equal(typeof browser.draftRemoteDescriptors,'function');
  client = new Context(); new TypertRegistry(client);
  const transportCalls = [];
  client.provide('connection',{interactions:'answer',registerGenerationSource:()=>()=>{},start:()=>({stop(){}}),rpc:{
    async call(channel,endpoint,payload,callSignal) {
      assert.equal(channel,'/api'); transportCalls.push({endpoint,keys:Object.keys(payload.args)});
      // Simulate the JSON wire boundary; actual shipped Gateway owns dispatch/envelopes.
      return JSON.parse(JSON.stringify(await capturedRpc.handler(endpoint,JSON.parse(JSON.stringify(payload)),callSignal,owner)));
    },
    open() { throw Error('Streaming transport is not used by unary drafts'); },
  },generation:{getSnapshot:()=>undefined},isLoopback:true});
  applyClient(client);
  const pendingMount = client.remote.$mount({package:'dsh-delegation-router',descriptors:[...browser.draftRemoteDescriptors(),...browser.catalogRemoteDescriptors()]});
  assert.equal(typeof pendingMount.then,'function'); unmount = await pendingMount; assert.equal(typeof unmount,'function');
  const clientResult = await client.remote.delegationRouter.generateDraft(request,signal);
  assert.equal(clientResult.ok,true,JSON.stringify(clientResult)); assert.deepEqual(clientResult.value,expected);
  assert.deepEqual(transportCalls[0],{endpoint:'delegationRouter/generateDraft',keys:['request']});
  const clientValidation = await client.remote.delegationRouter.validateDraft(draft,signal);
  assert.equal(clientValidation.ok,true); assert.deepEqual(clientValidation.value,validation.value);
  const catalogBefore = counts.fakePreparations;
  const catalogResult = await client.remote.delegationRouter.modelCatalog(signal);
  assert.equal(catalogResult.ok,true,JSON.stringify(catalogResult));
  assert.equal(catalogResult.value.groups[0].id,'detached-worker');
  assert.deepEqual(catalogResult.value.groups[0].models[0].reasoning.efforts.map(item=>item.id),['low','high']);
  assert.deepEqual(catalogResult.value.failures,[]);
  assert.equal(counts.fakePreparations,catalogBefore,'catalog never runs inference');
  const catalogDenied = await rpc('modelCatalog',{},guest);
  assert.equal(catalogDenied.ok,false); assert.equal(catalogDenied.error.code,'gateway/forbidden');
  adapterError = true;
  const failure = await client.remote.delegationRouter.generateDraft(request,signal);
  assert.equal(failure.ok,false); assert.equal(failure.error.code,'delegation-router/draft');
  assert.equal(failure.error.details.code,'GENERATION_FAILED');
  assert.equal(JSON.stringify(failure).includes('private-adapter-detail'),false);
  assert.equal(failure.error.message.includes('private-adapter-detail'),false);
  adapterError = false;
  before = counts.fakePreparations;
  const aborted = new AbortController(); aborted.abort();
  const cancelled = await client.remote.delegationRouter.generateDraft(request,aborted.signal);
  assert.equal(cancelled.ok,false); assert.equal(cancelled.error.code,'gateway/cancelled');
  assert.equal(counts.fakePreparations,before);
  const oldMethod = client.remote.delegationRouter.generateDraft;
  await unmount(); unmount=undefined;
  const retired = await oldMethod(request,signal);
  assert.equal(retired.ok,false); assert.equal(counts.fakePreparations,before);
  // Execute the actual browser plugin inside a real dependent Cordis fiber, not root.
  // Its self-mounted namespace must use optional ctx.get(), never an undeclared property.
  client.provide('remote.settings',{}); client.provide('remote.session',{});
  const snapshot = {status:'ready',writable:true,revision:1,user:{ui:browser.emptyDraft()},value:{ui:browser.emptyDraft()}};
  client.provide('configForms',{get:()=>({getSnapshot:()=>snapshot,subscribe:()=>()=>{}}),describe:()=>({load:async()=>{}})});
  client.provide('locale',{bind:()=>key=>browser.dictionaries.en[key]??key,register:()=>()=>{}});
  let scoped, readyResolve, offCatalog;
  const ready = new Promise(resolveReady=>{readyResolve=resolveReady;});
  client.provide('slots',{inject:(_name,fn)=>fn(),register:(_meta,component)=>{
    scoped=component({view:'page'}).props;
    offCatalog?.(); offCatalog=scoped.catalog.subscribe(()=>{if(scoped.catalog.getSnapshot().status!=='loading'&&scoped.catalog.getSnapshot().status!=='idle')readyResolve();});
    return ()=>{};
  }});
  const fiber=client.plugin({name:'detached-router-browser',inject:browser.inject,apply:browser.apply});
  let deadline;
  try {
    await fiber;
    await Promise.race([ready,new Promise((_yes,no)=>{deadline=setTimeout(()=>no(Error('Scoped browser catalog failed to initialize')),5000);})]);
    assert.equal(scoped.generator.available(),true);
    assert.equal(scoped.catalog.getSnapshot().status,'ready',JSON.stringify(scoped.catalog.getSnapshot()));
    assert.equal(scoped.catalog.getSnapshot().groups[0].id,'detached-worker');
    assert.equal(scoped.generator.selectGenerator(browser.modelKey({provider:'detached-worker',model:'worker'})),true);
    assert.equal(scoped.generator.setGeneratorEffort('low'),true);
    assert.equal(scoped.generator.setScope([{provider:'detached-worker',model:'worker',effort:'low'}]),true);
    assert.equal(scoped.generator.setRequirements('Scoped input selection test only.'),true);
    assert.equal(scoped.generator.inputsValid(),true);
  } finally { clearTimeout(deadline); offCatalog?.(); await fiber.dispose(); }
  assert.equal(client.get('remote.delegationRouter'),undefined,'scoped plugin disposal retires self-mounted namespace');
  assert.equal(counts.networkAttempts,0); assert.equal(counts.processAttempts,0);
  console.log(JSON.stringify({hostVersion:JSON.parse(await readFile(resolve(process.argv[2]),'utf8')).version,
    actualHostRegistry:true,actualHostGateway:true,actualHostClientMount:true,actualBrowserDescriptors:true,actualScopedBrowserPlugin:true,scopedGeneratorSelectable:true,isolatedCatalogRpc:true,catalogOwnerGuard:true,
    strictInputRejection:true,ownerRpcEnvelope:true,nonOwnerPolicyRejected:true,nonOwnerBusinessGuardRejected:true,
    sanitizedFailureEnvelope:true,clientCancellation:true,mountDisposal:true,validationWithoutGeneration:true,
    liveProfile:false,credentialsRead:false,settingsWrites:0,agentsCreated:0,paidCalls:0,...counts},null,2));
} finally {
  await unmount?.(); await client?.fiber.dispose(); await host?.fiber.dispose();
  hook.deregister(); for (const restore of restores.reverse()) restore(); syncBuiltinESMExports();
}
