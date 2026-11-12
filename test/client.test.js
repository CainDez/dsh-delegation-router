import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createDefaultPresets, DEFAULT_PRESET_ID } from '../src/default-presets.js';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
let definition;
const React = {
  Fragment: 'fragment',
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  useState: value => [value, () => {}],
  useRef: value => ({ current: value }),
  useEffect: () => {}
};
vm.runInNewContext(source, { setTimeout, clearTimeout, window: { __ModuleLoader__: { load: entry => { definition = entry; } }, confirm: () => true } });
assert.equal(definition.id, 'dsh-delegation-router');
const plugin = definition.factory(name => { assert.equal(name, 'react'); return React; });
const copy = value => JSON.parse(JSON.stringify(value));
const t = key => plugin.dictionaries.zh[key] ?? key;
const seed = editor => editor.edit(next => Object.assign(next, { ...copy(plugin.defaults()), presets: [{ id: 'fast', name: 'Fast', provider: 'p', model: 'm', effort: 'low', description: 'Formatting' }, { id: 'deep', name: 'Deep', provider: 'p', model: 'm', effort: 'high', description: 'Detailed analysis' }], defaultPreset: 'fast' }));
function host(options = {}) {
  let snapshot = { status: 'ready', writable: true, revision: 2, value: { ui: copy(plugin.defaults()) }, user: {}, ...options };
  const subscribers = new Set(); const events = new Map(); const mutations = []; const disposers = [], registrations = [], dictionaries = [];
  let nextSnapshot; let loads = 0;
  const notify = () => { for (const fn of subscribers) fn(); };
  const form = { getSnapshot: () => snapshot, subscribe: fn => { subscribers.add(fn); return () => subscribers.delete(fn); }, mutate() { throw Error('boolean-only API would discard original host diagnostic'); } };
  const ctx = {
    configForms: {
      get: id => { assert.equal(id, 'delegation-router'); return form; },
      describe: () => ({ async load() { loads++; if (nextSnapshot) { snapshot = nextSnapshot; nextSnapshot = undefined; notify(); } } })
    },
    remote: { settings: { async mutate(ns, ops, revision) {
      mutations.push({ ns, ops: copy(ops), revision });
      const value = { ui: copy(ops[1].value) };
      nextSnapshot = { status: 'ready', writable: true, revision: revision + 1, value, user: copy(value) };
      return { ok: true, value: { ns, revision: revision + 1, value } };
    } } },
    locale: { bind: ns => { assert.equal(ns, 'delegationRouter'); return t; }, register: (ns, value) => { dictionaries.push({ ns, value }); return () => dictionaries.pop(); } },
    slots: { inject: (_name, fn) => fn(), register: (meta, component) => { registrations.push({ meta, component }); return () => registrations.splice(registrations.findIndex(row => row.meta === meta), 1); } },
    on: (name, fn) => { events.set(name, fn); disposers.push(() => events.delete(name)); },
    effect: fn => { const off = fn(); disposers.push(off); return off; }
  };
  const editor = new plugin.RouterEditor(ctx, t);
  return { ctx, editor, mutations, registrations, dictionaries, subscribers, events, form, loads: () => loads, current: () => snapshot, change(value) { snapshot = { ...snapshot, ...value }; notify(); }, queue(value) { nextSnapshot = value; }, dispose() { editor.dispose(); for (const off of disposers.reverse()) off(); } };
}
function flatten(node) {
  if (node === null || node === undefined || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'string' || typeof node === 'number') return [node];
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}

test('actual module registers both exact configuration slots and cleans all contributions', () => {
  const h = host();
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale', 'configForms', 'remote', 'remote.settings', 'remote.session']);
  plugin.apply(h.ctx);
  assert.deepEqual(h.registrations.map(row => copy(row.meta)), [
    { name: 'plugins.bundle.config', key: 'dsh-delegation-router' },
    { name: 'plugins.row.config', key: 'dsh-delegation-router#delegation-router' }
  ]);
  assert.equal(h.dictionaries.length, 1); assert.equal(h.subscribers.size, 2); assert.ok(h.events.has('connection/reset'));
  h.dispose(); assert.equal(h.subscribers.size, 0); assert.equal(h.registrations.length, 0); assert.equal(h.dictionaries.length, 0); assert.equal(h.events.size, 0);
});

