import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { createDefaultPresets, DEFAULT_PRESET_ID } from '../src/default-presets.js';
import { selectRoute } from '../src/policy.js';
import { SubagentRouter } from '../src/runtime.js';
import { createNativeInvoker } from '../src/native-adapter.js';
import { MemoryJournal } from '../src/journal.js';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const request = extra => ({ prompt: 'Bounded child work', description: 'child work', ...extra });
const exec = callId => ({ callId });
const parent = () => ({ id: 'root', session: { header: { origin: 'root' } }, options: { provider: 'p-a', model: 'm-a', reasoningEffort: 'max' } });
const fixed = extra => ({ id: 'fixed', name: 'Existing fixed', provider: 'p-fixed', model: 'm-fixed', effort: 'low', description: 'Existing description', ...extra });
const inherited = extra => ({ id: 'inherited', name: 'Inherited', modelSource: 'parent', effort: 'high', ...extra });
const authorization = () => [
  { provider: 'p-a', model: 'm-a' }, { provider: 'p-b', model: 'm-a' },
  { provider: 'p-a', model: 'm-b' }, { provider: 'p-b', model: 'm-b' },
  { provider: 'p-fixed', model: 'm-fixed' },
];
const metadata = (provider = 'p-a', model = 'm-a', extra = {}) => ({
  provider, model, inputModalities: ['text'], context: { contextWindow: 100000 },
  reasoning: { efforts: ['low', 'high', 'max'] }, ...extra,
});
const policyMetadata = extra => ({ ...metadata(), context: 100000, ...extra });
function choose(config = { enabled: true }, input = {}) {
  return selectRoute(config, {
    parentRoute: { provider: 'p-a', model: 'm-a', effort: 'max' },
    catalog: new Map(createDefaultPresets().map(item => [item.id, policyMetadata()])),
    facts: { payload: { inputModalities: ['text'], context: { tokens: 100 } } },
    authorizedRoutes: authorization(), ...input,
  });
}
function fixture(overrides = {}) {
  const { config, parent: selectedParent = parent(), resolveModel = async (p, m) => metadata(p, m), ...dependencies } = overrides;
  const calls = [], resolutions = [], prepared = [], journal = dependencies.journal ?? new MemoryJournal();
  const router = new SubagentRouter({
    config: { schemaVersion: 2, enabled: true, ...config }, journal,
    resolveModel: (...args) => { resolutions.push(args.slice(0, 2)); return resolveModel(...args); },
    readAuthorization: authorization, estimateContext: () => 100,
    preflight: async options => { prepared.push(options); },
    invokeNative: async (args, _exec, beforeDispatch) => {
      beforeDispatch(); calls.push(args); return { kind: 'activation', subagentId: 'child-' + calls.length };
    },
    ...dependencies,
  });
  return { router, parent: selectedParent, calls, resolutions, prepared, journal };
}

// Schema compatibility is independent of any current Agent or catalog.
test('built-in Low High Max templates are fresh and default to High only when presets are omitted', () => {
  const one = createDefaultPresets(), two = createDefaultPresets();
  assert.notEqual(one, two); assert.notEqual(one[0], two[0]);
  assert.deepEqual(one.map(({ id, name, modelSource, effort }) => ({ id, name, modelSource, effort })), [
    { id: 'default-low', name: 'Low', modelSource: 'parent', effort: 'low' },
    { id: 'default-high', name: 'High', modelSource: 'parent', effort: 'high' },
    { id: 'default-max', name: 'Max', modelSource: 'parent', effort: 'max' },
  ]);
  assert.ok(one.every(item => item.description.length > 0 && !('provider' in item) && !('model' in item)));
  one[0].name = 'changed'; one.pop();
  assert.deepEqual(createDefaultPresets(), two);
  for (const raw of [{}, { schemaVersion: 2 }, { enabled: true }]) {
    const normalized = normalizeConfig(raw);
    assert.deepEqual(normalized.presets, two); assert.equal(normalized.defaultPreset, DEFAULT_PRESET_ID);
    assert.ok(Object.isFrozen(normalized.presets) && normalized.presets.every(Object.isFrozen));
    assert.deepEqual(normalizeConfig(normalized), normalized);
  }
  assert.equal(normalizeConfig({ defaultPreset: 'default-low' }).defaultPreset, 'default-low');
  const empty = normalizeConfig({ presets: [] });
  assert.deepEqual(empty.presets, []); assert.equal('defaultPreset' in empty, false);
  assert.throws(() => normalizeConfig({ enabled: true, presets: [] }), { code: 'INVALID_CONFIG' });
});

