import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadModelCatalog } from '../src/model-catalog.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function clock() {
  let now = 0, nextId = 0;
  const pending = new Map(), scheduled = [], cleared = [];
  return {
    pending, scheduled, cleared,
    setTimeout(callback, delay) { const id = ++nextId; scheduled.push({ id, delay, at: now }); pending.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { cleared.push(id); pending.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, item] of [...pending]) if (item.at <= now) { pending.delete(id); item.callback(); }
    }
  };
}
function fixture({ providers = [{ id: 'healthy', name: 'Healthy' }], list, resolve } = {}) {
  const calls = { providers: 0, lists: [], resolved: [], forbidden: [] };
  const api = {
    listProviders() { calls.providers++; return providers; },
    listModels(...args) { calls.lists.push(args); return list ? list(...args) : [{ id: 'model', name: 'Listed model' }]; },
    resolveModelInfo(provider, model, signal) {
      calls.resolved.push({ provider, model, signal });
      return resolve ? resolve(provider, model, signal) : { provider, id: model };
    }
  };
  const llm = new Proxy(api, {
    get(target, key) {
      if (!Object.hasOwn(target, key)) { calls.forbidden.push(key); throw Error('Forbidden inference/settings/credentials access'); }
      return target[key];
    }
  });
  return { llm, calls };
}
const options = timers => ({ timers });
const abortError = error => {
  assert.equal(error.name, 'AbortError'); assert.equal(error.code, 'ABORTED');
  assert.equal(error.message, 'Model catalog loading was aborted'); return true;
};

let factory;
vm.runInNewContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load: definition => { factory = definition.factory; } } }
});
const { normalizeCatalog } = factory(name => { assert.equal(name, 'react'); return {}; });
const normalize = value => JSON.parse(JSON.stringify(normalizeCatalog(value)));

test('providers run concurrently and a hanging list cannot delay healthy results beyond one 5s budget', async () => {
  const timers = clock(), upstream = new AbortController();
  const h = fixture({ providers: [{ id: 'hung' }, { id: 'healthy', name: 'Healthy' }, { id: 'also-hung' }],
    list: provider => provider === 'healthy' ? [{ id: 'model' }] : new Promise(() => {}) });
  let finished = false;
  const pending = loadModelCatalog(h.llm, upstream.signal, options(timers)).then(value => { finished = true; return value; });
  assert.equal(h.calls.providers, 1, 'provider discovery is synchronous');
  assert.equal(getEventListeners(upstream.signal, 'abort').length, 1);
  await flush();
  assert.deepEqual(h.calls.lists, [['hung'], ['healthy'], ['also-hung']]);
  assert.deepEqual(h.calls.resolved.map(call => [call.provider, call.model]), [['healthy', 'model']]);
  assert.equal(timers.pending.size, 2, 'healthy provider already released its timer');
  timers.advance(4999); await flush(); assert.equal(finished, false);
  timers.advance(1); const result = await pending;
  assert.deepEqual(result.groups, [{ id: 'healthy', name: 'Healthy', models: [{ id: 'model', name: 'model' }] }]);
  assert.deepEqual(result.failures.map(failure => failure.id), ['hung', 'also-hung']);
  assert.ok(result.failures.every(failure => /timed out/.test(failure.message)));
  assert.deepEqual(timers.scheduled.map(timer => [timer.delay, timer.at]), [[5000, 0], [5000, 0], [5000, 0]]);
  assert.equal(timers.pending.size, 0); assert.equal(timers.cleared.length, 3);
  assert.equal(getEventListeners(upstream.signal, 'abort').length, 0);
  assert.deepEqual(normalize(result), result); assert.deepEqual(h.calls.forbidden, []);
});

