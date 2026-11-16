import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

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
const fixedCandidates = () => [
  { id: 'fast', name: 'Fast', provider: 'p', model: 'm', effort: 'low', description: 'Formatting' },
  { id: 'deep', name: 'Deep', provider: 'p', model: 'm', effort: 'high', description: 'Detailed analysis' }
];
const stored = extra => ({ ...copy(plugin.emptyDraft()), candidates: fixedCandidates(), defaultCandidateId: 'fast', ...extra });
const seed = editor => editor.edit(next => Object.assign(next, copy(stored())));
function host(options = {}) {
  let snapshot = { status: 'ready', writable: true, revision: 2, value: { ui: stored() }, user: {}, ...options };
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
      const value = { ui: copy(ops[0].value) };
      nextSnapshot = { status: 'ready', writable: true, revision: revision + 1, value, user: copy(value) };
      return { ok: true, value: { ns, revision: revision + 1, value } };
    } } },
    locale: { bind: ns => { assert.equal(ns, 'delegationRouter'); return t; }, register: (ns, value) => { dictionaries.push({ ns, value }); return () => dictionaries.pop(); } },
    slots: { inject: (_name, fn) => fn(), register: (meta, component) => { registrations.push({ meta, component }); return () => registrations.splice(registrations.findIndex(row => row.meta.key === meta.key), 1); } },
    on: (name, fn) => { events.set(name, fn); disposers.push(() => events.delete(name)); },
    effect: fn => { const off = fn(); disposers.push(off); return () => disposers.pop(); }
  };
  const editor = new plugin.RouterEditor(ctx, t);
  return { ctx, editor, mutations, registrations, dictionaries, subscribers, events, form, loads: () => loads, current: () => snapshot, change(value) { snapshot = { ...snapshot, ...value }; notify(); }, queue(value) { nextSnapshot = value; }, dispose() { editor.dispose(); for (const off of disposers.reverse()) off?.(); } };
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

test('candidate editing changes only the detached draft and never enables routing', () => {
  const h = host(), before = copy(h.current().value); seed(h.editor);
  const draft = h.editor.getSnapshot().draft;
  assert.equal(draft.enabled, false); assert.equal(Object.hasOwn(draft, 'teams'), false);
  assert.deepEqual(Array.from(draft.candidates, item => item.effort), ['low', 'high']);
  assert.deepEqual(copy(h.current().value), before); assert.equal(h.mutations.length, 0); assert.equal(h.editor.getSnapshot().dirty, true); h.dispose();
});

test('save sends one set-ui transaction and fixed revision, then waits for mirror', async () => {
  const h = host(); seed(h.editor); assert.equal(await h.editor.save(), true);
  assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].ns, 'delegation-router'); assert.equal(h.mutations[0].revision, 2);
  assert.deepEqual(h.mutations[0].ops.map(row => [row.op, row.path]), [['set', ['ui']]]);
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

test('invalid v3 sources stay read-only without conversion helpers or overwriting', async () => {
  for (const value of [
    { ui: { schemaVersion: 0 } },
    { ui: { schemaVersion: 1, models: [{ id: 'old' }] } },
    { ui: { schemaVersion: 3, candidates: 'broken' } },
    { ui: { schemaVersion: 3, candidates: [null] } },
    { ui: { schemaVersion: 3, unexpected: [] } },
    { ui: { schemaVersion: 3, teams: { enabled: false } } },
    { ui: { schemaVersion: 3, ...stored(), defaultPreset: 'fast' } },
    { ui: { ...stored(), limits: { maxPendingStarts: 1, unknown: 2 } } },
    { ui: stored({ candidates: [{ ...fixedCandidates()[0], retained: 'unknown key' }, fixedCandidates()[1]] }) },
    { ui: {} },
    { ui: null },
    { policy: stored() },
    { ui: stored(), policy: {} },
    Object.assign({ ui: stored() }, { policy: undefined })
  ]) {
    const h = host({ value }), state = h.editor.getSnapshot();
    assert.equal(state.invalidSource, true);
    assert.deepEqual(copy(state.draft), copy(plugin.emptyDraft()));
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false);
    assert.equal(await h.editor.save(), false); assert.equal(h.editor.addCandidate(), false); assert.equal(h.mutations.length, 0);
    const nodes = flatten(plugin.RouterPage({ editor: h.editor, t }));
    const offending = value.policy !== undefined ? value.policy : value.ui;
    assert.ok(nodes.includes(t('invalidSource'))); assert.ok(nodes.includes(JSON.stringify(offending, null, 2)));
    h.dispose();
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
  h.editor.edit(draft => { delete draft.candidates[0].description; delete draft.limits; });
  const desired = copy(h.editor.getSnapshot().draft);
  h.ctx.remote.settings.mutate = async () => {
    // Independent Host-schema fixture, not the function under test.
    const effective = copy(desired);
    effective.candidates[0].description = '';
    effective.limits = { maxPendingStarts: 32, maxActivePerModel: 8, maxCreationsPerParent: 64, metadataTimeoutMs: 5000 };
    h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value: { ui: effective } });
    return { ok: true, value: { revision: 3 } };
  };
  assert.equal(await h.editor.save(), true); assert.equal(h.editor.getSnapshot().receiptUnverified, false); assert.equal(h.editor.getSnapshot().savedButNotLive, false); h.dispose();
});

