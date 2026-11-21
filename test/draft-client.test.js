import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const React = {
  Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useState: value => [value, () => {}],
  useRef: value => ({ current: value }), useEffect() {}
};
let definition;
vm.runInNewContext(source, { AbortController, window: { __ModuleLoader__: { load: entry => { definition = entry; } } } });
const plugin = definition.factory(() => React);
const copy = value => JSON.parse(JSON.stringify(value));
const t = key => plugin.dictionaries.en[key] ?? key;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const low = { provider: 'p', model: 'm', effort: 'low' };
const high = { provider: 'p', model: 'm', effort: 'high' };
const plain = { provider: 'p', model: 'plain', effort: null };
const native = () => ({ groups: [{ id: 'p', models: [
  { id: 'm', reasoning: { efforts: [{ id: 'low' }, { id: 'high' }], defaultEffort: 'low' } },
  { id: 'explicit', reasoning: { efforts: [{ id: 'custom' }] } },
  { id: 'plain' }
] }], failures: [] });
const draftPool = () => [
  { id: 'pool-low', name: 'Pool quick', ...low, description: 'Unchanged low metadata' },
  { id: 'pool-high', name: 'Pool thorough', ...high, description: 'Unchanged high metadata' },
  { id: 'pool-plain', name: 'Pool plain', ...plain, description: '' }
];
const activeConfig = ui => ui.configs.find(row => row.id === ui.activeConfigId);
const generated = () => ({ candidates: [
  { id: 'scope-1', name: 'Quick', ...low, description: 'Small edits' },
  { id: 'scope-2', name: 'Thorough', ...high, description: 'Review' }
], defaultCandidateId: 'scope-1', warnings: ['Review these suggestions.'] });

