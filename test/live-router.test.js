import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveRouter } from '../src/live-router.js';
import { normalizeConfig } from '../src/config.js';
import { MemoryJournal } from '../src/journal.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
class CountingJournal extends MemoryJournal { closes = 0; close() { this.closes++; } }
const candidate = id => ({ id, name:'Candidate '+id, provider: 'provider-' + id, model: 'model-' + id, effort:'low' });
const policy = extra => normalizeConfig({ schemaVersion:3, enabled: true, candidates: [candidate('a'), candidate('b')], defaultCandidateId:'a', ...extra });
const request = extra => ({ prompt: 'Bounded child work', description: 'child work', ...extra });
const execution = (callId, signal) => ({ callId, signal });
const metadata = { inputModalities: ['text'], context: { contextWindow: 100000 }, reasoning: { efforts: ['low', 'high'], defaultEffort: 'low' } };
function fixture(overrides = {}) {
  const owners = [], starts = [], paths = [];
  const parent = Object.freeze({ id: 'parent', provider: 'parent-provider', model: 'parent-model', session: Object.freeze({ header: Object.freeze({ origin: 'root' }) }) });
  let current = { policy: policy(overrides.policy), auditFile: 'C:/audit/router.jsonl' };
  let readError;
  const { policy: _, createJournal, ...dependencies } = overrides;
  const router = new LiveRouter({
    readConfig: () => { if (readError) throw readError; return current; },
    createJournal: path => { paths.push(path); const journal = createJournal ? createJournal(path) : new CountingJournal(); owners.push(journal); return journal; },
    resolveModel: async () => structuredClone(metadata),
    readAuthorization: () => ['a', 'b'].map(id => ({ provider: 'provider-' + id, model: 'model-' + id })),
    preflight: async () => {},
    invokeNative: async args => { starts.push(args); return { kind: 'activation', childId: 'child-' + starts.length }; },
    estimateContext: () => 100,
    ...dependencies,
  });
  return { router, parent, owners, starts, paths,
    get current() { return current; },
    replace(extra, auditFile = current.auditFile) { current = { policy: policy(extra), auditFile }; return current; },
    candidate(extra, auditFile = current.auditFile) { return { policy: policy(extra), auditFile }; },
    setReadError(error) { readError = error; },
  };
}
const fails = (fn, code) => assert.rejects(async () => fn(), { code });

test('disabled status and disabled admissions do not acquire an audit owner', async () => {
  const f = fixture({ policy: { enabled: false } });
  assert.equal(f.router.status().enabled, false);
  assert.equal(f.router.status().activeRevision, null);
  assert.equal(f.router.status().configurationPending, false);
  await fails(() => f.router.run(f.parent, request(), execution('disabled')), 'ROUTER_DISABLED');
  assert.equal(f.owners.length, 0); assert.equal(f.starts.length, 0);
  f.router.close(); assert.equal(f.owners.length, 0);
});

test('first enable lazily creates one owner and preserves parent Agent options', async () => {
  const f = fixture({ policy: { enabled: false } }), before = structuredClone(f.parent);
  const enabled = f.candidate({ defaultCandidateId: 'b' });
  assert.doesNotThrow(() => f.router.validateUpdate(enabled));
  assert.equal(f.owners.length, 0);
  f.replace({ defaultCandidateId: 'b' });
  const result = await f.router.run(f.parent, request(), execution('first'));
  assert.equal(result.selected.model, 'model-b');
  assert.equal(f.owners.length, 1); assert.deepEqual(f.paths, ['C:/audit/router.jsonl']);
  assert.deepEqual(f.parent, before);
  assert.equal(f.router.status().configurationPending, false);
  assert.equal(f.router.status().configuredRevision, f.router.status().activeRevision);
  f.router.close();
});

