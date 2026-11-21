import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { normalizeConfigSets, compileStoredConfig, readStoredDraftPool } from '../src/config-sets.js';

const candidate = (id = 'fixed') => ({ id, name: 'Global ' + id, provider: 'provider-' + id, model: 'model-' + id, effort: null, description: 'Global description' });
const policy = extra => ({ schemaVersion: 3, enabled: true, candidates: [candidate()], defaultCandidateId: 'fixed', ...extra });
const entry = (id = 'one', name = '任意名称 / 自由组合', extra) => ({ id, name, defaultCandidateId: 'fixed', overrides: [], ...extra });
const sets = (configs = [entry()], activeConfigId = configs[0]?.id, extra) => ({ schemaVersion: 4, enabled: true, candidates: [candidate(), candidate('other')], activeConfigId, configs, ...extra });
const invalid = raw => {
  assert.throws(() => normalizeConfigSets(raw), { code: 'INVALID_CONFIG' });
  assert.throws(() => compileStoredConfig(raw), { code: 'INVALID_CONFIG' });
};
const routes = value => value.candidates.map(({ id, provider, model, effort }) => ({ id, provider, model, effort }));
function frozen(value) {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}

test('v4 stores only a global pool and lightweight named presets; normalized data is detached and deeply frozen', () => {
  const raw = sets([entry('one', '  我的预设 / One  '), entry('two', '非场景限定 · 二', {
    defaultCandidateId: 'other', overrides: [{ id: 'fixed', name: 'Preset name', description: '' }],
  })], 'two', { limits: { maxPendingStarts: 2 } });
  const before = structuredClone(raw), result = normalizeConfigSets(raw);
  assert.deepEqual(raw, before); frozen(result);
  assert.deepEqual(Object.keys(result), ['schemaVersion', 'enabled', 'candidates', 'limits', 'activeConfigId', 'configs']);
  assert.equal(result.configs[0].name, '我的预设 / One');
  assert.deepEqual(result.candidates, normalizeConfig({ schemaVersion: 3, candidates: raw.candidates }).candidates);
  assert.deepEqual(result.configs[1], { id: 'two', name: '非场景限定 · 二', defaultCandidateId: 'other', overrides: [{ id: 'fixed', name: 'Preset name', description: '' }] });
  assert.equal(result.limits.maxPendingStarts, 2);
  assert.notEqual(result.candidates[0], raw.candidates[0]);
  assert.notEqual(result.configs[1].overrides[0], raw.configs[1].overrides[0]);
  raw.candidates[0].model = 'changed'; raw.configs[1].overrides[0].name = 'changed';
  assert.equal(result.candidates[0].model, 'model-fixed'); assert.equal(result.configs[1].overrides[0].name, 'Preset name');
  assert.deepEqual(normalizeConfigSets(result), result);
});

test('switching presets changes only candidate labels and default, never global routes, membership, enablement or limits', () => {
  const raw = sets([entry('one', 'One'), entry('two', 'Two', {
    defaultCandidateId: 'other', overrides: [{ id: 'other', name: 'Other preset label' }, { id: 'fixed', name: 'Fixed preset label', description: '' }],
  })], 'one', { limits: { maxActivePerModel: 3 } });
  const before = structuredClone(raw), first = compileStoredConfig(raw);
  raw.activeConfigId = 'two'; const second = compileStoredConfig(raw);
  assert.deepEqual(routes(first), routes(second)); assert.deepEqual(routes(second), routes(raw));
  assert.equal(second.candidates[0].name, 'Fixed preset label'); assert.equal(second.candidates[0].description, '');
  assert.equal(second.candidates[1].name, 'Other preset label'); assert.equal(second.candidates[1].description, 'Global description');
  assert.equal(first.defaultCandidateId, 'fixed'); assert.equal(second.defaultCandidateId, 'other');
  assert.equal(second.enabled, true); assert.deepEqual(second.limits, first.limits); assert.equal(second.limits.maxActivePerModel, 3);
  assert.deepEqual(raw.candidates, before.candidates); frozen(first); frozen(second);
  assert.equal(Object.hasOwn(second, 'configs'), false); assert.equal(Object.hasOwn(second, 'overrides'), false);
});

