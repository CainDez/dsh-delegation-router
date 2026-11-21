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
vm.runInNewContext(source, { setTimeout, clearTimeout, window: { __ModuleLoader__: { load: value => { definition = value; } }, confirm: () => true } });
const plugin = definition.factory(() => React);
const copy = value => JSON.parse(JSON.stringify(value));
const t = key => plugin.dictionaries.en[key] ?? key;
const candidates = () => [
  { id: 'fast', name: 'Fast edit', provider: 'p', model: 'm1', effort: 'brief', description: 'Small edits' },
  { id: 'deep', name: 'Deep analysis', provider: 'p', model: 'm1', effort: 'deep', description: 'Detailed analysis' }
];
const nativeCatalog = () => ({ groups: [{ id: 'p', models: [
  { id: 'm1', reasoning: { efforts: [{ id: 'brief', name: 'Brief' }, { id: 'deep', name: 'Deep' }], defaultEffort: 'brief' } },
  { id: 'm2', reasoning: { efforts: [{ id: 'deep', name: 'Deep' }, { id: 'max', name: 'Maximum' }], defaultEffort: 'deep' } },
  { id: 'plain' }
] }], failures: [] });
function harness(value = { ui: { ...copy(plugin.emptyDraft()), candidates: candidates() } }) {
  let snapshot = { status: 'ready', writable: true, revision: 7, user: copy(value), value: copy(value) };
  const listeners = new Set(), mutations = [], catalogCalls = [];
  let response = nativeCatalog(), effective;
  const notify = () => { for (const fn of listeners) fn(); };
  const ctx = {
    configForms: {
      get: () => ({ getSnapshot: () => snapshot, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } }),
      describe: () => ({ async load() {} })
    },
    remote: {
      session: { modelCatalog(...args) { catalogCalls.push(args); return Promise.resolve({ ok: true, value: response }); } },
      settings: { async mutate(ns, ops, revision) {
        mutations.push({ ns, ops: copy(ops), revision });
        const user = { ...copy(snapshot.user), ui: copy(ops[0].value) };
        snapshot = { ...snapshot, revision: revision + 1, user, value: effective ? { ui: effective(copy(user.ui)) } : copy(user) };
        notify(); return { ok: true };
      } }
    }
  };
  const editor = new plugin.RouterEditor(ctx, t), catalog = new plugin.ModelCatalog(ctx);
  return { editor, catalog, ctx, mutations, catalogCalls, current: () => copy(snapshot),
    response(value) { response = value; }, effective(fn) { effective = fn; },
    change(value) { snapshot = { ...snapshot, ...value }; notify(); },
    dispose() { editor.dispose(); catalog.dispose(); }
  };
}
function flatten(node) {
  if (node === null || node === undefined || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [node];
  if (node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}
const page = h => flatten(plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t, view: 'page' }));
const panel = (nodes, key) => flatten(nodes.find(node => node?.props?.['data-workspace-panel'] === key));
const control = (nodes, key, type = 'select') => nodes.find(node => node?.type === type && node.props['aria-label'] === t(key));
const action = (nodes, key) => nodes.find(node => node?.type === 'button' && node.props.children.includes(t(key)));
const field = (h, key, type = 'select') => control(key === 'enabled' ? page(h) : panel(page(h), 'details'), key, type);
const button = (h, key) => action(panel(page(h), 'details'), key);
function workspace(h) {
  let active;
  return () => {
    const useState = React.useState;
    let tree;
    React.useState = initial => [active ?? initial, next => { active = next; }];
    try { tree = plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t, view: 'page' }); }
    finally { React.useState = useState; }
    return flatten(tree);
  };
}

test('same model supports named candidates with one effort and no automatic default', async () => {
  const h = harness(); await h.catalog.load(); const before = h.current();
  assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, undefined);
  assert.deepEqual(panel(page(h), 'details').filter(node => node?.type === 'select' && node.props['aria-label'] === t('effort')).map(node => node.props.value), [JSON.stringify('brief'), JSON.stringify('deep')]);
  field(h, 'defaultCandidate').props.onChange({ target: { value: 'deep' } }); field(h, 'enabled', 'input').props.onChange({ target: { checked: true } });
  assert.deepEqual(h.current(), before); assert.equal(await h.editor.save(), true);
  const saved = h.current().value.ui;
  assert.equal(saved.schemaVersion, 5);
  assert.deepEqual(saved.configs[0].candidates, candidates()); assert.equal(saved.configs[0].defaultCandidateId, 'deep');
  assert.deepEqual(saved.candidates, candidates()); assert.equal(saved.enabled, true);
  assert.equal(Object.hasOwn(h.current().value.ui, 'teams'), false); h.dispose();
});