test('revision switch uses the new route while old call identity returns the exact original receipt', async () => {
  const f = fixture(), one = f.router.run(f.parent, request(), execution('one'));
  const result = await one; f.router.settle(f.parent.id, result.childId);
  const oldRuntime = f.router.runtime;
  f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' }));
  f.replace({ defaultCandidateId: 'b' });
  const second = await f.router.run(f.parent, request(), execution('two'));
  assert.equal(second.selected.model, 'model-b');
  assert.notEqual(f.router.runtime, oldRuntime);
  const replay = f.router.run(f.parent, request(), execution('one'));
  assert.equal(replay, one); assert.deepEqual(await replay, result);
  assert.equal(f.starts.length, 2); assert.equal(f.owners.length, 1); assert.equal(f.owners[0].closes, 0);
  assert.throws(() => f.router.run(f.parent, request({ prompt: 'Changed task' }), execution('one')), { code: 'CALL_ID_REUSE' });
  f.router.close(); assert.equal(f.owners[0].closes, 1);
});

test('saved disabled or malformed configuration never causes an old host call to start twice', async () => {
  const f = fixture(), original = f.router.run(f.parent, request(), execution('one'));
  await original; f.replace({ enabled: false });
  assert.equal(f.router.run(f.parent, request(), execution('one')), original);
  f.setReadError(Object.assign(new Error('Malformed saved config'), { code: 'INVALID_CONFIG' }));
  assert.equal(f.router.run(f.parent, request(), execution('one')), original);
  assert.equal(f.starts.length, 1);
  assert.equal(f.router.status().configurationError.code, 'INVALID_CONFIG');
  f.router.close();
});

test('prepare inFlight guard rejects policy updates before any intent or native creation', async () => {
  const entered = deferred(), release = deferred();
  const f = fixture({ resolveModel: async () => { entered.resolve(); await release.promise; return metadata; } });
  const running = f.router.run(f.parent, request(), execution('one'));
  await entered.promise;
  assert.equal(f.router.status().inFlight, 1);
  assert.equal(f.router.status().switchingBlocked, true);
  assert.deepEqual(f.owners[0].load(), []);
  assert.throws(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })), { code: 'CONFIG_BUSY' });
  assert.doesNotThrow(() => f.router.validateUpdate(f.current));
  release.resolve(); const result = await running;
  f.router.settle(f.parent.id, result.childId);
  assert.doesNotThrow(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })));
  f.router.close();
});

test('creation preflight participates in the update guard and rejection releases inFlight without an audit intent', async () => {
  const entered = deferred(), release = deferred();
  const f = fixture({ preflight: async () => { entered.resolve(); await release.promise; throw Object.assign(Error('preflight refused'),{code:'PREFLIGHT'}); } });
  const running = f.router.run(f.parent, request(), execution('preflight')); await entered.promise;
  assert.equal(f.router.inFlight, 1);
  assert.throws(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })), { code: 'CONFIG_BUSY' });
  release.resolve(); await assert.rejects(running,{code:'PREFLIGHT'});
  assert.equal(f.router.inFlight, 0); assert.deepEqual(f.owners[0].load(), []);
  assert.equal(f.starts.length, 0);
  assert.doesNotThrow(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })));
  f.router.close();
});

test('accepted live children block revisions until their lifecycle settlement, not merely until run resolves', async () => {
  const f = fixture(); const child = await f.router.run(f.parent, request(), execution('one'));
  assert.equal(f.router.inFlight, 0); assert.equal(f.router.pending(), true);
  assert.throws(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })), { code: 'CONFIG_BUSY' });
  f.router.settle(f.parent.id, child.childId);
  assert.equal(f.router.pending(), false);
  assert.doesNotThrow(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })));
  f.replace({ defaultCandidateId: 'b' }); await f.router.run(f.parent, request(), execution('later'));
  assert.equal(f.owners.length, 1);
  f.router.close();
});

test('bypassing the pre-save guard still cannot switch routes while children are active', async () => {
  const f = fixture(); const child = await f.router.run(f.parent, request(), execution('one'));
  f.replace({ defaultCandidateId: 'b' });
  assert.equal(f.router.status().configurationPending, true);
  await fails(() => f.router.run(f.parent, request(), execution('two')), 'CONFIG_BUSY');
  assert.equal(f.starts.length, 1);
  f.router.settle(f.parent.id, child.childId);
  assert.equal(f.router.pending(), false);
  const second = await f.router.run(f.parent, request(), execution('three'));
  assert.equal(second.selected.model, 'model-b');
  f.router.close();
});