test('existing fixed v2 presets, default identity and serialization are not overwritten', () => {
  const presets = [fixed({ id: 'default-high' }), fixed({ id: 'custom', effort: 'high' })];
  const raw = { schemaVersion: 2, enabled: true, presets, defaultPreset: 'custom' };
  const normalized = normalizeConfig(raw);
  assert.deepEqual(normalized.presets, presets); assert.equal(normalized.defaultPreset, 'custom');
  assert.equal(JSON.stringify(normalized.presets), JSON.stringify(presets));
  assert.ok(normalized.presets.every(item => !Object.hasOwn(item, 'modelSource')));
  assert.deepEqual(normalizeConfig(JSON.parse(JSON.stringify(normalized))), normalized);
  const noDefault = normalizeConfig({ presets: [fixed()] });
  assert.equal('defaultPreset' in noDefault, false); assert.equal(noDefault.presets.length, 1);
  assert.throws(() => normalizeConfig({ enabled: true, presets: [fixed()] }), { code: 'INVALID_CONFIG' });
});

test('parent modelSource is exclusive and effort still requires an exact explicit value', () => {
  const valid = inherited();
  assert.deepEqual(normalizeConfig({ presets: [valid] }).presets, [valid]);
  for (const extra of [
    { modelSource: undefined }, { modelSource: null }, { modelSource: 'fixed' }, { modelSource: 'global' },
    { modelSource: 'Parent' }, { provider: 'p-a' }, { provider: undefined }, { model: 'm-a' }, { model: undefined },
    { effort: undefined }, { effort: '' }, { effort: 'default' }, { effort: ' high' }, { effort: ['high'] },
  ]) assert.throws(() => normalizeConfig({ presets: [inherited(extra)] }), { code: 'INVALID_CONFIG' });
  assert.throws(() => normalizeConfig({ presets: [fixed({ modelSource: 'parent' })] }), { code: 'INVALID_CONFIG' });
  for (const effort of ['custom-effort', null]) assert.equal(normalizeConfig({ presets: [inherited({ effort })] }).presets[0].effort, effort);
});

test('policy inherits exact provider/model, not effort, and authorizes the resolved identity', () => {
  assert.deepEqual(choose(), { presetId: 'default-high', provider: 'p-a', model: 'm-a', effort: 'high', reason: 'default-preset' });
  for (const effort of ['low', 'high', 'max']) {
    const selected = choose(undefined, { proposal: { presetId: 'default-' + effort }, parentRoute: { provider: 'p-b', model: 'm-b', effort: 'unrelated' },
      catalog: new Map([['default-' + effort, policyMetadata({ provider: 'p-b', model: 'm-b' })]]) });
    assert.deepEqual(selected, { presetId: 'default-' + effort, provider: 'p-b', model: 'm-b', effort, reason: 'explicit-preset' });
  }
  assert.throws(() => choose(undefined, { authorizedRoutes: [{ provider: 'p-fixed', model: 'm-fixed' }] }), { code: 'NO_ROUTE' });
  assert.throws(() => choose(undefined, { authorizedRoutes: [{ provider: 'p-a', model: 'm-a', efforts: ['max'] }] }), { code: 'NO_ROUTE' });
  for (const extra of [{ provider: 'other' }, { model: 'other' }, { inputModalities: ['image'] }, { context: 99 }]) {
    assert.throws(() => choose(undefined, { catalog: new Map([['default-high', policyMetadata(extra)]]) }), { code: 'NO_ROUTE' });
  }
});