test('preset editing changes only the detached draft and never enables routing or Team', () => {
  const h = host(), before = copy(h.current().value); seed(h.editor);
  const draft = h.editor.getSnapshot().draft;
  assert.equal(draft.enabled, false); assert.equal(Object.hasOwn(draft, 'teams'), false);
  assert.deepEqual(Array.from(draft.presets, item => item.effort), ['low', 'high']);
  assert.deepEqual(copy(h.current().value), before); assert.equal(h.mutations.length, 0); assert.equal(h.editor.getSnapshot().dirty, true); h.dispose();
});

test('save sends one official atomic unset-policy/set-ui transaction and fixed revision, then waits for mirror', async () => {
  const h = host(); seed(h.editor); assert.equal(await h.editor.save(), true);
  assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].ns, 'delegation-router'); assert.equal(h.mutations[0].revision, 2);
  assert.deepEqual(h.mutations[0].ops.map(row => [row.op, row.path]), [['unset', ['policy']], ['set', ['ui']]]);
  assert.equal(h.loads(), 1); assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.editor.getSnapshot().dirty, false);
  h.dispose();
});

test('local and server revision conflicts retain draft without retries', async () => {
  const h = host(); seed(h.editor); const draft = JSON.stringify(h.editor.getSnapshot().draft);
  h.change({ revision: 3 }); assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0);
  assert.equal(h.editor.getSnapshot().conflicted, true); assert.equal(JSON.stringify(h.editor.getSnapshot().draft), draft);
  await h.editor.reload(); seed(h.editor);
  h.ctx.remote.settings.mutate = async () => ({ ok: false, error: { code: 'settings/conflict', message: 'expected revision 3, found 4' } });
  assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().error, 'expected revision 3, found 4'); assert.equal(h.editor.getSnapshot().dirty, true);
  assert.equal(h.editor.getSnapshot().conflicted, true); h.dispose();
});

test('host schema and busy refusal original messages survive with all edits intact', async () => {
  for (const message of ['effort must be an explicit advertised value', 'active work prevents policy switch']) {
    const h = host(); seed(h.editor); const before = JSON.stringify(h.editor.getSnapshot().draft);
    let count = 0; h.ctx.remote.settings.mutate = async () => { count++; return { ok: false, error: { code: 'settings/rejected', message } }; };
    assert.equal(await h.editor.save(), false); assert.equal(count, 1);
    assert.equal(h.editor.getSnapshot().error, message); assert.equal(JSON.stringify(h.editor.getSnapshot().draft), before);
    assert.equal(h.editor.getSnapshot().dirty, true); h.dispose();
  }
});