test('names do not rename stable ids, and deleting a default requires an explicit replacement or clear', async () => {
  const h = harness({ ui: { ...copy(plugin.emptyDraft()), candidates: candidates(), defaultCandidateId: 'fast' } });
  assert.equal(field(h, 'id', 'input'), undefined); assert.ok(page(h).some(node => node?.type === 'code' && node.props['aria-label'] === t('id')));
  field(h, 'name', 'input').props.onChange({ target: { value: 'renamed' } });
  assert.equal(h.editor.getSnapshot().draft.candidates[0].id, 'fast'); assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, 'fast'); assert.equal(await h.editor.save(), true);
  button(h, 'remove').props.onClick(); assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, 'fast'); assert.equal(await h.editor.save(), false);
  field(h, 'defaultCandidate').props.onChange({ target: { value: 'deep' } }); assert.equal(await h.editor.save(), true);
  button(h, 'remove').props.onClick();
  assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, 'deep'); assert.equal(await h.editor.save(), false);
  field(h, 'defaultCandidate').props.onChange({ target: { value: '' } });
  assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, undefined); assert.equal(await h.editor.save(), true); h.dispose();
});

test('empty lists and duplicate ids cannot enable routing or accept forged defaults', async () => {
  const h = harness({ ui: copy(plugin.emptyDraft()) });
  field(h, 'enabled', 'input').props.onChange({ target: { checked: true } }); assert.equal(await h.editor.save(), false);
  assert.equal(h.mutations.length, 0); field(h, 'defaultCandidate').props.onChange({ target: { value: 'invented' } });
  assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, undefined);
  h.editor.edit(next => { next.candidates = candidates(); next.candidates[1].id = 'fast'; });
  field(h, 'defaultCandidate').props.onChange({ target: { value: 'fast' } }); assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, undefined);
  assert.equal(await h.editor.save(), false); h.dispose();
});

test('unsupported entry fields and schema versions stay read-only', async () => {
  for (const value of [
    { policy: { ...copy(plugin.emptyDraft()), candidates: candidates() } },
    { ui: { schemaVersion: 0 } },
    { ui: { schemaVersion: 1, models: [] } },
    { ui: { schemaVersion: 3, candidates: 'broken' } },
    { ui: { schemaVersion: 3, unexpected: [] } },
    { ui: { schemaVersion: 3, ...copy(plugin.emptyDraft()), candidates: candidates(), teams: { enabled: false } } },
    { ui: { ...copy(plugin.emptyDraft()), candidates: [{ ...candidates()[0], retained: 'unknown key' }, candidates()[1]], defaultCandidateId: 'fast' } },
    { ui: { ...copy(plugin.emptyDraft()), candidates: candidates(), limits: { maxPendingStarts: 1, unknown: 2 } } },
    { ui: null }
  ]) {
    const h = harness(value), before = h.current(), state = h.editor.getSnapshot();
    assert.equal(state.invalidSource, true); assert.deepEqual(copy(state.draft), copy(plugin.emptyDraft()));
    const nodes = page(h);
    const offending = value.policy !== undefined ? value.policy : value.ui;
    assert.ok(nodes.includes(t('invalidSource'))); assert.ok(nodes.includes(t('originalConfiguration')));
    assert.ok(nodes.includes(JSON.stringify(offending, null, 2)));
    assert.equal(button(h, 'addCandidate').props.disabled, true); assert.equal(h.editor.addCandidate(), false);
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false); assert.equal(await h.editor.save(), false);
    assert.equal(h.mutations.length, 0); assert.deepEqual(h.current(), before); h.dispose();
  }
});

test('only an explicit native replacement releases the readonly invalid state after reload', async () => {
  const h = harness({ policy: { ...copy(plugin.emptyDraft()), candidates: candidates() } });
  h.editor.resetConnection(); await h.editor.reload();
  assert.equal(h.editor.getSnapshot().invalidSource, true);
  assert.equal(h.editor.edit(next => { next.enabled = true; }), false);
  const replacement = { ...copy(plugin.emptyDraft()), candidates: candidates() };
  h.change({ revision: 8, user: { ui: replacement }, value: { ui: replacement } });
  await h.editor.reload(); assert.equal(h.editor.getSnapshot().invalidSource, false);
  field(h, 'description', 'input').props.onChange({ target: { value: 'manual v3 edit' } });
  assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 8);
  const written = h.mutations[0].ops[0].value;
  assert.equal(written.schemaVersion, 5);
  assert.deepEqual(written.configs[0].candidates, [{ ...candidates()[0], description: 'manual v3 edit' }, candidates()[1]]);
  assert.deepEqual(written.candidates, replacement.candidates); h.dispose();
});