test('policy rejects unresolved parent routes without evaluating getters or trying a fixed fallback', () => {
  let reads = 0;
  const getter = Object.defineProperty({ model: 'm-a' }, 'provider', { enumerable: true, get() { reads++; return 'p-a'; } });
  for (const parentRoute of [undefined, null, {}, { provider: 'p-a' }, { model: 'm-a' }, { provider: '', model: 'm-a' },
    { provider: ' p-a', model: 'm-a' }, { provider: 'p-a', model: 'x'.repeat(201) }, Object.create({ provider: 'p-a', model: 'm-a' }), getter]) {
    assert.throws(() => choose(undefined, { parentRoute }), { code: 'PARENT_ROUTE_UNAVAILABLE' });
  }
  assert.equal(reads, 0);
  const config = { enabled: true, presets: [inherited(), fixed()], defaultPreset: 'inherited' };
  const catalog = new Map([['inherited', policyMetadata()], ['fixed', policyMetadata({ provider: 'p-fixed', model: 'm-fixed' })]]);
  assert.throws(() => choose(config, { parentRoute: undefined, catalog }), { code: 'PARENT_ROUTE_UNAVAILABLE' });
  assert.equal(choose(config, { parentRoute: undefined, catalog, proposal: { presetId: 'fixed' } }).model, 'm-fixed');
});

test('custom inherited efforts are exact and null still requires affirmative effort-less metadata', () => {
  const config = effort => ({ enabled: true, presets: [inherited({ effort })], defaultPreset: 'inherited' });
  assert.equal(choose(config('custom-effort'), { catalog: new Map([['inherited', policyMetadata({ reasoning: { efforts: ['custom-effort'] } })]]) }).effort, 'custom-effort');
  assert.equal(choose(config(null), { catalog: new Map([['inherited', policyMetadata({ reasoning: { efforts: [] } })]]) }).effort, null);
  for (const info of [undefined, {}, policyMetadata(), policyMetadata({ reasoning: undefined }), policyMetadata({ reasoning: {} }),
    policyMetadata({ reasoning: { efforts: ['default'] } }), policyMetadata({ reasoning: { efforts: [''] } })]) {
    assert.throws(() => choose(config(null), { catalog: new Map([['inherited', info]]) }), { code: 'NO_ROUTE' });
  }
  assert.throws(() => choose(undefined, { catalog: new Map([['default-high', policyMetadata({ reasoning: { efforts: ['low', 'max'] } })]]) }), { code: 'NO_ROUTE' });
});

test('runtime resolves the current parent per call, keeps the preset effort, and never writes parent options', async () => {
  const f = fixture(), before = structuredClone(f.parent);
  Object.freeze(f.parent.options); Object.freeze(f.parent);
  const first = await f.router.run(f.parent, request(), exec('default'));
  assert.deepEqual(first.selected, { provider: 'p-a', model: 'm-a', effort: 'high' });
  assert.equal(first.presetId, DEFAULT_PRESET_ID); assert.deepEqual(f.parent, before);
  const secondParent = parent(); secondParent.options = { provider: 'p-b', model: 'm-b', reasoningEffort: 'low' };
  const second = await f.router.run(secondParent, request({ preset_id: 'default-max' }), exec('changed'));
  assert.deepEqual(second.selected, { provider: 'p-b', model: 'm-b', effort: 'max' });
  assert.deepEqual(f.resolutions, [['p-a', 'm-a'], ['p-b', 'm-b']]);
  assert.deepEqual(f.calls.map(args => args.reasoning_effort), ['high', 'max']);
  assert.ok(f.prepared.every(Object.isFrozen));
  assert.deepEqual(f.journal.load().map(row => [row.provider, row.model, row.modelId]), [
    ['p-a', 'm-a', JSON.stringify(['p-a', 'm-a'])], ['p-a', 'm-a', JSON.stringify(['p-a', 'm-a'])],
    ['p-b', 'm-b', JSON.stringify(['p-b', 'm-b'])], ['p-b', 'm-b', JSON.stringify(['p-b', 'm-b'])],
  ]);
});

test('plan snapshots are frozen detached data and injected reader overrides stale Agent options', async () => {
  const current = { provider: 'p-b', model: 'm-b', effort: 'low' };
  const f = fixture({ readParentRoute: () => current });
  const plan = await f.router.plan(f.parent, request());
  assert.deepEqual(plan.parentRoute, { provider: 'p-b', model: 'm-b' });
  assert.notEqual(plan.parentRoute, current);
  for (const value of [plan, plan.route, plan.options, plan.parentRoute]) assert.ok(Object.isFrozen(value));
  assert.equal(plan.route.effort, 'high'); assert.equal(f.parent.options.model, 'm-a');
  current.model = 'm-a';
  assert.equal(plan.parentRoute.model, 'm-b');
  assert.throws(() => f.router.validateSelected(f.parent, plan), { code: 'STALE_PARENT_ROUTE' });
});