test('unavailable/loading/read-only states cannot edit or save', async () => {
  for (const options of [{ status: 'loading' }, { status: 'unavailable' }, { writable: false }]) {
    const h = host(options); seed(h.editor); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('legacy sources remain readonly through reload without conversion or writes', async () => {
  const legacy = { enabled: true, models: [{ id: 'old', provider: 'p', model: 'm', defaultEffort: 'low' }], rules: [], unknown: 'retain' };
  for (const source of ['ui', 'policy']) {
    const h = host({ value: { [source]: legacy } }); seed(h.editor);
    assert.equal(h.editor.getSnapshot().dirty, false); assert.equal(await h.editor.save(), false);
    assert.equal(h.mutations.length, 0); assert.equal(h.editor.startMigration, undefined); assert.equal(h.editor.acknowledge, undefined);
    assert.equal(h.editor.getSnapshot().migrationRequired, true);
    assert.equal(h.editor.getSnapshot().configurationIssue.code, 'LEGACY_CONFIGURATION');
    assert.deepEqual(copy(h.editor.getSnapshot().configurationIssue.original), legacy);
    assert.deepEqual(copy(h.current().value[source]), legacy);
    await h.editor.reload(); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.deepEqual(copy(h.editor.getSnapshot().configurationIssue.original), legacy);
    assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('accepted but unverified save blocks repeat mutation and preserves draft', async () => {
  const h = host(); seed(h.editor);
  h.ctx.remote.settings.mutate = async () => { h.mutations.push({}); return { ok: true, value: { revision: 3 } }; };
  assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().receiptUnverified, true);
  assert.equal(h.editor.getSnapshot().dirty, true); assert.match(h.editor.getSnapshot().error, /刷新/);
  assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 1); h.dispose();
});

test('late save settlement after dispose cannot publish or mutate another profile', async () => {
  const h = host(); seed(h.editor); let release;
  h.ctx.remote.settings.mutate = async () => await new Promise(resolve => { release = resolve; });
  const pending = h.editor.save(); assert.equal(h.editor.getSnapshot().saving, true); h.editor.dispose();
  release({ ok: true, value: { revision: 3 } }); assert.equal(await pending, false); assert.equal(h.loads(), 0); assert.equal(h.subscribers.size, 0);
});

test('schema-default-filled effective settings acknowledge the exact raw user write', async () => {
  const h = host(); seed(h.editor);
  h.editor.edit(draft => { delete draft.presets[0].description; delete draft.limits; delete draft.teams; });
  const desired = copy(h.editor.getSnapshot().draft);
  h.ctx.remote.settings.mutate = async () => {
    // Independent Host-schema fixture, not the function under test.
    const effective = copy(desired);
    effective.presets[0].description = '';
    effective.limits = { maxPendingStarts: 32, maxActivePerModel: 8, maxCreationsPerParent: 64, metadataTimeoutMs: 5000 };
    effective.teams = { enabled: false };
    h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value: { ui: effective } });
    return { ok: true, value: { revision: 3 } };
  };
  assert.equal(await h.editor.save(), true); assert.equal(h.editor.getSnapshot().receiptUnverified, false); assert.equal(h.editor.getSnapshot().savedButNotLive, false); h.dispose();
});

test('higher-layer effective policy, preset route and unknown additions are saved but not live', async () => {
  for (const override of [
    value => { value.policy = { enabled: true }; },
    value => { value.ui.enabled = true; },
    value => { value.ui.schemaVersion = 1; },
    value => { value.ui.teams = { enabled: true }; },
    value => { value.ui.teams = { enabled: false, extra: true }; },
    value => { value.ui.presets.push({ id: 'higher-preset' }); },
    value => { value.ui.presets[0].effort = 'high'; },
    value => { value.ui.presets[0].extra = []; },
    value => { value.ui.extra = false; }
  ]) {
    const h = host(); seed(h.editor); const desired = copy(h.editor.getSnapshot().draft);
    h.ctx.remote.settings.mutate = async () => {
      const value = { ui: copy(desired) }; override(value);
      h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value });
      return { ok: true, value: { revision: 3 } };
    };
    assert.equal(await h.editor.save(), false); const state = h.editor.getSnapshot();
    assert.equal(state.saved, false); assert.equal(state.savedButNotLive, true); assert.equal(state.receiptUnverified, false);
    assert.deepEqual(copy(state.draft), desired); assert.equal(state.dirty, false);
    assert.ok(flatten(plugin.RouterPage({ editor: h.editor, t })).includes(t('savedButNotLive')));
    h.dispose();
  }
});

test('failed reload retains draft and uncertain write fence until raw and effective verification succeeds', async () => {
  const h = host(); seed(h.editor); const desired = copy(h.editor.getSnapshot().draft);
  h.ctx.remote.settings.mutate = async () => { h.mutations.push({}); return { ok: true, value: { revision: 3 } }; };
  assert.equal(await h.editor.save(), false);
  const load = h.editor.mirror.load;
  h.editor.mirror.load = async () => { throw Error('refresh transport unavailable'); };
  await h.editor.reload();
  assert.equal(h.editor.getSnapshot().error, 'refresh transport unavailable');
  assert.equal(h.editor.getSnapshot().receiptUnverified, true); assert.deepEqual(copy(h.editor.getSnapshot().draft), desired);
  assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 1);
  h.editor.mirror.load = load;
  await h.editor.reload(); assert.equal(h.editor.getSnapshot().receiptUnverified, true); // A stale ready mirror is not evidence.
  h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value: { ui: desired } });
  await h.editor.reload(); assert.equal(h.editor.getSnapshot().receiptUnverified, false); assert.equal(h.editor.getSnapshot().saved, true); h.dispose();
});

