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
vm.runInNewContext(source, { window: { __ModuleLoader__: { load: entry => { definition = entry; } } } });
const plugin = definition.factory(() => React);
const copy = value => JSON.parse(JSON.stringify(value));
const translate = key => plugin.dictionaries.en[key] ?? key;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fakeClock() {
  let now = 0, serial = 0;
  const pending = new Map(), callbacks = new Map();
  return {
    pending, callbacks,
    setTimeout(fn, delay) { const id = ++serial; pending.set(id, { at: now + delay, fn }); callbacks.set(id, fn); return id; },
    clearTimeout(id) { pending.delete(id); },
    latest() { return callbacks.get(serial); },
    async tick(ms) {
      const target = now + ms;
      while (true) {
        const due = [...pending].filter(([, row]) => row.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        now = due[1].at; pending.delete(due[0]); due[1].fn(); await flush();
      }
      now = target; await flush();
    }
  };
}
const storedUI = () => ({ ...copy(plugin.emptyDraft()), candidates: [
  { id: 'fast', name: 'Fast', provider: 'p', model: 'm', effort: 'low', description: '' },
  { id: 'deep', name: 'Deep', provider: 'p', model: 'm', effort: 'high', description: '' }
], defaultCandidateId: 'fast' });
function harness(t, options = {}) {
  const clock = fakeClock(), mutations = [], listeners = new Set();
  const value = options.value ?? { ui: storedUI() };
  let snapshot = { status: 'ready', writable: true, revision: 7, value: copy(value), user: copy(value), ...options };
  const notify = () => { for (const fn of listeners) fn(); };
  const form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  const h = { clock, mutations, current: () => snapshot, loads: 0,
    change(patch, emit = true) { snapshot = { ...snapshot, ...patch }; if (emit) notify(); },
    ack(row, effective) {
      const user = { ...copy(snapshot.user), ui: copy(row.ops[0].value) };
      h.change({ revision: row.revision + 1, user, value: effective ?? copy(user) });
    },
    mutate: async row => { h.ack(row); return { ok: true }; },
    load: async () => {},
    dispose() { h.editor.dispose(); }
  };
  h.ctx = { configForms: { get: () => form, describe: () => ({ async load() { h.loads++; await h.load(); } }) },
    remote: { settings: { async mutate(ns, ops, revision) { const row = { ns, ops: copy(ops), revision }; mutations.push(row); return await h.mutate(row); } } } };
  h.editor = new plugin.RouterEditor(h.ctx, translate, clock);
  t.after(() => h.dispose());
  return h;
}
const rename = (h, name) => h.editor.edit(next => { next.candidates[0].name = name; });
function flatten(node) {
  if (node === null || node === undefined || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [node];
  if (node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}
const page = h => flatten(plugin.RouterPage({ editor: h.editor, t: translate, view: 'page' }));
const button = (h, key) => page(h).find(node => node?.type === 'button' && node.props.children.includes(translate(key)));

test('initial empty drafts, subscription refresh and reload never autosave', async t => {
  const h = harness(t, { value: {}, user: {} });
  assert.equal(h.editor.getSnapshot().dirty, false);
  h.change({ revision: 8 }); await h.editor.reload(); await h.clock.tick(6000);
  assert.equal(h.mutations.length, 0); assert.equal(h.clock.pending.size, 0);
});

test('600ms trailing debounce submits only the latest draft and revision once', async t => {
  const h = harness(t); rename(h, 'first'); await h.clock.tick(599);
  assert.equal(h.mutations.length, 0); rename(h, 'latest'); await h.clock.tick(599);
  assert.equal(h.mutations.length, 0); await h.clock.tick(1);
  assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].revision, 7);
  const written = h.mutations[0].ops[0].value;
  assert.equal(written.schemaVersion, 5);
  assert.equal(written.configs[0].candidates[0].name, 'latest');
  assert.deepEqual(written.candidates, storedUI().candidates);
  assert.deepEqual(h.mutations[0].ops.map(row => [row.op, row.path]), [['set', ['ui']]]);
  assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.editor.getSnapshot().autosavePaused, false);
  await h.clock.tick(6000); assert.equal(h.mutations.length, 1);
});

test('valid to invalid edits cancel old work; only a repaired draft saves', async t => {
  const h = harness(t); rename(h, 'valid'); await h.clock.tick(599); rename(h, '');
  await h.clock.tick(6000); assert.equal(h.mutations.length, 0); assert.equal(h.clock.pending.size, 0);
  rename(h, 'repaired'); await h.clock.tick(600); assert.equal(h.mutations.length, 1);
  assert.equal(h.mutations[0].ops[0].value.configs[0].candidates[0].name, 'repaired');
});