test('disable blocks new work immediately without disposing the runtime needed for settle', async () => {
  const f = fixture(); const first = await f.router.run(f.parent, request(), execution('one'));
  const runtime = f.router.runtime;
  assert.doesNotThrow(() => f.router.validateUpdate(f.candidate({ enabled: false, defaultCandidateId: 'b' })));
  f.replace({ enabled: false, defaultCandidateId: 'b' });
  await fails(() => f.router.run(f.parent, request(), execution('disabled')), 'ROUTER_DISABLED');
  assert.equal(f.router.runtime, runtime); assert.equal(f.owners[0].closes, 0);
  f.router.settle(f.parent.id, first.childId);
  assert.deepEqual(f.owners[0].load().map(r => r.status), ['intent', 'accepted', 'settled']);
  f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' }));
  f.replace({ defaultCandidateId: 'b' });
  const next = await f.router.run(f.parent, request(), execution('after-enable'));
  assert.equal(next.selected.model, 'model-b');
  assert.equal(f.owners.length, 1);
  f.router.close();
});

test('configuration changing during metadata await rejects the old plan before native publication', async () => {
  const entered = deferred(), release = deferred();
  const f = fixture({ resolveModel: async () => { entered.resolve(); await release.promise; return metadata; } });
  const running = f.router.run(f.parent, request(), execution('one')); await entered.promise;
  f.replace({ defaultCandidateId: 'b' }); release.resolve();
  await assert.rejects(running, { code: 'STALE_CONFIG' });
  assert.equal(f.starts.length, 0); assert.equal(f.router.inFlight, 0);
  assert.deepEqual(f.owners[0].load(), []);
  const later = await f.router.run(f.parent, request(), execution('two'));
  assert.equal(later.selected.model, 'model-b');
  assert.equal(f.owners.length, 1);
  f.router.close();
});

test('configuration disabling during preflight rejects old options rather than publishing them', async () => {
  const entered = deferred(), release = deferred();
  const f = fixture({ preflight: async () => { entered.resolve(); await release.promise; } });
  const running = f.router.run(f.parent, request(), execution('one')); await entered.promise;
  f.replace({ enabled: false }); release.resolve();
  await assert.rejects(running, { code: 'STALE_CONFIG' });
  assert.equal(f.starts.length, 0); assert.equal(f.router.inFlight, 0);
  f.router.close();
});

test('last synchronous revision check rejects configuration changed by intent publication before native dispatch', async () => {
  let f, changed = false;
  class UpdatingJournal extends CountingJournal { append(record) { super.append(record); if (record.status === 'intent' && !changed) { changed = true; f.replace({ defaultCandidateId: 'b' }); } } }
  f = fixture({ createJournal: () => new UpdatingJournal() });
  await fails(() => f.router.run(f.parent, request(), execution('one')), 'STALE_CONFIG');
  assert.equal(f.starts.length, 0);
  assert.deepEqual(f.owners[0].load().map(record => record.status), ['intent', 'rejected']);
  const next = await f.router.run(f.parent, request(), execution('two'));
  assert.equal(next.selected.model, 'model-b');
  assert.equal(f.owners.length, 1);
  f.router.close();
});

test('coordinator routes an end-before-receipt event to the original runtime and permits a later revision', async () => {
  let f;
  f = fixture({ invokeNative: async () => { f.router.settle(f.parent.id, 'fast-child'); return { kind: 'activation', childId: 'fast-child' }; } });
  await f.router.run(f.parent, request(), execution('one'));
  assert.deepEqual(f.owners[0].load().map(record => record.status), ['intent', 'accepted', 'settled']);
  assert.equal(f.router.pending(), false);
  assert.doesNotThrow(() => f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })));
  f.replace({ defaultCandidateId: 'b' });
  const next = await f.router.run(f.parent, request(), execution('later'));
  assert.equal(next.candidateId, 'b');
  assert.equal(f.owners.length, 1);
  f.router.close();
});

