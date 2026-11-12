import test from 'node:test';
import assert from 'node:assert/strict';
import { SubagentRouter, normalizeRequest, normalizeMetadata } from '../src/runtime.js';
import { MemoryJournal } from '../src/journal.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function deepFreeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; }
const makeParent = () => deepFreeze({ id: 'root-session', provider: 'parent-provider', model: 'parent-model', reasoningEffort: 'parent-effort', session: { header: { origin: 'root' }, agentOptions: { provider: 'parent-provider', model: 'parent-model', reasoningEffort: 'parent-effort' } } });
const request = extra => ({ prompt: 'Implement bounded child work', description: 'child work', ...extra });
const metadata = { inputModalities: ['text', 'image'], context: { contextWindow: 100000 }, reasoning: { efforts: [{ id: 'low' }, { id: 'high' }], defaultEffort: 'low' } };
const preset = (id, extra = {}) => ({ id, name:'Preset '+id, provider: 'provider-' + id, model: 'model-' + id, effort:'low', ...extra });
const auth = ids => ids.map(id => ({ provider: 'provider-' + id, model: 'model-' + id }));
function fixture(overrides = {}) {
  const calls = [], parent = makeParent(), journal = overrides.journal ?? new MemoryJournal();
  const { config: configExtra, ...dependencies } = overrides;
  const router = new SubagentRouter({
    config: { schemaVersion: 2, enabled: true, presets: [preset('a'), preset('b')], defaultPreset:'a', ...configExtra },
    resolveModel: async () => structuredClone(metadata), readAuthorization: () => auth(['a', 'b']),
    preflight: async () => {}, invokeNative: async args => { calls.push(args); return { kind: 'activation', subagentId: 'child-' + calls.length }; },
    journal, estimateContext: () => 100,
    ...dependencies,
  });
  return { router, calls, parent, journal };
}
const exec = (callId, signal) => ({ callId, signal });
test('runtime only selects child options and preserves a deeply frozen parent Agent', async () => {
  const f = fixture(), before = structuredClone(f.parent);
  const result = await f.router.run(f.parent, request({ preset_id: 'b' }), exec('first'));
  assert.equal(result.subagentId, 'child-1');
  assert.deepEqual(result.selected, { provider: 'provider-b', model: 'model-b', effort: 'low' });
  assert.deepEqual(f.calls[0], { prompt: 'Implement bounded child work', description: 'child work', provider: 'provider-b', model: 'model-b', reasoning_effort: 'low' });
  assert.deepEqual(f.parent, before);
  assert.deepEqual(f.journal.load().map(record => record.status), ['intent', 'accepted']);
  assert.ok(f.journal.load().every(record => !Object.hasOwn(record, 'prompt') && !Object.hasOwn(record, 'description')));
});

test('concurrent starts reserve model capacity before native publication', async () => {
  const entered = deferred(), release = deferred(); let starts = 0;
  const f = fixture({ config: { limits: { maxActivePerModel: 1 } }, invokeNative: async () => { starts++; entered.resolve(); await release.promise; return { kind: 'activation', subagentId: 'only-child' }; } });
  const first = f.router.run(f.parent, request(), exec('one'));
  await entered.promise;
  await assert.rejects(f.router.run(f.parent, request(), exec('two')), { code: 'MODEL_CAPACITY' });
  release.resolve(); await first;
  assert.equal(starts, 1);
  f.router.settle(f.parent.id, 'only-child');
  await f.router.run(f.parent, request(), exec('three'));
  assert.equal(starts, 2);
});

test('pending quota is shared across candidate models', async () => {
  const entered = deferred(), release = deferred();
  const f = fixture({ config: { limits: { maxPendingStarts: 1 } }, invokeNative: async () => { entered.resolve(); await release.promise; return { kind: 'activation', subagentId: 'child' }; } });
  const first = f.router.run(f.parent, request({ preset_id: 'a' }), exec('one'));
  await entered.promise;
  await assert.rejects(f.router.run(f.parent, request({ preset_id: 'b' }), exec('two')), { code: 'PENDING_LIMIT' });
  release.resolve(); await first;
});

