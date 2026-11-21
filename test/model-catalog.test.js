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
vm.runInNewContext(source, { AbortController, setTimeout, clearTimeout, window: { __ModuleLoader__: { load: entry => { definition = entry; } }, confirm: () => true } });
const plugin = definition.factory(name => { assert.equal(name, 'react'); return React; });
const { ModelCatalog, RouterEditor, normalizeCatalog, modelKey } = plugin;
const copy = value => JSON.parse(JSON.stringify(value));
const t = key => plugin.dictionaries.en[key] ?? key;
const ok = value => ({ ok: true, value });
const key = (provider, model) => modelKey({ provider, model });
const nativeCatalog = () => ({
  // Actual current SessionController shape, including fields the UI must ignore.
  default: { provider: 'private-default', model: 'not-in-groups', reasoningEffort: 'secret' },
  routableProviders: ['alpha', 'beta'],
  groups: [{ id: 'alpha', name: 'Provider Alpha', models: [
    { id: 'actual-model', name: 'Friendly Model', description: 'Ignore unrelated metadata', badge: 'custom',
      reasoning: { efforts: [{ id: 'brief', name: 'Brief' }, { id: 'thorough', name: 'Thorough', description: 'Not persisted' }], defaultEffort: 'thorough' }, credential: 'never-copy' },
    { id: 'no-default', name: 'No declared default', reasoning: { efforts: [{ id: 'real', name: 'Real effort' }] } },
    { id: 'plain', name: 'No reasoning' }
  ], credential: 'never-copy-provider' }], failures: []
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function harness(initialUi) {
  let configuration = { status: 'ready', writable: true, revision: 9, user: {}, value: { ui: copy(initialUi ?? configured()) } };
  const subscriptions = new Map(), events = new Map(), formListeners = new Set(), effects = [], slots = [], mutations = [], rpcArgs = [];
  let response = async () => ok(nativeCatalog());
  const ctx = {
    remote: {
      session: {
        modelCatalog(...args) { rpcArgs.push(args); return response(); },
        selectModel() { assert.fail('Catalog picker must never change the parent model'); }
      },
      $on(event, fn) { assert.equal(subscriptions.has(event), false); subscriptions.set(event, fn); return () => subscriptions.delete(event); },
      settings: { async mutate(namespace, ops, revision) {
        mutations.push({ namespace, ops: copy(ops), revision });
        configuration = { ...configuration, revision: revision + 1, user: { ui: copy(ops[0].value) }, value: { ui: copy(ops[0].value) } };
        for (const fn of formListeners) fn(); return { ok: true };
      } }
    },
    configForms: {
      get: id => { assert.equal(id, 'delegation-router'); return { getSnapshot: () => configuration, subscribe: fn => { formListeners.add(fn); return () => formListeners.delete(fn); } }; },
      describe: () => ({ async load() {} })
    },
    on(event, fn) { events.set(event, fn); return () => events.delete(event); },
    locale: { bind: () => t, register: () => () => {} },
    effect(fn) { const off = fn(); effects.push(off); return off; },
    slots: { inject: (_name, fn) => fn(), register: (options, component) => { slots.push({ options, component }); return () => slots.pop(); } }
  };
  return { ctx, subscriptions, events, slots, mutations, rpcArgs, formListeners,
    setResponse(fn) { response = fn; }, config: () => configuration,
    dispose() { for (const fn of effects.reverse()) fn(); events.clear(); }
  };
}
function flatten(node) {
  if (node === null || node === undefined || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}
const page = (editor, catalog) => flatten(plugin.RouterPage({ editor, catalog, t, view: 'page' }));
const field = (nodes, type, label) => nodes.find(node => node?.type === type && node.props['aria-label'] === t(label));
function configured() { return { ...copy(plugin.emptyDraft()), candidates: [{ id: 'keep-alias', name: 'Keep name', provider: 'alpha', model: 'actual-model', effort: 'thorough', description: 'Keep description' }], defaultCandidateId: 'keep-alias' }; }

test('normalizer uses current native efforts/id/name and whitelists display fields only', () => {
  const response = nativeCatalog(), before = copy(response), normalized = copy(normalizeCatalog(response));
  assert.deepEqual(response, before);
  assert.deepEqual(normalized, { groups: [{ id: 'alpha', name: 'Provider Alpha', models: [
    { id: 'actual-model', name: 'Friendly Model', reasoning: { efforts: [{ id: 'brief', name: 'Brief' }, { id: 'thorough', name: 'Thorough' }], defaultEffort: 'thorough' } },
    { id: 'no-default', name: 'No declared default', reasoning: { efforts: [{ id: 'real', name: 'Real effort' }] } },
    { id: 'plain', name: 'No reasoning' }
  ] }], failures: [] });
  assert.doesNotMatch(JSON.stringify(normalized), /credential|never-copy|description|private-default|routableProviders|badge/);
});

test('malformed and incomplete reasoning responses fail closed, not as a fresh empty catalog', async () => {
  for (const value of [null, { groups: [] }, { groups: [{ id: 'p', models: [{ id: 'm', reasoning: { levels: [{ effort: 'low', label: 'Low' }] } }] }], failures: [] },
    { groups: [{ id: 'p', models: [{ id: 'm' }, { id: 'm' }] }], failures: [] },
    { groups: [], failures: [{ provider: 'old-shape', error: 'not-current-contract' }] }]) {
    assert.throws(() => normalizeCatalog(value), /Invalid native model catalog/);
    const h = harness(); h.setResponse(async () => ok(value)); const catalog = new ModelCatalog(h.ctx);
    assert.equal(await catalog.load(), false); assert.equal(catalog.getSnapshot().status, 'error'); assert.equal(catalog.select({ edit() { assert.fail(); } }, 0, key('p', 'm')), false); catalog.dispose();
  }
});

test('installed isolated catalog RPC is preferred and cancelled on connection reset', async () => {
  const h = harness(), stale = deferred(); let calls = 0, oldSignal;
  h.ctx.remote.delegationRouter = { modelCatalog(signal) { calls++; if (calls === 1) { oldSignal = signal; return stale.promise; } return Promise.resolve(ok(nativeCatalog())); } };
  const catalog = new ModelCatalog(h.ctx), pending = catalog.load(); await Promise.resolve();
  catalog.resetConnection(); const fresh = catalog.inFlight.promise; assert.equal(await fresh, true);
  assert.equal(oldSignal.aborted, true); assert.equal(h.rpcArgs.length, 0);
  stale.resolve(ok({groups:[],failures:[]})); await pending;
  assert.equal(catalog.getSnapshot().groups.length, 1); catalog.dispose();
});

test('catalog timeout releases refresh and ignores a late response from the stalled request', async () => {
  const h = harness(), stalled = deferred(), callbacks = new Map(); let id = 0;
  const timers = { setTimeout(fn) { const next = ++id; callbacks.set(next, fn); return next; }, clearTimeout(key) { callbacks.delete(key); } };
  h.setResponse(() => stalled.promise);
  const catalog = new ModelCatalog(h.ctx, timers, 20), pending = catalog.load();
  await Promise.resolve(); assert.equal(catalog.getSnapshot().status, 'loading');
  [...callbacks.values()][0](); assert.equal(await pending, false);
  assert.equal(catalog.getSnapshot().status, 'error'); assert.equal(catalog.getSnapshot().errorCode, 'catalog/timeout');
  assert.equal(catalog.inFlight, undefined); assert.equal(callbacks.size, 0);
  h.setResponse(async () => ok(nativeCatalog())); assert.equal(await catalog.load(), true);
  const fresh = copy(catalog.getSnapshot()); stalled.resolve(ok({groups:[],failures:[]}));
  await Promise.resolve(); await Promise.resolve(); assert.deepEqual(copy(catalog.getSnapshot()), fresh);
  assert.equal(h.rpcArgs.length, 2); catalog.dispose();
});

test('catalog refresh control shows loading, successful counts and adjacent failure feedback', async () => {
  const h = harness(), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t);
  const button = () => page(editor, catalog).find(node => node?.type === 'button' && node.props.children.includes(t('catalogRefresh')));
  assert.equal(button().props.disabled, false);
  const pending = button().props.onClick();
  assert.ok(page(editor, catalog).includes(t('catalogLoading'))); await pending;
  assert.ok(page(editor, catalog).some(node => typeof node === 'string' && node.startsWith(t('catalogReady')) && node.includes('3')));
  const root = plugin.RouterPage({editor,catalog,t,view:'page'});
  assert.ok(flatten(root).find(node => node?.props?.['data-model-catalog']));
  const manual = flatten(root).find(node => node?.props?.['data-manual-editor']);
  assert.equal(manual.type, 'div');
  assert.ok(flatten(manual).some(node => node?.type === 'details' && node.props['data-candidate'] && !node.props.open));
  assert.equal(h.mutations.length, 0); editor.dispose(); catalog.dispose();
});

test('one zero-argument native RPC serves same-generation concurrent loads', async () => {
  const h = harness(), flight = deferred(); h.setResponse(() => flight.promise); const catalog = new ModelCatalog(h.ctx);
  const first = catalog.load(), second = catalog.load(); assert.equal(first, second);
  await Promise.resolve(); assert.deepEqual(h.rpcArgs, [[]]); assert.equal(catalog.getSnapshot().status, 'loading');
  flight.resolve(ok(nativeCatalog())); assert.equal(await first, true); assert.equal(catalog.getSnapshot().status, 'ready');
  catalog.dispose();
});

test('all five native remote events independently reload the catalog and dispose removes their handlers', async () => {
  const h = harness(), catalog = new ModelCatalog(h.ctx);
  assert.deepEqual([...h.subscriptions.keys()], ['llm/adapters-updated', 'llm/models-updated', 'settings/document-updated', 'credentials/record-updated', 'credentials/reference-updated']);
  await catalog.load(); let notifications = 0; const off = catalog.subscribe(() => notifications++);
  for (const event of [...h.subscriptions.keys()]) { const count = h.rpcArgs.length; h.subscriptions.get(event)({ ignored: true }); await catalog.inFlight.promise; assert.equal(h.rpcArgs.length, count + 1); }
  assert.ok(notifications >= 10); off(); catalog.dispose(); assert.equal(h.subscriptions.size, 0); assert.equal(catalog.listeners.size, 0);
});

test('events arriving during a request coalesce into one fresh follow-up instead of publishing a stale reply', async () => {
  const h = harness(), first = deferred(), second = deferred(), started = deferred();
  h.setResponse(() => { if (h.rpcArgs.length === 1) return first.promise; started.resolve(); return second.promise; });
  const catalog = new ModelCatalog(h.ctx), original = catalog.load(); await Promise.resolve();
  h.subscriptions.get('llm/models-updated')(); h.subscriptions.get('credentials/record-updated')();
  first.resolve(ok(nativeCatalog())); await original; await started.promise;
  assert.equal(h.rpcArgs.length, 2); assert.equal(catalog.getSnapshot().status, 'loading'); assert.equal(catalog.getSnapshot().groups.length, 0);
  second.resolve(ok({ groups: [{ id: 'new', name: 'New', models: [{ id: 'new-model', name: 'New Model' }] }], failures: [] })); await catalog.inFlight.promise;
  assert.equal(catalog.getSnapshot().groups[0].id, 'new'); catalog.dispose();
});

test('reset clears old options and fences late acknowledgments from a prior connection generation', async () => {
  const h = harness(), old = deferred(), fresh = deferred(), freshStarted = deferred();
  const catalog = new ModelCatalog(h.ctx); await catalog.load();
  h.setResponse(() => { if (h.rpcArgs.length === 2) return old.promise; freshStarted.resolve(); return fresh.promise; });
  const pendingOld = catalog.load(); await Promise.resolve(); catalog.resetConnection(); await freshStarted.promise;
  assert.equal(catalog.getSnapshot().groups.length, 0); assert.equal(catalog.find('alpha', 'actual-model'), undefined);
  const pendingFresh = catalog.inFlight.promise;
  old.resolve(ok(nativeCatalog())); await pendingOld; assert.equal(catalog.getSnapshot().status, 'loading');
  fresh.resolve(ok({ groups: [], failures: [] })); await pendingFresh; assert.equal(catalog.getSnapshot().groups.length, 0); catalog.dispose();
});

test('reset fences a prior-generation transport failure after a fresh catalog has succeeded', async () => {
  const h = harness(), old = deferred(), fresh = deferred(), started = deferred();
  h.setResponse(() => h.rpcArgs.length === 1 ? old.promise : (started.resolve(), fresh.promise));
  const catalog = new ModelCatalog(h.ctx), stale = catalog.load(); await Promise.resolve(); catalog.resetConnection(); await started.promise;
  const pendingFresh = catalog.inFlight.promise; fresh.resolve(ok(nativeCatalog())); assert.equal(await pendingFresh, true);
  const before = copy(catalog.getSnapshot()); old.reject(Error('disconnected old profile')); assert.equal(await stale, false);
  assert.deepEqual(copy(catalog.getSnapshot()), before); assert.equal(catalog.inFlight, undefined); catalog.dispose();
});

test('dispose fences late RPC success and late transport error without notifying listeners', async () => {
  for (const fail of [false, true]) {
    const h = harness(), rpc = deferred(); h.setResponse(() => rpc.promise); const catalog = new ModelCatalog(h.ctx);
    const pending = catalog.load(); await Promise.resolve(); let calls = 0; catalog.subscribe(() => calls++); catalog.dispose();
    if (fail) rpc.reject(Error('late network failure')); else rpc.resolve(ok(nativeCatalog()));
    assert.equal(await pending, false); assert.equal(calls, 0); assert.equal(catalog.getSnapshot().status, 'idle'); assert.equal(h.subscriptions.size, 0);
  }
});

test('native refusal and transport messages stay readable while old options become unselectable', async () => {
  for (const fail of [async () => ({ ok: false, error: { code: 'native/catalog-unavailable', message: 'original provider detail' } }), async () => { throw Error('original transport detail'); }]) {
    const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
    const before = copy(editor.getSnapshot()); h.setResponse(fail); assert.equal(await catalog.load(), false);
    assert.match(catalog.getSnapshot().error, /original (provider|transport) detail/); assert.equal(catalog.getSnapshot().groups.length, 0);
    assert.equal(catalog.select(editor, 0, key('alpha', 'actual-model')), false); assert.deepEqual(copy(editor.getSnapshot()), before);
    assert.ok(page(editor, catalog).some(node => typeof node === 'string' && /original (provider|transport) detail/.test(node)));
    editor.dispose(); catalog.dispose();
  }
});

test('partial failures preserve exact id/name/message and successful groups remain selectable', async () => {
  const h = harness(configured()), value = nativeCatalog(); value.failures = [{ id: 'failed', name: 'Failed Provider', message: 'original partial diagnostic', extra: 'discard' }];
  h.setResponse(async () => ok(value)); const catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  assert.deepEqual(copy(catalog.getSnapshot().failures), [{ id: 'failed', name: 'Failed Provider', message: 'original partial diagnostic' }]);
  assert.equal(catalog.select(editor, 0, key('alpha', 'actual-model')), true);
  editor.edit(next => Object.assign(next.candidates[0], { provider: 'failed', model: 'retained-model', effort: 'old' }));
  const before = copy(editor.getSnapshot().draft); const nodes = page(editor, catalog);
  assert.ok(nodes.includes(t('catalogUnverified'))); assert.equal(nodes.includes(t('catalogMissing')), false);
  assert.ok(nodes.includes('Failed Provider (failed): original partial diagnostic')); assert.deepEqual(copy(editor.getSnapshot().draft), before);
  editor.dispose(); catalog.dispose();
});

test('catalog load, refresh, missing model and effort changes never rewrite saved candidates or revisions', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t), before = copy(editor.getSnapshot());
  await catalog.load(); assert.deepEqual(copy(editor.getSnapshot()), before);
  const value = nativeCatalog(); value.groups[0].models[0].reasoning = { efforts: [{ id: 'new-effort', name: 'New effort' }], defaultEffort: 'new-effort' };
  h.setResponse(async () => ok(value)); await catalog.load(); assert.deepEqual(copy(editor.getSnapshot()), before);
  h.setResponse(async () => ok({ groups: [], failures: [] })); await catalog.load(); assert.ok(page(editor, catalog).includes(t('catalogMissing')));
  assert.deepEqual(copy(editor.getSnapshot()), before); assert.equal(h.config().revision, 9); assert.equal(h.mutations.length, 0);
  editor.dispose(); catalog.dispose();
});

