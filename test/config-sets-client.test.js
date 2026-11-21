import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { normalizeConfigSets, compileStoredConfig } from '../src/config-sets.js';

let definition;
const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useRef: value => ({ current: value }), useEffect() {} };
vm.runInNewContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), { AbortController, window: { __ModuleLoader__: { load: value => { definition = value; } } } });
const plugin = definition.factory(() => React);
const copy = value => JSON.parse(JSON.stringify(value));
const t = key => plugin.dictionaries.en[key] ?? key;
const policy = (model = 'one') => ({ ...copy(plugin.emptyDraft()), enabled: true, candidates: [{ id: 'same-id', name: model, provider: 'p', model, effort: null }], defaultCandidateId: 'same-id' });
const collection = () => ({ schemaVersion: 4, enabled: true, candidates: policy().candidates, limits: copy(plugin.emptyDraft().limits), activeConfigId: 'a', configs: [{ id: 'a', name: 'My own name', defaultCandidateId: 'same-id', overrides: [] }, { id: 'b', name: '另一套任意名称', defaultCandidateId: 'same-id', overrides: [{ id: 'same-id', name: 'two', description: 'B role' }] }] });
function harness(context, ui = collection()) {
  let snapshot = { status: 'ready', writable: true, revision: 1, user: { ui: copy(ui), auditFile: 'D:/keep.jsonl' }, value: { ui: copy(ui), auditFile: 'D:/keep.jsonl' } };
  const listeners = new Set(), timers = new Map(); let tick = 0;
  const h = { mutations: [], timers, snapshot: () => snapshot, change: (patch, notify = true) => { snapshot = { ...snapshot, ...patch }; if (notify) for (const fn of listeners) fn(); } };
  h.mutate = async (_ns, ops, revision) => { const user = { ...snapshot.user, ui: copy(ops[0].value) }; h.change({ revision: revision + 1, value: copy(user), user }); return { ok: true }; };
  const form = { getSnapshot: () => snapshot, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  h.ctx = { configForms: { get: () => form, describe: () => ({ async load() {} }) }, remote: { settings: { async mutate(ns, ops, revision) { h.mutations.push(copy({ ns, ops, revision })); return h.mutate(ns, ops, revision); } }, delegationRouter: { async generateDraft() { return { candidates: [{ id: 'scope-1', name: 'Generated', provider: 'p', model: 'one', effort: null, description: '' }], defaultCandidateId: 'scope-1', warnings: [] }; }, async validateDraft(request) { return { candidates: request.candidates, defaultCandidateId: request.defaultCandidateId }; } } } };
  h.editor = new plugin.RouterEditor(h.ctx, t, { setTimeout(fn) { timers.set(++tick, fn); return tick; }, clearTimeout(id) { timers.delete(id); } });
  context.after(() => h.editor.dispose());
  return h;
}
function flatten(node) {
  if (node == null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}

test('v4 reads the active policy without writes; v3 stays unchanged until an explicit collection action', async context => {
  const h = harness(context);
  assert.equal(h.editor.getSnapshot().draft.candidates[0].model, 'one');
  assert.equal(h.editor.getSnapshot().configSet.configs.length, 2);
  assert.equal(h.mutations.length, 0); assert.equal(h.timers.size, 0);
  const old = harness(context, policy());
  old.editor.edit(next => { next.limits.maxActivePerModel = 2; });
  assert.equal(await old.editor.save(), true);
  assert.equal(old.mutations[0].ops[0].value.schemaVersion, 3);
  assert.equal(await old.editor.renameConfig('用户自行命名'), true);
  const saved = old.mutations[1].ops[0].value;
  assert.equal(saved.schemaVersion, 4); assert.equal(saved.configs[0].name, '用户自行命名');
  assert.equal(saved.limits.maxActivePerModel, 2);
  assert.equal(old.snapshot().value.auditFile, 'D:/keep.jsonl');
});

test('new/copy presets preserve one global pool, enabled state and limits; roles remain independent', async context => {
  const h = harness(context, policy());
  assert.equal(await h.editor.createConfig('  Anything 用户定义  ', true), true);
  let saved = h.snapshot().user.ui;
  assert.equal(saved.configs[1].name, 'Anything 用户定义');
  assert.equal(saved.candidates.length, 1); assert.equal(saved.enabled, true);
  assert.equal(saved.configs[1].defaultCandidateId, 'same-id');
  h.editor.edit(next => { next.candidates[0].description = 'Only copied preset'; next.candidates[0].model = 'changed'; next.limits.maxActivePerModel = 4; });
  assert.equal(await h.editor.save(), true);
  assert.equal(h.snapshot().user.ui.candidates[0].model, 'changed');
  assert.equal(h.snapshot().user.ui.limits.maxActivePerModel, 4);
  assert.equal(await h.editor.switchConfig('config-1'), true);
  assert.equal(h.editor.getSnapshot().draft.candidates[0].model, 'changed');
  assert.equal(h.editor.getSnapshot().draft.candidates[0].description ?? '', '');
  assert.equal(await h.editor.createConfig('Empty roles'), true);
  saved = h.snapshot().user.ui;
  assert.equal(saved.configs.length, 3);
  assert.equal(saved.enabled, true); assert.equal(saved.candidates[0].model, 'changed');
  assert.equal(h.editor.getSnapshot().draft.candidates[0].description ?? '', '');
  assert.equal(saved.configs[2].defaultCandidateId, 'same-id');
  assert.equal(saved.limits.maxActivePerModel, 4);
  assert.equal(h.timers.size, 0); normalizeConfigSets(saved);
});

test('switch persists one CAS transaction and edits affect only the selected configuration', async context => {
  const h = harness(context);
  assert.equal(await h.editor.switchConfig('b'), true);
  assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 1);
  assert.equal(h.mutations[0].ops.length, 1); assert.deepEqual(h.mutations[0].ops[0].path, ['ui']);
  assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'two');
  h.editor.edit(next => { next.candidates[0].name = 'Changed name'; });
  await h.editor.save();
  assert.equal(h.snapshot().user.ui.candidates[0].name, 'one');
  assert.equal(h.snapshot().user.ui.configs[1].overrides[0].name, 'Changed name');
  assert.equal(await h.editor.switchConfig('a'), true);
  assert.equal(compileStoredConfig(h.snapshot().user.ui).candidates[0].model, 'one');
  assert.equal(h.snapshot().value.auditFile, 'D:/keep.jsonl');
});