test('absent storage and v3 remain compatible; v4 initializes global defaults and absent overrides only', () => {
  assert.deepEqual(compileStoredConfig(), normalizeConfig());
  assert.deepEqual(compileStoredConfig(policy()), normalizeConfig(policy()));
  const raw = { schemaVersion: 4, activeConfigId: 'one', configs: [{ id: 'one', name: 'Blank' }] };
  const normalized = normalizeConfigSets(raw);
  assert.equal(normalized.enabled, false); assert.deepEqual(normalized.candidates, []);
  assert.deepEqual(normalized.limits, normalizeConfig().limits); assert.deepEqual(normalized.configs[0].overrides, []);
  assert.deepEqual(compileStoredConfig(raw), normalizeConfig());
  for (const value of [null, {}, [], false, 'text', { schemaVersion: 2 }, { schemaVersion: 5 }]) invalid(value);
  assert.throws(() => normalizeConfigSets(), { code: 'INVALID_CONFIG' });
  assert.throws(() => normalizeConfigSets(policy()), { code: 'INVALID_CONFIG' });
  assert.throws(() => normalizeConfig(raw), { code: 'INVALID_CONFIG' });
});

const fullEntry = (id = 'one', name = 'One', candidates = [candidate('fixed')], extra) => ({ id, name, candidates, ...extra });
const independent = (configs = [fullEntry('one', 'One', [candidate()], { defaultCandidateId: 'fixed' })], candidates = [candidate('pool-only')]) =>
  ({ schemaVersion: 5, enabled: true, candidates, activeConfigId: configs[0]?.id, configs });

test('v5 compiles current full profiles independently of shared draft pool and sibling presets', () => {
  const first = fullEntry('one', '  手动选择  ', [candidate('shared-id')], { defaultCandidateId: 'shared-id' });
  const second = fullEntry('two', 'Two', [{ ...candidate('shared-id'), model: 'another-model', effort: 'high' }, candidate('only-two')], { defaultCandidateId: 'only-two' });
  const raw = independent([first, second], [{ ...candidate('shared-id'), model: 'draft-only' }]);
  const before = structuredClone(raw), normalized = normalizeConfigSets(raw);
  frozen(normalized); assert.deepEqual(raw, before); assert.deepEqual(normalizeConfigSets(normalized), normalized);
  assert.equal(normalized.configs[0].name, '手动选择');
  assert.notEqual(normalized.configs[0].candidates[0], raw.configs[0].candidates[0]);
  assert.notEqual(normalized.candidates[0], raw.candidates[0]);
  assert.deepEqual(compileStoredConfig(raw), normalizeConfig({ schemaVersion: 3, enabled: true, candidates: first.candidates, defaultCandidateId: first.defaultCandidateId }));
  assert.deepEqual(readStoredDraftPool(raw), raw.candidates);
  raw.activeConfigId = 'two'; assert.deepEqual(compileStoredConfig(raw).candidates, second.candidates);
  raw.candidates = []; assert.deepEqual(readStoredDraftPool(raw), []); assert.deepEqual(compileStoredConfig(raw).candidates, second.candidates);
  delete raw.candidates; assert.deepEqual(readStoredDraftPool(raw), []); assert.deepEqual(compileStoredConfig(raw).candidates, second.candidates);
});

test('v5 requires a local default only for an enabled active preset; every supplied default must be local', () => {
  const raw = independent([fullEntry('one', 'One', [candidate()], { defaultCandidateId: 'fixed' }), fullEntry('two', 'Two', [])]);
  assert.deepEqual(normalizeConfigSets(raw).configs[1], fullEntry('two', 'Two', []));
  raw.activeConfigId = 'two'; invalid(raw);
  raw.enabled = false; assert.deepEqual(compileStoredConfig(raw).candidates, []);
  assert.equal(Object.hasOwn(compileStoredConfig(raw), 'defaultCandidateId'), false);
  raw.configs[1].candidates = [candidate('only-two')];
  invalid({ ...raw, enabled: true });
  for (const defaultCandidateId of [null, '', 'fixed', 'pool-only', 1]) {
    raw.configs[1].defaultCandidateId = defaultCandidateId; invalid(raw);
    raw.activeConfigId = 'one'; invalid(raw); raw.activeConfigId = 'two';
  }
  raw.configs[1].defaultCandidateId = 'only-two';
  assert.equal(compileStoredConfig({ ...raw, enabled: true }).defaultCandidateId, 'only-two');
});