test('unknown persistent candidate fields stay read-only: original viewable, no selection or save overwrite', async () => {
  const ui = configured(); ui.candidates[0].unknownField = 'preserve';
  const h = harness(ui), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  const state = editor.getSnapshot();
  assert.equal(state.invalidSource, true);
  assert.deepEqual(copy(state.invalidOriginal), ui);
  const nodes = page(editor, catalog);
  assert.ok(nodes.includes(t('invalidSource')));
  assert.ok(nodes.includes(JSON.stringify(ui, null, 2)));
  assert.equal(catalog.select(editor, 0, key('alpha', 'actual-model')), false);
  assert.equal(catalog.setEffort(editor, 0, JSON.stringify('brief')), false);
  assert.equal(editor.edit(next => { next.enabled = true; }), false);
  assert.equal(await editor.save(), false); assert.equal(h.mutations.length, 0);
  assert.deepEqual(copy(h.config().value.ui), ui);
  editor.dispose(); catalog.dispose();
});

test('only explicit model selection updates pair and exact effort, preserving candidate metadata', async () => {
  const ui = configured(), h = harness(ui), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  assert.equal(catalog.select(editor, 0, key('alpha', 'actual-model')), true);
  const draft = copy(editor.getSnapshot().draft); assert.deepEqual(draft, ui);
  assert.equal(editor.getSnapshot().dirty, true); assert.equal(editor.baseRevision, 9); assert.equal(h.mutations.length, 0);
  assert.doesNotMatch(JSON.stringify(draft), /Friendly Model|credential|routableProviders/); editor.dispose(); catalog.dispose();
});