async function harness(testContext, overrides = {}, scope = [low, high]) {
  const ui = { schemaVersion: 5, enabled: true, candidates: draftPool(), activeConfigId: 'a',
    limits: { ...copy(plugin.emptyDraft().limits), maxActivePerModel: 3 }, configs: [
      { id: 'a', name: 'Alpha preset', candidates: [{ id: 'old', name: 'Existing', ...low, description: 'Keep until confirmed' }], defaultCandidateId: 'old' },
      { id: 'b', name: 'Beta preset', candidates: [{ id: 'beta', name: 'Other preset profile', ...high, description: 'Never overwrite' }], defaultCandidateId: 'beta' }
    ] };
  const value = { ui, auditFile: 'D:/audit/keep.jsonl' };
  let snapshot = { status: 'ready', writable: true, revision: 7, value: copy(value), user: copy(value), ...overrides };
  const listeners = new Set(), pendingTimers = new Map(); let timerId = 0;
  const clock = { setTimeout(fn) { const id = ++timerId; pendingTimers.set(id, fn); return id; }, clearTimeout(id) { pendingTimers.delete(id); } };
  const form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  const h = { pendingTimers, calls: [], mutations: [], loads: 0, catalogResponse: native(),
    current: () => copy(snapshot),
    change(patch, notify = true) { snapshot = { ...snapshot, ...patch }; if (notify) for (const fn of listeners) fn(); },
    generate: async () => generated(), validate: async request => ({ candidates: request.candidates, defaultCandidateId: request.defaultCandidateId }),
    mutate: async row => { const user = { ...snapshot.user, ui: copy(row.ops[0].value) }; h.change({ revision: row.revision + 1, user, value: copy(user) }); return { ok: true }; },
    async flushTimers() { const fns = [...pendingTimers.values()]; pendingTimers.clear(); for (const fn of fns) fn(); for (let i = 0; i < 15; i++) await Promise.resolve(); }
  };
  h.ctx = { configForms: { get: () => form, describe: () => ({ async load() { h.loads++; } }) }, remote: {
    session: { modelCatalog: async () => ({ ok: true, value: h.catalogResponse }) },
    delegationRouter: {
      async generateDraft(request, signal) { h.calls.push({ method: 'generate', request: copy(request), signal }); return h.generate(request, signal); },
      async validateDraft(request, signal) { h.calls.push({ method: 'validate', request: copy(request), signal }); return h.validate(request, signal); }
    },
    settings: { async mutate(ns, ops, revision) { const row = { ns, ops: copy(ops), revision }; h.mutations.push(row); return h.mutate(row); } }
  } };
  h.editor = new plugin.RouterEditor(h.ctx, t, clock);
  h.catalog = new plugin.ModelCatalog(h.ctx);
  h.generator = new plugin.DraftGenerator(h.ctx, h.editor, h.catalog, t);
  h.dispose = () => { h.generator.dispose(); h.catalog.dispose(); h.editor.dispose(); };
  testContext.after(h.dispose);
  await h.catalog.load();
  h.configure = () => { assert.equal(h.generator.selectGenerator(plugin.modelKey(low)), true); assert.equal(h.generator.setScope(scope), true); assert.equal(h.generator.setRequirements('Use quick edits and careful review profiles.'), true); };
  h.configure(); return h;
}
function flatten(node) {
  if (node === undefined || node === null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}
const workspaceProps = h => ({ editor: h.editor, catalog: h.catalog, generator: h.generator, t, view: 'page' });
const workspacePanel = (nodes, key) => nodes.find(node => node?.props?.['data-workspace-panel'] === key);
const workspaceNav = (nodes, key) => nodes.find(node => node?.props?.['data-workspace-nav'] === key);
function workspace(props) {
  // Persist RouterPage's navigation state between renders; nested components use the default stub.
  const useState = React.useState;
  let panel;
  return () => {
    let tree;
    React.useState = initial => [panel ?? initial, next => { panel = next; }];
    try { tree = plugin.RouterPage(props); } finally { React.useState = useState; }
    return flatten(tree);
  };
}
const wizard = h => flatten(plugin.DraftWizard({ generator: h.generator, editor: h.editor, catalog: h.catalog, t }));
const button = (h, key) => wizard(h).find(node => node?.type === 'button' && node.props.children.includes(t(key)));
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function mountPlugin(h, mount) {
  const effects = [], registrations = [], requests = [];
  h.ctx.remote.$mount = request => { requests.push(request); return mount(request); };
  const ctx = { ...h.ctx,
    locale: { bind: () => t, register: () => () => {} },
    slots: { inject: (_name, fn) => fn(), register: (_meta, component) => { registrations.push(component); return () => {}; } },
    on() {}, effect(fn) { const off = fn(); effects.push(off); return off; }
  };
  plugin.apply(ctx);
  let cleanup;
  return { requests, props: registrations[0]({ view: 'page' }).props,
    dispose() { return cleanup ??= (async () => { for (const off of effects.reverse()) await off?.(); })(); }
  };
}

test('RPC mount descriptors bind cancellation and async disposal releases exactly once before or after mount resolves', async testContext => {
  for (const late of [false, true]) {
    const h = await harness(testContext), gate = deferred(); const service = h.ctx.remote.delegationRouter;
    delete h.ctx.remote.delegationRouter;
    const mounted = mountPlugin(h, () => gate.promise); let releases = 0;
    testContext.after(() => mounted.dispose());
    assert.equal(mounted.props.generator.getSnapshot().available, false);
    assert.equal(mounted.requests.length, 1);
    const request = copy(mounted.requests[0]); assert.equal(request.package, 'dsh-delegation-router');
    assert.deepEqual(request.descriptors.map(row => [row.service, row.method, row.cancellation.parameter]), [
      ['delegationRouter', 'generateDraft', 'signal'], ['delegationRouter', 'validateDraft', 'signal'], ['delegationRouter', 'modelCatalog', 'signal']
    ]);
    let cleanup;
    if (late) cleanup = mounted.dispose();
    h.ctx.remote.delegationRouter = service;
    gate.resolve(async () => { await Promise.resolve(); releases++; delete h.ctx.remote.delegationRouter; });
    await flush();
    if (!late) { assert.equal(mounted.props.generator.getSnapshot().available, true); cleanup = mounted.dispose(); }
    await cleanup; await mounted.dispose(); assert.equal(releases, 1);
    assert.equal(mounted.props.generator.disposed, true);
  }
});

test('failed RPC mount reports unavailable draft UI without removing manual editor controls', async testContext => {
  const h = await harness(testContext), gate = deferred(); delete h.ctx.remote.delegationRouter;
  const mounted = mountPlugin(h, () => gate.promise); testContext.after(() => mounted.dispose());
  gate.reject(Error('mount failed')); await flush();
  assert.equal(mounted.props.generator.getSnapshot().available, false);
  assert.equal(mounted.props.generator.getSnapshot().error, t('draftUnavailable'));
  const render = workspace(mounted.props);
  workspaceNav(render(), 'draft').props.onClick();
  const draft = workspacePanel(render(), 'draft');
  assert.equal(draft.props.hidden, false);
  assert.ok(flatten(draft).includes(t('draftUnavailable')));
  workspaceNav(render(), 'pool').props.onClick();
  const pool = workspacePanel(render(), 'pool');
  assert.equal(pool.props.hidden, false);
  const add = flatten(pool).find(row => row?.type === 'button' && row.props.children.includes(t('addPoolCandidate')));
  assert.equal(add.props.disabled, false); assert.equal(mounted.props.editor.editable(), true);
  assert.equal(h.calls.length, 0); assert.equal(h.mutations.length, 0); await mounted.dispose();
});

test('workspace navigation shows only preset details by default and does not write settings', async testContext => {
  const h = await harness(testContext, v4Fixture(), [low]), before = h.current();
  const render = workspace(workspaceProps(h));
  const assertPanel = (nodes, active) => {
    for (const key of ['details', 'pool', 'draft']) {
      assert.equal(workspacePanel(nodes, key).props.hidden, key !== active, key);
      assert.equal(workspaceNav(nodes, key).props['aria-pressed'], key === active, key);
    }
  };
  let nodes = render();
  assertPanel(nodes, 'details');
  for (const key of ['pool', 'draft', 'details']) {
    workspaceNav(nodes, key).props.onClick();
    nodes = render();
    assertPanel(nodes, key);
    assert.ok(nodes.some(row => row?.props?.['data-autosave']));
  }
  assert.equal(h.pendingTimers.size, 0);
  assert.deepEqual(h.current(), before);
  assert.equal(h.editor.getSnapshot().dirty, false);
  assert.equal(h.mutations.length, 0); assert.equal(h.calls.length, 0);
});

function v4Fixture(candidates = [{ id: 'shared', name: 'Shared low effort', ...low }]) {
  const ui = { ...copy(plugin.emptyDraft()), schemaVersion: 4, enabled: true, activeConfigId: 'a', candidates, configs: [
    { id: 'a', name: 'Alpha preset', defaultCandidateId: 'shared', overrides: [{ id: 'shared', name: 'Alpha role' }] },
    { id: 'b', name: 'Beta preset', defaultCandidateId: 'shared', overrides: [{ id: 'shared', name: 'Beta role' }] }
  ] };
  return { value: { ui }, user: { ui: copy(ui) } };
}

test('v4 wizard selects its generator from the catalog, but delegation scope from the unambiguous shared pool', async testContext => {
  const fixture = v4Fixture([
    { id: 'shared', name: 'Shared low effort', ...low },
    { id: 'dupe-1', name: 'Ambiguous high 1', ...high },
    { id: 'dupe-2', name: 'Ambiguous high 2', ...high }
  ]);
  const h = await harness(testContext, fixture, []);
  assert.equal(button(h, 'draftGenerate').props.disabled, true);
  assert.equal(h.generator.setScope([high]), false);
  assert.equal(await h.generator.generate(), false); // The two pool matches must not permit a generated request.
  assert.equal(h.calls.length, 0);
  assert.equal(h.generator.setScope([]), true);
  const nodes = wizard(h);
  const generator = nodes.find(row => row?.type === 'select' && row.props['aria-label'] === t('draftGenerator'));
  assert.ok(flatten(generator).some(row => row?.type === 'option' && row.props.value === plugin.modelKey(plain)));
  generator.props.onChange({ target: { value: plugin.modelKey(plain) } });
  const region = nodes.find(row => row?.props?.role === 'region' && row.props['aria-label'] === t('draftScope'));
  const labels = flatten(region).filter(row => row?.type === 'label');
  assert.equal(labels.length, 1);
  assert.ok(flatten(labels[0]).includes('Shared low effort · p / m / low'));
  assert.ok(nodes.includes(t('draftDuplicateScope')));
  const checkbox = flatten(labels[0]).find(row => row?.type === 'input' && row.props.type === 'checkbox');
  assert.equal(checkbox.props.disabled, false);
  checkbox.props.onChange({ target: { checked: true } });
  h.generate = async () => ({ ...generated(), candidates: [generated().candidates[0]] });
  const generate = button(h, 'draftGenerate');
  assert.equal(generate.props.disabled, false);
  assert.equal(await generate.props.onClick(), true);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].request.generator, plain);
  assert.deepEqual(h.calls[0].request.scope, [low]);
  assert.equal(h.mutations.length, 0);
});