test('raw enabled Team settings cannot be silently removed when an effective layer hides them', async () => {
  const original = { ...copy(plugin.defaults()), teams: { enabled: true } };
  const h = host({ user: { policy: original }, value: { ui: copy(plugin.defaults()) } });
  assert.equal(h.editor.getSnapshot().configurationIssue.code, 'TEAM_ROUTING_REMOVED');
  assert.deepEqual(copy(h.editor.getSnapshot().configurationIssue.original), original);
  assert.equal(h.editor.edit(next => { next.enabled = true; }), false);
  assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0); h.dispose();
});

test('hidden raw legacy sources stay readonly on initial load without dropping their unknown fields', async () => {
  for (const source of ['ui', 'policy']) for (const value of [{ ui: copy(plugin.defaults()) }, { policy: copy(plugin.defaults()) }]) {
    const original = { schemaVersion: 1, enabled: true, models: [{ id: 'old', customField: 'retain' }], rules: [{ effect: { denyModels: ['old'] } }], unknown: { retained: true } };
    const user = { [source]: original, auditFile: 'C:/audit/retained.jsonl' }, h = host({ user, value });
    const state = h.editor.getSnapshot(); assert.equal(state.migrationRequired, true);
    assert.equal(state.configurationIssue.code, 'LEGACY_CONFIGURATION'); assert.equal(state.configurationIssue.source, source);
    assert.deepEqual(copy(state.configurationIssue.original), original);
    assert.ok(flatten(plugin.RouterPage({ editor: h.editor, t })).includes(JSON.stringify(original, null, 2)));
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false); assert.equal(await h.editor.save(), false);
    await h.editor.reload(); assert.equal(h.editor.addPreset(), false); assert.deepEqual(copy(h.current().user), user);
    assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('raw conflicting or unsupported structures cannot be overwritten through a supported effective layer', async () => {
  for (const user of [
    { ui: copy(plugin.defaults()), policy: {} },
    { ui: { schemaVersion: 9 } }, { policy: { schemaVersion: 2, presets: 'broken' } }, { ui: null }
  ]) {
    const h = host({ user, value: { ui: copy(plugin.defaults()) } });
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false); assert.equal(await h.editor.save(), false);
    const state = h.editor.getSnapshot(); assert.ok(state.sourceConflict || state.invalidSource);
    assert.equal(h.mutations.length, 0); assert.deepEqual(copy(h.current().user), user); h.dispose();
  }
});

test('canonical save requires exact raw acknowledgement even for accepted legacy false compatibility', async () => {
  const h = host(); seed(h.editor); const desired = copy(h.editor.getSnapshot().draft);
  h.ctx.remote.settings.mutate = async () => {
    h.mutations.push({}); const raw = { ...copy(desired), teams: { enabled: false } };
    h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: raw }, value: { ui: desired } });
    return { ok: true };
  };
  assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().receiptUnverified, true);
  assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 1); h.dispose();
});

test('host refusal diagnostic survives a subsequent refresh failure', async () => {
  const h = host(); seed(h.editor);
  h.ctx.remote.settings.mutate = async () => ({ ok: false, error: { code: 'settings/rejected', message: 'host original validation diagnostic' } });
  h.editor.mirror.load = async () => { throw Error('secondary refresh failure'); };
  assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().error, 'host original validation diagnostic');
  assert.equal(h.editor.getSnapshot().dirty, true); h.dispose();
});