test('undeclared native default needs one real effort, with no synthetic default option', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  assert.equal(catalog.select(editor, 0, key('alpha', 'no-default')), true);
  assert.equal(editor.getSnapshot().draft.candidates[0].effort, '');
  const nodes = page(editor, catalog), picker = field(nodes, 'select', 'effort'); assert.ok(nodes.includes(t('effortRequired')));
  assert.deepEqual(flatten(picker).filter(node => node?.type === 'option').map(node => node.props.value), ['', JSON.stringify('real')]);
  const before = copy(editor.getSnapshot()); picker.props.onChange({ target: { value: JSON.stringify('default') } }); assert.deepEqual(copy(editor.getSnapshot()), before);
  picker.props.onChange({ target: { value: JSON.stringify('real') } }); assert.equal(editor.getSnapshot().draft.candidates[0].effort, 'real');
  assert.equal(await editor.save(), true); editor.dispose(); catalog.dispose();
});

test('verified absent or empty reasoning supports null and never changes an existing draft on load', async () => {
  for (const reasoning of [undefined, { efforts: [] }]) {
    const ui = configured(), h = harness(ui), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t);
    const value = nativeCatalog(); value.groups[0].models.find(model => model.id === 'plain').reasoning = reasoning;
    h.setResponse(async () => ok(value)); const before = copy(editor.getSnapshot()); await catalog.load();
    assert.deepEqual(copy(editor.getSnapshot()), before);
    assert.equal(catalog.select(editor, 0, key('alpha', 'plain')), true);
    assert.equal(editor.getSnapshot().draft.candidates[0].effort, null);
    const nodes = page(editor, catalog), picker = field(nodes, 'select', 'effort');
    assert.ok(nodes.includes(t('noReasoning')));
    assert.deepEqual(flatten(picker).filter(node => node?.type === 'option').map(node => node.props.value), ['', 'null']);
    assert.equal(await editor.save(), true); assert.equal(h.mutations[0].ops[0].value.configs[0].candidates[0].effort, null);
    editor.dispose(); catalog.dispose();
  }
});