test('v3 seeds the draft scope from persisted candidates; v5 never falls back to active profiles or the catalog', async testContext => {
  const catalogOnly = { provider: 'p', model: 'explicit', effort: 'custom' };
  const existing = { id: 'old', name: 'Existing', ...low, description: '' };
  const sources = [
    { schemaVersion: 3, enabled: true, candidates: [existing], defaultCandidateId: 'old' },
    { schemaVersion: 5, enabled: true, candidates: [draftPool()[0]], activeConfigId: 'a', configs: [
      { id: 'a', name: 'Alpha', candidates: [existing, { id: 'manual-only', name: 'Manual-only profile', ...high, description: '' }], defaultCandidateId: 'old' }
    ] }
  ];
  for (const ui of sources) {
    const h = await harness(testContext, { value: { ui }, user: { ui: copy(ui) } }, []);
    const scope = wizard(h).find(row => row?.props?.role === 'region' && row.props['aria-label'] === t('draftScope'));
    const labels = flatten(scope).filter(row => row?.type === 'label');
    assert.equal(labels.length, 1);
    assert.ok(flatten(labels[0]).includes(ui.schemaVersion === 3 ? 'Existing · p / m / low' : 'Pool quick · p / m / low'));
    for (const unavailable of [high, catalogOnly]) {
      assert.equal(h.generator.setScope([unavailable]), false);
      assert.equal(await h.generator.generate(), false);
    }
    assert.equal(h.calls.length, 0);
    assert.equal(h.mutations.length, 0);
    assert.deepEqual(h.current().value.ui, ui);
    assert.equal(h.generator.setScope([low]), true);
    h.generate = async () => ({ ...generated(), candidates: [generated().candidates[0]] });
    assert.equal(await h.generator.generate(), true);
    assert.deepEqual(h.calls[0].request.scope, [low]);
    assert.equal(h.mutations.length, 0);
  }
});

test('generation through the settings form focuses review only when the draft panel is visible', async testContext => {
  for (const hidden of [false, true]) {
    const h = await harness(testContext, v4Fixture(), [low]);
    h.generator.setScope([low]);
    h.generate = async () => ({ ...generated(), candidates: [generated().candidates[0]] });
    const calls = [];
    const heading = { closest: selector => { assert.equal(selector, '[hidden]'); return hidden ? {} : null; },
      focus: options => calls.push(['focus', options.preventScroll]), scrollIntoView: options => calls.push(['scroll', options.block]) };
    const ref = { current: null };
    let requested = false, effects = [];
    const original = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
    function render() {
      effects = [];
      Object.assign(React, {
        useState: value => value === false ? [requested, next => { requested = next; }] : original.useState(value),
        useRef: () => ref,
        useEffect: effect => effects.push(effect)
      });
      try {
        const nodes = wizard(h);
        ref.current = nodes.find(node => node?.type === 'h3' && node.props.ref === ref) ? heading : null;
        for (const effect of effects) effect();
        return nodes;
      } finally { Object.assign(React, original); }
    }
    const start = render().find(node => node?.type === 'button' && node.props.children.includes(t('draftGenerate')));
    assert.equal(await start.props.onClick(), true);
    assert.deepEqual(calls, []);
    assert.ok(render().includes(t('draftReview')));
    assert.deepEqual(calls, hidden ? [] : [['focus', true], ['scroll', 'nearest']]);
    assert.equal(requested, false);
    assert.equal(h.mutations.length, 0);
  }
});

test('a generated draft review and its navigation badge never appear in another preset', async testContext => {
  const h = await harness(testContext, v4Fixture(), [low]);
  assert.equal(h.generator.setScope([low]), true);
  h.generate = async () => ({ ...generated(), candidates: [generated().candidates[0]] });
  assert.equal(await h.generator.generate(), true);
  const render = workspace(workspaceProps(h));
  workspaceNav(render(), 'draft').props.onClick();
  let nodes = render();
  assert.ok(flatten(workspaceNav(nodes, 'draft')).includes(t('draftPendingBadge')));
  assert.ok(flatten(workspacePanel(nodes, 'draft')).some(row => row?.props?.['data-draft-review']));
  assert.ok(button(h, 'draftApply'));

  assert.equal(await h.editor.switchConfig('b'), true);
  assert.ok(h.generator.getSnapshot().draft); // The stale draft is retained, not silently deleted.
  nodes = render();
  const draft = workspacePanel(nodes, 'draft');
  assert.equal(draft.props.hidden, false);
  assert.ok(flatten(draft).includes('Beta preset'));
  assert.equal(flatten(draft).some(row => row?.props?.['data-draft-review']), false);
  assert.equal(flatten(draft).includes(t('draftApply')), false);
  assert.equal(flatten(draft).includes('Review these suggestions.'), false);
  assert.equal(flatten(workspaceNav(nodes, 'draft')).includes(t('draftPendingBadge')), false);
  assert.equal(h.mutations.length, 1); // Only switching the active preset writes settings.
});