test('higher-layer effective overrides are saved but not live', async () => {
  for (const override of [
    value => { value.ui.enabled = true; },
    value => { value.ui.schemaVersion = 2; },
    value => { value.ui.candidates.push({ id: 'higher-candidate' }); },
    value => { value.ui.candidates[0].effort = 'high'; },
    value => { value.ui.candidates[0].extra = []; },
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

test('raw invalid user sources cannot be silently overwritten through a valid effective layer', async () => {
  for (const user of [{ ui: { schemaVersion: 0 } }, { policy: stored() }, { ui: stored(), policy: {} }]) {
    const h = host({ user, value: { ui: stored() } });
    assert.equal(h.editor.getSnapshot().invalidSource, true);
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false);
    assert.equal(await h.editor.save(), false); assert.equal(h.mutations.length, 0);
    assert.deepEqual(copy(h.current().user), user); h.dispose();
  }
});

test('hidden raw invalid sources stay readonly on initial load without dropping their fields', async () => {
  const original = { schemaVersion: 1, enabled: true, models: [{ id: 'old', customField: 'retain' }], rules: [{ effect: { denyModels: ['old'] } }], unknown: { retained: true } };
  const user = { ui: original, auditFile: 'C:/audit/retained.jsonl' }, h = host({ user, value: { ui: stored() } });
  const state = h.editor.getSnapshot(); assert.equal(state.invalidSource, true);
  assert.deepEqual(copy(state.invalidOriginal), original);
  assert.ok(flatten(plugin.RouterPage({ editor: h.editor, t })).includes(JSON.stringify(original, null, 2)));
  assert.equal(h.editor.edit(next => { next.enabled = true; }), false); assert.equal(await h.editor.save(), false);
  await h.editor.reload(); assert.equal(h.editor.addCandidate(), false); assert.deepEqual(copy(h.current().user), user);
  assert.equal(h.mutations.length, 0); h.dispose();
});

test('raw conflicting or unsupported structures cannot be overwritten through a supported effective layer', async () => {
  for (const user of [{ ui: { schemaVersion: 9 } }, { ui: { schemaVersion: 3, candidates: 'broken' } }, { ui: null }]) {
    const h = host({ user, value: { ui: stored() } });
    assert.equal(h.editor.edit(next => { next.enabled = true; }), false); assert.equal(await h.editor.save(), false);
    assert.equal(h.editor.getSnapshot().invalidSource, true);
    assert.equal(h.mutations.length, 0); assert.deepEqual(copy(h.current().user), user); h.dispose();
  }
});

test('unknown outer fields and invalid audit values remain readonly and cannot falsely acknowledge live settings', async () => {
  for (const extra of [{ unexpected: 'retained' }, { auditFile: 7 }]) {
    const original = { ui: stored(), ...extra }, blocked = host({ user: original, value: original });
    assert.equal(blocked.editor.getSnapshot().invalidSource, true);
    assert.deepEqual(copy(blocked.editor.getSnapshot().invalidOriginal), original);
    assert.equal(blocked.editor.edit(next => { next.enabled = true; }), false);
    assert.equal(await blocked.editor.save(), false); assert.equal(blocked.mutations.length, 0); blocked.dispose();
    const h = host(); seed(h.editor); const desired = copy(h.editor.getSnapshot().draft);
    h.ctx.remote.settings.mutate = async () => {
      h.mutations.push({}); h.queue({ status: 'ready', writable: true, revision: 3,
        user: { ui: desired }, value: { ui: desired, ...extra } }); return { ok: true };
    };
    assert.equal(await h.editor.save(), false); assert.equal(h.editor.getSnapshot().savedButNotLive, true);
    assert.equal(h.editor.getSnapshot().receiptUnverified, false); assert.equal(h.mutations.length, 1); h.dispose();
  }
});

test('canonical save requires exact raw acknowledgement with exact persisted fields', async () => {
  const h = host(); seed(h.editor); const desired = copy(h.editor.getSnapshot().draft);
  h.ctx.remote.settings.mutate = async () => {
    h.mutations.push({}); const raw = { ...copy(desired), extraSourceField: 'higher layer' };
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
  h.change({ revision: 2, user: {}, value: { ui: stored() } });
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

test('adding one candidate creates a blank unfinished card that blocks autosave and never picks a default', () => {
  const h = host({ value: { ui: copy(plugin.emptyDraft()) } }), nodes = flatten(plugin.RouterPage({ editor: h.editor, t, view: 'page' }));
  nodes.find(node => node?.type === 'button' && node.props.children.includes(t('addCandidate'))).props.onClick();
  assert.deepEqual(copy(h.editor.getSnapshot().draft.candidates), [{ id: 'candidate-1', name: '', provider: '', model: '', effort: '', description: '' }]);
  assert.equal(h.editor.getSnapshot().draft.defaultCandidateId, undefined);
  assert.equal(plugin.validDraft(h.editor.getSnapshot().draft), false);
  assert.ok(flatten(plugin.RouterPage({ editor: h.editor, t, view: 'page' })).includes(t('autosaveIncomplete')));
  assert.equal(h.mutations.length, 0); assert.deepEqual(copy(h.current().value.ui.candidates), []); h.dispose();
});

test('English dictionary has complete label coverage without Chinese fallback', () => {
  assert.deepEqual(Object.keys(plugin.dictionaries.en).sort(), Object.keys(plugin.dictionaries.zh).sort());
  for (const [key, value] of Object.entries(plugin.dictionaries.en)) assert.doesNotMatch(value, /[\u3400-\u9fff]/, key);
});

test('all four metadata locales identify ui as the single configuration entry', async () => {
  const locales = {};
  for (const language of ['zh', 'zh-CN', 'en', 'en-US']) {
    const dictionary = JSON.parse(await readFile(new URL('../locale/' + language + '.json', import.meta.url), 'utf8'));
    locales[language] = dictionary;
    assert.deepEqual(Object.keys(dictionary.config).sort(), ['auditFile', 'ui']);
    if (language.startsWith('zh')) assert.match(dictionary.config.ui, /规范入口 ui/);
    else assert.match(dictionary.config.ui, /canonical ui entry/);
  }
  assert.deepEqual(locales.zh, locales['zh-CN']); assert.deepEqual(locales.en, locales['en-US']);
});

test('candidate list renders native fields without inheritance or template controls', () => {
  const h = host(); seed(h.editor);
  const nodes = flatten(plugin.RouterPage({ editor: h.editor, t, view: 'page' }));
  for (const key of ['candidates', 'defaultCandidate', 'effort', 'description', 'advanced']) assert.ok(nodes.includes(t(key)), key);
  assert.equal(nodes.some(node => node?.props?.['data-lane']), false);
  const picker = nodes.find(node => node?.type === 'select' && node.props['aria-label'] === t('chooseModel'));
  assert.equal(picker.props.value, plugin.modelKey({ provider: 'p', model: 'm' }));
  assert.equal(flatten(picker).some(node => node?.type === 'option' && node.props.children === t('chooseModel')), false);
  const effort = nodes.find(node => node?.type === 'select' && node.props['aria-label'] === t('effort'));
  assert.equal(effort.props.disabled, true);
  const name = nodes.find(node => node?.type === 'input' && node.props['aria-label'] === t('name'));
  name.props.onChange({ target: { value: 'Edited name' } }); assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'Edited name');
  assert.ok(nodes.filter(node => node?.type === 'fieldset').every(node => node.props.style.minWidth === 0)); h.dispose();
});

test('brief evidence warning leaves quotas audit and ordinary save behavior intact', async () => {
  const auditFile = 'C:/audit/preserved-route.jsonl', h = host({ value: { ui: stored(), auditFile } });
  const root = plugin.RouterPage({ editor: h.editor, t, view: 'page' }), nodes = flatten(root);
  const advanced = nodes.find(node => node?.type === 'details' && node.props.children[0]?.props?.children?.includes(t('advanced')));
  assert.ok(flatten(advanced).includes(t('executionEvidence')));
  assert.equal(nodes.includes(auditFile), false); // read-only path is not an actionable setting here
  assert.equal(h.editor.getSnapshot().auditFile, auditFile);
  for (const [key, value] of Object.entries({ maxPendingStarts: 3, maxActivePerModel: 4, maxCreationsPerParent: 5, metadataTimeoutMs: 6000 })) {
    const control = nodes.find(node => node?.type === 'input' && node.props['aria-label'] === t(key));
    assert.equal(control.props.disabled, false); control.props.onChange({ target: { value: String(value) } });
    assert.equal(h.editor.getSnapshot().draft.limits[key], value);
  }
  assert.equal(await h.editor.save(), true); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 2);
  assert.deepEqual(h.mutations[0].ops.map(op => op.path), [['ui']]);
  assert.equal(h.editor.getSnapshot().saved, true); h.dispose();
});

test('fresh profiles start from an explicitly empty v3 draft', () => {
  for (const value of [undefined, {}, { ui: { schemaVersion: 3 } }, { ui: { schemaVersion: 3, enabled: false } }]) {
    const h = host(value === undefined ? { value: undefined } : { value }), state = h.editor.getSnapshot();
    assert.deepEqual(copy(state.draft), copy(plugin.emptyDraft()));
    assert.equal(state.draft.enabled, false); assert.equal(state.draft.defaultCandidateId, undefined);
    assert.equal(state.invalidSource, false); assert.equal(state.dirty, false); assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('explicit empty and fixed candidates and default selections are preserved', () => {
  const fixed = { id: 'fast', name: 'My Fast', provider: 'p', model: 'fixed', effort: 'custom', description: 'Existing v3' };
  for (const raw of [
    { schemaVersion: 3, enabled: false, candidates: [] },
    { schemaVersion: 3, enabled: false, candidates: [fixed] },
    { schemaVersion: 3, enabled: true, candidates: [fixed], defaultCandidateId: fixed.id }
  ]) {
    const h = host({ value: { ui: raw } }), draft = h.editor.getSnapshot().draft;
    assert.deepEqual(copy(draft.candidates), raw.candidates); assert.equal(draft.defaultCandidateId, raw.defaultCandidateId);
    assert.equal(h.editor.getSnapshot().dirty, false);
    assert.deepEqual(copy(plugin.normalizeAckUi(raw).candidates), raw.candidates); assert.equal(plugin.normalizeAckUi(raw).defaultCandidateId, raw.defaultCandidateId);
    assert.equal(h.mutations.length, 0); h.dispose();
  }
});

test('invalid sources never become editable drafts', () => {
  for (const original of [{ unexpected: [] }, { schemaVersion: 0 }, { schemaVersion: 3, candidates: 'invalid' }]) {
    const h = host({ value: { ui: original } });
    assert.deepEqual(copy(h.editor.getSnapshot().draft), copy(plugin.emptyDraft()));
    assert.equal(h.editor.getSnapshot().invalidSource, true); h.dispose();
  }
});

test('normalizeAckUi preserves invalid sources instead of fabricating v3 defaults', () => {
  assert.deepEqual(copy(plugin.normalizeAckUi({})), {});
  assert.deepEqual(copy(plugin.normalizeAckUi({ schemaVersion: 0 })), { schemaVersion: 0 });
  assert.deepEqual(copy(plugin.normalizeAckUi({ schemaVersion: 3, candidates: [], extra: true })), { schemaVersion: 3, candidates: [], extra: true });
  assert.equal(plugin.normalizeAckUi(null), null);
  const legitimate = { schemaVersion: 3, enabled: false, candidates: [{ id: 'fast', name: 'Fast', provider: 'p', model: 'm', effort: 'low' }] };
  assert.deepEqual(copy(plugin.normalizeAckUi(legitimate)), { ...copy(plugin.emptyDraft()), candidates: [{ ...legitimate.candidates[0], description: '' }] });
});

test('an empty effective ui:{} never acknowledges a saved empty v3 draft as live', async () => {
  const h = host({ value: {} });
  h.editor.edit(next => { next.limits.maxPendingStarts = 16; });
  const desired = copy(h.editor.getSnapshot().draft);
  h.ctx.remote.settings.mutate = async (ns, ops, revision) => {
    h.mutations.push({ ns, ops: copy(ops), revision });
    h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value: { ui: {} } });
    return { ok: true, value: { revision: 3 } };
  };
  assert.equal(await h.editor.save(), false);
  assert.equal(h.editor.getSnapshot().saved, false);
  assert.equal(h.editor.getSnapshot().savedButNotLive, true);
  assert.equal(h.editor.getSnapshot().receiptUnverified, false);
  assert.deepEqual(h.mutations[0].ops[0].value, desired); h.dispose();
});

test('draft validation enforces exact fixed candidates without inherited sources', () => {
  const valid = stored(); assert.equal(plugin.validDraft(valid), true);
  valid.candidates[0].effort = 'saved-custom'; assert.equal(plugin.validDraft(valid), true);
  valid.candidates[0].effort = null; assert.equal(plugin.validDraft(valid), true);
  for (const change of [
    candidate => { candidate.provider = ''; }, candidate => { candidate.model = ''; },
    candidate => { candidate.provider = undefined; }, candidate => { candidate.unexpected = true; },
    candidate => { candidate.effort = 'default'; }, candidate => { candidate.effort = ''; },
    candidate => { candidate.effort = undefined; }, candidate => { candidate.name = ''; }
  ]) {
    const invalid = stored(); change(invalid.candidates[0]); assert.equal(plugin.validDraft(invalid), false);
  }
  for (const change of [
    ui => { ui.candidates[1].id = ui.candidates[0].id; },
    ui => { ui.enabled = true; delete ui.defaultCandidateId; },
    ui => { ui.defaultCandidateId = 'missing'; },
    ui => { ui.enabled = 'true'; }, ui => { ui.schemaVersion = 2; },
    ui => { ui.limits.maxPendingStarts = 0; },
    ui => { ui.extra = true; },
    ui => { ui.candidates[0].extra = []; },
    ui => { ui.limits.unknown = 5; },
    ui => { ui.unexpected = []; }
  ]) {
    const invalid = stored(); change(invalid); assert.equal(plugin.validDraft(invalid), false);
  }
});

test('fixed candidate drafts persist exactly across CAS and effective-route verification', async () => {
  for (const changed of [false, true]) {
    const h = host({ value: {} }); h.editor.edit(next => { next.candidates = fixedCandidates(); next.defaultCandidateId = 'fast'; });
    const desired = copy(h.editor.getSnapshot().draft);
    h.ctx.remote.settings.mutate = async (ns, ops, revision) => {
      h.mutations.push({ ns, ops: copy(ops), revision }); const effective = copy(desired);
      if (changed) effective.candidates[0].effort = 'higher-layer';
      h.queue({ status: 'ready', writable: true, revision: 3, user: { ui: desired }, value: { ui: effective } });
      return { ok: true };
    };
    assert.equal(await h.editor.save(), !changed); assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 2);
    assert.deepEqual(h.mutations[0].ops[0].value, desired);
    assert.equal(h.editor.getSnapshot().savedButNotLive, changed);
    assert.ok(h.mutations[0].ops[0].value.candidates.every(candidate => typeof candidate.provider === 'string' && typeof candidate.model === 'string'));
    h.dispose();
  }
});