test('invalid effective or hidden raw sources fence stale callbacks and preserve dirty v3 drafts', async () => {
  for (const hidden of [false, true]) {
    const h = harness(); await h.catalog.load();
    const name = field(h, 'name', 'input'), model = field(h, 'chooseModel'), effort = field(h, 'effort');
    field(h, 'description', 'input').props.onChange({ target: { value: 'retain dirty draft' } });
    const draft = copy(h.editor.getSnapshot().draft), original = { schemaVersion: 0 };
    const value = hidden ? h.current().value : { ui: original };
    h.change({ revision: 8, user: { ui: original }, value });
    assert.equal(h.editor.getSnapshot().invalidSource, true);
    name.props.onChange({ target: { value: 'stale' } });
    model.props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm2' }) } });
    effort.props.onChange({ target: { value: JSON.stringify('deep') } });
    assert.deepEqual(copy(h.editor.getSnapshot().draft), draft); assert.equal(await h.editor.save(), false);
    h.editor.resetConnection(); assert.equal(await h.editor.save(), false); await h.editor.reload();
    assert.equal(h.editor.getSnapshot().invalidSource, true);
    assert.equal(h.editor.addCandidate(), false); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('reset fences stale candidate edits without discarding drafts', () => {
  const h = harness(), name = field(h, 'name', 'input'); h.editor.edit(next => { next.candidates[0].description = 'dirty'; }); h.editor.resetConnection();
  const retained = copy(h.editor.getSnapshot().draft); name.props.onChange({ target: { value: 'stale' } }); assert.deepEqual(copy(h.editor.getSnapshot().draft), retained); h.dispose();
});

test('simultaneous policy and ui keys cannot be merged or overwritten', async () => {
  const h = harness({ ui: { ...copy(plugin.emptyDraft()), candidates: candidates() }, policy: {} });
  assert.ok(page(h).includes(t('invalidSource'))); button(h, 'addCandidate').props.onClick(); assert.equal(h.editor.getSnapshot().dirty, false);
  assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
});

test('both languages expose responsive native controls and honest capability boundaries', () => {
  const h = harness();
  for (const language of ['zh', 'en']) {
    const dictionary = plugin.dictionaries[language], translate = key => dictionary[key] ?? key;
    const nodes = flatten(plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t: translate, view: 'page' }));
    for (const key of ['title', 'name', 'description', 'effort', 'defaultCandidate', 'candidates', 'authority', 'advanced', 'executionEvidence']) assert.ok(nodes.includes(dictionary[key]), key);
    assert.ok(nodes.filter(node => node?.type === 'button').every(node => node.props.style.minHeight >= 44));
    assert.ok(nodes.filter(node => ['fieldset', 'section'].includes(node?.type)).every(node => node.props.style.minWidth === 0));
    if (language === 'zh') { assert.match(dictionary.authority, /仅传文本，不转发图片/); assert.match(dictionary.executionEvidence, /保存或列出.*不会执行.*不能证明.*实际路由.*router_status/); }
    else { assert.match(dictionary.authority, /text-only.*does not forward images/); assert.match(dictionary.executionEvidence, /Saving or listing.*does not execute.*prove actual child routing.*router_status/); }
    const root = plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t: translate, view: 'page' });
    const advanced = flatten(root).find(node => node?.type === 'details' && node.props.children[0]?.props?.children?.includes(dictionary.advanced));
    assert.ok(flatten(advanced).includes(dictionary.executionEvidence));
  }
  assert.equal(h.mutations.length, 0); h.dispose();
});