// Generation is a detached, explicitly invoked operation, not an autosave source.
test('full triples generate a detached draft; reviewed application validates then saves exactly once', async testContext => {
  const h = await harness(testContext), before = h.current(), original = copy(h.editor.getSnapshot().draft);
  assert.equal(h.calls.length, 0); assert.equal(h.pendingTimers.size, 0);
  assert.equal(h.generator.setScope([low, high, plain]), true); // Plain is in scope but not in the reviewed output.
  assert.equal(await h.generator.generate(), true);
  assert.deepEqual(copy(h.editor.getSnapshot().draft), original); assert.deepEqual(h.current(), before);
  assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.pendingTimers.size, 0); assert.equal(h.mutations.length, 0);
  assert.deepEqual(h.calls[0].request, { generator: low, scope: [low, high, plain], requirements: 'Use quick edits and careful review profiles.' });
  assert.equal(h.generator.editCandidate('scope-1', { name: 'My name', description: 'Manual review of draft only' }), true);
  assert.equal(h.generator.setDefault('scope-2'), true);
  assert.equal(await h.generator.validateAndApply(), false); assert.equal(h.calls.length, 1);
  assert.equal(h.generator.confirm(true), true);
  assert.equal(await h.generator.validateAndApply(), true);
  assert.deepEqual(h.calls.map(row => row.method), ['generate', 'validate']); assert.equal(h.mutations.length, 1);
  assert.equal(h.mutations[0].revision, 7); assert.equal(h.mutations[0].ns, 'delegation-router');
  assert.deepEqual(h.mutations[0].ops.map(row => [row.op, row.path]), [['set', ['ui']]]);
  const saved = h.current().value;
  assert.equal(saved.ui.enabled, true); assert.deepEqual(saved.ui.limits, original.limits); assert.equal(saved.auditFile, before.value.auditFile);
  assert.equal(saved.ui.schemaVersion, 5);
  assert.deepEqual(saved.ui.candidates, before.value.ui.candidates);
  assert.deepEqual(saved.ui.configs[1], before.value.ui.configs[1]);
  assert.deepEqual(activeConfig(saved.ui), { id: 'a', name: 'Alpha preset', defaultCandidateId: 'pool-high', candidates: [
    { id: 'pool-low', name: 'My name', ...low, description: 'Manual review of draft only' },
    { id: 'pool-high', name: 'Thorough', ...high, description: 'Review' }
  ] });
  assert.equal(h.generator.getSnapshot().status, 'applied'); assert.equal(h.pendingTimers.size, 0);
  assert.equal(await h.generator.validateAndApply(), false); await h.flushTimers(); assert.equal(h.mutations.length, 1);
});

test('dynamic RPC uses optional scoped lookup rather than undeclared namespace property access', async testContext => {
  const h = await harness(testContext), remote = h.ctx.remote.delegationRouter; let lookups = 0;
  remote.modelCatalog = async () => ({ok:true,value:h.catalogResponse});
  h.ctx.get = key => { assert.equal(key,'remote.delegationRouter'); lookups++; return remote; };
  Object.defineProperty(h.ctx.remote,'delegationRouter',{get(){ throw Error('cannot get property without inject'); },configurable:true});
  assert.equal(h.generator.available(),true); assert.equal(await h.catalog.load(),true);
  h.configure(); assert.equal(await h.generator.generate(),true); h.generator.confirm(true);
  assert.equal(await h.generator.validateAndApply(),true); assert.equal(h.mutations.length,1);
  assert.ok(lookups>=4);
});

test('unfinished manual edits do not disable generator and scope input preparation', async testContext => {
  const h = await harness(testContext), original = h.current(); h.editor.addCandidate();
  const nodes = wizard(h);
  const picker = nodes.find(node => node?.type === 'select' && node.props['aria-label'] === t('draftGenerator'));
  assert.equal(picker.props.disabled, false);
  picker.props.onChange({target:{value:plugin.modelKey(plain)}});
  assert.deepEqual(copy(h.generator.getSnapshot().input.generator), plain);
  assert.equal(nodes.find(node => node?.type === 'textarea' && node.props.maxLength === 8000).props.disabled, false);
  assert.equal(button(h,'draftGenerate').props.disabled, true);
  assert.equal(await h.generator.generate(), false); assert.equal(h.calls.length, 0); assert.equal(h.mutations.length, 0);
  assert.deepEqual(h.current(), original);
});

test('generator defaults are advertised only; explicit choices and genuine null are supported', async testContext => {
  const h = await harness(testContext), g = h.generator;
  assert.equal(g.selectGenerator(plugin.modelKey({ provider: 'p', model: 'explicit' })), true);
  assert.equal(g.getSnapshot().input.generator.effort, ''); assert.equal(await g.generate(), false); assert.equal(h.calls.length, 0);
  assert.equal(g.setGeneratorEffort('medium'), false); assert.equal(g.setGeneratorEffort('default'), false);
  assert.equal(g.setGeneratorEffort('custom'), true); assert.equal(g.inputsValid(), true);
  assert.equal(g.selectGenerator(plugin.modelKey(plain)), true); assert.deepEqual(copy(g.getSnapshot().input.generator), plain);
  assert.equal(g.setScope([low, high, plain]), true); assert.equal(g.inputsValid(), true);
  assert.equal(g.setScope([low, low]), false); assert.equal(g.setScope([{ ...low, effort: null }]), false);
  assert.equal(g.setScope([{ ...low, effort: 'medium' }]), false);
  assert.equal(g.setRequirements('a'.repeat(8000)), true); assert.equal(g.setRequirements('a'.repeat(8001)), false);
  assert.equal(g.setRequirements('   '), true); assert.equal(g.inputsValid(), false);
  h.catalog.publish({ status: 'loading', groups: [], failures: [], error: '' });
  assert.equal(g.selectGenerator(plugin.modelKey(plain)), false); assert.equal(g.setGeneratorEffort(null), false);
  assert.equal(g.setScope([plain]), false); assert.equal(g.inputsValid(), false);
});