test('no parent route fallback to creation headers, global defaults, or asynchronous readers', async () => {
  for (const options of [undefined, {}, { provider: 'p-a' }, { provider: 'p-a', model: '' }]) {
    const root = { ...parent(), provider: 'p-a', model: 'm-a', options, session: { header: { origin: 'root' }, agentOptions: { provider: 'p-a', model: 'm-a' } } };
    const f = fixture({ parent: root });
    await assert.rejects(f.router.run(f.parent, request(), exec('missing')), { code: 'PARENT_ROUTE_UNAVAILABLE' });
    assert.deepEqual(f.resolutions, []); assert.deepEqual(f.calls, []); assert.deepEqual(f.journal.load(), []);
  }
  for (const readParentRoute of [() => { throw Error('offline'); }, async () => ({ provider: 'p-a', model: 'm-a' }), async () => { throw Error('offline'); }]) {
    const f = fixture({ readParentRoute });
    await assert.rejects(f.router.run(f.parent, request(), exec('invalid-reader')), { code: 'PARENT_ROUTE_UNAVAILABLE' });
    assert.deepEqual(f.resolutions, []);
  }
});

test('a fixed override preserves old behavior and never needs the parent route reader', async () => {
  const f = fixture({ config: { presets: [...createDefaultPresets(), fixed()], defaultPreset: 'fixed' },
    readParentRoute: () => { throw Error('fixed routes must not consult this reader'); },
    preflight: async () => { f.parent.options = { provider: 'new', model: 'new', reasoningEffort: 'max' }; },
  });
  const result = await f.router.run(f.parent, request(), exec('fixed'));
  assert.deepEqual(result.selected, { provider: 'p-fixed', model: 'm-fixed', effort: 'low' });
  assert.deepEqual(f.resolutions, [['p-fixed', 'm-fixed']]);
  await assert.rejects(f.router.run(f.parent, request({ preset_id: 'default-high' }), exec('parent')), { code: 'PARENT_ROUTE_UNAVAILABLE' });
  assert.equal(f.calls.length, 1);
});

for (const stage of ['resolveModel', 'preflight']) {
  for (const change of ['provider', 'model', 'unavailable']) {
    test('parent ' + change + ' drift during async ' + stage + ' fails closed before intent', async () => {
      const entered = deferred(), release = deferred();
      const f = fixture({ [stage]: async (p, m) => { entered.resolve(); await release.promise; return stage === 'resolveModel' ? metadata(p, m) : undefined; } });
      const run = f.router.run(f.parent, request(), exec('drift'));
      await entered.promise;
      if (change === 'unavailable') f.parent.options = undefined;
      else f.parent.options[change] = change === 'provider' ? 'p-b' : 'm-b';
      release.resolve();
      await assert.rejects(run, { code: 'STALE_PARENT_ROUTE' });
      assert.deepEqual(f.resolutions, [['p-a', 'm-a']]); assert.deepEqual(f.calls, []); assert.deepEqual(f.journal.load(), []);
      assert.equal(f.router.ledger.state(f.parent.id).pending, 0);
      f.parent.options = parent().options;
      assert.equal(f.router.run(f.parent, request(), exec('drift')), run);
      await assert.rejects(run, { code: 'STALE_PARENT_ROUTE' });
    });
  }
}

test('parent route drift after an awaited plan is fenced before reservation', async () => {
  const f = fixture(), original = f.router.plan.bind(f.router);
  f.router.plan = async (...args) => { const plan = await original(...args); f.parent.options.model = 'm-b'; return plan; };
  await assert.rejects(f.router.run(f.parent, request(), exec('plan')), { code: 'STALE_PARENT_ROUTE' });
  assert.deepEqual(f.calls, []); assert.deepEqual(f.journal.load(), []);
});

