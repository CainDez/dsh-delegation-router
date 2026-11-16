import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { normalizeConfig } from '../src/config.js';
import { LiveRouter } from '../src/live-router.js';
import { MemoryJournal } from '../src/journal.js';

// Shell Node cannot read Electron's app.asar. This structural mock only loads the
// module; compiler tests below exercise the real implementation, not a mock.
const mockSource = 'function node(type, fields = {}) { const value = { type, meta: {}, ...fields }; for (const name of ["default", "description", "required", "step", "min", "max", "volatile"]) value[name] = function(arg = true) { const meta = { ...this.meta, [name]: arg }; if (name === "default" && arguments.length === 1) meta[name] = arguments[0]; return { ...this, meta }; }; return value; } export default { object: dict => node("object", { dict }), array: inner => node("array", { inner }), union: values => node("union", { list: values.map(value => typeof value === "object" ? value : node("const", { value })) }), string: () => node("string"), number: () => node("number"), boolean: () => node("boolean"), any: () => node("any") };';
const mockUrl = 'data:text/javascript,' + encodeURIComponent(mockSource);
const hook = registerHooks({ resolve(specifier, context, next) { return specifier === '@deepseek-ai/schemastery' ? { url: mockUrl, shortCircuit: true } : next(specifier, context); } });
let RouterConfig, compilePluginConfig;
try { ({ RouterConfig, compilePluginConfig } = await import('../src/ui-config.js')); } finally { hook.deregister(); }

const candidate = (id = 'fast', effort = 'low') => ({ id, name: id, provider: 'p', model: 'm', effort, description: '' });
const ui = extra => ({ schemaVersion: 3, enabled: true, candidates: [candidate(), candidate('deep', 'high')], defaultCandidateId: 'fast', ...extra });
const invalid = raw => assert.throws(() => compilePluginConfig(raw), { code: 'INVALID_CONFIG' });
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('native schema exposes only the ui entry and auditFile; ui stays volatile raw data', () => {
  assert.equal(RouterConfig.type, 'object');
  assert.deepEqual(Object.keys(RouterConfig.dict), ['ui', 'auditFile']);
  assert.equal(RouterConfig.dict.ui.type, 'any');
  assert.equal(RouterConfig.dict.ui.meta.volatile, true);
  assert.equal(RouterConfig.dict.ui.meta.default, undefined);
  assert.deepEqual(Object.keys(RouterConfig.dict.ui.meta).sort(), ['default', 'description', 'volatile']);
  assert.equal(RouterConfig.dict.auditFile.type, 'string');
  assert.equal(RouterConfig.dict.auditFile.meta.volatile, undefined);
});

test('schema describes fixed candidates and the required schema version', () => {
  assert.match(RouterConfig.dict.ui.meta.description, /候选/);
  assert.match(RouterConfig.dict.ui.meta.description, /schemaVersion 3/);
  assert.match(RouterConfig.dict.ui.meta.description, /schemaVersion 4/);
  assert.match(RouterConfig.dict.ui.meta.description, /全局共享/);
  assert.doesNotMatch(RouterConfig.dict.ui.meta.description, /policy|别名/);
});

test('the absent entry initializes a fresh empty v3 configuration; explicit empty sources reject', () => {
  for (const raw of [undefined, {}, { ui: undefined }, { ui: undefined, auditFile: undefined }]) {
    const result = compilePluginConfig(raw);
    assert.deepEqual(result.policy, normalizeConfig());
    assert.equal(result.policy.schemaVersion, 3); assert.equal(result.policy.enabled, false);
    assert.deepEqual(result.policy.candidates, []); assert.equal(Object.hasOwn(result.policy, 'defaultCandidateId'), false);
    assert.ok(Object.isFrozen(result));
  }
  invalid({ ui: {} });
  invalid({ ui: { enabled: false } });
  invalid({ ui: { schemaVersion: 0 } });
});

test('v3 ui compiles to the identical exact candidate configuration', () => {
  const raw = ui({ limits: { maxPendingStarts: 1 } });
  const result = compilePluginConfig({ ui: raw });
  assert.deepEqual(result.policy, normalizeConfig(raw));
  assert.equal(result.policy.defaultCandidateId, 'fast');
  assert.deepEqual(result.policy.candidates.map(item => item.effort), ['low', 'high']);
  assert.deepEqual(Object.keys(result), ['policy']);
});