test('ack normalization fills only descriptions and documented defaults, not routes or unknown extras', () => {
  const { description: _description, ...profile } = candidates()[0];
  const base = { schemaVersion: 5, candidates: [profile], activeConfigId: 'a', configs: [{ id: 'a', name: 'Alpha', candidates: [profile] }] };
  assert.deepEqual(copy(plugin.normalizeAckUi(base)), { ...base, enabled: false, limits: copy(plugin.emptyDraft().limits),
    candidates: [{ ...profile, description: '' }], configs: [{ ...base.configs[0], candidates: [{ ...profile, description: '' }] }] });
  for (const rows of [ui => ui.candidates, ui => ui.configs[0].candidates]) {
    const changed = copy(base);
    rows(changed)[0].effort = null;
    assert.notDeepEqual(copy(plugin.normalizeAckUi(base)), copy(plugin.normalizeAckUi(changed)));
    rows(changed)[0].effort = 'brief'; rows(changed)[0].unknown = [];
    assert.deepEqual(copy(plugin.normalizeAckUi(changed)), changed);
  }
  // An empty or malformed source is never repaired into a valid v5 acknowledgement.
  assert.deepEqual(copy(plugin.normalizeAckUi({})), {});
  assert.deepEqual(copy(plugin.normalizeAckUi({ schemaVersion: 3, candidates: [], extra: true })), { schemaVersion: 3, candidates: [], extra: true });
});

test('fresh configuration starts empty with no template seeding, default or write', async () => {
  const h = harness({}); const before = h.current();
  assert.deepEqual(copy(h.editor.getSnapshot().draft), copy(plugin.emptyDraft()));
  assert.equal(field(h, 'defaultCandidate').props.value, '');
  assert.ok(page(h).includes(t('noCandidates')));
  assert.equal(button(h, 'addCandidate').props.disabled, false);
  assert.equal(page(h).filter(node => node?.type === 'select' && [t('chooseModel'), t('effort')].includes(node.props['aria-label'])).length, 0);
  assert.equal(page(h).some(node => node?.type === 'option' && /Low|High|Max/.test(String(node.props.children))), false);
  const response = nativeCatalog(); response.default = { provider: 'global-provider', model: 'global-model', reasoningEffort: 'deep' };
  h.response(response); await h.catalog.load(); assert.deepEqual(h.catalogCalls, [[]]);
  assert.deepEqual(copy(h.editor.getSnapshot().draft), copy(plugin.emptyDraft()));
  assert.doesNotMatch(JSON.stringify(page(h)), /global-provider|global-model/);
  assert.deepEqual(h.current(), before); assert.equal(h.mutations.length, 0); h.dispose();
});

test('explicit model selection fixes the pair and derives the exact advertised effort', async () => {
  const h = harness({ ui: copy(plugin.emptyDraft()) }); await h.catalog.load();
  button(h, 'addCandidate').props.onClick();
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm2' }) } });
  assert.deepEqual(copy(h.editor.getSnapshot().draft.candidates), [{ id: 'candidate-1', name: '', provider: 'p', model: 'm2', effort: 'deep', description: '' }]);
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm1' }) } });
  assert.deepEqual(copy(h.editor.getSnapshot().draft.candidates), [{ id: 'candidate-1', name: '', provider: 'p', model: 'm1', effort: 'brief', description: '' }]);
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'plain' }) } });
  assert.equal(h.editor.getSnapshot().draft.candidates[0].effort, null);
  assert.ok(page(h).includes(t('noReasoning')));
  field(h, 'name', 'input').props.onChange({ target: { value: 'Mine' } });
  field(h, 'defaultCandidate').props.onChange({ target: { value: 'candidate-1' } });
  assert.equal(await h.editor.save(), true);
  assert.deepEqual(h.current().value.ui.configs[0].candidates, [{ id: 'candidate-1', name: 'Mine', provider: 'p', model: 'plain', effort: null, description: '' }]);
  h.dispose();
});

test('undeclared native default needs one real effort, with no synthetic default option', async () => {
  const h = harness({ ui: copy(plugin.emptyDraft()) }); await h.catalog.load();
  button(h, 'addCandidate').props.onClick();
  const response = nativeCatalog(); response.groups[0].models.push({ id: 'no-default', reasoning: { efforts: [{ id: 'real', name: 'Real effort' }] } });
  h.response(response); await h.catalog.load();
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'no-default' }) } });
  assert.equal(h.editor.getSnapshot().draft.candidates[0].effort, '');
  const nodes = page(h), picker = field(h, 'effort'); assert.ok(nodes.includes(t('effortRequired')));
  assert.deepEqual(flatten(picker).filter(node => node?.type === 'option').map(node => node.props.value), ['', JSON.stringify('real')]);
  const before = copy(h.editor.getSnapshot()); picker.props.onChange({ target: { value: JSON.stringify('default') } }); assert.deepEqual(copy(h.editor.getSnapshot()), before);
  field(h, 'name', 'input').props.onChange({ target: { value: 'No default' } });
  field(h, 'defaultCandidate').props.onChange({ target: { value: 'candidate-1' } });
  picker.props.onChange({ target: { value: JSON.stringify('real') } }); assert.equal(h.editor.getSnapshot().draft.candidates[0].effort, 'real');
  assert.equal(await h.editor.save(), true); h.dispose();
});