test('failed malformed and unknown catalog records cannot manufacture null or discard drafts', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t);
  editor.edit(next => { next.candidates[0].description = 'Retain dirty draft'; }); const before = copy(editor.getSnapshot());
  for (const response of [
    { ok: false, error: { message: 'offline' } }, ok({ ...nativeCatalog(), failures: [{ id: 'alpha', message: 'partial' }] }),
    ok({ groups: [{ id: 'alpha', models: [{}] }], failures: [] }),
    ok({ groups: [{ id: 'alpha', models: [{ id: 'actual-model', reasoning: null }] }], failures: [] }),
    ok({ groups: [{ id: 'alpha', models: [{ id: 'actual-model', reasoning: { efforts: [{ id: '   ' }] } }] }], failures: [] }),
    ok({ groups: [], failures: [] })
  ]) {
    h.setResponse(async () => response); await catalog.load();
    assert.equal(catalog.select(editor, 0, key('alpha', 'actual-model')), false);
    assert.equal(catalog.setEffort(editor, 0, 'null'), false);
    assert.deepEqual(copy(editor.getSnapshot()), before); assert.equal(h.mutations.length, 0);
    assert.equal(page(editor, catalog).includes(t('noReasoning')), false);
  }
  editor.dispose(); catalog.dispose();
});