test('one provider deadline covers listing plus every metadata lookup, not 5s per model', async () => {
  const timers = clock(), listing = deferred(), metadata = deferred();
  const h = fixture({ list: () => listing.promise, resolve: () => metadata.promise });
  const pending = loadModelCatalog(h.llm, undefined, options(timers));
  await flush(); timers.advance(3000); listing.resolve([{ id: 'first' }, { id: 'second' }]); await flush();
  assert.deepEqual(h.calls.resolved.map(call => call.model), ['first', 'second']);
  const [first, second] = h.calls.resolved;
  assert.equal(first.signal, second.signal); assert.ok(first.signal instanceof AbortSignal);
  assert.equal(first.signal.aborted, false);
  timers.advance(2000); const result = await pending;
  assert.deepEqual(result.groups, []); assert.equal(result.failures.length, 1);
  assert.equal(first.signal.aborted, true); assert.equal(timers.pending.size, 0);
  const before = structuredClone(result);
  metadata.resolve({ provider: 'healthy', id: 'first' }); await flush();
  assert.deepEqual(result, before, 'late metadata cannot change settled groups or failures');
});

test('one bad model fails its entire provider promptly and does not abort another provider', async () => {
  const timers = clock(), good = deferred(), stuck = deferred();
  const h = fixture({ providers: [{ id: 'broken' }, { id: 'healthy' }],
    list: provider => provider === 'broken' ? [{ id: 'fine' }, { id: 'bad' }, { id: 'stuck' }] : [{ id: 'model' }],
    resolve: (provider, id) => {
      if (provider === 'healthy') return good.promise;
      if (id === 'bad') throw Error('secret adapter error');
      if (id === 'stuck') return stuck.promise;
      return { provider, id };
    } });
  const pending = loadModelCatalog(h.llm, undefined, options(timers));
  await flush();
  assert.ok(h.calls.resolved.filter(call => call.provider === 'broken').every(call => call.signal.aborted));
  assert.equal(h.calls.resolved.find(call => call.provider === 'healthy').signal.aborted, false);
  assert.equal(timers.pending.size, 1, 'bad provider fails without waiting for its hung sibling');
  good.resolve({ provider: 'healthy', id: 'model' });
  const result = await pending;
  assert.deepEqual(result.groups.map(group => group.id), ['healthy']);
  assert.deepEqual(result.failures.map(failure => failure.id), ['broken']);
  assert.equal(result.groups.flatMap(group => group.models).find(model => model.id === 'fine'), undefined,
    'find cannot select even a successful model from a failed provider');
  assert.equal(timers.pending.size, 0);
  const before = structuredClone(result); stuck.resolve({ provider: 'broken', id: 'stuck' }); await flush();
  assert.deepEqual(result, before);
});

test('late list results never start metadata work and late rejections stay handled', async () => {
  for (const reject of [false, true]) {
    const timers = clock(), listing = deferred(), h = fixture({ list: () => listing.promise });
    const pending = loadModelCatalog(h.llm, undefined, { timers, timeoutMs: 17 });
    await flush(); timers.advance(17); const result = await pending, before = structuredClone(result);
    if (reject) listing.reject(Error('late secret credential error')); else listing.resolve([{ id: 'late' }]);
    await flush(); assert.deepEqual(result, before); assert.deepEqual(h.calls.resolved, []);
    assert.equal(timers.pending.size, 0);
  }
});

test('cancellation rejects safely, aborts provider metadata signals, and cleans every timer/listener', async () => {
  const timers = clock(), upstream = new AbortController(), late = deferred();
  const h = fixture({ providers: [{ id: 'one' }, { id: 'two' }], resolve: () => late.promise });
  const pending = loadModelCatalog(h.llm, upstream.signal, options(timers));
  const rejection = assert.rejects(pending, abortError);
  await flush(); assert.equal(h.calls.resolved.length, 2);
  assert.notEqual(h.calls.resolved[0].signal, h.calls.resolved[1].signal, 'timeouts cannot abort another provider');
  upstream.abort(Error('secret cancellation reason')); await rejection;
  assert.ok(h.calls.resolved.every(call => call.signal.aborted));
  assert.equal(timers.pending.size, 0); assert.equal(getEventListeners(upstream.signal, 'abort').length, 0);
  late.reject(Error('late secret')); await flush(); assert.deepEqual(h.calls.forbidden, []);
});

