import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReservationLedger } from '../src/ledger.js';
import { MemoryJournal, FileJournal } from '../src/journal.js';

const limits = { maxPendingStarts: 2, maxActivePerModel: 2, maxCreationsPerParent: 3 };
const ledger = extra => new ReservationLedger({ ...limits, ...extra });
const record = (status, extra = {}) => ({ decisionId: 'decision-1', candidateId: 'a', parentId: 'parent', policyRevision: 'revision', modelId: 'a', provider: 'provider-a', model: 'model-a', effort: 'low', kind: 'subagent', time: 0, status, ...extra });
function temporary(t) { const dir = mkdtempSync(join(tmpdir(), 'dsh-router-audit-test-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return join(dir, 'audit.jsonl'); }

test('ledger reservation transitions preserve pending/active/created invariants', () => {
  const l = ledger(), r = l.reserve('parent', 'a'), s = l.state('parent');
  assert.equal(s.pending, 1); assert.equal(s.created, 0); assert.equal(s.active.size, 1);
  l.accept(r, 'child');
  assert.equal(s.pending, 0); assert.equal(s.created, 1); assert.equal(s.active.size, 1);
  assert.throws(() => l.accept(r, 'again'), { code: 'RESERVATION_STATE' });
  l.settle('parent', 'child');
  assert.equal(s.active.size, 0); assert.equal(s.created, 1);
  const rejected = l.reserve('parent', 'b'); l.reject(rejected); l.reject(rejected);
  assert.equal(s.pending, 0); assert.equal(s.active.size, 0); assert.equal(s.created, 1);
});

test('ledger quotas reserve pending slots atomically and isolate parent identities', () => {
  const l = ledger({ maxPendingStarts: 1 });
  l.reserve('p1', 'a');
  assert.throws(() => l.reserve('p1', 'b'), { code: 'PENDING_LIMIT' });
  assert.doesNotThrow(() => l.reserve('p2', 'a'));
  const capacity = ledger({ maxActivePerModel: 1 });
  const r = capacity.reserve('p', 'a'); capacity.accept(r, 'child');
  assert.throws(() => capacity.reserve('p', 'a'), { code: 'MODEL_CAPACITY' });
  assert.doesNotThrow(() => capacity.reserve('p', 'b'));
});

test('unknown creation effects pause the parent even when the pending reservation is released', () => {
  const l = ledger(), r = l.reserve('parent', 'a');
  l.unknown(r);
  assert.equal(l.state('parent').pending, 0);
  assert.equal(l.state('parent').active.size, 0);
  assert.throws(() => l.reserve('parent', 'b'), { code: 'RECOVERY_REQUIRED' });
});

test('recovery pauses unresolved intent/accepted/unknown and counts completed decisions once', () => {
  for (const status of ['intent', 'accepted', 'unknown']) {
    const l = ledger();
    const records = status === 'intent' ? [record('intent')] : [record('intent'), record(status, status === 'accepted' ? { childId: 'child' } : {})];
    l.recover(records);
    assert.throws(() => l.reserve('parent', 'a'), { code: 'RECOVERY_REQUIRED' });
    assert.equal(l.state('parent').created, status === 'intent' ? 0 : 1);
  }
  const settled = ledger({ maxCreationsPerParent: 1 });
  settled.recover([record('intent'), record('accepted', { childId: 'child' }), record('settled', { childId: 'child' })]);
  assert.equal(settled.state('parent').created, 1);
  assert.equal(settled.state('parent').paused, false);
  assert.throws(() => settled.reserve('parent', 'a'), { code: 'CREATION_LIMIT' });
  const rejected = ledger(); rejected.recover([record('intent'), record('rejected')]);
  assert.doesNotThrow(() => rejected.reserve('parent', 'a'));
});

test('recovery rejects corrupt status and incomplete identity rather than silently reopening quota', () => {
  for (const records of [[null], [record('accpted')], [record('intent', { decisionId: '' })], [record('intent', { parentId: '' })]]) {
    assert.throws(() => ledger().recover(records), { code: 'AUDIT_CORRUPT' });
  }
});

test('recovery rejects missing candidate identities and unknown audit fields', () => {
  for (const extra of [{candidateId:undefined},{candidateId:''},{candidateId:'x'.repeat(121)},{kind:'teammate'},{unexpected:'value'}]) {
    assert.throws(()=>ledger().recover([record('intent',extra)]),{code:'AUDIT_FORMAT_UNSUPPORTED'});
  }
});

test('recovery refuses identity drift and impossible state transitions for a decision', () => {
  for (const records of [
    [record('intent'), record('accepted', { parentId: 'other-parent', childId: 'child' })],
    [record('intent'), record('accepted', { modelId: 'b', childId: 'child' })],
    [record('intent'), record('accepted', { candidateId: 'b', childId: 'child' })],
    [record('intent'), record('accepted', { childId: 'child' }), record('rejected')],
  ]) assert.throws(() => ledger().recover(records), { code: 'AUDIT_CORRUPT' });
});

test('MemoryJournal snapshots detach all record objects', () => {
  const j = new MemoryJournal(), input = { ...record('intent'), nested: { value: 1 } };
  j.append(input); input.nested.value = 2;
  const snapshot = j.load(); assert.equal(snapshot[0].nested.value, 1);
  snapshot[0].nested.value = 3; assert.equal(j.load()[0].nested.value, 1);
});

test('FileJournal persists parseable append records and releases its own lock on close', t => {
  const file = temporary(t), j = new FileJournal(file);
  try {
    assert.ok(existsSync(file + '.lock'));
    j.append(record('intent')); j.append(record('accepted', { childId: 'child' }));
    assert.deepEqual(j.load().map(r => r.status), ['intent', 'accepted']);
    assert.equal(readFileSync(file, 'utf8').split('\n').filter(Boolean).length, 2);
    assert.throws(() => new FileJournal(file), { code: 'AUDIT_LOCKED' });
  } finally { j.close(); }
  assert.equal(existsSync(file + '.lock'), false);
  const reopened = new FileJournal(file); try { assert.equal(reopened.load().length, 2); } finally { reopened.close(); }
  assert.throws(() => j.append(record('intent')), { code: 'AUDIT_CLOSED' });
  assert.doesNotThrow(() => j.close());
});

test('FileJournal does not bypass crash ownership locks or delete a foreign replacement lock', t => {
  const file = temporary(t); writeFileSync(file + '.lock', '{"owner":"crashed-process"}');
  assert.throws(() => new FileJournal(file), { code: 'AUDIT_LOCKED' });
  assert.equal(JSON.parse(readFileSync(file + '.lock', 'utf8')).owner, 'crashed-process');
  rmSync(file + '.lock');
  const j = new FileJournal(file);
  writeFileSync(file + '.lock', '{"owner":"replacement"}');
  assert.throws(() => j.close(), { code: 'AUDIT_LOCKED' });
  assert.equal(JSON.parse(readFileSync(file + '.lock', 'utf8')).owner, 'replacement');
});

test('FileJournal fails closed on torn JSON and cleans the lock on failed construction', t => {
  const file = temporary(t); writeFileSync(file, JSON.stringify(record('intent')) + '\n{"partial":');
  assert.throws(() => new FileJournal(file), { code: 'AUDIT_CORRUPT' });
  assert.equal(existsSync(file + '.lock'), false);
});

test('FileJournal rejects relative paths and non-file destinations', t => {
  assert.throws(() => new FileJournal('relative-audit.jsonl'), { code: 'AUDIT_PATH' });
  const file = temporary(t); mkdirSync(file);
  assert.throws(() => new FileJournal(file), { code: 'AUDIT_PATH' });
});
