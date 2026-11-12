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
const presets = () => [
  { id: 'fast', name: 'Fast edit', provider: 'p', model: 'm1', effort: 'brief', description: 'Small edits' },
  { id: 'deep', name: 'Deep analysis', provider: 'p', model: 'm1', effort: 'deep', description: 'Detailed analysis' }
];
const nativeCatalog = () => ({ groups: [{ id: 'p', models: [
  { id: 'm1', reasoning: { efforts: [{ id: 'brief', name: 'Brief' }, { id: 'deep', name: 'Deep' }], defaultEffort: 'brief' } },
  { id: 'm2', reasoning: { efforts: [{ id: 'deep', name: 'Deep' }, { id: 'max', name: 'Maximum' }], defaultEffort: 'deep' } }
] }], failures: [] });
function harness(value = { ui: { ...copy(plugin.emptyDraft()), presets: presets() } }) {
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
        const user = { ...snapshot.user, ui: copy(ops[1].value) }; delete user.policy;
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
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}
const page = h => flatten(plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t, view: 'page' }));
const field = (h, key, type = 'select') => page(h).find(node => node?.type === type && node.props['aria-label'] === t(key));
const button = (h, key) => page(h).find(node => node?.type === 'button' && node.props.children.includes(t(key)));
const legacy = () => ({ enabled: true, models: [{ id: 'old', provider: 'p', model: 'm1', efforts: ['brief', 'deep'], defaultEffort: 'deep', guidance: 'Old description', extraModelData: 'retained until save' }], defaultModel: 'old',
  rules: [{ id: 'must-block', kind: 'constraint', enabled: true, when: { fact: 'payload.backend', op: 'eq', value: 'spawn' }, effect: { denyModels: ['old'] } }, { id: 'preference', kind: 'preference', effect: { preferModel: 'old' } }],
  lanes: [{ id: 'hard', models: ['old'] }], review: { preferDifferentModel: true }, guidance: { enabled: true }, unknownLegacyField: 'explicitly removed' });
test('same model supports named presets with one effort and no automatic default', async () => {
  const h = harness(); await h.catalog.load(); const before = h.current();
  assert.equal(h.editor.getSnapshot().draft.defaultPreset, undefined);
  assert.deepEqual(page(h).filter(node => node?.type === 'select' && node.props['aria-label'] === t('effort')).map(node => node.props.value), [JSON.stringify('brief'), JSON.stringify('deep')]);
  assert.equal(page(h).some(node => node?.props?.['data-lane']), false); assert.equal(plugin.LANE_IDS, undefined); assert.equal(plugin.laneEfforts, undefined);
  field(h, 'defaultPreset').props.onChange({ target: { value: 'deep' } }); field(h, 'enabled', 'input').props.onChange({ target: { checked: true } });
  assert.deepEqual(h.current(), before); assert.equal(await h.editor.save(), true);
  assert.deepEqual(h.current().value.ui.presets, presets()); assert.equal(h.current().value.ui.defaultPreset, 'deep');
  assert.equal(Object.hasOwn(h.current().value.ui, 'teams'), false); h.dispose();
});

test('names do not rename stable ids, and deleting a default requires an explicit replacement or clear', async () => {
  const h = harness({ ui: { ...copy(plugin.emptyDraft()), presets: presets(), defaultPreset: 'fast' } });
  assert.equal(field(h, 'id', 'input'), undefined); assert.ok(page(h).some(node => node?.type === 'code' && node.props['aria-label'] === t('id')));
  field(h, 'name', 'input').props.onChange({ target: { value: 'renamed' } });
  assert.equal(h.editor.getSnapshot().draft.presets[0].id, 'fast'); assert.equal(h.editor.getSnapshot().draft.defaultPreset, 'fast'); assert.equal(await h.editor.save(), true);
  button(h, 'remove').props.onClick(); assert.equal(h.editor.getSnapshot().draft.defaultPreset, 'fast'); assert.equal(await h.editor.save(), false);
  field(h, 'defaultPreset').props.onChange({ target: { value: 'deep' } }); assert.equal(await h.editor.save(), true);
  button(h, 'remove').props.onClick();
  assert.equal(h.editor.getSnapshot().draft.defaultPreset, 'deep'); assert.equal(await h.editor.save(), false);
  field(h, 'defaultPreset').props.onChange({ target: { value: '' } });
  assert.equal(h.editor.getSnapshot().draft.defaultPreset, undefined); assert.equal(await h.editor.save(), true); h.dispose();
});