test('rename preserves id and all policies; delete requires confirmation, never deletes active or last', async context => {
  const h = harness(context); const before = copy(h.snapshot().user.ui.candidates);
  assert.equal(await h.editor.renameConfig('Free-form 设计 & work'), true);
  assert.equal(h.snapshot().user.ui.activeConfigId, 'a');
  assert.deepEqual(h.snapshot().user.ui.candidates, before);
  assert.equal(await h.editor.deleteConfig('b'), false);
  assert.equal(await h.editor.deleteConfig('a', true), false);
  assert.equal(await h.editor.deleteConfig('missing', true), false);
  assert.equal(await h.editor.deleteConfig('b', true), true);
  assert.equal(h.snapshot().user.ui.configs.length, 1);
  assert.equal(await h.editor.deleteConfig('a', true), false);
  assert.equal(h.mutations.length, 2);
});

test('name validation, case-insensitive duplicates and 32 configuration cap match backend', async context => {
  const h = harness(context);
  for (const name of ['', '   ', 'x'.repeat(121), 'bad\nname', ' MY OWN NAME ']) {
    assert.equal(await h.editor.createConfig(name), false);
  }
  assert.equal(await h.editor.renameConfig('另一套任意名称'), false);
  assert.equal(h.mutations.length, 0);
  const ui = collection(); ui.configs = Array.from({ length: 32 }, (_, index) => ({ id: 'c' + index, name: 'Name ' + index, defaultCandidateId: 'same-id', overrides: [] })); ui.activeConfigId = 'c0';
  const full = harness(context, ui);
  assert.equal(await full.editor.createConfig('33rd'), false);
  assert.equal(full.mutations.length, 0);
  assert.equal(await full.editor.renameConfig('Rename at cap'), true);
});