test('unknown outcomes retain parent pause across revisions and preserve failed call receipts', async () => {
  let starts = 0;
  const f = fixture({ invokeNative: async () => { starts++; throw Object.assign(new Error('reply lost'), { code: 'TRANSPORT' }); } });
  const first = f.router.run(f.parent, request(), execution('one'));
  await assert.rejects(first, { code: 'TRANSPORT' });
  assert.deepEqual(f.owners[0].load().map(r => r.status), ['intent', 'unknown']);
  assert.equal(f.router.pending(), true);
  assert.throws(()=>f.router.validateUpdate(f.candidate({ defaultCandidateId: 'b' })),{code:'CONFIG_BUSY'});
  await fails(() => f.router.run(f.parent, request(), execution('two')), 'RECOVERY_REQUIRED');
  f.replace({defaultCandidateId:'b'});
  await fails(() => f.router.run(f.parent,request(),execution('changed')), 'CONFIG_BUSY');
  f.router.settle(f.parent.id, 'late-child');
  assert.deepEqual(f.owners[0].load().map(r => r.status), ['intent', 'unknown']);
  assert.equal(f.router.run(f.parent, request(), execution('one')), first);
  assert.equal(starts, 1); assert.equal(f.owners.length, 1);
  f.router.close();
});

test('cumulative parent creation quotas survive fresh runtime reconstruction after policy edits', async () => {
  const f = fixture({ policy: { limits: { maxCreationsPerParent: 1 } } });
  const first = await f.router.run(f.parent, request(), execution('one'));
  f.router.settle(f.parent.id, first.childId);
  const next = { defaultCandidateId: 'b', limits: { maxCreationsPerParent: 1 } };
  f.router.validateUpdate(f.candidate(next)); f.replace(next);
  await fails(() => f.router.run(f.parent, request(), execution('two')), 'CREATION_LIMIT');
  assert.equal(f.starts.length, 1); assert.equal(f.router.runtime.ledger.state(f.parent.id).created, 1);
  assert.equal(f.owners.length, 1);
  f.router.close();
});

test('fixed audit file cannot be changed by either validation or execution after initialization', async () => {
  const f = fixture(); const first=await f.router.run(f.parent, request(), execution('initial')); f.router.settle(f.parent.id,first.childId);
  assert.throws(() => f.router.validateUpdate(f.candidate({}, 'C:/audit/other.jsonl')), { code: 'AUDIT_PATH_RELOAD_REQUIRED' });
  assert.throws(() => f.router.validateUpdate(f.candidate({ enabled: false }, 'C:/audit/other.jsonl')), { code: 'AUDIT_PATH_RELOAD_REQUIRED' });
  f.replace({}, 'C:/audit/other.jsonl');
  await fails(() => f.router.run(f.parent, request(), execution('one')), 'AUDIT_PATH_RELOAD_REQUIRED');
  assert.equal(f.owners.length, 1); assert.equal(f.starts.length, 1);
  f.router.close();
});

test('corrupt first recovery closes the fresh owner and does not publish a partial runtime', async () => {
  const f = fixture({ createJournal: () => { const journal = new CountingJournal(); journal.records = [{ decisionId: 'd', parentId: 'p', status: 'invalid' }]; return journal; } });
  await fails(() => f.router.run(f.parent, request(), execution('one')), 'AUDIT_CORRUPT');
  assert.equal(f.owners.length, 1); assert.equal(f.owners[0].closes, 1);
  assert.equal(f.router.journal, undefined); assert.equal(f.router.runtime, undefined);
  assert.equal(f.starts.length, 0);
  f.router.close(); assert.equal(f.owners[0].closes, 1);
});

test('initial journal read failure closes its fresh owner even before runtime recovery starts', async () => {
  class BrokenJournal extends CountingJournal { load() { throw Object.assign(new Error('unreadable journal'), { code: 'AUDIT_IO' }); } }
  const f = fixture({ createJournal: () => new BrokenJournal() });
  await fails(() => f.router.run(f.parent, request(), execution('initial')), 'AUDIT_IO');
  assert.equal(f.owners.length, 1); assert.equal(f.owners[0].closes, 1);
  assert.equal(f.router.runtime, undefined); assert.equal(f.router.journal, undefined);
  f.router.close(); assert.equal(f.owners[0].closes, 1);
});

test('closing after multiple successful revisions releases the real owner exactly once', async () => {
  const f = fixture();
  const first=await f.router.run(f.parent, request(), execution('initial'));f.router.settle(f.parent.id,first.childId);
  let call=0;
  for (const defaultCandidateId of ['b', 'a', 'b']) { f.replace({ defaultCandidateId }); const child=await f.router.run(f.parent, request(), execution('revision-'+call++));f.router.settle(f.parent.id,child.childId); }
  assert.equal(f.owners.length, 1); assert.equal(f.owners[0].closes, 0);
  f.router.close(); f.router.close();
  assert.equal(f.owners[0].closes, 1);
  await fails(() => f.router.run(f.parent, request(), execution('closed')), 'ROUTER_DISABLED');
  assert.equal(f.owners.length, 1);
});