test('v5 forbids overrides and validates complete inactive profiles without evaluating getters', () => {
  const raw = () => independent([fullEntry('one', 'One', [candidate()], { defaultCandidateId: 'fixed' }), fullEntry('two', 'Two', [candidate('other')])]);
  for (const key of ['overrides', 'policy', 'limits', 'enabled', 'provider', 'model', 'effort']) {
    const value = raw(); value.configs[1][key] = undefined; invalid(value);
  }
  for (const candidates of [undefined, null, {}, Array(1), [candidate(), candidate()], [{ ...candidate(), effort: 'default' }], [{ ...candidate(), effort: undefined }], [{ ...candidate(), model: undefined }]]) {
    const value = raw(); value.configs[1].candidates = candidates; invalid(value);
  }
  const omitted = raw(); delete omitted.configs[1].candidates; invalid(omitted);
  let reads = 0; const accessor = raw();
  Object.defineProperty(accessor.configs[1].candidates[0], 'model', { enumerable: true, get() { reads++; return 'not read'; } });
  invalid(accessor); assert.throws(() => readStoredDraftPool(accessor), { code: 'INVALID_CONFIG' }); assert.equal(reads, 0);
});

test('v5 permits 32 separate 128-profile presets and an independent 128-profile pool', () => {
  const candidates = Array.from({ length: 128 }, (_, index) => candidate('candidate-' + index));
  const configs = Array.from({ length: 32 }, (_, index) => fullEntry('preset-' + index, 'Preset ' + index,
    candidates.map(profile => ({ ...profile, name: 'Label ' + index + ' ' + profile.id })), { defaultCandidateId: candidates[index].id }));
  const raw = independent(configs, candidates); raw.activeConfigId = 'preset-31';
  const normalized = normalizeConfigSets(raw);
  assert.equal(normalized.configs.length, 32); assert.equal(normalized.candidates.length, 128);
  assert.deepEqual(compileStoredConfig(raw).candidates, configs[31].candidates);
  configs[0].candidates.push(candidate('excess')); invalid(raw);
});

test('draft pool reads retain strict v4 and unrestricted legacy v3 behavior without rewriting input', () => {
  assert.equal(readStoredDraftPool(undefined), undefined);
  assert.equal(readStoredDraftPool(policy()), undefined);
  const raw = sets([entry('one', 'One', { overrides: [{ id: 'fixed', name: 'Preset only' }] })]);
  const before = structuredClone(raw);
  assert.deepEqual(readStoredDraftPool(raw), before.candidates); assert.deepEqual(raw, before);
  assert.throws(() => readStoredDraftPool({ schemaVersion: 3, candidates: [{ ...candidate(), effort: 'default' }] }), { code: 'INVALID_CONFIG' });
  assert.throws(() => readStoredDraftPool({ ...raw, configs: [{ ...raw.configs[0], candidates: [] }] }), { code: 'INVALID_CONFIG' });
});

test('configuration list requires 1–32 entries and an exact active id without fallback', () => {
  for (const count of [1, 32]) {
    const configs = Array.from({ length: count }, (_, index) => entry('id-' + index, 'Name ' + index));
    assert.equal(normalizeConfigSets(sets(configs)).configs.length, count);
  }
  invalid(sets([])); invalid(sets(Array.from({ length: 33 }, (_, index) => entry('id-' + index, 'Name ' + index))));
  for (const configs of [undefined, null, {}, 'one', Array(1)]) invalid({ ...sets(), configs });
  for (const activeConfigId of [undefined, '', 'missing', 'ONE', null, 1, ' one', 'one/two', 'x'.repeat(121)]) invalid({ ...sets(), activeConfigId });
  const omitted = sets(); delete omitted.activeConfigId; invalid(omitted);
});