test('dirty, composing, readonly, generation lock and reset fence every management action', async context => {
  for (const block of [h => h.editor.edit(next => { next.candidates[0].name = ''; }), h => h.editor.setComposing(true), h => h.change({ writable: false }), h => { const baseline = h.editor.captureGenerated(); h.editor.lockGenerated({}, baseline); }, h => h.editor.resetConnection()]) {
    const h = harness(context); block(h); const before = copy(h.editor.getSnapshot().draft);
    assert.equal(await h.editor.switchConfig('b'), false);
    assert.equal(await h.editor.createConfig('New'), false);
    assert.equal(await h.editor.renameConfig('Rename'), false);
    assert.equal(await h.editor.deleteConfig('b', true), false);
    assert.deepEqual(copy(h.editor.getSnapshot().draft), before);
    assert.equal(h.mutations.length, 0);
  }
});

test('switch refusal preserves desired selection without retries; reload restores effective selection', async context => {
  const h = harness(context);
  h.mutate = async () => ({ ok: false, error: { code: 'settings/rejected', message: 'CONFIG_BUSY' } });
  assert.equal(await h.editor.switchConfig('b'), false);
  assert.equal(h.editor.getSnapshot().dirty, true); assert.equal(h.editor.getSnapshot().error, 'CONFIG_BUSY');
  assert.equal(h.editor.getSnapshot().configSet.activeConfigId, 'b');
  assert.equal(h.snapshot().value.ui.activeConfigId, 'a');
  assert.equal(await h.editor.switchConfig('a'), false); assert.equal(h.mutations.length, 1); assert.equal(h.timers.size, 0);
  await h.editor.reload(); assert.equal(h.editor.getSnapshot().configSet.activeConfigId, 'a');
});

test('unknown write and effective override retain full-collection acknowledgement fences', async context => {
  const h = harness(context);
  h.mutate = async () => { throw Error('transport reset'); };
  assert.equal(await h.editor.switchConfig('b'), false);
  assert.equal(h.editor.getSnapshot().receiptUnverified, true);
  assert.equal(await h.editor.createConfig('No retry'), false); assert.equal(h.mutations.length, 1);
  const overridden = harness(context);
  overridden.mutate = async (_ns, ops, revision) => { overridden.change({ revision: revision + 1, user: { ui: copy(ops[0].value) } }); return { ok: true }; };
  assert.equal(await overridden.editor.switchConfig('b'), false);
  assert.equal(overridden.editor.getSnapshot().savedButNotLive, true);
  assert.equal(overridden.editor.getSnapshot().canManageConfigs, false);
});

test('malformed inactive policy or collection stays readonly and cannot overwrite source', async context => {
  for (const change of [ui => { ui.activeConfigId = 'missing'; }, ui => { ui.configs[1].overrides[0].model = 'forbidden'; }, ui => { ui.configs[1].name = 'MY OWN NAME'; }, ui => { ui.configs[0].extra = true; }, ui => { ui.configs = []; }, ui => { ui.configs[1].policy = { schemaVersion: 4 }; }]) {
    const ui = collection(); change(ui); const h = harness(context, ui);
    assert.equal(h.editor.getSnapshot().invalidSource, true);
    assert.equal(await h.editor.renameConfig('Must not overwrite'), false);
    assert.equal(h.mutations.length, 0);
  }
});