test('invalid generation output cannot escape exact scope or smuggle persistent fields', async testContext => {
  for (const modify of [
    value => { value.candidates[0].effort = 'max'; },
    value => { value.candidates[0].provider = 'other'; },
    value => { value.candidates[0].model = 'plain'; },
    value => { value.candidates[0].effort = null; },
    value => { value.candidates[0].unexpected = true; },
    value => { value.candidates[0].id = 'custom'; value.defaultCandidateId = 'custom'; },
    value => { value.candidates[0].id = 'scope-01'; value.defaultCandidateId = 'scope-01'; },
    value => { value.candidates[0].id = 'scope-0'; value.defaultCandidateId = 'scope-0'; },
    value => { value.candidates[0].id = 'scope-3'; value.defaultCandidateId = 'scope-3'; },
    value => { value.candidates[0].effort = 'high'; value.candidates[1].effort = 'low'; },
    value => { value.candidates[1].id = value.candidates[0].id; },
    value => { value.defaultCandidateId = 'missing'; },
    value => { value.candidates = []; },
    value => { value.warnings = [{}]; }
  ]) {
    const h = await harness(testContext), before = h.current(); h.generate = async () => { const value = generated(); modify(value); return value; };
    assert.equal(await h.generator.generate(), false); assert.equal(h.generator.getSnapshot().status, 'error');
    assert.equal(h.mutations.length, 0); assert.equal(h.pendingTimers.size, 0); assert.deepEqual(h.current(), before);
  }
});

test('candidate review changes only names descriptions removal and default, and clears confirmation', async testContext => {
  const h = await harness(testContext), g = h.generator; await g.generate();
  g.confirm(true); assert.equal(g.editCandidate('scope-1', { effort: 'high' }), false);
  assert.equal(g.editCandidate('scope-1', { id: 'other' }), false); assert.equal(g.editCandidate('scope-1', { model: 'plain' }), false);
  assert.equal(g.editCandidate('scope-1', { name: 'Renamed' }), true); assert.equal(g.getSnapshot().confirmed, false);
  g.confirm(true); assert.equal(g.setDefault('scope-2'), true); assert.equal(g.getSnapshot().confirmed, false);
  assert.equal(g.setDefault('not-real'), false); g.confirm(true); assert.equal(g.removeCandidate('scope-2'), true);
  assert.equal(g.getSnapshot().draft.defaultCandidateId, undefined); assert.equal(g.canApply(), false);
  assert.equal(g.setDefault('scope-1'), true); g.confirm(true); assert.equal(g.canApply(), true);
  assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'Existing'); assert.equal(h.pendingTimers.size, 0);
});

test('minimal validation output is composed safely; diagnostics and outer config fields never persist', async testContext => {
  const h = await harness(testContext); h.generate = async () => { const value = generated(); for (const row of value.candidates) delete row.description; return { ok: true, value }; };
  h.validate = async request => ({ ok: true, value: { candidates: request.candidates.map(({ description: _description, ...row }) => row), defaultCandidateId: request.defaultCandidateId,
    scope: request.scope, enabled: false, limits: { maxActivePerModel: 999 }, auditFile: 'must-not-save', metadata: true } });
  assert.equal(await h.generator.generate(), true); h.generator.confirm(true);
  assert.equal(await h.generator.validateAndApply(), true);
  assert.equal(h.current().value.ui.enabled, true); assert.equal(h.current().value.ui.limits.maxActivePerModel, 3);
  assert.equal(h.current().value.auditFile, 'D:/audit/keep.jsonl'); assert.equal(Object.hasOwn(h.current().value.ui, 'scope'), false);
  assert.ok(activeConfig(h.current().value.ui).candidates.every(row => row.description === ''));
  assert.deepEqual(h.current().value.ui.candidates, draftPool());
});

test('validation cannot change a confirmed triple, id, name or default even within scope', async testContext => {
  for (const change of [
    result => { result.candidates[0].effort = 'high'; },
    result => { result.candidates[0].id = 'renamed'; result.defaultCandidateId = 'renamed'; },
    result => { result.candidates[0].name = 'surprise'; },
    result => { result.defaultCandidateId = 'scope-2'; },
    result => { result.candidates[0].unknown = 'persist me'; }
  ]) {
    const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true);
    h.validate = async request => { const result = copy(request); change(result); return result; };
    assert.equal(await h.generator.validateAndApply(), false); assert.equal(h.mutations.length, 0);
    assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.generator.getSnapshot().confirmed, false);
  }
});

test('requirements generator scope and catalog changes permanently invalidate a reviewed draft', async testContext => {
  for (const change of [
    h => h.generator.setRequirements('Changed requirements'),
    h => h.generator.setGeneratorEffort('high'),
    h => h.generator.setScope([low]),
    h => h.catalog.load()
  ]) {
    const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true); await change(h);
    assert.equal(h.generator.getSnapshot().status, 'stale'); assert.equal(h.generator.canApply(), false);
    assert.equal(await h.generator.validateAndApply(), false); assert.equal(h.mutations.length, 0);
    h.generate = async request => { const result = generated(); result.candidates = result.candidates.filter(row => request.scope.some(route => plugin.routeKey(route) === plugin.routeKey(row))); return result; };
    assert.equal(await h.generator.generate(), true); assert.equal(h.generator.getSnapshot().confirmed, false);
  }
});

test('manual edits and edit-then-save races invalidate generation baseline instead of overwriting', async testContext => {
  for (const persist of [false, true]) {
    const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true);
    assert.equal(h.editor.edit(next => { next.candidates[0].name = 'User edit'; }), true);
    assert.equal(h.generator.getSnapshot().status, 'conflict');
    if (persist) assert.equal(await h.editor.save(), true);
    assert.equal(await h.generator.validateAndApply(), false);
    assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'User edit'); assert.equal(h.mutations.length, persist ? 1 : 0);
  }
  const h = await harness(testContext); await h.generator.generate(); await h.editor.reload();
  assert.equal(h.generator.getSnapshot().status, 'conflict'); assert.equal(h.generator.confirm(true), false);
});