test('creation count survives settlement and cannot be reset by child completion', async () => {
  const f = fixture({ config: { limits: { maxCreationsPerParent: 1 } } });
  const result = await f.router.run(f.parent, request(), exec('one'));
  f.router.settle(f.parent.id, result.subagentId);
  await assert.rejects(f.router.run(f.parent, request(), exec('two')), { code: 'CREATION_LIMIT' });
  assert.equal(f.calls.length, 1);
});

test('host authorization is intersected with configured routes', async () => {
  const f = fixture({ readAuthorization: () => auth(['b']) });
  await assert.rejects(f.router.run(f.parent, request({ preset_id: 'a' }), exec('denied-explicit')), { code: 'NO_ROUTE' });
  await assert.rejects(f.router.run(f.parent, request(), exec('denied-default')), { code: 'NO_ROUTE' });
  const result = await f.router.run(f.parent, request({ preset_id: 'b' }), exec('one'));
  assert.equal(result.selected.model, 'model-b');
  const denied = fixture({ readAuthorization: () => [] });
  await assert.rejects(denied.router.run(denied.parent, request(), exec('one')), { code: 'NO_ROUTE' });
  assert.equal(denied.calls.length, 0);
});

test('revocation during asynchronous preflight cannot publish the previously selected route', async () => {
  let allowed = auth(['a', 'b']);
  const f = fixture({ readAuthorization: () => allowed, preflight: async () => { allowed = auth(['b']); } });
  await assert.rejects(f.router.run(f.parent, request({ preset_id: 'a' }), exec('revoked')));
  assert.equal(f.calls.length, 0);
});

test('missing authoritative authorization after metadata resolution fails closed', async () => {
  let reads = 0;
  const f = fixture({ readAuthorization: () => ++reads === 1 ? auth(['a']) : undefined });
  await assert.rejects(f.router.run(f.parent, request(), exec('missing-auth')));
  assert.equal(f.calls.length, 0);
});

test('metadata absence, unknown modality and unsupported reasoning all fail closed', async () => {
  for (const info of [undefined, { ...metadata, inputModalities: undefined }, { ...metadata, reasoning: { efforts: ['unconfigured'], defaultEffort: 'low' } }]) {
    const f = fixture({ resolveModel: async () => info });
    await assert.rejects(f.router.run(f.parent, request(), exec('one')), { code: 'NO_ROUTE' });
    assert.equal(f.calls.length, 0);
  }
});

test('resolver ignoring cancellation is bounded by metadata timeout', { timeout: 1000 }, async () => {
  const keepAlive = setTimeout(() => {}, 500);
  try {
    const f = fixture({ config: { limits: { metadataTimeoutMs: 10 } }, resolveModel: () => new Promise(() => {}) });
    await assert.rejects(f.router.run(f.parent, request(), exec('timeout')), { code: 'METADATA_TIMEOUT' });
    assert.equal(f.calls.length, 0);
  } finally { clearTimeout(keepAlive); }
});

test('preflight rejection or cancellation never invokes native creation or consumes quota', async () => {
  const f = fixture({ preflight: async () => { throw Object.assign(new Error('Unavailable adapter'), { code: 'PREFLIGHT' }); } });
  await assert.rejects(f.router.run(f.parent, request(), exec('preflight')), { code: 'PREFLIGHT' });
  assert.equal(f.calls.length, 0); assert.deepEqual(f.journal.load(), []);
  const abort = new AbortController(), entered = deferred();
  const cancelled = fixture({ preflight: async (_, signal) => { entered.resolve(); await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { code: 'CANCELLED' })), { once: true })); } });
  const running = cancelled.router.run(cancelled.parent, request(), exec('cancel', abort.signal));
  await entered.promise; abort.abort();
  await assert.rejects(running, { code: 'CANCELLED' });
  assert.equal(cancelled.calls.length, 0);
});