test('connection reset fences late save acknowledgments despite a colliding profile revision', async () => {
  const h = host(); plugin.apply(h.ctx);
  const page = h.registrations[0].component({ view: 'page' }); const editor = page.props.editor;
  seed(editor); const draft = copy(editor.getSnapshot().draft); let release;
  h.ctx.remote.settings.mutate = async () => await new Promise(resolve => { release = resolve; });
  const pending = editor.save(); h.events.get('connection/reset')();
  h.change({ revision: 2, user: {}, value: { ui: copy(plugin.defaults()) } });
  release({ ok: true, value: { revision: 3 } });
  assert.equal(await pending, false); assert.equal(h.loads(), 0);
  const state = editor.getSnapshot(); assert.equal(state.saved, false); assert.equal(state.conflicted, true); assert.equal(state.connectionReset, true);
  assert.deepEqual(copy(state.draft), draft); assert.equal(await editor.save(), false);
  const load = editor.mirror.load; editor.mirror.load = async () => { throw Error('still disconnected'); };
  await editor.reload(); assert.equal(editor.getSnapshot().receiptUnverified, true); assert.equal(editor.getSnapshot().connectionReset, true);
  editor.mirror.load = load; await editor.reload();
  assert.equal(editor.getSnapshot().conflicted, false); assert.equal(editor.getSnapshot().connectionReset, false); assert.equal(editor.getSnapshot().dirty, false);
  h.dispose();
});

test('connection reset during refresh fences the old continuation and preserves the draft', async () => {
  const h = host(); seed(h.editor); let release, reached;
  const refreshing = new Promise(resolve => { reached = resolve; });
  h.editor.mirror.load = async () => await new Promise(resolve => { release = resolve; reached(); });
  const pending = h.editor.save(); await refreshing;
  h.editor.resetConnection(); release();
  assert.equal(await pending, false); assert.equal(h.editor.getSnapshot().saved, false);
  assert.equal(h.editor.getSnapshot().conflicted, true); assert.equal(h.editor.getSnapshot().receiptUnverified, true); h.dispose();
});

test('adding one preset inherits the main model with a High template but never selects a default or writes', () => {
  const h = host({ value: { ui: copy(plugin.emptyDraft()) } }), nodes = flatten(plugin.RouterPage({ editor: h.editor, t, view: 'page' }));
  nodes.find(node => node?.type === 'button' && node.props.children.includes(t('addPreset'))).props.onClick();
  assert.deepEqual(copy(h.editor.getSnapshot().draft.presets), [{ id: 'preset-1', name: '', modelSource: 'parent', effort: 'high', description: '' }]);
  assert.equal(h.editor.getSnapshot().draft.defaultPreset, undefined);
  assert.equal(h.mutations.length, 0); assert.deepEqual(copy(h.current().value.ui.presets), []); h.dispose();
});

test('English dictionary has complete label coverage without Chinese fallback', () => {
  assert.deepEqual(Object.keys(plugin.dictionaries.en).sort(), Object.keys(plugin.dictionaries.zh).sort());
  for (const [key, value] of Object.entries(plugin.dictionaries.en)) assert.doesNotMatch(value, /[\u3400-\u9fff]/, key);
});

test('all four metadata locales identify ui as canonical and policy as the deprecated read alias', async () => {
  const locales = {};
  for (const language of ['zh', 'zh-CN', 'en', 'en-US']) {
    const dictionary = JSON.parse(await readFile(new URL('../locale/' + language + '.json', import.meta.url), 'utf8'));
    locales[language] = dictionary;
    assert.deepEqual(Object.keys(dictionary.config).sort(), ['auditFile', 'policy', 'ui']);
    if (language.startsWith('zh')) {
      assert.match(dictionary.config.ui, /规范入口 ui/);
      assert.match(dictionary.config.policy, /已弃用.*读取兼容别名.*规范编辑器保存为 ui/);
    } else {
      assert.match(dictionary.config.ui, /canonical ui entry/);
      assert.match(dictionary.config.policy, /deprecated read alias.*canonical editor saves ui/);
    }
  }
  assert.deepEqual(locales.zh, locales['zh-CN']); assert.deepEqual(locales.en, locales['en-US']);
});

