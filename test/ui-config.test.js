import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { normalizeConfig } from '../src/config.js';
import { createDefaultPresets, DEFAULT_PRESET_ID } from '../src/default-presets.js';

// Shell Node cannot read Electron's app.asar. This structural mock only loads the
// module; compiler tests below exercise the real implementation, not a mock.
const mockSource = 'function node(type, fields = {}) { const value = { type, meta: {}, ...fields }; for (const name of ["default", "description", "required", "step", "min", "max", "volatile"]) value[name] = function(arg = true) { const meta = { ...this.meta, [name]: arg }; if (name === "default" && arguments.length === 1) meta[name] = arguments[0]; return { ...this, meta }; }; return value; } export default { object: dict => node("object", { dict }), array: inner => node("array", { inner }), union: values => node("union", { list: values.map(value => typeof value === "object" ? value : node("const", { value })) }), string: () => node("string"), number: () => node("number"), boolean: () => node("boolean"), any: () => node("any") };';
const mockUrl = 'data:text/javascript,' + encodeURIComponent(mockSource);
const hook = registerHooks({ resolve(specifier, context, next) { return specifier === '@deepseek-ai/schemastery' ? { url: mockUrl, shortCircuit: true } : next(specifier, context); } });
let RouterConfig, compilePluginConfig;
try { ({ RouterConfig, compilePluginConfig } = await import('../src/ui-config.js')); } finally { hook.deregister(); }

const preset = (id = 'fast', effort = 'low') => ({ id, name: id, provider: 'p', model: 'm', effort, description: '' });
const ui = extra => ({ schemaVersion: 2, enabled: true, presets: [preset(), preset('deep', 'high')], defaultPreset: 'fast', ...extra });
const invalid = raw => assert.throws(() => compilePluginConfig(raw), { code: 'INVALID_CONFIG' });
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('native schema preserves raw sources and volatility so legacy fields cannot be defaulted away', () => {
  assert.equal(RouterConfig.type, 'object');
  assert.deepEqual(Object.keys(RouterConfig.dict), ['ui', 'policy', 'auditFile']);
  for (const source of ['ui', 'policy']) {
    assert.equal(RouterConfig.dict[source].type, 'any');
    assert.equal(RouterConfig.dict[source].meta.volatile, true);
    assert.equal(RouterConfig.dict[source].meta.default, undefined);
  }
  assert.equal(RouterConfig.dict.auditFile.meta.volatile, undefined);
});

test('native schema labels ui canonical and policy a deprecated read alias without enforcing a new write policy', () => {
  assert.match(RouterConfig.dict.ui.meta.description, /规范预设入口 ui/);
  assert.match(RouterConfig.dict.policy.meta.description, /已弃用.*读取兼容别名 policy.*不是高级模式.*v2.*原子移除 policy.*写入 ui/);
  for (const source of ['ui', 'policy']) {
    assert.deepEqual(Object.keys(RouterConfig.dict[source].meta).sort(), ['default', 'description', 'volatile']);
    assert.equal(RouterConfig.dict[source].type, 'any');
  }
  for (const enabled of [false, true]) {
    const original = freeze(ui({ enabled })), before = structuredClone(original);
    assert.deepEqual(compilePluginConfig({ policy: original }).policy, compilePluginConfig({ ui: original }).policy);
    assert.deepEqual(original, before);
  }
});

test('v2 ui and policy compile to the identical exact preset configuration', () => {
  const raw = ui({ limits: { maxPendingStarts: 1 }, teams: { enabled: false } });
  const result = compilePluginConfig({ ui: raw });
  assert.deepEqual(result.policy, normalizeConfig(raw));
  assert.deepEqual(compilePluginConfig({ policy: raw }).policy, result.policy);
  assert.equal(result.migrationRequired, false); assert.equal(result.migration, undefined);
  assert.equal(result.policy.defaultPreset, 'fast'); assert.equal(Object.hasOwn(result.policy, 'teams'), false);
  assert.deepEqual(result.policy.presets.map(item => item.effort), ['low', 'high']);
});