test('empty lists and duplicate ids cannot enable routing or accept forged defaults', async () => {
  const h = harness({ ui: copy(plugin.emptyDraft()) });
  field(h, 'enabled', 'input').props.onChange({ target: { checked: true } }); assert.equal(await h.editor.save(), false);
  assert.equal(h.mutations.length, 0); field(h, 'defaultPreset').props.onChange({ target: { value: 'invented' } });
  assert.equal(h.editor.getSnapshot().draft.defaultPreset, undefined);
  h.editor.edit(next => { next.presets = presets(); next.presets[1].id = 'fast'; });
  field(h, 'defaultPreset').props.onChange({ target: { value: 'fast' } }); assert.equal(h.editor.getSnapshot().draft.defaultPreset, undefined);
  assert.equal(await h.editor.save(), false); h.dispose();
});

test('deprecated v2 policy alias becomes canonical ui through an atomic save without touching audit settings', async () => {
  const h = harness({ policy: { ...copy(plugin.emptyDraft()), presets: presets() }, auditFile: 'C:/isolated/router.jsonl' });
  assert.equal(h.editor.getSnapshot().migration, undefined); assert.ok(page(h).includes(t('policySource')));
  assert.match(plugin.dictionaries.en.policySource, /deprecated policy read alias, not an advanced mode.*atomically removes policy.*canonical ui/);
  assert.match(plugin.dictionaries.zh.policySource, /已弃用的 policy 读取兼容别名.*并非高级模式.*原子移除 policy.*规范入口 ui/);
  field(h, 'name', 'input').props.onChange({ target: { value: 'Changed name' } });
  assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1);
  assert.deepEqual(h.mutations[0].ops.map(op => [op.op, op.path]), [['unset', ['policy']], ['set', ['ui']]]);
  assert.equal(h.current().value.policy, undefined); assert.equal(h.current().value.auditFile, 'C:/isolated/router.jsonl'); h.dispose();
});

test('deprecated alias copy does not block disabling and canonically saving existing v2 presets', async () => {
  const original = { ...copy(plugin.emptyDraft()), enabled: true, presets: presets(), defaultPreset: 'fast', retainedField: { exact: 'source value' } };
  original.presets[0].retainedPresetField = 'preset value';
  const h = harness({ policy: original, auditFile: 'C:/audit/retained.jsonl' }), before = h.current();
  assert.equal(h.editor.getSnapshot().configurationIssue, undefined); assert.equal(field(h, 'enabled', 'input').props.disabled, false);
  field(h, 'enabled', 'input').props.onChange({ target: { checked: false } });
  assert.deepEqual(h.current(), before); assert.equal(await h.editor.save(), true);
  assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 7);
  assert.deepEqual(h.mutations[0].ops.map(op => [op.op, op.path]), [['unset', ['policy']], ['set', ['ui']]]);
  assert.deepEqual(h.mutations[0].ops[1].value, { ...original, enabled: false });
  assert.equal(h.current().user.policy, undefined); assert.equal(h.current().value.auditFile, before.value.auditFile);
  assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.editor.getSnapshot().savedButNotLive, false); h.dispose();
});