test('parent route drift during intent audit is rejected and releases quota without publication', async () => {
  const f = fixture(), append = f.journal.append.bind(f.journal);
  f.journal.append = row => { append(row); if (row.status === 'intent') f.parent.options.model = 'm-b'; };
  await assert.rejects(f.router.run(f.parent, request(), exec('intent')), { code: 'STALE_PARENT_ROUTE' });
  assert.deepEqual(f.calls, []); assert.deepEqual(f.journal.load().map(row => row.status), ['intent', 'rejected']);
  assert.equal(f.router.ledger.state(f.parent.id).paused, false); assert.equal(f.router.ledger.state(f.parent.id).active.size, 0);
});

test('native pipeline fence rejects post-prepare parent drift synchronously before actual dispatch', async () => {
  const entered = deferred(), release = deferred(); let dispatches = 0, completions = 0;
  const native = { output: { schema: { type: 'object', required: ['kind', 'subagentId'], properties: { kind: { type: 'string', const: 'activation' }, subagentId: { type: 'string' } } } } };
  const ctx = { tools: { executable: () => native, schemas: () => [{ name: 'subagent', parameters: { properties: { provider: {}, model: {}, reasoning_effort: {} } } }] } };
  const pipeline = {
    prepare: async input => { entered.resolve(); await release.promise; return { kind: 'dispatch', exec: input }; },
    dispatch: async () => { dispatches++; return { kind: 'post-result', result: { value: { kind: 'activation', subagentId: 'native-child' } } }; },
    complete: async (_exec, outcome) => { completions++; return outcome.result; },
  };
  const f = fixture({ invokeNative: createNativeInvoker(ctx, pipeline) });
  const execution = { callId: 'native', agent: f.parent, token: {}, toolSet: {}, signal: new AbortController().signal };
  const run = f.router.run(f.parent, request(), execution);
  await entered.promise; f.parent.options.model = 'm-b'; release.resolve();
  await assert.rejects(run, { code: 'STALE_PARENT_ROUTE', definitelyNotStarted: true });
  assert.equal(dispatches, 0); assert.equal(completions, 1);
  assert.deepEqual(f.journal.load().map(row => row.status), ['intent', 'rejected']);
  assert.equal(f.router.ledger.state(f.parent.id).paused, false);
  f.parent.options.model = 'm-a';
  assert.equal(f.router.run(f.parent, request(), execution), run);
  await assert.rejects(run, { code: 'STALE_PARENT_ROUTE' });
  await f.router.run(f.parent, request(), { ...execution, callId: 'new-call' });
  assert.equal(dispatches, 1);
});

test('parent changes after dispatch preserve the frozen child route and normal accepted/settled lifecycle', async () => {
  let publications = 0, sent;
  const f = fixture({ invokeNative: async (args, _exec, fence) => {
    fence(); sent = { ...args }; publications++;
    await Promise.resolve(); f.parent.options = { provider: 'p-b', model: 'm-b', reasoningEffort: 'low' };
    return { kind: 'activation', subagentId: 'published-child' };
  } });
  const run = f.router.run(f.parent, request(), exec('published'));
  const result = await run;
  assert.deepEqual(result.selected, { provider: 'p-a', model: 'm-a', effort: 'high' });
  assert.equal(sent.provider, 'p-a'); assert.equal(sent.model, 'm-a'); assert.equal(sent.reasoning_effort, 'high');
  assert.equal(f.router.run(f.parent, request(), exec('published')), run);
  assert.deepEqual((await run).selected, result.selected);
  assert.deepEqual(f.journal.load().map(row => row.status), ['intent', 'accepted']);
  assert.ok(f.journal.load().every(row => row.provider === 'p-a' && row.model === 'm-a' && row.effort === 'high'));
  assert.equal(f.router.ledger.state(f.parent.id).paused, false);
  f.parent.options.model = 'm-a';
  f.router.settle(f.parent.id, 'published-child');
  assert.equal(f.journal.load().at(-1).status, 'settled'); assert.equal(publications, 1);
  assert.equal(f.router.ledger.state(f.parent.id).active.size, 0);
});

test('parent effort changes alone do not alter inherited effort or invalidate provider/model identity', async () => {
  const f = fixture({ preflight: async () => { f.parent.options.reasoningEffort = 'low'; } });
  const result = await f.router.run(f.parent, request(), exec('effort-only'));
  assert.equal(result.selected.effort, 'high'); assert.equal(f.calls[0].reasoning_effort, 'high');
  assert.equal(f.parent.options.reasoningEffort, 'low');
});