test('generated draft changes only current policy and becomes stale after switching sets', async context => {
  const h = harness(context);
  const catalogState = { status: 'ready', groups: [{ id: 'p', models: [{ id: 'one' }] }], failures: [] };
  const catalog = { getSnapshot: () => catalogState, subscribe: () => () => {}, find: () => ({ id: 'one' }) };
  const gen = new plugin.DraftGenerator(h.ctx, h.editor, catalog, t); context.after(() => gen.dispose());
  gen.selectGenerator(plugin.modelKey({ provider: 'p', model: 'one' }));
  gen.setScope([{ provider: 'p', model: 'one', effort: null }]); gen.setRequirements('User defined config requirements.');
  assert.equal(await gen.generate(), true); gen.confirm(true);
  assert.equal(await gen.validateAndApply(), true);
  assert.equal(h.snapshot().user.ui.configs[0].overrides[0].id, 'same-id');
  assert.equal(h.snapshot().user.ui.candidates[0].id, 'same-id');
  assert.equal(h.snapshot().user.ui.configs[1].overrides[0].name, 'two');
  assert.equal(await gen.generate(), true); gen.confirm(true);
  const oldWizard = flatten(plugin.DraftWizard({ generator: gen, editor: h.editor, catalog, t }));
  assert.equal(await h.editor.switchConfig('b'), true);
  assert.equal(gen.canApply(), false); assert.equal(await gen.validateAndApply(), false);
  assert.equal(await gen.generate(), true);
  const freshDraft = copy(gen.getSnapshot().draft);
  oldWizard.find(row => row?.type === 'input' && row.props['aria-label'] === t('draftName') + ' · scope-1').props.onChange({ target: { value: 'Late draft from A' } });
  oldWizard.find(row => row?.type === 'input' && row.props['aria-label'] === t('draftConfirmPreset')).props.onChange({ target: { checked: true } });
  assert.equal(gen.getSnapshot().confirmed, false);
  assert.deepEqual(copy(gen.getSnapshot().draft), freshDraft);
  gen.confirm(true);
  const count = h.mutations.length;
  await oldWizard.find(row => row?.type === 'button' && row.props.children.includes(t('draftApply'))).props.onClick();
  oldWizard.find(row => row?.type === 'button' && row.props.children.includes(t('draftRemove'))).props.onClick();
  assert.equal(h.mutations.length, count);
  assert.deepEqual(copy(gen.getSnapshot().draft), freshDraft);
  assert.equal(h.snapshot().user.ui.configs[1].overrides[0].name, 'two');
});

test('silent host updates fence stale rename/copy actions instead of retargeting another current set', async context => {
  for (const act of [h => h.editor.renameConfig('Stale name'), h => h.editor.createConfig('Stale copy', true), h => h.editor.switchConfig('b'), h => h.editor.deleteConfig('b', true)]) {
    const h = harness(context); const ui = collection(); ui.activeConfigId = 'b';
    h.change({ revision: 2, user: { ui }, value: { ui } }, false);
    assert.equal(await act(h), false); assert.equal(h.mutations.length, 0);
    assert.equal(h.editor.getSnapshot().configSet.activeConfigId, 'b');
  }
});

test('active-policy equality alone cannot acknowledge omitted or altered inactive configurations', async context => {
  const h = harness(context);
  h.mutate = async (_ns, ops, revision) => {
    const actual = copy(ops[0].value); actual.configs[1].overrides[0].description = 'Unexpected inactive change';
    h.change({ revision: revision + 1, user: { ui: actual }, value: { ui: actual } }); return { ok: true };
  };
  assert.equal(await h.editor.renameConfig('Rename'), false);
  assert.equal(h.editor.getSnapshot().receiptUnverified, true);
  assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 1);
});

test('normalized effective v4 defaults acknowledge only the matching full raw write', async context => {
  const ui = collection(); delete ui.limits; delete ui.configs[1].overrides;
  const h = harness(context, ui);
  h.mutate = async (_ns, ops, revision) => {
    const raw = copy(ops[0].value), effective = copy(raw);
    effective.enabled ??= false; effective.limits = { ...copy(plugin.emptyDraft().limits), ...effective.limits };
    effective.configs = effective.configs.map(row => ({ ...row, overrides: row.overrides ?? [] }));
    h.change({ revision: revision + 1, user: { ui: raw }, value: { ui: effective } }); return { ok: true };
  };
  assert.equal(await h.editor.renameConfig('Still active'), true);
  assert.equal(h.editor.getSnapshot().saved, true);
});

test('receipt comparison distinguishes inherited preset descriptions from explicit clears', async context => {
  const ui = collection(); ui.candidates[0].description = 'Inherited global description';
  ui.configs[1].overrides = [{ id: 'same-id', name: 'Role B' }];
  const h = harness(context, ui);
  h.mutate = async (_ns, ops, revision) => {
    const raw = copy(ops[0].value), effective = copy(raw);
    effective.configs[1].overrides[0].description = '';
    h.change({ revision: revision + 1, user: { ui: raw }, value: { ui: effective } }); return { ok: true };
  };
  assert.equal(await h.editor.renameConfig('Renamed'), false);
  assert.equal(h.editor.getSnapshot().savedButNotLive, true);
  assert.equal(h.editor.getSnapshot().canManageConfigs, false);
});