test('legacy originals use the shared readonly issue without conversion controls in either language', async () => {
  for (const source of ['ui', 'policy']) for (const version of [undefined, 1]) {
    const original = { ...legacy(), ...(version ? { schemaVersion: version } : {}) }, h = harness({ [source]: original, auditFile: 'C:/audit.jsonl' }), before = h.current();
    assert.equal(h.editor.getSnapshot().migrationRequired, true);
    assert.equal(h.editor.getSnapshot().configurationIssue.code, 'LEGACY_CONFIGURATION');
    assert.deepEqual(copy(h.editor.getSnapshot().configurationIssue.original), original);
    assert.notEqual(h.editor.getSnapshot().configurationIssue.original, h.editor.host.value[source]);
    for (const language of ['zh', 'en']) {
      const dictionary = plugin.dictionaries[language], translate = key => dictionary[key] ?? key;
      const nodes = flatten(plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t: translate, view: 'page' }));
      assert.ok(nodes.includes('LEGACY_CONFIGURATION')); assert.ok(nodes.includes(dictionary.legacyConfiguration));
      assert.ok(nodes.includes(dictionary.configurationOriginal)); assert.ok(nodes.includes(JSON.stringify(original, null, 2)));
      assert.equal(nodes.some(node => node?.type === 'button' && /migrat|迁移/.test(node.props.children.join(''))), false);
      assert.equal(nodes.some(node => node?.type === 'input' && /confirm|确认/.test(node.props['aria-label'] ?? '')), false);
      for (const key of ['migrationPreview', 'ackRemoval', 'ackConstraints', 'migrate', 'migrationPlanned', 'mappingHelp', 'removedFields', 'hardConstraints']) assert.equal(dictionary[key], undefined);
    }
    assert.equal(field(h, 'enabled', 'input').props.disabled, true); assert.equal(button(h, 'retry'), undefined);
    assert.equal(h.editor.startMigration, undefined); assert.equal(h.editor.acknowledge, undefined);
    assert.equal(plugin.migrationDraft, undefined); assert.equal(plugin.migrationInfo, undefined);
    assert.equal(h.editor.addPreset(), false); assert.equal(h.editor.addDefaultPresets(), false);
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false); assert.equal(await h.editor.save(), false);
    await h.catalog.load(); await h.editor.reload(); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.deepEqual(h.current(), before); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('only an explicit native replacement releases legacy readonly quarantine after reload', async () => {
  const original = legacy(), h = harness({ policy: original });
  h.editor.resetConnection(); await h.editor.reload();
  assert.equal(h.editor.getSnapshot().configurationIssue.code, 'LEGACY_CONFIGURATION');
  assert.equal(h.editor.edit(next => { next.enabled = true; }), false);
  const replacement = { ...copy(plugin.emptyDraft()), presets: presets(), extraSourceField: 'retain' };
  h.change({ revision: 8, user: { ui: replacement }, value: { ui: replacement } });
  await h.editor.reload(); assert.equal(h.editor.getSnapshot().configurationIssue, undefined);
  assert.equal(h.editor.getSnapshot().migrationRequired, false);
  field(h, 'description', 'input').props.onChange({ target: { value: 'manual v2 edit' } });
  assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 8);
  assert.equal(h.mutations[0].ops[1].value.extraSourceField, 'retain'); h.dispose();
});