test('preset list renders native fields and advanced settings without lanes or rule controls', () => {
  const h = host(); seed(h.editor);
  const nodes = flatten(plugin.RouterPage({ editor: h.editor, t, view: 'page' }));
  for (const key of ['presets', 'defaultPreset', 'effort', 'description', 'advanced']) assert.ok(nodes.includes(t(key)), key);
  assert.equal(nodes.some(node => node?.props?.['data-lane']), false);
  assert.equal(nodes.some(node => node?.type === 'input' && ['Provider ID', '模型 ID', '条件值'].includes(node.props['aria-label'])), false);
  const picker = nodes.find(node => node?.type === 'select' && node.props['aria-label'] === t('chooseModel'));
  assert.equal(picker.props.disabled, false); // Inheritance stays selectable without a catalog.
  assert.equal(flatten(picker).find(node => node?.type === 'option').props.value, plugin.PARENT_MODEL_KEY);
  const effort = nodes.find(node => node?.type === 'select' && node.props['aria-label'] === t('effort'));
  assert.equal(effort.props.disabled, true);
  const name = nodes.find(node => node?.type === 'input' && node.props['aria-label'] === t('name'));
  name.props.onChange({ target: { value: 'Edited name' } }); assert.equal(h.editor.getSnapshot().draft.presets[0].name, 'Edited name');
  assert.equal(nodes.some(node => node?.type === 'input' && /Team/.test(node.props['aria-label'] ?? '')), false);
  assert.equal(plugin.dictionaries.en.team, undefined); assert.equal(plugin.dictionaries.en.teamWarning, undefined);
  assert.ok(nodes.filter(node => node?.type === 'fieldset').every(node => node.props.style.minWidth === 0)); h.dispose();
});

test('brief evidence warning leaves quotas audit and ordinary save behavior intact', async () => {
  const auditFile = 'C:/audit/preserved-route.jsonl', h = host({ value: { ui: copy(plugin.defaults()), auditFile } });
  const root = plugin.RouterPage({ editor: h.editor, t, view: 'page' }), nodes = flatten(root);
  assert.ok(root.props.children.some(node => node?.type === 'p' && node.props.children.includes(t('executionEvidence'))));
  assert.equal(nodes.some(node => node?.type === 'summary' && /证据|evidence/.test(node.props.children.join(''))), false);
  assert.ok(nodes.includes(auditFile)); assert.ok(nodes.includes(t('auditHelp')));
  for (const [key, value] of Object.entries({ maxPendingStarts: 3, maxActivePerModel: 4, maxCreationsPerParent: 5, metadataTimeoutMs: 6000 })) {
    const control = nodes.find(node => node?.type === 'input' && node.props['aria-label'] === t(key));
    assert.equal(control.props.disabled, false); control.props.onChange({ target: { value: String(value) } });
    assert.equal(h.editor.getSnapshot().draft.limits[key], value);
  }
  assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 2);
  assert.deepEqual(h.mutations[0].ops.map(op => op.path), [['policy'], ['ui']]);
  assert.equal(h.editor.getSnapshot().saved, true); h.dispose();
});

test('browser defaults match the shared template module field for field and never alias', () => {
  assert.equal(plugin.DEFAULT_PRESET_ID, DEFAULT_PRESET_ID);
  assert.deepEqual(copy(plugin.createDefaultPresets()), createDefaultPresets());
  assert.deepEqual(copy(plugin.defaults().presets), createDefaultPresets());
  const changed = plugin.defaults(); changed.presets[0].name = 'Changed'; changed.limits.maxPendingStarts = 1;
  assert.deepEqual(copy(plugin.defaults().presets), createDefaultPresets());
  assert.equal(plugin.defaults().limits.maxPendingStarts, 32);
});