test('missing defaults, duplicate IDs and invalid limits never enter the autosave queue', async t => {
  for (const invalidate of [
    next => { next.enabled = true; delete next.defaultCandidateId; },
    next => { next.candidates[1].id = next.candidates[0].id; },
    ...['maxPendingStarts', 'maxActivePerModel', 'maxCreationsPerParent', 'metadataTimeoutMs'].flatMap(key =>
      [0, -1, 1.5, '', '2', null, key === 'metadataTimeoutMs' ? 600001 : 1000001].map(value => next => { next.limits[key] = value; })),
    next => { next.enabled = 'true'; },
    next => { next.candidates[0].effort = ''; },
    next => { next.candidates[0].unexpected = true; },
    next => { next.candidates[0].extra = 'unknown key'; },
    next => { next.extra = true; },
    next => { next.limits.unknown = 5; },
    next => { next.unexpected = []; },
    next => { next.candidates.splice(0, 1); }
  ]) {
    const h = harness(t); h.editor.edit(invalidate); await h.clock.tick(1200);
    assert.equal(h.mutations.length, 0); assert.equal(h.clock.pending.size, 0);
  }
});

test('inclusive limit boundaries and omitted limits save without coercion', async t => {
  for (const boundary of [1, 'maximum', 'omitted']) {
    const h = harness(t);
    h.editor.edit(next => {
      if (boundary === 'omitted') delete next.limits;
      else for (const key of Object.keys(next.limits)) next.limits[key] = boundary === 1 ? 1 : key === 'metadataTimeoutMs' ? 600000 : 1000000;
    });
    const desired = copy(h.editor.getSnapshot().draft);
    await h.clock.tick(600); assert.equal(h.mutations.length, 1);
    const { schemaVersion, configs, candidates: pool, limits, enabled } = h.mutations[0].ops[0].value;
    assert.equal(schemaVersion, 5);
    assert.deepEqual(pool, storedUI().candidates);
    assert.deepEqual(configs[0].candidates, desired.candidates);
    assert.equal(configs[0].defaultCandidateId, desired.defaultCandidateId);
    assert.equal(enabled, desired.enabled);
    assert.deepEqual(limits, desired.limits);
    assert.equal(h.editor.getSnapshot().saved, true);
  }
});

test('native IME handlers cancel pending saves until composition end plus 600ms', async t => {
  const h = harness(t); rename(h, 'before');
  const input = page(h).find(node => node?.type === 'input' && node.props['aria-label'] === translate('name'));
  input.props.onCompositionStart(); input.props.onChange({ target: { value: '中文输入中' } });
  await h.clock.tick(6000); assert.equal(h.mutations.length, 0); assert.equal(await h.editor.save(), false);
  input.props.onCompositionEnd(); await h.clock.tick(599); assert.equal(h.mutations.length, 0);
  await h.clock.tick(1); assert.equal(h.mutations.length, 1);
  assert.equal(h.mutations[0].ops[0].value.configs[0].candidates[0].name, '中文输入中');
});

test('explicit refusal pauses autosave across edits and notifications; explicit retry alone resumes', async t => {
  const h = harness(t); h.mutate = async () => ({ ok: false, error: { code: 'settings/rejected', message: 'original refusal' } });
  rename(h, 'refused'); await h.clock.tick(600);
  assert.equal(h.editor.getSnapshot().autosavePaused, true); assert.equal(h.editor.getSnapshot().receiptUnverified, false);
  assert.equal(button(h, 'retry').props.disabled, false);
  rename(h, 'retained latest'); h.change({}); await h.clock.tick(6000);
  assert.equal(h.mutations.length, 1); assert.equal(h.editor.getSnapshot().error, 'original refusal');
  h.mutate = async row => { h.ack(row); return { ok: true }; };
  button(h, 'retry').props.onClick(); await flush();
  assert.equal(h.mutations.length, 2); assert.equal(h.mutations[1].ops[0].value.configs[0].candidates[0].name, 'retained latest');
  assert.equal(h.editor.getSnapshot().saved, true);
  rename(h, 'new edit'); await h.clock.tick(600); assert.equal(h.mutations.length, 3);
});