test('enabled Team sources are quarantined before normalization with original recovery evidence', () => {
  for (const source of ['ui', 'policy']) for (const original of [
    ui({ teams: { enabled: true }, extra: 'retain even invalid former fields' }),
    { schemaVersion: 1, enabled: true, teams: { enabled: true }, models: [{ id: 'old' }], rules: [{ kind: 'constraint' }] },
    { enabled: true, teams: { enabled: true }, models: [] }
  ]) {
    const raw = freeze({ [source]: structuredClone(original), auditFile: 'C:/audit/retained.jsonl' });
    const result = compilePluginConfig(raw);
    assert.deepEqual(result.policy, normalizeConfig({ schemaVersion: 2, enabled: false, presets: [] }));
    assert.equal(result.configurationIssue.code, 'TEAM_ROUTING_REMOVED');
    assert.match(result.configurationIssue.message, /read-only.*disabled.*Back up.*native settings/);
    assert.equal(result.configurationIssue.source, source);
    assert.deepEqual(result.configurationIssue.original, original);
    assert.notEqual(result.configurationIssue.original, raw[source]);
    assert.deepEqual(raw[source], original); assert.equal(result.auditFile, raw.auditFile);
    assert.equal(result.migrationRequired, original.schemaVersion !== 2);
    assert.equal(Object.hasOwn(result, 'migration'), false);
  }
});

test('only exact false Team compatibility is accepted and canonical compilation omits it', () => {
  for (const source of ['ui', 'policy']) {
    const original = ui({ teams: { enabled: false } });
    const result = compilePluginConfig({ [source]: original });
    assert.equal(result.configurationIssue, undefined); assert.equal(Object.hasOwn(result.policy, 'teams'), false);
    assert.deepEqual(original.teams, { enabled: false });
    for (const teams of [null, {}, false, { enabled: 0 }, { enabled: 'false' }, { enabled: false, extra: true }]) {
      invalid({ [source]: ui({ teams }) });
      const legacy = { schemaVersion: 1, models: [], teams }, retained = compilePluginConfig({ [source]: legacy });
      assert.equal(retained.configurationIssue.code, 'LEGACY_CONFIGURATION'); assert.deepEqual(retained.configurationIssue.original, legacy);
    }
  }
});

test('absent preset fields initialize disabled inherited Low High Max templates with High as default', () => {
  for (const raw of [undefined, {}, { policy: undefined, ui: undefined }, { ui: {} }, { policy: {} }, { ui: { schemaVersion: 2 } }, { policy: { schemaVersion: 2, presets: undefined } }]) {
    const result = compilePluginConfig(raw);
    assert.equal(result.policy.schemaVersion, 2); assert.equal(result.policy.enabled, false);
    assert.deepEqual(result.policy.presets, createDefaultPresets()); assert.equal(result.policy.defaultPreset, DEFAULT_PRESET_ID);
    assert.equal(result.migrationRequired, false);
  }
});

test('legacy sources mount disabled with detached readonly originals and no conversion payload', () => {
  const legacy = { enabled: true, models: [{ id: 'old', provider: 'p', model: 'm', efforts: ['default', 'high'], defaultEffort: 'default' }], defaultModel: 'old', rules: [{ id: 'hard', kind: 'constraint', when: { all: [] }, effect: { denyModels: ['old'] } }], lanes: [{ id: 'main', models: ['old'] }], review: { preferDifferentModel: true }, guidance: { enabled: true }, extra: 'retained' };
  for (const source of ['ui', 'policy']) for (const value of [legacy, { ...legacy, schemaVersion: 1 }, { schemaVersion: 1, enabled: false }, { models: [] }]) {
    const raw = freeze({ [source]: structuredClone(value), auditFile: 'C:/audit/route.jsonl' }), before = structuredClone(raw);
    const result = compilePluginConfig(raw);
    assert.equal(result.migrationRequired, true);
    assert.deepEqual(result.policy, normalizeConfig({ schemaVersion: 2, enabled: false, presets: [] }));
    assert.equal(result.configurationIssue.code, 'LEGACY_CONFIGURATION');
    assert.match(result.configurationIssue.message, /read-only.*disabled.*Back up.*manually.*v2.*native settings/);
    assert.deepEqual(result.configurationIssue.original, value); assert.notEqual(result.configurationIssue.original, raw[source]);
    assert.equal(result.configurationIssue.source, source); assert.equal(result.auditFile, before.auditFile);
    for (const key of ['migration', 'removedFields', 'hardConstraints']) assert.equal(Object.hasOwn(result, key), false);
    assert.deepEqual(raw, before); assert.ok(Object.isFrozen(result.configurationIssue));
  }
});