test('legacy effective or hidden raw sources fence stale callbacks and preserve dirty v2 drafts', async () => {
  for (const hidden of [false, true]) for (const source of ['ui', 'policy']) {
    const h = harness(); await h.catalog.load();
    const name = field(h, 'name', 'input'), model = field(h, 'chooseModel'), effort = field(h, 'effort');
    field(h, 'description', 'input').props.onChange({ target: { value: 'retain dirty draft' } });
    const draft = copy(h.editor.getSnapshot().draft), original = legacy();
    const value = hidden ? h.current().value : { [source]: original };
    h.change({ revision: 8, user: { [source]: original }, value });
    assert.equal(h.editor.getSnapshot().configurationIssue.code, 'LEGACY_CONFIGURATION');
    assert.deepEqual(copy(h.editor.getSnapshot().configurationIssue.original), original);
    name.props.onChange({ target: { value: 'stale' } });
    model.props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm2' }) } });
    effort.props.onChange({ target: { value: JSON.stringify('deep') } });
    assert.deepEqual(copy(h.editor.getSnapshot().draft), draft); assert.equal(await h.editor.save(), false);
    h.editor.resetConnection(); assert.equal(await h.editor.save(), false); await h.editor.reload();
    assert.equal(h.editor.getSnapshot().configurationIssue.code, 'LEGACY_CONFIGURATION');
    assert.equal(h.editor.addPreset(), false); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('reset fences stale preset edits without discarding drafts', () => {
  const h = harness(), name = field(h, 'name', 'input'); h.editor.edit(next => { next.presets[0].description = 'dirty'; }); h.editor.resetConnection();
  const retained = copy(h.editor.getSnapshot().draft); name.props.onChange({ target: { value: 'stale' } }); assert.deepEqual(copy(h.editor.getSnapshot().draft), retained); h.dispose();
});

test('simultaneous sources cannot be merged or overwritten', async () => {
  const h = harness({ ui: { ...copy(plugin.emptyDraft()), presets: presets() }, policy: legacy() });
  assert.ok(page(h).includes(t('sourceConflict'))); button(h, 'addPreset').props.onClick(); assert.equal(h.editor.getSnapshot().dirty, false);
  assert.equal(h.editor.startMigration, undefined); assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
});

test('enabled Team originals are readonly and cannot be migrated, edited or saved', async () => {
  for (const source of ['ui', 'policy']) for (const original of [
    { ...copy(plugin.defaults()), enabled: true, teams: { enabled: true } },
    { ...legacy(), schemaVersion: 1, teams: { enabled: true } }
  ]) {
    const h = harness({ [source]: original, auditFile: 'C:/audit/retained.jsonl' }), before = h.current();
    await h.catalog.load();
    const state = h.editor.getSnapshot(), nodes = page(h);
    assert.equal(state.configurationIssue.code, 'TEAM_ROUTING_REMOVED');
    assert.match(state.configurationIssue.message, /Back up.*native settings/);
    assert.deepEqual(copy(state.configurationIssue.original), original);
    assert.ok(nodes.includes('TEAM_ROUTING_REMOVED')); assert.ok(nodes.includes(t('teamRemoved')));
    assert.ok(nodes.includes(JSON.stringify(original, null, 2)));
    assert.equal(nodes.some(node => node?.type === 'input' && /Team/.test(node.props['aria-label'] ?? '')), false);
    assert.equal(button(h, 'migrate'), undefined); assert.equal(field(h, 'ackRemoval', 'input'), undefined);
    assert.equal(button(h, 'retry'), undefined); assert.equal(button(h, 'addPreset').props.disabled, true);
    field(h, 'enabled', 'input').props.onChange({ target: { checked: true } });
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false);
    assert.equal(h.editor.addPreset(), false); assert.equal(h.editor.addDefaultPresets(), false);
    assert.equal(h.editor.acknowledge, undefined); assert.equal(h.editor.startMigration, undefined);
    assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.equal(h.mutations.length, 0); assert.deepEqual(h.current(), before); h.dispose();
  }
});

test('stale catalog callbacks cannot mutate a newly quarantined Team configuration', async () => {
  const h = harness(); await h.catalog.load();
  const name = field(h, 'name', 'input'), model = field(h, 'chooseModel'), effort = field(h, 'effort');
  const original = { ...copy(h.current().value.ui), teams: { enabled: true } };
  h.change({ revision: 8, user: { ui: original }, value: { ui: original } });
  const before = copy(h.editor.getSnapshot());
  name.props.onChange({ target: { value: 'stale' } });
  model.props.onChange({ target: { value: JSON.stringify(['p', 'm2']) } });
  effort.props.onChange({ target: { value: JSON.stringify('deep') } });
  assert.deepEqual(copy(h.editor.getSnapshot()), before); assert.equal(await h.editor.save(), false);
  assert.equal(h.mutations.length, 0); h.dispose();
});

test('exact false compatibility is omitted only on canonical save without changing original settings', async () => {
  for (const source of ['ui', 'policy']) {
    const original = { ...copy(plugin.emptyDraft()), presets: presets(), teams: { enabled: false } };
    const h = harness({ [source]: original }), before = h.current();
    assert.equal(h.editor.getSnapshot().configurationIssue, undefined);
    assert.equal(Object.hasOwn(h.editor.getSnapshot().draft, 'teams'), false); assert.deepEqual(h.current(), before);
    field(h, 'description', 'input').props.onChange({ target: { value: 'explicit edit' } });
    assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 7);
    assert.equal(Object.hasOwn(h.mutations[0].ops[1].value, 'teams'), false); h.dispose();
  }
});

test('malformed v2 sources remain read-only instead of crashing or saving empty replacements', async () => {
  for (const value of [ { schemaVersion: 2, presets: 'broken' }, { schemaVersion: 2, presets: [null] }, { schemaVersion: 2, teams: null }, { schemaVersion: 9 }, null, 'not an object' ]) {
    const h = harness({ ui: value }), before = h.current();
    assert.ok(page(h).includes(t('invalidSource'))); assert.equal(button(h, 'addPreset').props.disabled, true);
    button(h, 'addPreset').props.onClick(); assert.equal(await h.editor.save(), false);
    assert.equal(h.mutations.length, 0); assert.deepEqual(h.current(), before); h.dispose();
  }
});

test('both languages expose responsive native controls and honest capability boundaries', () => {
  const h = harness();
  for (const language of ['zh', 'en']) {
    const dictionary = plugin.dictionaries[language], translate = key => dictionary[key] ?? key;
    const nodes = flatten(plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t: translate, view: 'page' }));
    for (const key of ['title', 'name', 'description', 'effort', 'defaultPreset', 'authority', 'advanced', 'executionEvidence']) assert.ok(nodes.includes(dictionary[key]), key);
    assert.ok(nodes.filter(node => node?.type === 'button').every(node => node.props.style.minHeight >= 44));
    assert.ok(nodes.filter(node => ['fieldset', 'section'].includes(node?.type)).every(node => node.props.style.minWidth === 0));
    if (language === 'zh') { assert.match(dictionary.authority, /仅传文本，不转发图片/); assert.match(dictionary.executionEvidence, /保存或列出.*不会执行.*不能证明.*实际路由.*router_status/); }
    else { assert.match(dictionary.authority, /text-only.*does not forward images/); assert.match(dictionary.executionEvidence, /Saving or listing.*does not execute.*prove actual child routing.*router_status/); }
    for (const key of ['evidence', 'evidenceHelp', 'evidenceSelected', 'evidenceAccepted', 'evidenceObserved', 'evidenceSettled', 'evidenceUnknown']) assert.equal(dictionary[key], undefined);
    const root = plugin.RouterPage({ editor: h.editor, catalog: h.catalog, t: translate, view: 'page' });
    assert.ok(root.props.children.some(node => node?.type === 'p' && node.props.children.includes(dictionary.executionEvidence)));
  }
  assert.equal(h.mutations.length, 0); h.dispose();
});