test('preflight ignoring its signal is still bounded on timeout and parent cancellation', { timeout: 1000 }, async () => {
  const timed = fixture({ config: { limits: { metadataTimeoutMs: 10 } }, preflight: () => new Promise(() => {}) });
  await assert.rejects(timed.router.run(timed.parent, request(), exec('preflight-timeout')), { code: 'METADATA_TIMEOUT' });
  assert.equal(timed.calls.length, 0);
  const entered = deferred(), controller = new AbortController();
  const cancelled = fixture({ preflight: () => { entered.resolve(); return new Promise(() => {}); } });
  const work = cancelled.router.run(cancelled.parent, request(), exec('ignored-abort', controller.signal));
  await entered.promise; controller.abort();
  await assert.rejects(work, { code: 'CANCELLED' });
  assert.equal(cancelled.calls.length, 0);
});

test('native failure with uncertain effects pauses parent and never retries the same call', async () => {
  let starts = 0;
  const f = fixture({ invokeNative: async () => { starts++; throw Object.assign(new Error('Response lost'), { code: 'TRANSPORT' }); } });
  const one = f.router.run(f.parent, request(), exec('one'));
  const replay = f.router.run(f.parent, request(), exec('one'));
  assert.equal(one, replay);
  await assert.rejects(one, { code: 'TRANSPORT' });
  await assert.rejects(replay, { code: 'TRANSPORT' });
  await assert.rejects(f.router.run(f.parent, request(), exec('two')), { code: 'RECOVERY_REQUIRED' });
  assert.equal(starts, 1);
  assert.deepEqual(f.journal.load().map(r => r.status), ['intent', 'unknown']);
  assert.throws(() => f.router.run(f.parent, request({ prompt: 'different' }), exec('one')), { code: 'CALL_ID_REUSE' });
});

test('ambiguous native return is unknown; definitely-not-started rejection frees the reservation', async () => {
  const f = fixture({ invokeNative: async () => ({ data: 'no authoritative child id' }) });
  await assert.rejects(f.router.run(f.parent, request(), exec('one')), { code: 'START_UNKNOWN' });
  await assert.rejects(f.router.run(f.parent, request(), exec('two')), { code: 'RECOVERY_REQUIRED' });
  let first = true;
  const known = fixture({ config: { limits: { maxPendingStarts: 1, maxActivePerModel: 1 } }, invokeNative: async () => { if (first) { first = false; throw Object.assign(new Error('Denied'), { definitelyNotStarted: true }); } return { kind: 'activation', subagentId: 'child' }; } });
  await assert.rejects(known.router.run(known.parent, request(), exec('one')));
  await known.router.run(known.parent, request(), exec('two'));
  assert.deepEqual(known.journal.load().map(r => r.status), ['intent', 'rejected', 'intent', 'accepted']);
});

test('terminal lifecycle event arriving before creation receipt is reconciled without a leaked slot', async () => {
  let router;
  const f = fixture({ config: { limits: { maxActivePerModel: 1 } }, invokeNative: async () => { router.settle('root-session', 'fast-child'); return { kind: 'activation', subagentId: 'fast-child' }; } });
  router = f.router;
  await router.run(f.parent, request(), exec('one'));
  assert.deepEqual(f.journal.load().map(r => r.status), ['intent', 'accepted', 'settled']);
  await router.run(f.parent, request(), exec('two'));
  assert.equal(router.ledger.state(f.parent.id).active.size, 0);
});

test('audit write failure before intent publication never invokes native creation', async () => {
  const journal = new MemoryJournal(); journal.append = () => { throw Object.assign(new Error('disk full'), { code: 'AUDIT_IO' }); };
  const f = fixture({ journal });
  await assert.rejects(f.router.run(f.parent, request(), exec('one')), { code: 'AUDIT_IO' });
  assert.equal(f.calls.length, 0); assert.equal(f.router.ledger.state(f.parent.id).pending, 0);
});

