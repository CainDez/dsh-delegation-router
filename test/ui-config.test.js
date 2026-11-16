import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { normalizeConfig } from '../src/config.js';

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