test('unsupported or unknown inherited capability never falls back to another effort or fixed preset', async () => {
  for (const info of [undefined, {}, metadata('p-a', 'm-a', { reasoning: undefined }), metadata('p-a', 'm-a', { reasoning: {} }),
    metadata('p-a', 'm-a', { reasoning: { efforts: ['low', 'max'], defaultEffort: 'low' } }), metadata('p-a', 'm-a', { reasoning: { efforts: ['default'] } })]) {
    const f = fixture({ config: { presets: [...createDefaultPresets(), fixed()], defaultPreset: DEFAULT_PRESET_ID }, resolveModel: async () => info });
    await assert.rejects(f.router.run(f.parent, request(), exec('unsupported')), { code: 'NO_ROUTE' });
    assert.deepEqual(f.resolutions, [['p-a', 'm-a']]); assert.deepEqual(f.calls, []); assert.deepEqual(f.journal.load(), []);
  }
});

test('inherited presets share actual-model quota with fixed aliases regardless of effort', async () => {
  const f = fixture({ config: { presets: [...createDefaultPresets(), fixed({ provider: 'p-a', model: 'm-a' })], defaultPreset: DEFAULT_PRESET_ID, limits: { maxActivePerModel: 1 } } });
  const first = await f.router.run(f.parent, request({ preset_id: 'default-low' }), exec('low'));
  for (const preset_id of ['default-high', 'default-max', 'fixed']) {
    await assert.rejects(f.router.run(f.parent, request({ preset_id }), exec(preset_id)), { code: 'MODEL_CAPACITY' });
  }
  assert.equal(f.calls.length, 1); f.router.settle(f.parent.id, first.subagentId);
  const second = await f.router.run(f.parent, request({ preset_id: 'fixed' }), exec('fixed-later'));
  assert.equal(second.selected.model, 'm-a'); assert.equal(f.calls.length, 2);
  assert.ok(f.journal.load().every(row => row.modelId === JSON.stringify(['p-a', 'm-a'])));
});

test('concurrent plans keep separate parent snapshots rather than a global resolved model cache', async () => {
  const entered = deferred(), release = deferred();
  const f = fixture({ resolveModel: async (p, m) => { if (m === 'm-a') { entered.resolve(); await release.promise; } return metadata(p, m); } });
  const first = f.router.run(f.parent, request(), exec('one'));
  await entered.promise;
  const secondParent = parent(); secondParent.id = 'another-root'; secondParent.options = { provider: 'p-b', model: 'm-b' };
  const second = await f.router.run(secondParent, request({ preset_id: 'default-low' }), exec('two'));
  release.resolve(); const firstResult = await first;
  assert.deepEqual(firstResult.selected, { provider: 'p-a', model: 'm-a', effort: 'high' });
  assert.deepEqual(second.selected, { provider: 'p-b', model: 'm-b', effort: 'low' });
  assert.deepEqual(f.resolutions, [['p-a', 'm-a'], ['p-b', 'm-b']]);
});

test('inherited null effort still invokes the host inheritance guard and otherwise omits native effort', async () => {
  const config = { presets: [inherited({ effort: null })], defaultPreset: 'inherited' };
  const resolveModel = async () => metadata('p-a', 'm-a', { reasoning: { efforts: [] } });
  const f = fixture({ config, resolveModel }); f.parent.options.reasoningEffort = undefined;
  const result = await f.router.run(f.parent, request(), exec('none'));
  assert.equal(result.selected.effort, null); assert.equal('reasoning_effort' in f.calls[0], false);
  const guarded = fixture({ config, resolveModel, validateOptions: (_parent, route) => {
    assert.equal(route.provider, 'p-a'); assert.equal(route.model, 'm-a'); assert.equal(route.effort, null);
    throw Object.assign(Error('native same-route effort would be inherited'), { code: 'NULL_EFFORT_INHERITANCE' });
  } });
  await assert.rejects(guarded.router.run(guarded.parent, request(), exec('guard')), { code: 'NULL_EFFORT_INHERITANCE' });
  assert.deepEqual(guarded.calls, []); assert.deepEqual(guarded.journal.load(), []);
});