test('ack normalization fills only descriptions and documented defaults, not routes or unknown extras', () => {
  const base = { schemaVersion: 2, enabled: false, presets: [presets()[0]] }; delete base.presets[0].description;
  assert.deepEqual(copy(plugin.normalizeAckUi(base)), { ...copy(plugin.emptyDraft()), presets: [{ ...presets()[0], description: '' }] });
  const changed = copy(base); changed.presets[0].effort = null; assert.notDeepEqual(copy(plugin.normalizeAckUi(base)), copy(plugin.normalizeAckUi(changed)));
  changed.presets[0].effort = 'brief'; changed.presets[0].unknown = []; assert.notDeepEqual(copy(plugin.normalizeAckUi(base)), copy(plugin.normalizeAckUi(changed)));
});

test('new configuration shows inherited Low High Max and High default without claiming catalog validation', async () => {
  const h = harness({}); const before = h.current();
  const sourcePickers = page(h).filter(node => node?.type === 'select' && node.props['aria-label'] === t('chooseModel'));
  assert.equal(sourcePickers.length, 3);
  for (const picker of sourcePickers) {
    assert.equal(picker.props.value, plugin.PARENT_MODEL_KEY); assert.equal(picker.props.disabled, false);
    const first = flatten(picker).find(node => node?.type === 'option');
    assert.equal(first.props.value, plugin.PARENT_MODEL_KEY); assert.ok(first.props.children.includes(t('inheritModel')));
  }
  assert.equal(field(h, 'defaultPreset').props.value, 'default-high');
  assert.deepEqual(page(h).filter(node => node?.type === 'select' && node.props['aria-label'] === t('effort')).map(node => node.props.value), ['"low"', '"high"', '"max"']);
  assert.ok(page(h).includes(t('inheritHelp'))); assert.ok(page(h).includes(t('inheritEffortHelp')));
  assert.equal(page(h).includes(t('noReasoning')), false); assert.equal(h.editor.getSnapshot().dirty, false);
  const response = nativeCatalog(); response.default = { provider: 'global-provider', model: 'global-model', reasoningEffort: 'deep' };
  h.response(response); await h.catalog.load(); assert.deepEqual(h.catalogCalls, [[]]);
  assert.deepEqual(copy(h.editor.getSnapshot().draft), copy(plugin.defaults()));
  assert.doesNotMatch(JSON.stringify(page(h)), /global-provider|global-model/);
  assert.deepEqual(h.current(), before); assert.equal(h.mutations.length, 0); h.dispose();
});