test('saved stale effort remains visible and cannot be newly selected', async () => {
  const ui = { ...copy(plugin.emptyDraft()), candidates: candidates(), defaultCandidateId: 'fast' }; ui.candidates[0].effort = 'old-effort';
  const h = harness({ ui }); await h.catalog.load();
  const nodes = page(h), picker = field(h, 'effort');
  assert.ok(nodes.some(node => node?.type === 'optgroup' && node.props.label === 'p (p)'));
  const unknown = flatten(picker).find(node => node?.type === 'option' && node.props.value === JSON.stringify('old-effort'));
  assert.equal(unknown.props.disabled, true); const before = copy(h.editor.getSnapshot());
  picker.props.onChange({ target: { value: JSON.stringify('old-effort') } }); assert.deepEqual(copy(h.editor.getSnapshot()), before);
  picker.props.onChange({ target: { value: JSON.stringify('brief') } }); assert.equal(h.editor.getSnapshot().draft.candidates[0].effort, 'brief');
  assert.equal(h.editor.getSnapshot().draft.candidates[0].id, 'fast'); h.dispose();
});

test('saved exact custom or null efforts survive catalog changes without silent replacement', async () => {
  for (const effort of ['provider-custom', null]) {
    const ui = { ...copy(plugin.emptyDraft()), candidates: candidates(), defaultCandidateId: 'fast' }; ui.candidates[0].effort = effort;
    const h = harness({ ui }), before = copy(h.editor.getSnapshot());
    await h.catalog.load(); h.response({ groups: [], failures: [] }); await h.catalog.load();
    assert.deepEqual(copy(h.editor.getSnapshot()), before); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.equal(page(h).includes(t('noReasoning')), false);
    field(h, 'description', 'input').props.onChange({ target: { value: 'Edited only description' } });
    assert.equal(await h.editor.save(), true); assert.equal(h.current().value.ui.configs[0].candidates[0].effort, effort); h.dispose();
  }
});

test('blank candidates block autosave until complete and enabling requires an explicit default', async () => {
  const h = harness({ ui: copy(plugin.emptyDraft()) }); await h.catalog.load();
  button(h, 'addCandidate').props.onClick();
  field(h, 'enabled', 'input').props.onChange({ target: { checked: true } });
  assert.equal(plugin.validDraft(h.editor.getSnapshot().draft), false); assert.equal(await h.editor.save(), false);
  assert.equal(h.mutations.length, 0);
  field(h, 'name', 'input').props.onChange({ target: { value: 'Incomplete' } });
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm1' }) } });
  assert.equal(plugin.validDraft(h.editor.getSnapshot().draft), false); // enabling still requires a preset default
  field(h, 'effort').props.onChange({ target: { value: JSON.stringify('brief') } });
  assert.equal(plugin.validDraft(h.editor.getSnapshot().draft), false); // enabled without default
  assert.ok(page(h).some(node => typeof node === 'string' && node.includes(t('autosaveIncomplete'))));
  field(h, 'defaultCandidate').props.onChange({ target: { value: 'candidate-1' } });
  assert.equal(plugin.validDraft(h.editor.getSnapshot().draft), true);
  assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1);
  assert.deepEqual(h.current().value.ui.configs[0].candidates, [{ id: 'candidate-1', name: 'Incomplete', provider: 'p', model: 'm1', effort: 'brief', description: '' }]);
  h.dispose();
});