test('dirty readonly conflicts and unknown-write receipts protect manual work before generation', async testContext => {
  for (const prepare of [
    h => h.editor.edit(next => { next.candidates[0].name = 'dirty'; }),
    h => h.editor.editPool(rows => { rows[0].name = 'dirty pool'; }),
    h => h.change({ writable: false }),
    h => h.change({ status: 'loading' }),
    h => { h.editor.conflicted = true; h.editor.publish(); },
    h => { h.editor.receiptUnverified = true; h.editor.publish(); },
    h => h.change({ user: { ui: { schemaVersion: 0 } } }),
    h => { h.editor.savedButNotLive = true; h.editor.autosavePaused = true; h.editor.publish(); }
  ]) {
    const h = await harness(testContext); prepare(h); const before = copy(h.editor.getSnapshot().draft);
    assert.equal(await h.generator.generate(), false); assert.equal(h.calls.length, 0); assert.deepEqual(copy(h.editor.getSnapshot().draft), before);
  }
});

test('generation double-clicks issue one request and block related controls until completion', async testContext => {
  const h = await harness(testContext), gate = deferred(); h.generate = () => gate.promise;
  const pending = h.generator.generate(); assert.equal(h.generator.getSnapshot().status, 'generating');
  assert.equal(await h.generator.generate(), false); assert.equal(h.calls.length, 1);
  assert.equal(h.generator.setRequirements('not allowed'), false); assert.equal(h.generator.setScope([high]), false);
  assert.equal(h.generator.selectGenerator(plugin.modelKey(plain)), false); assert.equal(h.generator.setGeneratorEffort('high'), false);
  assert.equal(h.editor.edit(next => { next.candidates[0].name = 'blocked'; }), false);
  assert.equal(await h.editor.save(), false); await h.editor.reload(); assert.equal(h.loads, 0);
  assert.equal(button(h, 'draftGenerate').props.disabled, true); assert.equal(button(h, 'draftCancel').props.disabled, false);
  gate.resolve(generated()); assert.equal(await pending, true); assert.equal(h.editor.getSnapshot().generatedBusy, false);
});

test('validation double-clicks issue one request and block stale draft/manual callbacks', async testContext => {
  const h = await harness(testContext), gate = deferred(); await h.generator.generate(); h.generator.confirm(true);
  h.validate = request => gate.promise.then(() => request);
  const pending = h.generator.validateAndApply(); assert.equal(await h.generator.validateAndApply(), false);
  assert.equal(h.generator.editCandidate('scope-1', { name: 'race' }), false); assert.equal(h.generator.removeCandidate('scope-2'), false);
  assert.equal(h.generator.setDefault('scope-2'), false); assert.equal(h.generator.confirm(false), false);
  assert.equal(h.editor.edit(next => { next.enabled = false; }), false);
  gate.resolve(); assert.equal(await pending, true); assert.equal(h.calls.filter(row => row.method === 'validate').length, 1); assert.equal(h.mutations.length, 1);
});

test('silent host revision/value/read-only changes during validation fail final snapshot fence', async testContext => {
  for (const patch of [
    h => ({ revision: 8 }),
    h => ({ writable: false }),
    h => ({ value: { ...h.current().value, ui: { ...h.current().value.ui, enabled: false } } })
  ]) {
    const h = await harness(testContext), gate = deferred(); await h.generator.generate(); h.generator.confirm(true);
    h.validate = request => gate.promise.then(() => request); const pending = h.generator.validateAndApply();
    h.change(patch(h), false); gate.resolve(); assert.equal(await pending, false);
    assert.equal(h.mutations.length, 0); assert.equal(h.generator.getSnapshot().status, 'conflict');
  }
});

test('late generation/validation after cancel reset dispose or catalog invalidation is ignored', async testContext => {
  for (const phase of ['generate', 'validate']) for (const action of ['cancel', 'reset', 'dispose', 'catalog']) {
    const h = await harness(testContext), gate = deferred(); let pending;
    if (phase === 'generate') { h.generate = () => gate.promise; pending = h.generator.generate(); }
    else { await h.generator.generate(); h.generator.confirm(true); h.validate = request => gate.promise.then(() => request); pending = h.generator.validateAndApply(); }
    if (action === 'cancel') h.generator.cancel();
    else if (action === 'reset') { h.generator.resetConnection(); h.editor.resetConnection(); h.catalog.resetConnection(); }
    else if (action === 'dispose') h.generator.dispose();
    else h.catalog.invalidate();
    assert.equal(h.calls.at(-1).signal instanceof AbortSignal, true);
    assert.equal(h.calls.at(-1).signal.aborted, true, phase + '/' + action);
    gate.resolve(generated()); assert.equal(await pending, false); assert.equal(h.mutations.length, 0);
    assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.editor.getSnapshot().generatedBusy, false);
  }
});

test('catalog refresh from the submitted settings write preserves the successful application receipt', async testContext => {
  const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true);
  const mutate = h.mutate;
  h.mutate = async row => { const response = await mutate(row); h.catalog.invalidate(); return response; };
  assert.equal(await h.generator.validateAndApply(), true); await flush();
  assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.generator.getSnapshot().status, 'applied');
  assert.equal(h.generator.getSnapshot().error, ''); assert.equal(h.generator.baseline, undefined);
  assert.equal(h.generator.confirm(true), false); assert.equal(await h.generator.validateAndApply(), false);
  await h.catalog.load(); // Delayed settings notifications must not relabel a saved result as stale either.
  assert.equal(h.generator.getSnapshot().status, 'applied'); assert.equal(h.mutations.length, 1);
});