test('unknown entry and configuration fields reject', () => {
  for (const raw of [{ extra: ui() }, { extra: undefined }, { extra: null }, { ui: ui(), extra: undefined }]) invalid(raw);
  for (const value of [{ schemaVersion: 0 }, { schemaVersion: 3, extra: true }, { candidates: [] }]) invalid({ ui: value });
});

test('audit path remains an independent optional field', () => {
  assert.equal(compilePluginConfig({ ui: ui(), auditFile: '' }).auditFile, undefined);
  assert.equal(compilePluginConfig({ ui: ui(), auditFile: 'C:/audit.jsonl' }).auditFile, 'C:/audit.jsonl');
  assert.equal(compilePluginConfig({ auditFile: 'C:/audit.jsonl' }).auditFile, 'C:/audit.jsonl');
  invalid({ ui: ui(), auditFile: 2 });
});

test('precise effort including null is retained; missing, default, unknown fields and invalid references reject', () => {
  assert.equal(compilePluginConfig({ ui: ui({ candidates: [candidate('fast', null)] }) }).policy.candidates[0].effort, null);
  for (const extra of [
    { candidates: [{ ...candidate(), effort: undefined }] }, { candidates: [candidate('fast', '')] }, { candidates: [candidate('fast', 'default')] },
    { candidates: [{ ...candidate(), provider: undefined }] },
    { candidates: [{ ...candidate(), name: '' }] }, { candidates: [{ ...candidate(), description: 'multi\nline' }] },
    { candidates: [{ ...candidate(), unknown: true }] }, { candidates: [candidate(), candidate()] },
    { defaultCandidateId: 'missing' }, { defaultCandidateId: undefined }, { limits: { unknown: 1 } },
    { unknown: true }
  ]) invalid({ ui: ui(extra) });
  for (const raw of [null, [], { ui: null }, { ui: [] }, { ui: 'text' }, { auditFile: 2 }, { unknown: true }, { ui: { schemaVersion: 9 } }]) invalid(raw);
});

test('descriptor-first copying rejects getters, functions, pollution and hidden or symbol data', () => {
  let evaluated = false; const raw = {};
  Object.defineProperty(raw, 'ui', { enumerable: true, get() { evaluated = true; return ui(); } }); invalid(raw);
  const nested = candidate(); Object.defineProperty(nested, 'effort', { enumerable: true, get() { evaluated = true; return 'low'; } }); invalid({ ui: ui({ candidates: [nested] }) });
  const old = {}; Object.defineProperty(old, 'models', { enumerable: true, get() { evaluated = true; return []; } }); invalid({ ui: old });
  assert.equal(evaluated, false);
  invalid(JSON.parse('{"__proto__":{"polluted":true}}'));
  invalid({ ui: ui({ candidates: [JSON.parse('{"constructor":{}}')] }) });
  invalid({ ui: Object.create({ enabled: true }) }); invalid({ [Symbol('hidden')]: true });
  const hidden = {}; Object.defineProperty(hidden, 'policy', { value: {} }); invalid(hidden);
  invalid({ ui: () => ({}) }); assert.equal({}.polluted, undefined);
});

test('cyclic sparse and excessive configuration structures reject before compilation', () => {
  const cyclic = {}; cyclic.ui = cyclic; invalid(cyclic);
  invalid({ ui: ui({ candidates: Array(1) }) }); invalid({ ui: ui({ candidates: Array(129).fill(candidate()) }) });
  const deep = {}; let child = deep; for (let i = 0; i < 40; i++) child = child.next = {}; invalid({ ui: deep });
  invalid({ ui: { schemaVersion: 3, models: Array(1025).fill({ id: 'old' }) } });
});

test('compiler does not mutate deeply frozen candidates or alias input records', () => {
  const raw = freeze({ ui: ui(), auditFile: 'C:/audit/router.jsonl' }), before = structuredClone(raw);
  const result = compilePluginConfig(raw); assert.deepEqual(raw, before); assert.ok(Object.isFrozen(result));
  assert.notEqual(result.policy.candidates[0], raw.ui.candidates[0]); assert.ok(Object.isFrozen(result.policy.candidates[0]));
});