test('switch save holds the fence throughout mutation and blocks duplicate actions', async context => {
  const h = harness(context); let resolve;
  h.mutate = () => new Promise(done => { resolve = done; });
  const save = h.editor.switchConfig('b');
  assert.equal(h.editor.getSnapshot().saving, true);
  assert.equal(await h.editor.createConfig('No duplicate'), false);
  assert.equal(await h.editor.switchConfig('a'), false);
  assert.equal(await h.editor.deleteConfig('a', true), false);
  const raw = copy(h.mutations[0].ops[0].value);
  h.change({ revision: 2, user: { ui: raw }, value: { ui: raw } }); resolve({ ok: true });
  assert.equal(await save, true); assert.equal(h.mutations.length, 1);
});

test('old rendered manual fields, IME, catalog, delete and add callbacks cannot cross sets or ABA', async context => {
  const cases = [
    nodes => nodes.find(row => row?.type === 'input' && row.props['aria-label'] === t('name')).props.onChange({ target: { value: 'Late A name' } }),
    nodes => nodes.find(row => row?.type === 'input' && row.props['aria-label'] === t('enabled')).props.onChange({ target: { checked: false } }),
    nodes => nodes.find(row => row?.type === 'input' && row.props['aria-label'] === t('maxActivePerModel')).props.onChange({ target: { value: '100' } }),
    nodes => nodes.find(row => row?.type === 'select' && row.props['aria-label'] === t('defaultCandidate')).props.onChange({ target: { value: 'same-id' } }),
    nodes => nodes.find(row => row?.type === 'select' && row.props['aria-label'] === t('chooseModel')).props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'two' }) } }),
    nodes => nodes.find(row => row?.type === 'select' && row.props['aria-label'] === t('effort')).props.onChange({ target: { value: plugin.effortKey(null) } }),
    nodes => nodes.find(row => row?.type === 'input' && row.props['aria-label'] === t('name')).props.onCompositionStart(),
    nodes => nodes.find(row => row?.type === 'button' && row.props.children.includes(t('remove'))).props.onClick(),
    nodes => nodes.find(row => row?.type === 'button' && row.props.children.includes(t('addCandidate'))).props.onClick()
  ];
  for (const aba of [false, true]) for (const invoke of cases) {
    const ui = collection(); ui.configs[1].overrides = [];
    const h = harness(context, ui), catalog = new plugin.ModelCatalog(h.ctx); context.after(() => catalog.dispose());
    catalog.publish({ status: 'ready', groups: [{ id: 'p', name: 'P', models: [{ id: 'one' }, { id: 'two' }] }], failures: [] });
    const old = flatten(plugin.RouterPage({ editor: h.editor, catalog, t }));
    await h.editor.switchConfig('b'); if (aba) await h.editor.switchConfig('a');
    const before = copy(h.editor.getSnapshot().draft); invoke(old);
    assert.deepEqual(copy(h.editor.getSnapshot().draft), before);
    assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.editor.composing, false); assert.equal(h.timers.size, 0);
    h.editor.setComposing(true);
    old.find(row => row?.type === 'input' && row.props['aria-label'] === t('name')).props.onCompositionEnd();
    assert.equal(h.editor.composing, true);
  }
});

test('old rendered management actions cannot rename, copy, delete or switch a new current configuration', async context => {
  const h = harness(context);
  const original = React.useState; React.useState = () => ['New custom name', () => {}];
  let nodes;
  try { nodes = flatten(plugin.ConfigSetsPanel({ editor: h.editor, state: h.editor.getSnapshot(), t })); }
  finally { React.useState = original; }
  await h.editor.switchConfig('b');
  for (const key of ['newConfig', 'copyConfig', 'renameConfig']) await nodes.find(row => row?.type === 'button' && row.props.children.includes(t(key))).props.onClick();
  nodes.find(row => row?.type === 'select').props.onChange({ target: { value: 'a' } });
  assert.equal(h.mutations.length, 1); assert.equal(h.editor.getSnapshot().configSet.activeConfigId, 'b');
});