test('catalog changes after write submission preserve unknown and unverified receipt fences', async testContext => {
  for (const outcome of ['unknown', 'unverified']) {
    const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true);
    h.mutate = async () => {
      h.catalog.invalidate();
      if (outcome === 'unknown') throw Error('uncertain generated write');
      return { ok: true }; // A response without the raw mirror is not a verified receipt.
    };
    assert.equal(await h.generator.validateAndApply(), false); await flush();
    assert.equal(h.editor.getSnapshot().receiptUnverified, true); assert.equal(h.editor.getSnapshot().saved, false);
    assert.equal(h.generator.getSnapshot().status, 'error'); assert.equal(h.generator.getSnapshot().applyAttempted, true);
    assert.equal(h.generator.getSnapshot().error, outcome === 'unknown' ? 'uncertain generated write' : t('verifyFailed'));
    assert.equal(h.generator.baseline, undefined); assert.equal(h.generator.confirm(true), false);
    await h.catalog.load(); assert.equal(h.generator.getSnapshot().status, 'error');
    assert.equal(await h.generator.validateAndApply(), false); assert.equal(await h.editor.save(), false);
    await h.flushTimers(); assert.equal(h.mutations.length, 1);
  }
});

test('catalog change before write submission still invalidates validation and prevents persistence', async testContext => {
  const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true); let changed = false;
  const off = h.generator.subscribe(() => {
    if (h.generator.getSnapshot().status === 'applying' && !changed) { changed = true; h.catalog.invalidate(); }
  });
  assert.equal(await h.generator.validateAndApply(), false); off();
  assert.equal(h.mutations.length, 0); assert.equal(h.generator.getSnapshot().status, 'stale');
});

test('unknown generated write stays receipt-fenced with no auto/manual duplicate mutation', async testContext => {
  const h = await harness(testContext); await h.generator.generate(); h.generator.confirm(true);
  h.mutate = async () => { throw Error('transport lost after possible write'); };
  assert.equal(await h.generator.validateAndApply(), false); assert.equal(h.mutations.length, 1);
  assert.equal(h.editor.getSnapshot().receiptUnverified, true); assert.equal(h.editor.getSnapshot().dirty, true);
  assert.equal(await h.generator.validateAndApply(), false); assert.equal(await h.generator.generate(), false);
  assert.equal(await h.editor.save(), false); await h.flushTimers(); assert.equal(h.mutations.length, 1);
  assert.equal(h.generator.getSnapshot().error, t('draftProtected'));
});

test('real RemoteResult transport failures preserve unknown-write fences for manual and generated saves', async testContext => {
  const failures = [
    { ok: false, error: { code: 'gateway/internal', message: 'Request timed out' } },
    { ok: false, error: { code: 'gateway/internal', message: 'settings namespace was disposed after the mutate' } },
    { ok: false, error: { code: 'gateway/cancelled', message: 'request cancelled' } },
    { ok: false, error: { code: 'cancelled', message: 'cancelled' } },
    { ok: false, error: { code: 'future/unknown', message: 'unknown outcome' } },
    { ok: false, error: { message: 'missing error code' } },
    { ok: 'true' },
    undefined
  ];
  for (const mode of ['manual', 'generated']) for (const response of failures) {
    const h = await harness(testContext);
    h.mutate = async () => response;
    if (mode === 'manual') {
      h.editor.edit(next => { next.candidates[0].name = 'Manual unknown outcome'; });
      await h.flushTimers();
    } else {
      await h.generator.generate(); h.generator.confirm(true);
      assert.equal(await h.generator.validateAndApply(), false);
    }
    assert.equal(h.mutations.length, 1); const desired = copy(h.mutations[0].ops[0].value);
    assert.equal(h.editor.getSnapshot().receiptUnverified, true); assert.deepEqual(copy(h.editor.pendingDesired), desired);
    assert.equal(h.editor.getSnapshot().error, response?.error?.message ?? t('writeUncertain'));
    assert.equal(h.editor.edit(next => { next.enabled = false; }), false); assert.equal(await h.editor.save(), false);
    const nodes = flatten(plugin.RouterPage({ editor: h.editor, catalog: h.catalog, generator: h.generator, t, view: 'page' }));
    assert.equal(nodes.some(row => row?.type === 'button' && row.props.children.includes(t('retry'))), false);
    await h.editor.reload(); assert.equal(h.editor.getSnapshot().receiptUnverified, true);
    await h.flushTimers(); assert.equal(h.mutations.length, 1);
    // Explicit reload can acknowledge the original write later, never issuing a new one.
    const document = { ...h.current().user, ui: desired };
    h.change({ revision: 8, value: copy(document), user: copy(document) }); await h.editor.reload();
    assert.equal(h.editor.getSnapshot().receiptUnverified, false); assert.equal(h.editor.getSnapshot().saved, true);
    assert.equal(h.editor.pendingDesired, undefined); assert.equal(h.mutations.length, 1);
  }
});

test('gateway internal after actual commit requires explicit reload without replaying generated write', async testContext => {
  const h = await harness(testContext), mutate = h.mutate;
  await h.generator.generate(); h.generator.confirm(true);
  h.mutate = async row => { await mutate(row); h.catalog.invalidate(); return { ok: false, error: { code: 'gateway/internal', message: 'namespace disposed after mutate' } }; };
  assert.equal(await h.generator.validateAndApply(), false); assert.equal(h.editor.getSnapshot().receiptUnverified, true);
  assert.equal(activeConfig(h.current().value.ui).candidates[0].id, 'pool-low');
  assert.equal(await h.editor.save(), false); assert.equal(await h.generator.validateAndApply(), false);
  await h.editor.reload(); assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.mutations.length, 1);
});

test('only recognized explicit rejection RemoteResult codes release the no-write receipt fence', async testContext => {
  for (const code of ['settings/rejected', 'settings/conflict', 'gateway/bad-request']) {
    const h = await harness(testContext); h.mutate = async () => ({ ok: false, error: { code, message: 'host explicitly refused' } });
    h.editor.edit(next => { next.candidates[0].name = 'Refused edit'; });
    assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().receiptUnverified, false);
    assert.equal(h.editor.pendingDesired, undefined); assert.equal(h.editor.getSnapshot().dirty, true);
    assert.equal(h.editor.getSnapshot().conflicted, code === 'settings/conflict');
    assert.equal(h.editor.getSnapshot().error, 'host explicitly refused');
  }
});