test('invalid request identities cannot enter the receipt cache or create a child', async () => {
  const f = fixture();
  await fails(() => f.router.run(f.parent, request(), {}), 'INVALID_REQUEST');
  await fails(() => f.router.run(f.parent, request(), execution('')), 'INVALID_REQUEST');
  await fails(() => f.router.run(f.parent, { ...request(), unexpected: true }, execution('unsafe')), 'INVALID_REQUEST');
  assert.equal(f.router.calls.size, 0); assert.equal(f.owners.length, 0);
  f.router.close();
});

test('decision read is lazy even when enabled and never opens a journal or runtime',async()=>{
  for(const enabled of [true,false]){
    const f=fixture({policy:{enabled}});
    assert.deepEqual(await f.router.decisions(f.parent),[]);assert.equal(f.owners.length,0);assert.equal(f.router.runtime,undefined);
    await assert.rejects(f.router.decisions(f.parent,{limit:101}),{code:'INVALID_REQUEST'});assert.equal(f.owners.length,0);
    await assert.rejects(f.router.decisions({id:'child',session:{header:{origin:'subagent'}}}),{code:'ROOT_ONLY'});
  }
});

test('decision snapshots isolate parents, distinguish acceptance from actual request, and survive disable settlement',async()=>{
  let observed=null;
  const f=fixture({readChildRoute:async()=>observed});
  const result=await f.router.run(f.parent,request({candidate_id:'a'}),execution('first'));
  const [accepted]=await f.router.decisions(f.parent);assert.equal(accepted.status,'accepted');assert.equal(accepted.observed,null);assert.equal(accepted.candidateId,'a');
  assert.deepEqual(await f.router.decisions({id:'foreign',session:{header:{origin:'root'}}}),[]);
  observed={provider:'actual',model:'request',effort:'high',secret:'credential'};
  assert.equal((await f.router.decisions(f.parent))[0].status,'observed');
  const disabled=f.candidate({enabled:false});f.router.validateUpdate(disabled);f.replace({enabled:false});
  f.router.settle(f.parent.id,result.childId);f.router.settle(f.parent.id,result.childId);
  const [settled]=await f.router.decisions(f.parent);assert.equal(settled.status,'settled');assert.equal(settled.settled,true);
  assert.equal(f.owners[0].load().filter(r=>r.status==='settled').length,1);
  assert.equal(JSON.stringify(settled).includes('credential'),false);f.router.close();
});

test('recovered accepted records are unknown snapshots and a late end cannot auto reconcile them',async()=>{
  const original=fixture();const result=await original.router.run(original.parent,request(),execution('one'));
  const records=original.owners[0].load();original.router.close();
  const f=fixture({createJournal:()=>{const journal=new CountingJournal();journal.records=structuredClone(records);return journal;}});
  f.router.ensure();const [before]=await f.router.decisions(f.parent);assert.equal(before.status,'unknown');assert.equal(before.accepted,true);assert.equal(before.settled,false);
  f.router.settle(f.parent.id,result.childId);assert.equal((await f.router.decisions(f.parent))[0].status,'unknown');
  await fails(()=>f.router.run(f.parent,request(),execution('new')),'RECOVERY_REQUIRED');f.router.close();
});