test('only missing preset fields initialize three inherited presets without enabling or writing', () => {
  for (const value of [undefined, {}, { ui: {} }, { policy: { schemaVersion: 2 } }, { ui: { schemaVersion: 2, presets: undefined } }]) {
    const h = host({ value }), state = h.editor.getSnapshot();
    assert.deepEqual(copy(state.draft), copy(plugin.defaults()));
    assert.equal(state.draft.defaultPreset, DEFAULT_PRESET_ID);
    assert.equal(state.draft.enabled, false); assert.equal(Object.hasOwn(state.draft, 'teams'), false);
    assert.equal(state.migration, undefined); assert.equal(state.dirty, false); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('explicit empty and existing fixed v2 presets and default selections are never filled or migrated', () => {
  const fixed = { id: 'default-high', name: 'My High', provider: 'p', model: 'fixed', effort: 'custom', description: 'Existing v2' };
  for (const source of ['ui', 'policy']) for (const raw of [
    { schemaVersion: 2, enabled: false, presets: [] },
    { schemaVersion: 2, enabled: false, presets: [fixed] },
    { schemaVersion: 2, enabled: true, presets: [fixed], defaultPreset: fixed.id }
  ]) {
    const h = host({ value: { [source]: raw } }), draft = h.editor.getSnapshot().draft;
    assert.deepEqual(copy(draft.presets), raw.presets); assert.equal(draft.defaultPreset, raw.defaultPreset);
    assert.equal(h.editor.getSnapshot().migration, undefined); assert.equal(h.editor.getSnapshot().dirty, false);
    assert.deepEqual(copy(plugin.normalizeAckUi(raw).presets), raw.presets); assert.equal(plugin.normalizeAckUi(raw).defaultPreset, raw.defaultPreset);
    assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('legacy quarantine has no conversion helpers or inherited defaults', () => {
  assert.equal(plugin.migrationInfo, undefined); assert.equal(plugin.migrationDraft, undefined);
  for (const original of [{ models: [] }, { models: [{ id: 'fixed', provider: 'p', model: 'm', defaultEffort: 'high' }], defaultModel: 'absent' }]) {
    const h = host({ value: { ui: original } }), draft = copy(h.editor.getSnapshot().draft);
    assert.deepEqual(draft, copy(plugin.emptyDraft()));
    assert.deepEqual(copy(h.editor.getSnapshot().configurationIssue.original), original); h.dispose();
  }
});

test('draft validation enforces the inherited or fixed source union without guessing the parent', () => {
  const valid = copy(plugin.defaults()); assert.equal(plugin.validDraft(valid), true);
  valid.presets[0].effort = 'saved-custom'; assert.equal(plugin.validDraft(valid), true);
  valid.presets[0].effort = null; assert.equal(plugin.validDraft(valid), true); // Runtime must verify the eventual parent metadata.
  for (const change of [
    preset => { preset.provider = 'p'; }, preset => { preset.model = 'm'; },
    preset => { preset.provider = undefined; }, preset => { preset.modelSource = 'global'; },
    preset => { delete preset.modelSource; }, preset => { preset.modelSource = undefined; },
    preset => { preset.effort = 'default'; }, preset => { preset.effort = ''; }
  ]) {
    const invalid = copy(plugin.defaults()); change(invalid.presets[0]); assert.equal(plugin.validDraft(invalid), false);
  }
});

test('inherited drafts retain exact source and effort across CAS and effective-route verification', async () => {
  for (const changed of [false, true]) {
    const h = host({ value: {} }); h.editor.edit(next => { next.presets[0].effort = 'custom-exact'; });
    const desired = copy(h.editor.getSnapshot().draft);
    h.ctx.remote.settings.mutate = async (ns, ops, revision) => {
      h.mutations.push({ ns, ops: copy(ops), revision }); const effective = copy(desired);
      if (changed) { delete effective.presets[0].modelSource; effective.presets[0].provider = 'p'; effective.presets[0].model = 'm'; }
      h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value: { ui: effective } });
      return { ok: true };
    };
    assert.equal(await h.editor.save(), !changed); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 2);
    assert.deepEqual(h.mutations[0].ops[1].value, desired);
    assert.equal(h.editor.getSnapshot().savedButNotLive, changed);
    assert.ok(h.mutations[0].ops[1].value.presets.every(preset => preset.modelSource === 'parent' && !Object.hasOwn(preset, 'provider') && !Object.hasOwn(preset, 'model')));
    h.dispose();
  }
});