test('transport exceptions retain an unknown-write fence and never expose retry', async t => {
  const h = harness(t); h.mutate = async () => { throw Error('lost acknowledgment'); };
  rename(h, 'uncertain'); await h.clock.tick(600);
  assert.equal(h.editor.getSnapshot().receiptUnverified, true); assert.equal(button(h, 'retry'), undefined);
  assert.equal(rename(h, 'must not edit'), false); assert.equal(await h.editor.save(), false);
  h.change({}); await h.clock.tick(6000); assert.equal(h.mutations.length, 1);
  h.load = async () => { throw Error('refresh unavailable'); }; await h.editor.reload();
  assert.equal(h.editor.getSnapshot().receiptUnverified, true); assert.equal(h.mutations.length, 1);
});

test('accepted but unverified writes permit refresh verification, never repeat mutations', async t => {
  const h = harness(t); h.mutate = async () => ({ ok: true }); rename(h, 'pending verification');
  await h.clock.tick(600); assert.equal(h.editor.getSnapshot().receiptUnverified, true);
  assert.equal(button(h, 'retry'), undefined); assert.equal(await h.editor.save(), false);
  await h.editor.reload(); await h.clock.tick(6000); assert.equal(h.mutations.length, 1);
  h.ack(h.mutations[0]); await h.editor.reload();
  assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.editor.getSnapshot().receiptUnverified, false);
  assert.equal(h.mutations.length, 1);
});

test('local and server CAS conflicts stop edits and retries without losing draft', async t => {
  for (const server of [false, true]) {
    const h = harness(t); rename(h, 'conflicting draft');
    if (server) h.mutate = async () => ({ ok: false, error: { code: 'settings/conflict', message: 'revision changed' } });
    else h.change({ revision: 8 });
    await h.clock.tick(600); assert.equal(h.editor.getSnapshot().conflicted, true);
    assert.equal(rename(h, 'forbidden'), false); assert.equal(button(h, 'retry'), undefined);
    assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'conflicting draft');
    await h.clock.tick(6000); assert.equal(h.mutations.length, server ? 1 : 0);
  }
});

test('host restrictions arriving during debounce cancel writes, including silent read-only changes', async t => {
  for (const patch of [
    { writable: false }, { status: 'unavailable' },
    { user: { ui: { schemaVersion: 1, models: [] } } },
    { user: { ui: { schemaVersion: 0 } } },
    { user: { ui: { schemaVersion: 3, ...storedUI(), unexpected: [] } } },
    { user: { policy: {} } },
    { user: Object.assign({ ui: copy(storedUI()) }, { policy: undefined }) },
    { user: { ui: null } }
  ]) {
    const h = harness(t); rename(h, 'retained'); h.change(patch); await h.clock.tick(6000);
    assert.equal(h.mutations.length, 0); assert.equal(h.clock.pending.size, 0);
    assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'retained');
  }
  const h = harness(t); rename(h, 'silent change'); h.change({ writable: false }, false);
  await h.clock.tick(600); assert.equal(h.mutations.length, 0);
});

test('reload, failed reload, reset and dispose cancel timers and fence captured callbacks', async t => {
  for (const action of ['reload', 'failed reload', 'reset', 'dispose']) {
    const h = harness(t); rename(h, 'queued'); const stale = h.clock.latest();
    if (action === 'failed reload') { h.load = async () => { throw Error('refresh failed'); }; await h.editor.reload(); }
    else if (action === 'reload') await h.editor.reload();
    else if (action === 'reset') h.editor.resetConnection();
    else h.editor.dispose();
    stale(); await h.clock.tick(6000); assert.equal(h.mutations.length, 0, action);
    assert.equal(h.clock.pending.size, 0, action);
  }
});

test('superseded timer callbacks and an explicit save cannot duplicate a write', async t => {
  const h = harness(t); rename(h, 'old'); const stale = h.clock.latest(); rename(h, 'new');
  stale(); await flush(); assert.equal(h.mutations.length, 0);
  const current = h.clock.latest(); assert.equal(await h.editor.save(), true);
  current(); await h.clock.tick(6000); assert.equal(h.mutations.length, 1);
  assert.equal(h.mutations[0].ops[0].value.configs[0].candidates[0].name, 'new');
});

test('editing remains blocked throughout mutation and mirror verification', async t => {
  const h = harness(t), gate = deferred(); h.load = () => gate.promise;
  const staleInput = page(h).find(node => node?.type === 'input' && node.props['aria-label'] === translate('name'));
  rename(h, 'writing'); await h.clock.tick(600);
  assert.equal(h.editor.getSnapshot().saving, true); assert.equal(h.editor.getSnapshot().autosavePaused, true);
  assert.equal(rename(h, 'blocked'), false); staleInput.props.onChange({ target: { value: 'stale callback' } });
  assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'writing');
  assert.ok(page(h).filter(node => node?.type === 'input').every(node => node.props.disabled));
  await h.clock.tick(6000); assert.equal(h.mutations.length, 1); gate.resolve(); await flush();
  assert.equal(h.editor.getSnapshot().saved, true); assert.equal(h.editor.editable(), true);
});