const terminalEvidence=(parentId='parent',childId='old-child')=>({source:'persisted-turn-end',parentId,childId,startSeq:4,endSeq:9,reason:'completed'});
function recordedAcceptedJournal(status='accepted'){
  const journal=new CountingJournal();const base={decisionId:'old-decision',candidateId:'recorded-candidate',parentId:'parent',policyRevision:'original-revision',modelId:'old-model-alias',provider:'old-provider',model:'old-model',effort:'high',kind:'subagent'};
  journal.append({...base,status:'intent',time:1});journal.append({...base,status,childId:'old-child',time:2});return journal;
}
test('explicit recovery works while disabled, preserves recorded candidate identity and never creates an Agent',async()=>{
  const journal=recordedAcceptedJournal(),original=structuredClone(journal.load());const f=fixture({policy:{enabled:false},createJournal:()=>journal});
  assert.equal(f.router.status().enabled,false);assert.deepEqual(await f.router.decisions(f.parent),[]);assert.equal(f.owners.length,0);
  const result=f.router.reconcile('parent','old-child',terminalEvidence());assert.equal(result.reconciled,true);
  assert.equal(f.owners.length,1);assert.equal(f.owners[0].closes,0);assert.equal(f.starts.length,0);assert.equal(f.router.calls.size,0);
  assert.deepEqual(journal.load().slice(0,2),original);const settled=journal.load()[2];
  for(const field of ['decisionId','candidateId','parentId','policyRevision','modelId','provider','model','effort','kind','childId'])assert.equal(settled[field],original[1][field]);
  assert.equal(settled.status,'settled');assert.equal(f.router.pending(),false);assert.equal(f.router.runtime.ledger.state('parent').created,1);
  assert.equal(f.router.runtime.ledger.state('parent').paused,false);
  const [card]=await f.router.decisions(f.parent);assert.equal(card.settled,true);assert.equal(card.unknown,false);
  assert.equal(f.router.reconcile('parent','old-child',terminalEvidence()).alreadySettled,true);assert.equal(journal.load().length,3);
  await fails(()=>f.router.run(f.parent,request(),execution('still-off')),'ROUTER_DISABLED');f.router.close();assert.equal(journal.closes,1);
});
test('unknown recovery cannot clear history, parent pause or journal ownership even while disabled',async()=>{
  const journal=recordedAcceptedJournal('unknown'),before=structuredClone(journal.load());const f=fixture({policy:{enabled:false},createJournal:()=>journal});
  assert.throws(()=>f.router.reconcile('parent','old-child',terminalEvidence()),{code:'RECOVERY_REQUIRED'});
  assert.deepEqual(journal.load(),before);assert.equal(f.router.pending(),true);assert.equal(f.router.runtime.ledger.state('parent').paused,true);assert.equal(journal.closes,0);
  assert.throws(()=>f.router.validateUpdate(f.candidate({enabled:true})),{code:'CONFIG_BUSY'});
  assert.equal(f.starts.length,0);f.router.close();assert.equal(journal.closes,1);
});
test('reconciliation evidence and cross-parent failures never append or release the audit owner',()=>{
  for(const evidence of [undefined,terminalEvidence('foreign'),{...terminalEvidence(),source:'inactive'}, {...terminalEvidence(),startSeq:9,endSeq:4}]){
    const journal=recordedAcceptedJournal(),before=structuredClone(journal.load());const f=fixture({policy:{enabled:false},createJournal:()=>journal});
    assert.throws(()=>f.router.reconcile('parent','old-child',evidence),{code:'RECONCILIATION_EVIDENCE'});
    assert.deepEqual(journal.load(),before);assert.equal(journal.closes,0);assert.equal(f.router.runtime.ledger.state('parent').paused,true);assert.equal(f.starts.length,0);f.router.close();
  }
  const journal=recordedAcceptedJournal(),f=fixture({policy:{enabled:false},createJournal:()=>journal});
  assert.throws(()=>f.router.reconcile('foreign','old-child',terminalEvidence('foreign')),{code:'RECONCILIATION_SCOPE'});assert.equal(journal.closes,0);assert.equal(journal.load().length,2);f.router.close();
});
test('ambiguous recovery writes keep ownership and pause without repeating mutation',()=>{
  const journal=recordedAcceptedJournal();const append=journal.append.bind(journal);let attempted=0;
  journal.append=record=>{if(record.status==='settled'){attempted++;throw Object.assign(Error('fsync failure'),{code:'AUDIT_IO'});}append(record);};
  const f=fixture({policy:{enabled:false},createJournal:()=>journal});
  assert.throws(()=>f.router.reconcile('parent','old-child',terminalEvidence()),{code:'AUDIT_IO'});
  assert.equal(journal.closes,0);assert.equal(f.router.pending(),true);assert.equal(f.router.runtime.ledger.state('parent').paused,true);
  assert.throws(()=>f.router.reconcile('parent','old-child',terminalEvidence()),{code:'RECOVERY_REQUIRED'});assert.equal(attempted,1);assert.equal(journal.load().length,2);assert.equal(f.starts.length,0);
  f.router.close();assert.equal(journal.closes,1);
});