test('explicit empty or fixed v3 sources never receive implicit candidates or a new default', () => {
  for (const value of [
    { schemaVersion: 3, candidates: [] },
    { schemaVersion: 3, enabled: false, candidates: [candidate()] },
    ui({ candidates: [{ ...candidate(), id: 'default-high' }], defaultCandidateId: 'default-high' }),
  ]) {
    const before = structuredClone(value), result = compilePluginConfig({ ui: value });
    assert.deepEqual(result.policy.candidates, value.candidates);
    assert.equal(result.policy.defaultCandidateId, value.defaultCandidateId); assert.deepEqual(value, before);
  }
  invalid({ ui: { schemaVersion: 3, enabled: true, candidates: [] } });
  invalid({ ui: { schemaVersion: 3, enabled: true } });
  invalid({ ui: { schemaVersion: 3, enabled: true, candidates: [candidate()] } });
  invalid({ ui: { schemaVersion: 3, defaultCandidateId: 'fast' } });
  assert.equal(Object.hasOwn(compilePluginConfig({ ui: { schemaVersion: 3 } }).policy, 'defaultCandidateId'), false);
});

const multi = (activeConfigId = 'first') => ({ schemaVersion: 4, enabled: true,
  candidates: [candidate(), candidate('deep', 'high')], limits: { maxActivePerModel: 1 }, activeConfigId, configs: [
    { id: 'first', name: '任意预设 First', defaultCandidateId: 'fast', overrides: [] },
    { id: 'second', name: '任意预设 Second', defaultCandidateId: 'deep', overrides: [{ id: 'fast', name: 'Preset-specific name', description: 'Preset-specific description' }] },
  ] });
const routePool = policy => policy.candidates.map(({ id, provider, model, effort }) => ({ id, provider, model, effort }));

test('v4 compiles preset labels/default over a single global pool while audit, enabled and limits stay global', () => {
  const first = compilePluginConfig({ ui: multi() }).policy;
  for (const active of ['first', 'second']) {
    const raw = freeze({ ui: multi(active), auditFile: 'C:/global/audit.jsonl' }), before = structuredClone(raw);
    const result = compilePluginConfig(raw);
    assert.deepEqual(Object.keys(result), ['policy', 'auditFile']);
    assert.equal(result.auditFile, 'C:/global/audit.jsonl'); assert.equal(result.policy.enabled, true);
    assert.equal(result.policy.limits.maxActivePerModel, 1);
    assert.deepEqual(routePool(result.policy), routePool(first));
    assert.equal(result.policy.defaultCandidateId, active === 'first' ? 'fast' : 'deep');
    assert.equal(result.policy.candidates[0].name, active === 'first' ? 'fast' : 'Preset-specific name');
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.policy.candidates[0]));
    assert.notEqual(result.policy.candidates[0], raw.ui.candidates[0]); assert.deepEqual(raw, before);
  }
  invalid({ ui: { ...multi(), auditFile: 'C:/nested/audit.jsonl' } });
  const nested = multi(); nested.configs[0].auditFile = 'C:/nested/audit.jsonl'; invalid({ ui: nested });
});

test('preset metadata, order, inactive overrides and inactive defaults never change compiled runtime config', () => {
  const raw = { ui: multi(), auditFile: 'C:/global/audit.jsonl' }, before = compilePluginConfig(raw);
  const pool = structuredClone(raw.ui.candidates);
  raw.ui.configs[0].name = '重命名当前预设'; raw.ui.configs[1].name = '重命名未选中预设';
  raw.ui.configs[1].defaultCandidateId = 'fast'; raw.ui.configs[1].overrides = [{ id: 'deep', name: 'Inactive label', description: '' }];
  raw.ui.configs.reverse();
  assert.deepEqual(compilePluginConfig(raw), before); assert.equal(JSON.stringify(compilePluginConfig(raw)), JSON.stringify(before));
  raw.ui.configs.push({ id: 'third', name: 'Third', defaultCandidateId: 'fast' });
  assert.deepEqual(compilePluginConfig(raw), before);
  raw.ui.configs = raw.ui.configs.filter(entry => entry.id === 'first');
  assert.deepEqual(compilePluginConfig(raw), before); assert.deepEqual(raw.ui.candidates, pool);
});