test('pre-cancelled requests do no work, and cancellation while listing never resolves models', async () => {
  const timers = clock(), upstream = new AbortController(), h = fixture();
  upstream.abort('credential secret');
  await assert.rejects(loadModelCatalog(h.llm, upstream.signal, options(timers)), abortError);
  assert.equal(h.calls.providers, 0); assert.deepEqual(timers.scheduled, []);
  const current = new AbortController(), listing = deferred(), other = fixture({ list: () => listing.promise });
  const pending = loadModelCatalog(other.llm, current.signal, options(timers));
  const rejection = assert.rejects(pending, abortError);
  await flush(); current.abort(); await rejection;
  listing.resolve([{ id: 'late' }]); await flush();
  assert.deepEqual(other.calls.resolved, []); assert.equal(timers.pending.size, 0);
  assert.equal(getEventListeners(current.signal, 'abort').length, 0);
});

test('exact advertised native efforts are projected without defaults, guesses, credentials or adapter extras', async () => {
  let forbiddenReads = 0;
  const secret = { get() { forbiddenReads++; throw Error('must not read credentials'); } };
  const provider = { id: 'healthy', name: 'Provider display', description: 'omit me' };
  Object.defineProperty(provider, 'credentials', secret);
  const listed = [{ id: 'thought', name: 'Listed thought', reasoning: { efforts: [{ id: 'fake' }] } },
    { id: 'no-default' }, { id: 'plain' }, { id: 'empty-efforts' }];
  Object.defineProperty(listed[0], 'credential', secret);
  const reasoning = { efforts: [{ id: 'tiny-native', name: 'Short thought', description: 'omit' },
    { id: 'deep-native', name: 'Long thought' }], defaultEffort: 'deep-native', credential: 'secret' };
  const h = fixture({ providers: [provider], list: () => listed, resolve: (provider, id) => {
    const value = { provider, id, name: 'Resolved name is not listing display', adapter: 'omit' };
    Object.defineProperty(value, 'credentials', secret);
    if (id === 'thought') value.reasoning = reasoning;
    if (id === 'no-default') value.reasoning = { efforts: [{ id: 'custom-effort' }] };
    if (id === 'empty-efforts') value.reasoning = { efforts: [] };
    return value;
  } });
  const timers = clock(), result = await loadModelCatalog(h.llm, undefined, options(timers));
  assert.deepEqual(result, { groups: [{ id: 'healthy', name: 'Provider display', models: [
    { id: 'thought', name: 'Listed thought', reasoning: { efforts: [{ id: 'tiny-native', name: 'Short thought' }, { id: 'deep-native', name: 'Long thought' }], defaultEffort: 'deep-native' } },
    { id: 'no-default', name: 'no-default', reasoning: { efforts: [{ id: 'custom-effort', name: 'custom-effort' }] } },
    { id: 'plain', name: 'plain' }, { id: 'empty-efforts', name: 'empty-efforts', reasoning: { efforts: [] } }
  ] }], failures: [] });
  assert.deepEqual(normalize(result), result); assert.equal(forbiddenReads, 0);
  assert.doesNotMatch(JSON.stringify(result), /credential|secret|adapter|omit|fake|Resolved/);
  const before = structuredClone(result); reasoning.efforts[0].name = 'changed'; listed[0].name = 'changed'; provider.name = 'changed';
  assert.deepEqual(result, before, 'all returned data is detached');
  assert.equal(timers.pending.size, 0); assert.deepEqual(h.calls.forbidden, []);
});

test('empty provider and model directories are successful empty catalogs', async () => {
  for (const providers of [[], [{ id: 'empty' }]]) {
    const timers = clock(), h = fixture({ providers, list: () => [] });
    assert.deepEqual(await loadModelCatalog(h.llm, undefined, options(timers)), { groups: [], failures: [] });
    assert.deepEqual(h.calls.resolved, []); assert.equal(timers.pending.size, 0);
  }
});