test('audit failure after native publication is conservative unknown and never opens retry capacity', async () => {
  const journal = new MemoryJournal(), append = journal.append.bind(journal);
  journal.append = record => { if (record.status === 'accepted') throw Object.assign(new Error('lost audit write'), { code: 'AUDIT_IO' }); append(record); };
  const f = fixture({ journal });
  await assert.rejects(f.router.run(f.parent, request(), exec('one')), { code: 'AUDIT_IO' });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(journal.load().map(record => record.status), ['intent', 'unknown']);
  assert.equal(journal.load().at(-1).childId, 'child-1');
  f.router.settle(f.parent.id, 'child-1');
  assert.deepEqual(journal.load().map(record => record.status), ['intent', 'unknown']);
  await assert.rejects(f.router.run(f.parent, request(), exec('two')), { code: 'RECOVERY_REQUIRED' });
  assert.equal(f.calls.length, 1);
  const recovered = fixture({ journal });
  await assert.rejects(recovered.router.run(recovered.parent, request(), exec('after-restart')), { code: 'RECOVERY_REQUIRED' });
  assert.equal(recovered.calls.length, 0);
});

test('missing host execution identity is rejected instead of becoming an undefined idempotency key', async () => {
  const f = fixture();
  await assert.rejects(async () => f.router.run(f.parent, request(), {}));
  assert.equal(f.calls.length, 0);
});

test('request validation precedes fingerprint serialization and never evaluates model-controlled getters', async () => {
  const f = fixture(); let invoked = false;
  const raw = request(); Object.defineProperty(raw, 'prompt', { enumerable: true, get() { invoked = true; return 'unsafe'; } });
  await assert.rejects(async () => f.router.run(f.parent, raw, exec('unsafe')), { code: 'INVALID_REQUEST' });
  assert.equal(invoked, false);
  assert.equal(f.calls.length, 0);
});

test('closed, stale-policy, subagent-origin and pre-aborted requests fail before creation', async () => {
  const f = fixture();
  await assert.rejects(f.router.run(f.parent, request({ policy_revision: 'stale' }), exec('stale')), { code: 'STALE_POLICY' });
  const nested = { ...f.parent, session: { header: { origin: 'subagent' } } };
  await assert.rejects(f.router.run(nested, request(), exec('nested')), { code: 'ROOT_ONLY' });
  const abort = new AbortController(); abort.abort();
  await assert.rejects(f.router.run(f.parent, request(), exec('cancelled', abort.signal)), { code: 'CANCELLED' });
  f.router.close();
  await assert.rejects(f.router.run(f.parent, request(), exec('closed')), { code: 'ROUTER_DISABLED' });
  assert.equal(f.calls.length, 0);
});

test('settlement audit failure pauses internally, snapshots unknown, and duplicate end never retries ambiguous writes', async () => {
  const journal=new MemoryJournal(),append=journal.append.bind(journal);let settlementWrites=0;
  journal.append=record=>{if(record.status==='settled'){settlementWrites++;throw Object.assign(new Error('fsync failure'),{code:'AUDIT_IO'});}append(record);};
  const f=fixture({journal});const result=await f.router.run(f.parent,request(),exec('one'));
  assert.throws(()=>f.router.settle(f.parent.id,result.subagentId),{code:'AUDIT_IO'});
  assert.equal(f.router.ledger.state(f.parent.id).paused,true);
  f.router.settle(f.parent.id,result.subagentId);assert.equal(settlementWrites,1);
  const [snapshot]=await f.router.decisions(f.parent);assert.equal(snapshot.status,'unknown');assert.equal(snapshot.settled,false);
  await assert.rejects(f.router.run(f.parent,request(),exec('two')),{code:'RECOVERY_REQUIRED'});
});