test('saved stale effort remains visible and cannot be newly selected', async () => {
  const ui = configured(); ui.candidates[0].effort = 'old-effort';
  const h = harness(ui), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  const nodes = page(editor, catalog), picker = field(nodes, 'select', 'effort');
  assert.ok(nodes.includes('Friendly Model — actual-model'));
  assert.ok(nodes.some(node => node?.type === 'optgroup' && node.props.label === 'Provider Alpha (alpha)'));
  const unknown = flatten(picker).find(node => node?.type === 'option' && node.props.value === JSON.stringify('old-effort'));
  assert.equal(unknown.props.disabled, true); const before = copy(editor.getSnapshot());
  picker.props.onChange({ target: { value: JSON.stringify('old-effort') } }); assert.deepEqual(copy(editor.getSnapshot()), before);
  picker.props.onChange({ target: { value: JSON.stringify('brief') } }); assert.equal(editor.getSnapshot().draft.candidates[0].effort, 'brief');
  assert.equal(editor.getSnapshot().draft.candidates[0].id, 'keep-alias'); assert.equal(editor.getSnapshot().draft.candidates[0].name, 'Keep name'); editor.dispose(); catalog.dispose();
});

test('stale callbacks revalidate current catalog, effort and candidate identity', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  const nodes = page(editor, catalog), picker = field(nodes, 'select', 'chooseModel'), effort = field(nodes, 'select', 'effort');
  const updated = nativeCatalog(); updated.groups[0].models = [{ id: 'actual-model', reasoning: { efforts: [{ id: 'fresh', name: 'Fresh' }], defaultEffort: 'fresh' } }];
  h.setResponse(async () => ok(updated)); await catalog.load(); let before = copy(editor.getSnapshot());
  picker.props.onChange({ target: { value: key('alpha', 'no-default') } }); effort.props.onChange({ target: { value: JSON.stringify('brief') } });
  assert.deepEqual(copy(editor.getSnapshot()), before);
  editor.edit(next => { next.candidates[0].id = 'replacement'; }); before = copy(editor.getSnapshot());
  picker.props.onChange({ target: { value: key('alpha', 'actual-model') } }); effort.props.onChange({ target: { value: JSON.stringify('fresh') } });
  assert.deepEqual(copy(editor.getSnapshot()), before); editor.dispose(); catalog.dispose();
});