test('preset ids are safe case-sensitive strings; names trim and compare under toLowerCase without scene restrictions', () => {
  for (const id of ['A.z_9-1', 'a'.repeat(120), 'constructor', '0']) assert.equal(normalizeConfigSets(sets([entry(id)])).activeConfigId, id);
  assert.equal(normalizeConfigSets(sets([entry('a', 'First'), entry('A', 'Second')])).configs.length, 2);
  invalid(sets([entry('same', 'First'), entry('same', 'Second')]));
  for (const id of [undefined, null, 0, '', '-one', '_one', '.one', 'one/two', 'one:two', 'one two', '中文', ' a', 'a\n', 'a'.repeat(121)]) invalid(sets([{ ...entry(), id }]));
  assert.equal(normalizeConfigSets(sets([entry('a', '  ' + '中'.repeat(120) + '  ')])).configs[0].name.length, 120);
  for (const name of [undefined, null, 4, '', '   ', 'a'.repeat(121), 'a\nb', 'a\tb', 'a\x00b', 'a\x7fb']) invalid(sets([{ ...entry('a'), name }]));
  invalid(sets([entry('a', ' One '), entry('b', 'one')])); invalid(sets([entry('a', 'É'), entry('b', 'é')]));
  assert.equal(normalizeConfigSets(sets([entry('a', 'é'), entry('b', 'e\u0301')])).configs.length, 2);
});

test('strict storage rejects old per-policy v4, global defaults and per-preset routing/settings', () => {
  invalid({ schemaVersion: 4, activeConfigId: 'one', configs: [{ id: 'one', name: 'Old', policy: policy() }] });
  for (const extra of [{ defaultCandidateId: 'fixed' }, { auditFile: 'audit' }, { scenario: 'anything' }, { unknown: undefined }]) invalid({ ...sets(), ...extra });
  for (const key of ['policy', 'candidates', 'provider', 'model', 'effort', 'enabled', 'limits', 'auditFile', 'unknown']) invalid(sets([{ ...entry(), [key]: undefined }]));
  for (const overrides of [null, {}, 'text', Array(1), Array(3).fill({ id: 'fixed', name: 'Repeated' })]) invalid(sets([entry('one', 'One', { overrides })]));
});

test('every preset default references the global pool and every enabled preset requires an explicit default', () => {
  for (const defaultCandidateId of [undefined, null, '', 'missing', 1]) invalid(sets([entry('active', 'Active'), entry('inactive', 'Inactive', { defaultCandidateId })]));
  const disabled = sets([entry('one', 'One', { defaultCandidateId: undefined }), entry('two', 'Two')], 'one', { enabled: false });
  assert.equal(Object.hasOwn(compileStoredConfig(disabled), 'defaultCandidateId'), false);
  disabled.activeConfigId = 'two'; assert.equal(compileStoredConfig(disabled).defaultCandidateId, 'fixed');
  invalid(sets([entry()], 'one', { candidates: [] }));
  for (const enabled of [null, 1, 'true']) invalid(sets([entry()], 'one', { enabled }));
});

test('all override ids must be existing unique global candidate ids, with exact v3 name and description rules', () => {
  const override = { id: 'fixed', name: 'Preset label' };
  for (const id of [undefined, null, '', 'missing', 'FIXED', 1]) invalid(sets([entry('one', 'One', { overrides: [{ ...override, id }] })]));
  invalid(sets([entry('one', 'One', { overrides: [override, override] })]));
  for (const name of [undefined, null, '', ' pad ', 'a'.repeat(121), 'line\nbreak']) invalid(sets([entry('one', 'One', { overrides: [{ ...override, name }] })]));
  for (const description of [null, 1, ' pad ', 'a'.repeat(1001), 'line\nbreak']) invalid(sets([entry('one', 'One', { overrides: [{ ...override, description }] })]));
  for (const key of ['provider', 'model', 'effort', 'candidates', 'enabled', 'limits', 'unknown']) invalid(sets([entry('one', 'One', { overrides: [{ ...override, [key]: undefined }] })]));
  const raw = sets([entry('one', 'One', { overrides: [{ id: 'scope:1/model', name: 'x'.repeat(120), description: 'd'.repeat(1000) }] })], 'one', { candidates: [candidate('scope:1/model')] });
  raw.configs[0].defaultCandidateId = 'scope:1/model';
  assert.equal(compileStoredConfig(raw).candidates[0].description.length, 1000);
  const inactive = sets([entry('one', 'One'), entry('two', 'Two', { overrides: [{ ...override, name: '' }] })]); invalid(inactive);
});