test('each inherited preset can fix a catalog model and switch back without changing its exact effort or other presets', async () => {
  const h = harness({}); await h.catalog.load(); const originals = copy(h.editor.getSnapshot().draft.presets);
  const inheritedEffort = field(h, 'effort');
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm2' }) } });
  let draft = copy(h.editor.getSnapshot().draft);
  assert.deepEqual(draft.presets[0], { id: 'default-low', name: 'Low', provider: 'p', model: 'm2', effort: 'low', description: originals[0].description });
  assert.deepEqual(draft.presets.slice(1), originals.slice(1)); assert.equal(draft.defaultPreset, 'default-high');
  const retained = flatten(field(h, 'effort')).find(node => node?.type === 'option' && node.props.value === '"low"');
  assert.equal(retained.props.disabled, true); // Model m2 has no low; selecting it cannot silently downgrade or upgrade the preset.
  inheritedEffort.props.onChange({ target: { value: '"high"' } }); assert.deepEqual(copy(h.editor.getSnapshot().draft), draft);
  field(h, 'effort').props.onChange({ target: { value: '"max"' } });
  const staleFixedEffort = field(h, 'effort'), staleFixedModel = field(h, 'chooseModel');
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.PARENT_MODEL_KEY } });
  draft = copy(h.editor.getSnapshot().draft);
  assert.deepEqual(draft.presets[0], { ...originals[0], effort: 'max' });
  staleFixedEffort.props.onChange({ target: { value: '"deep"' } });
  staleFixedModel.props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm1' }) } });
  assert.deepEqual(copy(h.editor.getSnapshot().draft), draft);
  assert.equal(await h.editor.save(), true);
  assert.equal(h.current().value.ui.presets[0].modelSource, 'parent'); assert.equal(h.current().value.ui.presets[0].provider, undefined);
  assert.equal(h.current().value.ui.presets[0].model, undefined); h.dispose();
});

test('inheritance remains available offline and only explicit template effort changes are permitted', async () => {
  const h = harness(), original = copy(h.editor.getSnapshot().draft.presets[0]);
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.PARENT_MODEL_KEY } });
  const draft = copy(h.editor.getSnapshot().draft), inherited = draft.presets[0];
  assert.equal(inherited.effort, original.effort); assert.equal(inherited.modelSource, 'parent');
  assert.equal(Object.hasOwn(inherited, 'provider'), false); assert.equal(Object.hasOwn(inherited, 'model'), false);
  const retained = flatten(field(h, 'effort')).find(node => node?.type === 'option' && node.props.value === JSON.stringify(original.effort));
  assert.equal(retained.props.disabled, true); assert.ok(retained.props.children.some(text => typeof text === 'string' && text.includes(t('retainedEffort'))));
  for (const value of ['"default"', '"invented"', 'null']) field(h, 'effort').props.onChange({ target: { value } });
  assert.deepEqual(copy(h.editor.getSnapshot().draft), draft);
  field(h, 'chooseModel').props.onChange({ target: { value: plugin.modelKey({ provider: 'p', model: 'm1' }) } });
  assert.deepEqual(copy(h.editor.getSnapshot().draft), draft); // No successful catalog yet.
  field(h, 'effort').props.onChange({ target: { value: '"max"' } });
  assert.equal(h.editor.getSnapshot().draft.presets[0].effort, 'max');
  assert.equal(await h.editor.save(), true); h.dispose();
});

test('existing inherited custom or null efforts survive catalog changes and do not imply effort-less parent metadata', async () => {
  for (const effort of ['provider-custom', null]) {
    const ui = copy(plugin.defaults()); ui.presets[0].effort = effort;
    const h = harness({ ui }), before = copy(h.editor.getSnapshot().draft);
    await h.catalog.load(); h.response({ groups: [], failures: [] }); await h.catalog.load();
    assert.deepEqual(copy(h.editor.getSnapshot().draft), before); assert.equal(h.editor.getSnapshot().dirty, false);
    const retained = flatten(field(h, 'effort')).find(node => node?.type === 'option' && node.props.value === JSON.stringify(effort));
    assert.equal(retained.props.disabled, true); assert.equal(page(h).includes(t('noReasoning')), false);
    field(h, 'description', 'input').props.onChange({ target: { value: 'Edited only description' } });
    assert.equal(await h.editor.save(), true); assert.equal(h.current().value.ui.presets[0].effort, effort); h.dispose();
  }
});