test('preset and draft-pool controls edit separate complete profiles using the full catalog', async testContext => {
  const [fast, deep] = candidates(), ui = { schemaVersion: 5, enabled: true, activeConfigId: 'a',
    limits: copy(plugin.emptyDraft().limits), candidates: [{ ...fast, name: 'Pool only' }], configs: [
      { id: 'a', name: 'Active', candidates: [fast], defaultCandidateId: 'fast' },
      { id: 'b', name: 'Other', candidates: [deep], defaultCandidateId: 'deep' }
    ] };
  const h = harness({ ui }); testContext.after(() => h.dispose()); await h.catalog.load();
  const render = workspace(h);
  const details = () => panel(render(), 'details'), pool = () => panel(render(), 'pool');
  const cards = (nodes, key) => nodes.filter(node => node?.props && Object.hasOwn(node.props, key));
  assert.equal(cards(details(), 'data-candidate').length, 1);
  assert.equal(cards(details(), 'data-pool-candidate').length, 0);
  assert.equal(action(details(), 'addPoolCandidate'), undefined);
  const model = control(details(), 'chooseModel');
  const fullCatalog = ['m1', 'm2', 'plain'].map(id => plugin.modelKey({ provider: 'p', model: id }));
  for (const key of fullCatalog) assert.ok(flatten(model).some(node => node?.type === 'option' && node.props.value === key));
  model.props.onChange({ target: { value: fullCatalog[1] } });
  control(details(), 'effort').props.onChange({ target: { value: JSON.stringify('max') } });
  control(details(), 'name', 'input').props.onChange({ target: { value: 'My active profile' } });
  control(details(), 'description', 'input').props.onChange({ target: { value: 'Active role' } });
  assert.equal(await h.editor.save(), true);
  const active = { ...ui.configs[0], candidates: [{ ...fast, name: 'My active profile', model: 'm2', effort: 'max', description: 'Active role' }] };
  assert.deepEqual(h.current().value.ui, { ...ui, configs: [active, ui.configs[1]] });

  render().find(node => node?.props?.['data-workspace-nav'] === 'pool').props.onClick();
  assert.equal(cards(pool(), 'data-pool-candidate').length, 1);
  assert.equal(cards(pool(), 'data-candidate').length, 0);
  assert.equal(action(pool(), 'addCandidate'), undefined);
  assert.equal(control(pool(), 'defaultCandidate'), undefined);
  action(pool(), 'remove').props.onClick();
  assert.equal(await h.editor.save(), true);
  assert.deepEqual(h.current().value.ui, { ...ui, candidates: [], configs: [active, ui.configs[1]] });
  action(pool(), 'addPoolCandidate').props.onClick();
  assert.equal(await h.editor.save(), false); // An incomplete pool card must not autosave.
  control(pool(), 'poolName', 'input').props.onChange({ target: { value: 'New draft-pool profile' } });
  control(pool(), 'chooseModel').props.onChange({ target: { value: fullCatalog[2] } });
  assert.equal(await h.editor.save(), true);
  const saved = h.current().value.ui;
  assert.deepEqual(saved.configs, [active, ui.configs[1]]);
  assert.deepEqual(saved.candidates, [{ id: 'candidate-1', name: 'New draft-pool profile', provider: 'p', model: 'plain', effort: null, description: '' }]);
});

test('candidate cap of 128 is enforced on the add button and editor', async () => {
  for (const length of [127, 128]) {
    const ui = { ...copy(plugin.emptyDraft()), candidates: Array.from({ length }, (_, index) => ({ ...candidates()[0], id: 'custom-' + index })) };
    const h = harness({ ui }); const before = copy(h.editor.getSnapshot());
    if (length === 128) { assert.equal(button(h, 'addCandidate').props.disabled, true); assert.equal(h.editor.addCandidate(), false); assert.deepEqual(copy(h.editor.getSnapshot()), before); }
    else { assert.equal(h.editor.addCandidate(), true); assert.equal(h.editor.getSnapshot().draft.candidates.length, 128); }
    h.dispose();
  }
});

test('candidate controls keep reset, dirty and conflict protections', async () => {
  const h = harness({ ui: copy(plugin.emptyDraft()) }); button(h, 'addCandidate').props.onClick();
  const source = field(h, 'chooseModel'), effort = field(h, 'effort'), add = button(h, 'addCandidate'), before = copy(h.editor.getSnapshot().draft);
  h.editor.resetConnection(); source.props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm2' }) } }); effort.props.onChange({ target: { value: JSON.stringify('deep') } }); add.props.onClick();
  assert.deepEqual(copy(h.editor.getSnapshot().draft), before); assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0);
  await h.editor.reload(); assert.deepEqual(copy(h.editor.getSnapshot().draft.candidates), []);
  button(h, 'addCandidate').props.onClick(); h.change({ revision: 8 });
  assert.equal(h.editor.getSnapshot().conflicted, true); assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
});