test('concurrent end-before-receipt events remain isolated by exact parent and child identity', async () => {
  const a=deferred(),b=deferred(),entered=deferred();let starts=0;
  const f=fixture({invokeNative:async()=>{const index=++starts;if(index===2)entered.resolve();await (index===1?a.promise:b.promise);return {kind:'activation',subagentId:'c'+index};}});
  const one=f.router.run(f.parent,request({preset_id:'a'}),exec('one'));
  const two=f.router.run(f.parent,request({preset_id:'b'}),exec('two'));
  await entered.promise;
  f.router.settle('foreign','c1');f.router.settle(f.parent.id,'c2');f.router.settle(f.parent.id,'c1');
  b.resolve();await two;a.resolve();await one;
  f.router.settle(f.parent.id,'c1');f.router.settle(f.parent.id,'c2');
  assert.deepEqual(f.journal.load().map(r=>r.status),['intent','intent','accepted','settled','accepted','settled']);
  assert.equal(f.router.ledger.state(f.parent.id).active.size,0);
});

test('native activation without a nonempty bounded identity remains unknown', async () => {
  for(const subagentId of ['', ' ', 'x'.repeat(501)]) {
    const f=fixture({invokeNative:async()=>({kind:'activation',subagentId})});
    await assert.rejects(f.router.run(f.parent,request(),exec('empty')),{code:'START_UNKNOWN'});
    assert.equal(f.router.ledger.state(f.parent.id).paused,true);
  }
});

test('native beforeDispatch fence also checks cancellation and live authorization after preparation', async () => {
  for(const change of ['cancel','authorization']) {
    const entered=deferred(),release=deferred(),controller=new AbortController();let allowed=auth(['a','b']),dispatches=0;
    const f=fixture({readAuthorization:()=>allowed,invokeNative:async(_args,_exec,beforeDispatch)=>{
      entered.resolve();await release.promise;
      try { beforeDispatch(); } catch(error) { error.definitelyNotStarted=true;throw error; }
      dispatches++;return {kind:'activation',subagentId:'must-not-start'};
    }});
    const running=f.router.run(f.parent,request({preset_id:'a'}),exec('fence-'+change,controller.signal));await entered.promise;
    if(change==='cancel')controller.abort();else allowed=auth(['b']);release.resolve();
    await assert.rejects(running,{code:change==='cancel'?'CANCELLED':'STALE_AUTHORIZATION',definitelyNotStarted:true});
    assert.equal(dispatches,0);assert.deepEqual(f.journal.load().map(record=>record.status),['intent','rejected']);
  }
})