test('legacy constraints remain verbatim rather than interpreted or converted', () => {
  const rules = [{ id: 'restrict', effect: { allowModels: ['only'] } }, { id: 'disabled', enabled: false, kind: 'constraint' }, { id: 'soft', kind: 'preference' }];
  const result = compilePluginConfig({ ui: { models: [], rules } });
  assert.deepEqual(result.configurationIssue.original.rules, rules);
  assert.notEqual(result.configurationIssue.original.rules, rules); assert.deepEqual(result.policy.presets, []);
  assert.equal(Object.hasOwn(result, 'migration'), false);
});

test('simultaneous sources reject and audit path remains an independent optional field', () => {
  for (const raw of [{ ui: {}, policy: {} }, { ui: ui(), policy: {} }, { ui: null, policy: {} }]) invalid(raw);
  assert.equal(compilePluginConfig({ ui: ui(), auditFile: '' }).auditFile, undefined);
  assert.equal(compilePluginConfig({ ui: ui(), auditFile: 'C:/audit.jsonl' }).auditFile, 'C:/audit.jsonl');
});

test('precise effort including null is retained; missing, default, unknown fields and invalid references reject', () => {
  assert.equal(compilePluginConfig({ ui: ui({ presets: [preset('fast', null)] }) }).policy.presets[0].effort, null);
  for (const extra of [
    { presets: [{ ...preset(), effort: undefined }] }, { presets: [preset('fast', '')] }, { presets: [preset('fast', 'default')] },
    { presets: [{ ...preset(), name: '' }] }, { presets: [{ ...preset(), description: 'multi\nline' }] },
    { presets: [{ ...preset(), unknown: true }] }, { presets: [preset(), preset()] },
    { defaultPreset: 'missing' }, { defaultPreset: undefined }, { limits: { unknown: 1 } },
    { teams: { enabled: false, unknown: true } }, { rules: [] }, { lanes: [] }, { models: [] }, { review: {} }, { guidance: {} }
  ]) invalid({ ui: ui(extra) });
  for (const raw of [null, [], { ui: null }, { policy: null }, { auditFile: 2 }, { unknown: true }, { ui: { schemaVersion: 9 } }]) invalid(raw);
});

test('descriptor-first copying rejects getters, functions, pollution and hidden or symbol data before migration', () => {
  let evaluated = false; const raw = {};
  Object.defineProperty(raw, 'ui', { enumerable: true, get() { evaluated = true; return ui(); } }); invalid(raw);
  const nested = preset(); Object.defineProperty(nested, 'effort', { enumerable: true, get() { evaluated = true; return 'low'; } }); invalid({ ui: ui({ presets: [nested] }) });
  const old = {}; Object.defineProperty(old, 'models', { enumerable: true, get() { evaluated = true; return []; } }); invalid({ ui: old });
  assert.equal(evaluated, false);
  invalid(JSON.parse('{"__proto__":{"polluted":true}}')); invalid({ ui: ui({ presets: [JSON.parse('{"constructor":{}}')] }) });
  invalid({ ui: Object.create({ enabled: true }) }); invalid({ [Symbol('hidden')]: true });
  const hidden = {}; Object.defineProperty(hidden, 'policy', { value: {} }); invalid(hidden);
  invalid({ policy: () => ({}) }); assert.equal({}.polluted, undefined);
});

test('cyclic sparse and excessive configuration structures reject before compilation', () => {
  const cyclic = {}; cyclic.ui = cyclic; invalid(cyclic);
  invalid({ ui: ui({ presets: Array(1) }) }); invalid({ ui: ui({ presets: Array(129).fill(preset()) }) });
  const deep = {}; let child = deep; for (let i = 0; i < 40; i++) child = child.next = {}; invalid({ ui: deep });
  invalid({ policy: { models: Array(1025).fill({ id: 'old' }) } });
});