test('rendered recovery and retry remain available after busy switch refusal and CAS conflicts', async context => {
  const h = harness(context); const realMutate = h.mutate;
  h.mutate = async () => ({ ok: false, error: { code: 'settings/rejected', message: 'CONFIG_BUSY' } });
  await h.editor.switchConfig('b');
  let nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
  assert.ok(nodes.includes(t('configNotConfirmed')));
  h.mutate = realMutate;
  await nodes.find(row => row?.type === 'button' && row.props.children.includes(t('retry'))).props.onClick();
  assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.snapshot().value.ui.activeConfigId, 'b');
  h.mutate = async () => ({ ok: false, error: { code: 'settings/rejected', message: 'CONFIG_BUSY' } });
  await h.editor.switchConfig('a');
  nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
  await nodes.find(row => row?.type === 'button' && row.props.children.includes(t('cancel'))).props.onClick();
  assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.editor.getSnapshot().configSet.activeConfigId, 'b');
  h.editor.edit(next => { next.candidates[0].name = 'Pending'; }); h.change({ revision: 5 });
  nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
  await nodes.find(row => row?.type === 'button' && row.props.children.includes(t('cancel'))).props.onClick();
  assert.equal(h.editor.getSnapshot().conflicted, false); assert.equal(h.editor.getSnapshot().dirty, false);
});

test('fresh host restrictions fence same-revision rendered callbacks without blocking recovery', context => {
  for (const patch of [{ writable: false }, { status: 'loading' }, { value: { ui: { schemaVersion: 99 } } }, { user: { ui: { schemaVersion: 99 } } }]) {
    const h = harness(context); const old = flatten(plugin.RouterPage({ editor: h.editor, t }));
    const token = h.editor.viewToken(); h.change(patch, false);
    old.find(row => row?.type === 'input' && row.props['aria-label'] === t('name')).props.onChange({ target: { value: 'Unsafe' } });
    assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.timers.size, 0);
    assert.equal(h.editor.matchesView(token), false); assert.equal(h.editor.matchesView(token, false), true);
  }
});

test('switch/copy/new/rename/delete only touch preset data and never available models or global settings', async context => {
  const h = harness(context), shared = copy(h.snapshot().user.ui);
  const check = () => { const saved = h.snapshot().user.ui; assert.deepEqual(saved.candidates, shared.candidates); assert.deepEqual(saved.limits, shared.limits); assert.equal(saved.enabled, shared.enabled); };
  await h.editor.switchConfig('b'); check();
  await h.editor.createConfig('Copy', true); check();
  await h.editor.createConfig('Blank roles'); check();
  await h.editor.renameConfig('Renamed roles'); check();
  await h.editor.deleteConfig('b', true); check();
  for (const preset of h.snapshot().user.ui.configs) assert.deepEqual(Object.keys(preset).sort(), ['defaultCandidateId', 'id', 'name', 'overrides']);
});

test('global candidate changes propagate across presets; removal is guarded for defaults and prunes role references', async context => {
  const ui = collection(); ui.candidates.push({ id: 'extra', name: 'Extra', provider: 'p', model: 'extra', effort: null });
  ui.configs[1].overrides.push({ id: 'extra', name: 'Secondary extra', description: 'Role' });
  const h = harness(context, ui);
  assert.equal(h.editor.removeCandidate('same-id'), false); assert.equal(h.editor.getSnapshot().dirty, false);
  assert.equal(h.editor.removeCandidate('extra'), true); assert.equal(await h.editor.save(), true);
  assert.equal(h.snapshot().user.ui.candidates.length, 1);
  assert.equal(h.snapshot().user.ui.configs[1].overrides.some(row => row.id === 'extra'), false);
  h.editor.edit(next => { next.candidates[0].model = 'new-global-model'; next.enabled = false; next.limits.maxActivePerModel = 3; });
  assert.equal(await h.editor.save(), true); assert.equal(await h.editor.switchConfig('b'), true);
  assert.equal(h.editor.getSnapshot().draft.candidates[0].model, 'new-global-model');
  assert.equal(h.editor.getSnapshot().draft.enabled, false); assert.equal(h.editor.getSnapshot().draft.limits.maxActivePerModel, 3);
});