const nativeExecution = (id, signal) => ({callId:id,signal,arguments:request()});

test('native spawn and team fork use the live preset and share one journal and quota', async () => {
  const f=fixture();
  const first=await f.router.prepareNative(f.parent,{},nativeExecution('default'),'subagent');
  assert.deepEqual([first.provider,first.model,first.effort],['provider-a','model-a','low']);
  assert.deepEqual(f.owners[0].load(), []); // approvals and guards have not admitted it yet
  first.beforeStart();
  f.router.settle(f.parent.id,'native-a',{source:'subagent/end',runId:'early-end'});
  first.accepted('native-a');
  const initial=f.owners[0].load();
  assert.deepEqual(initial.map(row=>[row.status,row.entry,row.routingReason]),[['intent','subagent','default-candidate'],['accepted','subagent','default-candidate'],['settled','subagent','default-candidate']]);
  await fails(()=>f.router.prepareNative(f.parent,{},nativeExecution('default'),'subagent'),'CALL_ID_REUSE');
  f.router.validateUpdate(f.candidate({defaultCandidateId:'b'}));
  f.replace({defaultCandidateId:'b'});
  const fork=await f.router.prepareNative(f.parent,{},nativeExecution('fork'),'subagent_fork');
  assert.equal(fork.model,'model-b');
  fork.beforeStart(); fork.accepted('native-b');
  const routed=await f.router.run(f.parent,request({candidate_id:'a'}),execution('legacy'));
  assert.equal(routed.selected.model,'model-a');
  const observed=await f.router.decisions(f.parent);
  assert.equal(observed.find(row=>row.childId==='native-b').entry,'subagent_fork');
  assert.equal(f.owners.length,1); assert.equal(f.starts.length,1); // only the compatibility tool dispatches natively itself
  f.router.close();
});

test('disabled, abandoned, stale and cancelled native preparations do not leave a reservation', async () => {
  const f=fixture({policy:{enabled:false}});
  assert.equal(await f.router.prepareNative(f.parent,{},nativeExecution('off'),'subagent'),undefined);
  assert.equal(f.owners.length,0);
  f.replace({enabled:true});
  const lease=await f.router.prepareNative(f.parent,{},nativeExecution('stale'),'subagent');
  assert.throws(()=>lease.accepted('not-created'),{code:'INVALID_ACTIVATION'});
  f.replace({defaultCandidateId:'b'});
  assert.throws(()=>lease.beforeStart(),{code:'STALE_CONFIG'});
  assert.deepEqual(f.owners[0].load(),[]);
  const signal=new AbortController();
  const cancelled=await f.router.prepareNative(f.parent,{},nativeExecution('cancel',signal.signal),'subagent');
  signal.abort();
  assert.throws(()=>cancelled.beforeStart(),{code:'CANCELLED'});
  assert.deepEqual(f.owners[0].load(),[]);
  f.router.close();
});

test('successful native execution blocks duplicate leases and unknown creation is never replayed', async () => {
  const f=fixture();
  const one=await f.router.prepareNative(f.parent,{candidate_id:'b'},nativeExecution('same'),'subagent');
  const two=await f.router.prepareNative(f.parent,{candidate_id:'b'},nativeExecution('same'),'subagent');
  one.beforeStart();
  assert.throws(()=>two.beforeStart(),{code:'CALL_ID_REUSE'});
  one.unknown(new Error('native host cannot establish receipt'));
  one.unknown();
  assert.deepEqual(f.owners[0].load().map(row=>row.status),['intent','unknown']);
  const next=await f.router.prepareNative(f.parent,{},nativeExecution('new'),'subagent');
  assert.throws(()=>next.beforeStart(),{code:'RECOVERY_REQUIRED'});
  f.replace({enabled:false});
  await fails(()=>f.router.prepareNative(f.parent,{},nativeExecution('same'),'subagent'),'CALL_ID_REUSE');
  assert.equal(await f.router.prepareNative(f.parent,{},nativeExecution('different'),'subagent'),undefined);
  f.router.close();
});