test('compiler does not mutate deeply frozen presets or alias input records', () => {
  const raw = freeze({ ui: ui(), auditFile: 'C:/audit/router.jsonl' }), before = structuredClone(raw);
  const result = compilePluginConfig(raw); assert.deepEqual(raw, before); assert.ok(Object.isFrozen(result));
  assert.notEqual(result.policy.presets[0], raw.ui.presets[0]); assert.ok(Object.isFrozen(result.policy.presets[0]));
});

test('explicit empty or fixed v2 sources never receive inherited templates or a new default', () => {
  for (const source of ['ui', 'policy']) for (const value of [
    { schemaVersion: 2, presets: [] },
    { schemaVersion: 2, enabled: false, presets: [preset()] },
    ui({ presets: [{ ...preset(), id: 'default-high' }], defaultPreset: 'default-high' })
  ]) {
    const before = structuredClone(value), result = compilePluginConfig({ [source]: value });
    assert.equal(result.migrationRequired, false); assert.deepEqual(result.policy.presets, value.presets);
    assert.equal(result.policy.defaultPreset, value.defaultPreset); assert.deepEqual(value, before);
    assert.ok(result.policy.presets.every(item => !Object.hasOwn(item, 'modelSource')));
  }
  invalid({ ui: { schemaVersion: 2, enabled: true, presets: [] } });
  const enabled = compilePluginConfig({ ui: { schemaVersion: 2, enabled: true } });
  assert.deepEqual(enabled.policy.presets, createDefaultPresets()); assert.equal(enabled.policy.defaultPreset, DEFAULT_PRESET_ID);
  assert.equal(compilePluginConfig({ ui: { schemaVersion: 2, defaultPreset: 'default-low' } }).policy.defaultPreset, 'default-low');
});

test('mixed inherited and fixed v2 presets compile without changing serialization or default choice', () => {
  const parent = { id: 'inherited', name: 'Inherited', modelSource: 'parent', effort: 'exact-custom', description: 'Resolve at creation' };
  for (const source of ['ui', 'policy']) {
    const raw = freeze({ [source]: ui({ presets: [parent, preset()], defaultPreset: 'inherited' }) }), before = structuredClone(raw);
    const result = compilePluginConfig(raw);
    assert.equal(result.migrationRequired, false); assert.equal(result.migration, undefined);
    assert.deepEqual(result.policy.presets, before[source].presets); assert.equal(result.policy.defaultPreset, 'inherited');
    assert.deepEqual(raw, before); assert.ok(Object.isFrozen(result.policy.presets[0]));
    assert.equal(Object.hasOwn(result.policy.presets[0], 'provider'), false); assert.equal(Object.hasOwn(result.policy.presets[0], 'model'), false);
    assert.equal(Object.hasOwn(result.policy.presets[1], 'modelSource'), false);
  }
});

test('compiler rejects ambiguous model sources and malformed exact efforts without legacy fallback', () => {
  const inherited = { id: 'fast', name: 'Inherited', modelSource: 'parent', effort: 'high' };
  for (const value of [
    { ...inherited, provider: 'p' }, { ...inherited, model: 'm' }, { ...inherited, provider: undefined },
    { ...inherited, model: undefined }, { ...inherited, modelSource: 'global' }, { ...inherited, modelSource: undefined },
    { ...preset(), modelSource: 'fixed' }, { ...preset(), modelSource: null },
    { ...inherited, effort: '' }, { ...inherited, effort: undefined }, { ...inherited, effort: 'default' }
  ]) invalid({ ui: ui({ presets: [value] }) });
  // Null is only a structural value here; actual parent metadata must authorize it at creation.
  const result = compilePluginConfig({ ui: ui({ presets: [{ ...inherited, effort: null }] }) });
  assert.equal(result.policy.presets[0].effort, null); assert.equal(result.migrationRequired, false);
});