test('late mutation after profile reset cannot acknowledge a colliding revision or requeue work', async t => {
  const h = harness(t), gate = deferred(); h.mutate = () => gate.promise; rename(h, 'old profile');
  await h.clock.tick(600); h.editor.resetConnection();
  h.change({ revision: 7, value: { ui: storedUI() }, user: {} });
  gate.resolve({ ok: true }); await flush(); await h.clock.tick(6000);
  assert.equal(h.mutations.length, 1); assert.equal(h.loads, 0);
  assert.equal(h.editor.getSnapshot().saved, false); assert.equal(h.editor.getSnapshot().connectionReset, true);
  assert.equal(h.editor.getSnapshot().draft.candidates[0].name, 'old profile');
});

test('beforeunload warns only for unfinished work and unregisters on plugin cleanup', async t => {
  const h = harness(t), clock = fakeClock(), handlers = new Map(), effects = [], registrations = [];
  let localDefinition, removed = 0, cleaned = false;
  const localWindow = {
    __ModuleLoader__: { load: entry => { localDefinition = entry; } },
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name, fn) { assert.equal(handlers.get(name), fn); handlers.delete(name); removed++; }
  };
  vm.runInNewContext(source, { window: localWindow, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const localPlugin = localDefinition.factory(() => React);
  const cleanup = () => { if (!cleaned) { cleaned = true; for (const off of effects.reverse()) off?.(); } };
  t.after(cleanup);
  localPlugin.apply({ ...h.ctx,
    locale: { bind: () => translate, register: () => () => {} },
    slots: { inject: (_name, fn) => fn(), register: (_meta, component) => { registrations.push(component); return () => {}; } },
    on: () => {}, effect: fn => { const off = fn(); effects.push(off); return off; }
  });
  const editor = registrations[0]({ view: 'page' }).props.editor;
  const warned = () => { const event = { prevented: false, preventDefault() { this.prevented = true; } }; handlers.get('beforeunload')(event); return event; };
  assert.equal(warned().prevented, false);
  editor.edit(next => { next.candidates[0].name = 'pending'; });
  assert.equal(warned().prevented, true); assert.equal(warned().returnValue, '');
  await clock.tick(600); assert.equal(warned().prevented, false);
  const gate = deferred(); h.mutate = async row => { await gate.promise; h.ack(row); return { ok: true }; };
  editor.edit(next => { next.candidates[0].name = 'writing'; }); await clock.tick(600);
  assert.equal(editor.getSnapshot().saving, true); assert.equal(warned().prevented, true);
  gate.resolve(); await flush(); assert.equal(warned().prevented, false);
  h.mutate = async () => { throw Error('unknown write'); };
  editor.edit(next => { next.candidates[0].name = 'unknown'; }); await clock.tick(600);
  assert.equal(editor.getSnapshot().receiptUnverified, true); assert.equal(warned().prevented, true);
  cleanup(); assert.equal(handlers.size, 0); assert.equal(removed, 1); assert.equal(clock.pending.size, 0);
});

test('saved-but-overridden stays paused and status UI has no normal save or unsafe retry', async t => {
  const h = harness(t);
  const status = page(h).find(node => node?.props?.['data-autosave']);
  assert.equal(status.props.style.position, undefined); // status must not cover inputs on small screens
  assert.equal(button(h, 'save'), undefined); assert.equal(button(h, 'retry'), undefined);
  assert.ok(flatten(status).some(node => node?.props?.role === 'status' && node.props['aria-live'] === 'polite'));
  h.mutate = async row => { const ui = copy(row.ops[0].value); ui.configs[0].candidates[0].effort = 'higher-layer'; h.ack(row, { ui }); return { ok: true }; };
  rename(h, 'overridden'); await h.clock.tick(600);
  assert.equal(h.editor.getSnapshot().savedButNotLive, true); assert.equal(h.editor.getSnapshot().autosavePaused, true);
  assert.ok(page(h).includes(translate('savedButNotLive'))); assert.equal(button(h, 'retry'), undefined);
  rename(h, 'further draft'); h.change({}); await h.clock.tick(6000); assert.equal(h.mutations.length, 1);
});