test('invalid inactive preset data and v4 descriptors reject without evaluating getters or repairing old per-policy storage', () => {
  const bad = multi(); bad.configs[1].overrides[0].effort = 'high'; invalid({ ui: bad });
  const duplicate = multi(); duplicate.configs[1].name = '  任意预设 FIRST  '; invalid({ ui: duplicate });
  const missing = multi(); missing.configs[1].defaultCandidateId = undefined; invalid({ ui: missing });
  const removed = multi(); removed.activeConfigId = 'removed'; invalid({ ui: removed });
  invalid({ ui: { schemaVersion: 4, activeConfigId: 'old', configs: [{ id: 'old', name: 'Old', policy: ui() }] } });
  let evaluated = false;
  const getter = multi(); Object.defineProperty(getter.configs[1].overrides[0], 'name', { enumerable: true, get() { evaluated = true; return 'Label'; } });
  invalid({ ui: getter }); assert.equal(evaluated, false);
});

test('shared pool mutations affect every preset but no preset can own routes, enablement or limits', () => {
  const raw = multi(), pool = structuredClone(raw.candidates);
  raw.candidates[0].model = 'new-global-model'; raw.limits.maxActivePerModel = 3;
  for (const active of ['first', 'second']) {
    raw.activeConfigId = active; const compiled = compilePluginConfig({ ui: raw }).policy;
    assert.equal(compiled.candidates[0].model, 'new-global-model'); assert.equal(compiled.limits.maxActivePerModel, 3);
    assert.deepEqual(compiled.candidates.map(row => row.id), pool.map(row => row.id));
  }
  for (const key of ['policy', 'candidates', 'enabled', 'limits', 'provider', 'model', 'effort']) {
    const bad = multi(); bad.configs[1][key] = undefined; invalid({ ui: bad });
  }
});

test('preset compilation preserves LiveRouter CONFIG_BUSY, disable and global audit-path boundaries', () => {
  let raw = { ui: multi(), auditFile: 'C:/global/audit.jsonl' };
  const router = new LiveRouter({ readConfig: () => compilePluginConfig(raw), createJournal: () => new MemoryJournal() });
  try {
    const runtime = router.ensure(), initial = router.status();
    for (const pending of [false, true]) {
      router.inFlight = pending ? 0 : 1; router.latest = pending ? new Map([['child', 'accepted']]) : new Map();
      raw.ui.configs[1].name = pending ? 'Inactive renamed again' : 'Inactive renamed';
      raw.ui.configs[1].overrides[0].name = pending ? 'Inactive label again' : 'Inactive label';
      assert.doesNotThrow(() => router.validateUpdate(compilePluginConfig(raw)));
      assert.equal(router.ensure(), runtime); assert.equal(router.status().configuredRevision, initial.configuredRevision);
      assert.equal(router.status().configurationPending, false);
      const switched = structuredClone(raw); switched.ui.activeConfigId = 'second';
      assert.throws(() => router.validateUpdate(compilePluginConfig(switched)), { code: 'CONFIG_BUSY' });
      for (const change of [
        value => { value.ui.limits.maxActivePerModel = 2; },
        value => { value.ui.candidates[0].model = 'different-global-model'; },
        value => { value.ui.configs[0].overrides = [{ id: 'fast', name: 'Current preset label' }]; },
      ]) { const changed = structuredClone(raw); change(changed); assert.throws(() => router.validateUpdate(compilePluginConfig(changed)), { code: 'CONFIG_BUSY' }); }
      const disabled = structuredClone(switched); disabled.ui.enabled = false;
      assert.doesNotThrow(() => router.validateUpdate(compilePluginConfig(disabled)));
      const changedAudit = { ...raw, auditFile: 'C:/other/audit.jsonl' };
      assert.throws(() => router.validateUpdate(compilePluginConfig(changedAudit)), { code: 'AUDIT_PATH_RELOAD_REQUIRED' });
    }
    router.inFlight = 0; router.latest.clear(); raw.ui.activeConfigId = 'second';
    assert.doesNotThrow(() => router.validateUpdate(compilePluginConfig(raw))); assert.notEqual(router.ensure(), runtime);
    assert.equal(router.status().configuredRevision, router.status().activeRevision);
  } finally { router.close(); }
});