test('delete then add before autosave never reuses a persisted candidate identity or its old role overrides', async context => {
  const ui = collection(); ui.candidates.push({ id: 'candidate-1', name: 'Old extra', provider: 'p', model: 'old', effort: null });
  ui.configs[1].overrides.push({ id: 'candidate-1', name: 'Old role', description: 'Old instructions' });
  const h = harness(context, ui);
  assert.equal(h.editor.removeCandidate('candidate-1'), true);
  assert.equal(h.editor.addCandidate(), true);
  const added = h.editor.getSnapshot().draft.candidates.at(-1);
  assert.notEqual(added.id, 'candidate-1');
  h.editor.edit(next => Object.assign(next.candidates.at(-1), { name: 'New extra', provider: 'p', model: 'new', effort: null }));
  assert.equal(await h.editor.save(), true);
  const saved = h.snapshot().user.ui;
  assert.equal(saved.candidates.at(-1).name, 'New extra'); assert.equal(saved.candidates.at(-1).model, 'new');
  assert.equal(saved.configs[1].overrides.some(row => row.id === 'candidate-1' || row.id === added.id), false);
  assert.equal(await h.editor.switchConfig('b'), true);
  assert.equal(h.editor.getSnapshot().draft.candidates.at(-1).name, 'New extra');
  assert.notEqual(h.editor.getSnapshot().draft.candidates.at(-1).description, 'Old instructions');
});

test('generated presets reject missing/ambiguous pool routes without adding or removing available candidates', async context => {
  for (const ambiguous of [false, true, 'colliding-id']) {
    const ui = collection(); if (ambiguous) ui.candidates.push({ ...copy(ui.candidates[0]), id: 'duplicate-route', name: 'Same route' });
    const h = harness(context, ui), before = copy(h.snapshot().user.ui), owner = {};
    const baseline = h.editor.captureGenerated(); h.editor.lockGenerated(owner, baseline);
    const generated = { candidates: [{ id: ambiguous === 'colliding-id' ? 'same-id' : 'scope-new', name: 'New role', provider: 'p', model: ambiguous ? 'one' : 'outside-pool', effort: null }], defaultCandidateId: ambiguous === 'colliding-id' ? 'same-id' : 'scope-new' };
    assert.equal(await h.editor.applyGenerated(generated, baseline, owner), false);
    h.editor.unlockGenerated(owner);
    assert.equal(h.mutations.length, 0); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.deepEqual(h.snapshot().user.ui, before); assert.equal(h.editor.getSnapshot().error, t('draftPoolMismatch'));
  }
});

test('multi-preset UI keeps model selectors only in the global pool, not preset role controls', context => {
  const h = harness(context), nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
  const details = nodes.find(row => row?.props?.['data-workspace-panel'] === 'details');
  const pool = nodes.find(row => row?.props?.['data-workspace-panel'] === 'pool');
  const roles = flatten(details).filter(row => row?.props?.['data-candidate']);
  const pools = flatten(pool).filter(row => row?.props?.['data-pool-candidate']);
  assert.equal(roles.length, 1); assert.equal(pools.length, 1);
  assert.equal(flatten(roles).filter(row => row?.type === 'select').length, 0);
  assert.equal(flatten(pools).filter(row => row?.type === 'select').length, 2);
  assert.equal(pool.props['data-shared-pool'], true);
  assert.equal(flatten(details).some(row => row?.props?.['data-pool-candidate']), false);
  assert.equal(flatten(pool).some(row => row?.props?.['data-candidate']), false);
});

test('a new v4 candidate can receive its initial name in the global model pool before saving', async context => {
  const h = harness(context), before = copy(h.snapshot().user.ui);
  const catalog = new plugin.ModelCatalog(h.ctx); context.after(() => catalog.dispose());
  catalog.publish({ status: 'ready', groups: [{ id: 'p', name: 'P', models: [{ id: 'one' }, { id: 'two' }] }], failures: [] });
  const pool = () => flatten(flatten(plugin.RouterPage({ editor: h.editor, catalog, t }))
    .find(row => row?.props?.['data-workspace-panel'] === 'pool'));
  const candidate = id => pool().find(row => row?.props?.['data-pool-candidate'] === id);
  const field = (row, type, key) => flatten(row).find(node => node?.type === type && node.props['aria-label'] === t(key));
  assert.equal(field(candidate('same-id'), 'input', 'poolName'), undefined);
  pool().find(row => row?.type === 'button' && row.props.children.includes(t('addCandidate'))).props.onClick();
  const { id } = h.editor.getSnapshot().draft.candidates.at(-1);
  const name = field(candidate(id), 'input', 'poolName');
  assert.equal(candidate(id).props.open, true);
  assert.equal(name.props.value, ''); assert.equal(name.props.disabled, false);
  name.props.onChange({ target: { value: 'Shared new model' } });
  assert.equal(h.mutations.length, 0); assert.equal(h.timers.size, 0);
  field(candidate(id), 'select', 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'two' }) } });
  assert.equal(h.timers.size, 1); assert.equal(h.mutations.length, 0);
  assert.equal(await h.editor.save(), true);
  const saved = h.snapshot().user.ui;
  assert.equal(saved.candidates.at(-1).id, id);
  assert.equal(saved.candidates.at(-1).name, 'Shared new model');
  assert.equal(saved.candidates.at(-1).model, 'two');
  assert.deepEqual(saved.configs, before.configs);
  assert.equal(field(candidate(id), 'input', 'poolName'), undefined);
});