test('losing reasoning never silently replaces a saved effort with null; explicit null choice is required', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  const value = nativeCatalog(); delete value.groups[0].models[0].reasoning; h.setResponse(async () => ok(value));
  const before = copy(editor.getSnapshot()); await catalog.load(); assert.deepEqual(copy(editor.getSnapshot()), before);
  const picker = field(page(editor, catalog), 'select', 'effort');
  picker.props.onChange({ target: { value: JSON.stringify('brief') } }); assert.deepEqual(copy(editor.getSnapshot()), before);
  picker.props.onChange({ target: { value: 'null' } }); assert.equal(editor.getSnapshot().draft.candidates[0].effort, null);
  editor.dispose(); catalog.dispose();
});

test('catalog failure does not block candidate management, saving or raw CAS', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t);
  h.setResponse(async () => { throw Error('catalog offline'); }); await catalog.load();
  editor.edit(next => { next.candidates[0].description = 'Edit despite offline catalog'; });
  assert.equal(await editor.save(), true); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 9);
  assert.deepEqual(h.mutations[0].ops.map(op => [op.op, op.path]), [['set', ['ui']]]);
  assert.equal(h.mutations[0].ops[0].value.configs[0].candidates[0].description, 'Edit despite offline catalog'); assert.equal(h.mutations[0].ops[0].value.configs[0].candidates[0].effort, 'thorough');
  assert.equal(editor.getSnapshot().saved, true); assert.equal(editor.getSnapshot().conflicted, false); editor.dispose(); catalog.dispose();
});