test('malformed resolved identities and reasoning fail the entire provider, never become no-effort models', async () => {
  const invalid = [undefined, null, [], {}, { provider: 'healthy' }, { id: 'bad' },
    { provider: 'wrong', id: 'bad' }, { provider: 'healthy', id: 'wrong' },
    ...[null, false, {}, { levels: [{ effort: 'low', label: 'Low' }] }, { efforts: null }, { efforts: [null] },
      { efforts: [{ id: '' }] }, { efforts: [{ id: 7 }] }, { efforts: [{ id: 'x' }, { id: 'x' }] },
      { efforts: [{ id: 'default' }] }, { efforts: [{ id: 'x' }], defaultEffort: 'absent' },
      { efforts: [{ id: 'x' }], defaultEffort: null }, { efforts: [{ id: 'x' }], defaultEffort: 7 }]
      .map(reasoning => ({ provider: 'healthy', id: 'bad', reasoning })),
    Object.defineProperty({ provider: 'healthy', id: 'bad' }, 'reasoning', { get() { throw Error('secret getter'); } })];
  for (const metadata of invalid) {
    const timers = clock(), h = fixture({ list: () => [{ id: 'good' }, { id: 'bad' }],
      resolve: (provider, id) => id === 'good' ? { provider, id } : metadata });
    const result = await loadModelCatalog(h.llm, undefined, options(timers));
    assert.deepEqual(result.groups, []); assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].id, 'healthy');
    assert.equal(timers.pending.size, 0); assert.ok(h.calls.resolved.every(call => call.signal.aborted));
    assert.deepEqual(normalize(result), result);
  }
});

test('malformed listings, synchronous errors and resolve rejection produce only fixed safe provider failures', async () => {
  const secret = 'sk-private-key https://user:password@adapter.invalid Authorization: Bearer abc';
  const hostileError = { get message() { throw Error('do not inspect errors'); }, toString() { throw Error('do not coerce errors'); } };
  for (const list of [() => { throw Error(secret); }, () => Promise.reject(hostileError), () => null,
    () => [{ id: 'duplicate' }, { id: 'duplicate' }], () => [{ id: 3 }], () => Array(1)]) {
    const timers = clock(), h = fixture({ list });
    const result = await loadModelCatalog(h.llm, undefined, options(timers));
    assert.deepEqual(result, { groups: [], failures: [{ id: 'healthy', name: 'Healthy', message: 'Model catalog unavailable for this provider.' }] });
    assert.doesNotMatch(JSON.stringify(result), /private-key|password|Authorization|Bearer|adapter.invalid/);
    assert.equal(timers.pending.size, 0);
  }
  const timers = clock(), h = fixture({ resolve: () => Promise.reject(Error(secret)) });
  assert.deepEqual((await loadModelCatalog(h.llm, undefined, options(timers))).failures,
    [{ id: 'healthy', name: 'Healthy', message: 'Model catalog unavailable for this provider.' }]);
  assert.equal(timers.pending.size, 0);
});

test('provider discovery errors and malformed directories reject with a sanitized catalog error', async () => {
  for (const providers of [null, {}, [{ id: 'same' }, { id: 'same' }], [{ id: '' }]]) {
    const timers = clock(), upstream = new AbortController(), h = fixture({ providers });
    await assert.rejects(loadModelCatalog(h.llm, upstream.signal, options(timers)), error => {
      assert.equal(error.code, 'CATALOG_UNAVAILABLE'); assert.equal(error.message, 'Model catalog is unavailable'); return true;
    });
    assert.deepEqual(h.calls.lists, []); assert.equal(timers.pending.size, 0);
    assert.equal(getEventListeners(upstream.signal, 'abort').length, 0);
  }
  await assert.rejects(loadModelCatalog({ listProviders() { throw Error('secret adapter credential'); } }),
    { code: 'CATALOG_UNAVAILABLE', message: 'Model catalog is unavailable' });
});