test('adding defaults is idempotent and preserves colliding custom IDs, order, enablement and default choice', async () => {
  for (const selected of [undefined, 'default-high']) {
    const custom = { ...presets()[0], id: 'default-high', name: 'Customized High' };
    const h = harness({ ui: { ...copy(plugin.emptyDraft()), presets: [custom], ...(selected ? { defaultPreset: selected } : {}) } });
    const before = h.current(); button(h, 'addDefaults').props.onClick();
    const draft = copy(h.editor.getSnapshot().draft);
    assert.deepEqual(draft.presets, [custom, ...copy(plugin.createDefaultPresets()).filter(preset => preset.id !== custom.id)]);
    assert.equal(draft.defaultPreset, selected); assert.equal(draft.enabled, false); assert.equal(Object.hasOwn(draft, 'teams'), false);
    assert.deepEqual(h.current(), before); assert.equal(h.mutations.length, 0);
    assert.equal(await h.editor.save(), true); const saved = copy(h.editor.getSnapshot());
    assert.equal(button(h, 'addDefaults').props.disabled, true); assert.equal(h.editor.addDefaultPresets(), false);
    assert.deepEqual(copy(h.editor.getSnapshot()), saved); assert.equal(h.mutations.length, 1); h.dispose();
  }
});

test('default insertion is atomic at the preset bound and empty lists stay empty until explicit insertion', () => {
  const empty = harness({ ui: copy(plugin.emptyDraft()) });
  assert.deepEqual(copy(empty.editor.getSnapshot().draft.presets), []); assert.equal(field(empty, 'defaultPreset').props.value, '');
  button(empty, 'addDefaults').props.onClick(); assert.deepEqual(copy(empty.editor.getSnapshot().draft.presets), copy(plugin.createDefaultPresets()));
  assert.equal(empty.editor.getSnapshot().draft.defaultPreset, undefined); assert.equal(empty.mutations.length, 0); empty.dispose();
  for (const length of [126, 128]) {
    const h = harness({ ui: { ...copy(plugin.emptyDraft()), presets: Array.from({ length }, (_, index) => ({ ...presets()[0], id: 'custom-' + index })) } });
    const before = copy(h.editor.getSnapshot()); assert.equal(button(h, 'addDefaults').props.disabled, true);
    assert.equal(h.editor.addDefaultPresets(), false); assert.deepEqual(copy(h.editor.getSnapshot()), before);
    if (length === 128) { assert.equal(button(h, 'addPreset').props.disabled, true); assert.equal(h.editor.addPreset(), false); }
    h.dispose();
  }
});

test('inherited controls and default insertion keep migration, reset, dirty and conflict protections', async () => {
  const old = harness({ ui: legacy() }), beforeLegacy = old.current();
  assert.equal(button(old, 'addDefaults').props.disabled, true); assert.equal(old.editor.addDefaultPresets(), false);
  assert.deepEqual(old.current(), beforeLegacy); assert.equal(old.editor.getSnapshot().dirty, false); old.dispose();
  const h = harness({ ui: copy(plugin.emptyDraft()) }); button(h, 'addDefaults').props.onClick();
  const source = field(h, 'chooseModel'), effort = field(h, 'effort'), add = button(h, 'addPreset'), before = copy(h.editor.getSnapshot().draft);
  h.editor.resetConnection(); source.props.onChange({ target: { value: plugin.PARENT_MODEL_KEY } }); effort.props.onChange({ target: { value: '"max"' } }); add.props.onClick();
  assert.deepEqual(copy(h.editor.getSnapshot().draft), before); assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0);
  await h.editor.reload(); assert.deepEqual(copy(h.editor.getSnapshot().draft.presets), []);
  button(h, 'addDefaults').props.onClick(); h.change({ revision: 8 });
  assert.equal(h.editor.getSnapshot().conflicted, true); assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
});