test('successful saves remain saved and nonconflicted across independent catalog refreshes', async () => {
  const h = harness(configured()), catalog = new ModelCatalog(h.ctx), editor = new RouterEditor(h.ctx, t); await catalog.load();
  editor.edit(next => { next.candidates[0].description = 'Saved configuration'; }); assert.equal(await editor.save(), true);
  const before = copy(editor.getSnapshot()); h.subscriptions.get('settings/document-updated')(); await catalog.inFlight.promise;
  assert.deepEqual(copy(editor.getSnapshot()), before); assert.equal(editor.getSnapshot().saved, true); assert.equal(editor.getSnapshot().dirty, false);
  assert.equal(editor.getSnapshot().conflicted, false); assert.equal(h.mutations.length, 1); editor.dispose(); catalog.dispose();
});

test('actual plugin lifecycle wires initial load, connection reset, new model events and scope cleanup', async () => {
  const h = harness(configured()); plugin.apply(h.ctx);
  const component = h.slots[0].component({ view: 'page' }); const { catalog, editor } = component.props;
  await catalog.inFlight.promise; assert.deepEqual(h.rpcArgs, [[]]); assert.equal(h.subscriptions.size, 5);
  editor.edit(next => { next.candidates[0].description = 'Detached draft'; }); const draft = copy(editor.getSnapshot().draft);
  const value = nativeCatalog(); value.groups[0].models.push({ id: 'added-after-settings', name: 'Newly added' });
  h.setResponse(async () => ok(value)); h.subscriptions.get('llm/models-updated')(); await catalog.inFlight.promise;
  assert.ok(page(editor, catalog).includes('Newly added — added-after-settings')); assert.deepEqual(copy(editor.getSnapshot().draft), draft); assert.equal(editor.getSnapshot().conflicted, false);
  const resetReply = deferred(); h.setResponse(() => resetReply.promise); h.events.get('connection/reset')();
  assert.equal(catalog.getSnapshot().groups.length, 0); assert.equal(editor.getSnapshot().connectionReset, true); assert.deepEqual(copy(editor.getSnapshot().draft), draft);
  const resetPending = catalog.inFlight.promise; await Promise.resolve(); h.dispose(); resetReply.resolve(ok(nativeCatalog())); await resetPending;
  assert.equal(h.subscriptions.size, 0); assert.equal(h.slots.length, 0); assert.equal(h.formListeners.size, 0); assert.equal(h.events.size, 0);
});