test('global pool edits are shared on every switch and removing referenced candidates rejects rather than retargeting presets', () => {
  const raw = sets([entry('one', 'One'), entry('two', 'Two', { defaultCandidateId: 'other', overrides: [{ id: 'other', name: 'Label' }] })]);
  raw.candidates[0].model = 'new-global-model';
  for (const id of ['one', 'two']) { raw.activeConfigId = id; assert.equal(compileStoredConfig(raw).candidates[0].model, 'new-global-model'); }
  raw.candidates = raw.candidates.filter(row => row.id !== 'other'); invalid(raw);
  raw.configs[1].defaultCandidateId = 'fixed'; invalid(raw); // dangling override still rejects
  raw.configs[1].overrides = []; assert.equal(normalizeConfigSets(raw).candidates.length, 1);
  for (const extra of [{ candidates: [candidate(), candidate()] }, { candidates: [{ ...candidate(), effort: 'default' }] }, { candidates: [{ ...candidate(), effort: undefined }] }, { limits: { maxPendingStarts: 0 } }, { limits: { metadataTimeoutMs: 600001 } }]) invalid({ ...sets(), ...extra });
});

test('maximum 128 shared candidates and 32 fully overridden presets remain bounded and valid', () => {
  const candidates = Array.from({ length: 128 }, (_, index) => candidate('candidate-' + index));
  const configs = Array.from({ length: 32 }, (_, index) => entry('preset-' + index, 'Preset ' + index, {
    defaultCandidateId: candidates[index].id,
    overrides: candidates.map(row => ({ id: row.id, name: 'Label ' + index + ' ' + row.id, description: '' })),
  }));
  const raw = sets(configs, 'preset-31', { candidates });
  const normalized = normalizeConfigSets(raw), compiled = compileStoredConfig(raw);
  assert.equal(normalized.configs.length, 32); assert.equal(normalized.candidates.length, 128);
  assert.equal(compiled.defaultCandidateId, candidates[31].id); assert.deepEqual(routes(compiled), routes(raw));
  invalid({ ...raw, candidates: [...candidates, candidate('candidate-128')] });
});

test('descriptor-first validation never evaluates accessors in root, pool, presets or inactive overrides', () => {
  let reads = 0;
  const getter = (target, key, raw) => { Object.defineProperty(target, key, { enumerable: true, get() { reads++; throw Error('getter executed'); } }); invalid(raw); };
  const root = sets(); getter(root, 'schemaVersion', root);
  const pool = sets(); getter(pool.candidates[0], 'model', pool);
  const active = sets(); getter(active, 'activeConfigId', active);
  const name = sets(); getter(name.configs[0], 'name', name);
  const inactive = sets([entry('a', 'Active'), entry('b', 'Inactive', { overrides: [{ id: 'fixed', name: 'Label' }] })]);
  getter(inactive.configs[1].overrides[0], 'name', inactive);
  const array = sets(); getter(array.configs, '0', array); assert.equal(reads, 0);
});

test('unsafe keys, hidden data, symbols, exotic prototypes and non-JSON values always reject', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) { const raw = sets(); Object.defineProperty(raw.configs[0], key, { enumerable: true, value: {} }); invalid(raw); }
  const symbol = sets(); symbol.configs[0][Symbol('hidden')] = true; invalid(symbol);
  const hidden = sets(); Object.defineProperty(hidden.configs[0], 'hidden', { value: true }); invalid(hidden);
  const prototype = sets(); Object.setPrototypeOf(prototype.configs[0], { inherited: true }); invalid(prototype);
  const array = sets(); Object.setPrototypeOf(array.configs, null); invalid(array);
  for (const value of [() => {}, Symbol('x'), 1n, NaN, Infinity, new Date()]) invalid({ ...sets(), candidates: value });
  const nullRoot = Object.assign(Object.create(null), sets()); assert.equal(normalizeConfigSets(nullRoot).configs.length, 1); assert.equal({}.polluted, undefined);
});

test('cycles, sparse arrays, custom array fields and structural exhaustion reject', () => {
  const cycle = sets(); cycle.configs[0].overrides = [cycle]; invalid(cycle);
  const sparse = sets(); sparse.configs = [entry(), , entry('b', 'B')]; invalid(sparse);
  const custom = sets(); custom.configs.extra = entry(); invalid(custom);
  const deep = sets(); let child = deep; for (let i = 0; i < 40; i++) child = child.unknown = {}; invalid(deep);
  const huge = sets(); huge.configs[0].unknown = Array(1024).fill(Array(64).fill(0)); invalid(huge);
});