test('request contract rejects every old routing field before metadata or native execution',async()=>{
  for(const field of ['lane','task_type','complexity','model_id','effort','author_child_id','name']) {
    let resolutions=0;const f=fixture({resolveModel:async()=>{resolutions++;return metadata;}});
    assert.throws(()=>f.router.run(f.parent,request({[field]:'old'}),exec(field)),{code:'INVALID_REQUEST'});
    assert.equal(resolutions,0);assert.equal(f.calls.length,0);assert.deepEqual(f.journal.load(),[]);
  }
  assert.throws(()=>normalizeRequest(request({preset_id:''})),{code:'INVALID_REQUEST'});
  assert.throws(()=>normalizeRequest(request({selection_reason:'x'.repeat(1001)})),{code:'INVALID_REQUEST'});
  assert.throws(()=>normalizeRequest(request({name:'worker'})),{code:'INVALID_REQUEST'});
  assert.equal(normalizeRequest(request({cwd:'elsewhere'})).cwd,'elsewhere');
});
test('only the exact selected preset resolves and advisory reasons never enter native args or audit',async()=>{
  const resolutions=[],f=fixture({resolveModel:async(provider,model)=>{resolutions.push([provider,model]);return metadata;}});
  const value=await f.router.run(f.parent,request({preset_id:'b',selection_reason:'sensitive explanation'}),exec('chosen'));
  assert.deepEqual(resolutions,[['provider-b','model-b']]);assert.equal(value.presetId,'b');assert.equal(value.routingReason,'explicit-preset');
  assert.equal('preset_id' in f.calls[0],false);assert.equal('selection_reason' in f.calls[0],false);
  assert.equal(JSON.stringify(f.journal.load()).includes('sensitive explanation'),false);
  assert.ok(f.journal.load().every(row=>row.presetId==='b'&&row.modelId===JSON.stringify(['provider-b','model-b'])));
  const unknown=fixture({resolveModel:async()=>{throw Error('must not resolve');}});
  await assert.rejects(unknown.router.run(unknown.parent,request({preset_id:'missing'}),exec('missing')),{code:'NO_ROUTE'});
  assert.equal(unknown.calls.length,0);
});
test('selected target metadata failure cannot trigger resolving or creating a different preset',async()=>{
  const resolved=[],f=fixture({resolveModel:async(provider)=>{resolved.push(provider);throw Error('catalog offline');}});
  await assert.rejects(f.router.run(f.parent,request({preset_id:'b'}),exec('offline')),{code:'NO_ROUTE'});
  assert.deepEqual(resolved,['provider-b']);assert.equal(f.calls.length,0);assert.deepEqual(f.journal.load(),[]);
});
test('same-model presets share active quota regardless of alias or effort',async()=>{
  const f=fixture({config:{presets:[preset('a'),preset('high',{provider:'provider-a',model:'model-a',effort:'high'})],limits:{maxActivePerModel:1}}});
  const first=await f.router.run(f.parent,request({preset_id:'a'}),exec('low'));
  await assert.rejects(f.router.run(f.parent,request({preset_id:'high'}),exec('high-denied')),{code:'MODEL_CAPACITY'});
  assert.equal(f.calls.length,1);f.router.settle(f.parent.id,first.subagentId);
  const second=await f.router.run(f.parent,request({preset_id:'high'}),exec('high-allowed'));
  assert.equal(second.selected.effort,'high');assert.equal(f.calls[1].reasoning_effort,'high');
});
test('explicit no-effort metadata omits effort in native calls and preflight',async()=>{
  for(const reasoning of [undefined,{efforts:[]}]) {
    let prepared;const info={inputModalities:['text'],context:{contextWindow:1000},...(reasoning===undefined?{}:{reasoning})};
    const config={presets:[preset('a',{effort:null})]};
    const f=fixture({config,resolveModel:async()=>info,preflight:async options=>{prepared=options;}});
    const result=await f.router.run(f.parent,request(),exec('no-effort'));
    assert.equal(result.selected.effort,null);assert.equal('reasoning_effort' in f.calls[0],false);assert.equal('reasoningEffort' in prepared,false);
  }
});
test('unknown or malformed metadata never manufactures no-effort support or invokes getters',async()=>{
  let invoked=0;const getter=Object.defineProperty({...metadata},'reasoning',{enumerable:true,get(){invoked++;return undefined;}});
  for(const info of [undefined,null,{},getter,{...metadata,reasoning:null},{...metadata,reasoning:{}},{...metadata,reasoning:{efforts:['']}},{...metadata,reasoning:{efforts:['default']}}]) {
    const f=fixture({config:{presets:[preset('a',{effort:null})]},resolveModel:async()=>info});
    await assert.rejects(f.router.run(f.parent,request(),exec('no-fabrication')),{code:'NO_ROUTE'});assert.equal(f.calls.length,0);
  }
  assert.equal(invoked,0);assert.equal(normalizeMetadata({}).reasoning,undefined);
});
test('authorization loss after intent is rejected without native effects or replay',async()=>{
  let allowed=auth(['a','b']);const journal=new MemoryJournal(),append=journal.append.bind(journal);
  journal.append=record=>{append(record);if(record.status==='intent')allowed=auth(['b']);};
  const f=fixture({journal,readAuthorization:()=>allowed});const run=f.router.run(f.parent,request(),exec('lost-after-intent'));
  await assert.rejects(run,{code:'STALE_AUTHORIZATION'});assert.equal(f.router.run(f.parent,request(),exec('lost-after-intent')),run);
  assert.equal(f.calls.length,0);assert.deepEqual(journal.load().map(row=>row.status),['intent','rejected']);assert.equal(f.router.ledger.state(f.parent.id).paused,false);
});
test('historical teammate accepted and unknown decisions still pause recovery and retain quota',async()=>{
  for(const status of ['accepted','unknown']){
    const journal=new MemoryJournal(),base={decisionId:'old-team',parentId:'root-session',policyRevision:'old-team-policy',modelId:JSON.stringify(['provider-a','model-a']),provider:'provider-a',model:'model-a',effort:'low',kind:'teammate'};
    journal.append({...base,status:'intent',time:1});journal.append({...base,status,childId:'old-team-child',time:2});
    const before=journal.load(),f=fixture({journal,config:{limits:{maxCreationsPerParent:1}}});
    const [card]=await f.router.decisions(f.parent);assert.equal(card.kind,'teammate');assert.equal(card.status,'unknown');assert.equal(card.unknown,true);assert.equal(card.settled,false);
    assert.equal(f.router.ledger.state(f.parent.id).paused,true);
    await assert.rejects(f.router.run(f.parent,request(),exec('not-a-retry')),{code:'RECOVERY_REQUIRED'});
    assert.equal(f.calls.length,0);assert.deepEqual(journal.load(),before);
    assert.equal(f.router.ledger.state(f.parent.id).created,1);
    if(status==='accepted'){
      f.router.reconcileCompleted(f.parent.id,'old-team-child',{source:'persisted-turn-end',parentId:f.parent.id,childId:'old-team-child',startSeq:1,endSeq:2,reason:'completed'});
      assert.equal(f.router.ledger.state(f.parent.id).paused,false);assert.equal(f.router.ledger.state(f.parent.id).created,1);
      await assert.rejects(f.router.run(f.parent,request(),exec('quota-after-recovery')),{code:'CREATION_LIMIT'});
    }
  }
});
test('read-only decisions preserve old audit identities and never reinterpret unknown recovery as completion',async()=>{
  const empty=fixture();assert.deepEqual(await empty.router.decisions(empty.parent),[]);assert.deepEqual(empty.journal.load(),[]);
  const journal=new MemoryJournal();const base={decisionId:'legacy',parentId:'root-session',policyRevision:'old',modelId:'old-model-alias',provider:'old-provider',model:'old-model',effort:'high',kind:'subagent'};
  journal.append({...base,status:'intent',time:1});journal.append({...base,status:'accepted',childId:'old-child',time:2});
  const before=structuredClone(journal.load());const f=fixture({journal,readChildRoute:async()=>{throw Object.assign(Error('foreign'),{code:'CHILD_SCOPE'});}});
  for(let i=0;i<2;i++){const [card]=await f.router.decisions(f.parent);assert.equal(card.status,'unknown');assert.equal(card.accepted,true);assert.equal(card.settled,false);assert.equal(card.observed,null);}
  assert.deepEqual(journal.load(),before);assert.equal(f.router.ledger.state(f.parent.id).paused,true);
  await assert.rejects(f.router.run(f.parent,request(),exec('paused')),{code:'RECOVERY_REQUIRED'});assert.equal(f.calls.length,0);
  const off=fixture({config:{enabled:false,presets:[],defaultPreset:undefined}});assert.deepEqual(await off.router.decisions(off.parent),[]);
  await assert.rejects(off.router.run(off.parent,request(),exec('off')),{code:'ROUTER_DISABLED'});assert.deepEqual(off.journal.load(),[]);
});