test('applyGenerated enforces its own snapshot fence and cannot merge response settings', async testContext => {
  const h = await harness(testContext), expected = h.editor.captureGenerated();
  h.editor.edit(next => { next.candidates[0].name = 'Change and revert'; });
  h.editor.edit(next => { next.candidates[0].name = 'Existing'; });
  h.editor.dirty = false; // Even byte-identical local values cannot revive an old edit version.
  assert.equal(await h.editor.applyGenerated(generated(), expected), false); assert.equal(h.mutations.length, 0);
  const fresh = h.editor.captureGenerated();
  assert.equal(await h.editor.applyGenerated({ ...generated(), enabled: false, limits: {}, auditFile: 'forged' }, fresh), true);
  assert.equal(h.current().value.ui.enabled, true); assert.equal(h.current().value.ui.limits.maxActivePerModel, 3);
  assert.equal(h.current().value.auditFile, 'D:/audit/keep.jsonl'); assert.equal(h.mutations.length, 1);
});

test('validation compares the current draft fingerprint, not only its confirmation flag', async testContext => {
  const h = await harness(testContext), gate = deferred(); await h.generator.generate(); h.generator.confirm(true);
  h.validate = request => gate.promise.then(() => request);
  const pending = h.generator.validateAndApply();
  h.generator.draft.candidates[0].description = 'Unexpected concurrent mutation';
  gate.resolve(); assert.equal(await pending, false); assert.equal(h.mutations.length, 0);
  assert.equal(h.generator.getSnapshot().status, 'conflict');
});

test('connection reset and disposal fence late generated save acknowledgements', async testContext => {
  for (const action of ['reset', 'dispose']) {
    const h = await harness(testContext), gate = deferred(); await h.generator.generate(); h.generator.confirm(true);
    h.mutate = () => gate.promise;
    const pending = h.generator.validateAndApply();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(h.mutations.length, 1); assert.equal(h.editor.getSnapshot().saving, true);
    assert.equal(h.generator.cancel(), false); // A submitted write cannot be retracted locally.
    if (action === 'reset') { h.generator.resetConnection(); h.editor.resetConnection(); }
    else h.dispose();
    gate.resolve({ ok: true }); assert.equal(await pending, false);
    assert.equal(h.editor.getSnapshot().saved, false); assert.equal(h.loads, 0);
  }
});

test('service errors preserve diagnostics and never retry or switch generators', async testContext => {
  const h = await harness(testContext); h.generate = async () => ({ ok: false, error: { code: 'draft/denied', message: 'exact host diagnostic' } });
  assert.equal(await h.generator.generate(), false); assert.equal(h.generator.getSnapshot().error, 'exact host diagnostic');
  assert.equal(h.generator.getSnapshot().errorCode, 'draft/denied'); assert.deepEqual(copy(h.generator.getSnapshot().input.generator), low);
  await h.flushTimers(); assert.equal(h.calls.length, 1); assert.equal(h.mutations.length, 0);
  h.generate = async () => ({ ok: 'yes', value: generated() }); assert.equal(await h.generator.generate(), false);
  delete h.ctx.remote.delegationRouter; assert.equal(await h.generator.generate(), false); assert.equal(h.calls.length, 2);
});

test('wizard exposes before/draft review fee warning immutable profiles and explicit confirmation in both languages', async testContext => {
  const h = await harness(testContext); await h.generator.generate();
  for (const language of ['en', 'zh']) {
    const translate = key => plugin.dictionaries[language][key] ?? key;
    const nodes = flatten(plugin.DraftWizard({ generator: h.generator, editor: h.editor, catalog: h.catalog, t: translate }));
    for (const key of ['draftPresetIntro','draftCost','draftBefore','draftAfter','draftConfirmPreset','draftApply','draftReady']) assert.ok(nodes.includes(translate(key)), key);
    const review = flatten(nodes.find(row => row?.props?.['data-draft-review']));
    assert.equal(review.some(row => row?.type === 'table'), false);
    const cards = review.filter(row => row?.type === 'article');
    assert.equal(cards.length, 2);
    for (const [index, card] of cards.entries()) {
      const comparison = flatten(card).find(row => row?.props?.style?.gridTemplateColumns?.includes('auto-fit'));
      const fields = flatten(comparison);
      assert.match(comparison.props.style.gridTemplateColumns, /100%/);
      assert.ok(fields.includes(translate('draftBefore'))); assert.ok(fields.includes(translate('draftAfter')));
      assert.ok(flatten(card).includes(index === 0 ? 'p / m / low' : 'p / m / high'));
      assert.equal(fields.filter(row => row?.type === 'textarea' && row.props.maxLength === 1000 && row.props.rows === 4 && row.props.style.resize === 'vertical').length, 1);
      assert.equal(fields.some(row => row?.type === 'select'), false);
    }
    assert.ok(nodes.some(row => row?.type === 'textarea' && row.props.maxLength === 8000));
    const apply = nodes.find(row => row?.type === 'button' && row.props.children.includes(translate('draftApply')));
    assert.equal(apply.props.disabled, true);
    const textInputs = nodes.filter(row => row?.type === 'input' && !['search', 'checkbox'].includes(row.props.type));
    assert.deepEqual(textInputs.map(row => row.props['aria-label']), ['scope-1', 'scope-2'].map(id => translate('draftName') + ' · ' + id));
    assert.ok(review.some(row => row?.type === 'input' && row.props.type === 'checkbox' && row.props['aria-label'] === translate('draftConfirmPreset')));
  }
  assert.equal(button(h, 'draftApply').props.disabled, true); h.generator.confirm(true); assert.equal(button(h, 'draftApply').props.disabled, false);
  const nodes = flatten(plugin.RouterPage(workspaceProps(h)));
  assert.ok(nodes.some(row => row?.props?.['data-autosave']));
  assert.ok(flatten(workspacePanel(nodes, 'pool')).some(row => row?.type === 'button' && row.props.children.includes(t('addPoolCandidate'))));
  assert.deepEqual(Object.keys(plugin.dictionaries.en).sort(), Object.keys(plugin.dictionaries.zh).sort());
});