test('preset details offer a saved default without a catalog; autosave preserves all other preset data', async context => {
  const ui = collection();
  ui.candidates[0].description = 'Global description';
  ui.candidates.push({ ...ui.candidates[0], id: 'extra', effort: 'high' });
  ui.configs[0].overrides = [{ id: 'same-id', name: 'Primary role' }];
  delete ui.configs[1].overrides;
  const h = harness(context, ui);
  const nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
  const isPicker = row => row?.type === 'select' && row.props['aria-label'] === t('defaultCandidate');
  const details = nodes.find(row => row?.props?.['data-workspace-panel'] === 'details');
  assert.equal(details.props.hidden, false);
  const picker = flatten(details).find(isPicker);
  assert.ok(picker); assert.equal(picker.props.disabled, false); assert.equal(picker.props.value, 'same-id');
  assert.equal(nodes.filter(isPicker).length, 1);
  assert.deepEqual(flatten(picker).filter(row => row?.type === 'option' && row.props.value).map(row => [row.props.value, row.props.children[0]]), [
    ['same-id', 'Primary role — p / one · No effort'], ['extra', 'one — p / one · high']
  ]);
  for (const id of ['same-id', '', 'missing']) picker.props.onChange({ target: { value: id } });
  assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(h.timers.size, 0);
  picker.props.onChange({ target: { value: 'extra' } });
  assert.equal(h.timers.size, 1); assert.equal(h.mutations.length, 0);
  assert.equal(await h.editor.save(), true);
  const expected = copy(ui); expected.configs[0].defaultCandidateId = 'extra';
  assert.deepEqual(h.snapshot().user.ui, expected);
  assert.equal(await h.editor.switchConfig('b'), true);
  const afterSwitch = flatten(plugin.RouterPage({ editor: h.editor, t })).find(isPicker);
  assert.equal(afterSwitch.props.value, 'same-id');
  picker.props.onChange({ target: { value: 'extra' } });
  assert.equal(h.editor.getSnapshot().dirty, false);
});

test('legacy single-policy settings can still choose a default without migrating', async context => {
  const ui = policy(); ui.candidates.push({ id: 'extra', name: 'Extra', provider: 'p', model: 'extra', effort: null });
  const h = harness(context, ui);
  const nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
  const select = nodes.find(row => row?.type === 'select' && row.props['aria-label'] === t('defaultCandidate'));
  assert.equal(select.props.disabled, false);
  select.props.onChange({ target: { value: 'extra' } });
  assert.equal(await h.editor.save(), true);
  assert.deepEqual(h.snapshot().user.ui, { ...ui, defaultCandidateId: 'extra' });
});

test('both languages render generic names, explicit delete controls and no preset scene selector', context => {
  const h = harness(context);
  for (const dictionary of [plugin.dictionaries.en, plugin.dictionaries.zh]) {
    const nodes = flatten(plugin.RouterPage({ editor: h.editor, t: key => dictionary[key] ?? key }));
    const select = nodes.find(row => row?.type === 'select' && row.props['aria-label'] === dictionary.activeConfig);
    assert.equal(select.props.value, 'a'); assert.equal(select.props.disabled, false);
    const names = flatten(select).filter(row => row?.type === 'option').map(row => row.props.children[0]);
    assert.deepEqual(names, ['My own name', '另一套任意名称']);
    assert.ok(nodes.some(row => row?.type === 'button' && row.props.children.includes(dictionary.copyConfig)));
    assert.ok(nodes.some(row => row?.props?.['aria-label'] === dictionary.deleteConfig + ' 另一套任意名称'));
  }
});
