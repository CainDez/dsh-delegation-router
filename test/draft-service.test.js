import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { registerHooks } from 'node:module';
import { DraftService, collectDraftText } from '../src/draft-service.js';
import { draftDescriptors, invokeDraftRemote, mountDraftRemote } from '../src/draft-remote.js';

const profile = (extra = {}) => ({ provider: 'worker-provider', model: 'worker', effort: 'low', ...extra });
const request = (extra = {}) => ({ generator: profile({ provider: 'gen-provider', model: 'generator', effort: 'high' }), scope: [profile(), profile({ effort: 'high' })], requirements: 'Balanced daily work', ...extra });
const metadata = (extra = {}) => ({ inputModalities: ['text'], reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] }, ...extra });
const candidate = () => ({ id: 'scope-1', name: 'Daily', ...profile(), description: 'Suitable for daily work; not guaranteed for hard work; requested effort.' });
const draftRequest = () => ({ scope: request().scope, candidates: [candidate()], defaultCandidateId: 'scope-1' });
const generatedText = () => JSON.stringify({ profiles: [{ ref: 'scope-1', name: candidate().name, description: candidate().description }], defaultRef: 'scope-1', warnings: [] });
const block = (text, index = 0, type = 'text') => ({ type: 'block-end', index, block: { type, text } });
const finish = (kind = 'stop') => ({ type: 'finish', reason: { kind, ...(['error', 'aborted'].includes(kind) ? { failure: { code: 'TRANSPORT_FAILURE', message: 'upstream secret details', providerRetryAfterMs: 1 } } : {}) } });
const normalChunks = () => [block(generatedText()), finish()];
const iterable = async function* (chunks) { yield* chunks; };
const coded = code => error => { assert.ok(error instanceof Error); assert.equal(error.code, code); assert.equal(typeof error.message, 'string'); assert.ok(error.message.length); return true; };
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function harness({ resolve, prepare, chunks, stream, timeoutMs = 1000 } = {}) {
  const calls = { metadata: [], prepare: [], stream: [], publicStream: 0, writes: 0 };
  const config = Object.freeze({ enabled: false, limits: Object.freeze({ maxActivePerModel: 3 }) });
  const llm = {
    config,
    async resolveModelInfo(provider, model, signal) {
      calls.metadata.push({ provider, model, signal });
      return resolve ? resolve(provider, model, signal, calls.metadata.length) : metadata({ provider, model });
    },
    async prepareCall(options, signal) {
      calls.prepare.push({ options, signal });
      const prepared = { config: { ...options }, inputModalities: ['text'], stream(options) {
        calls.stream.push(options);
        return stream ? stream(options) : iterable(chunks ?? normalChunks());
      } };
      return prepare ? prepare(prepared, options, signal) : prepared;
    },
    stream() { calls.publicStream++; assert.fail('Unprepared llm.stream must never run'); },
    save() { calls.writes++; assert.fail('Configuration must not be written'); },
    update() { calls.writes++; assert.fail('Configuration must not be written'); },
  };
  return { calls, llm, service: new DraftService(llm, { timeoutMs }) };
}
function keepTimeoutAlive(t) {
  // Service timers are intentionally unref'ed; keep the test alive until assertions finish.
  const timer = setTimeout(() => {}, 2000); t.after(() => clearTimeout(timer));
}

test('generation pins the exact generator route, uses prepared stream once, and only returns a draft', async () => {
  const { service, calls, llm } = harness(); const raw = request(); const before = structuredClone(raw); const parentConfig = llm.config;
  const result = await service.generateDraft(raw);
  assert.deepEqual(result, { candidates: [candidate()], defaultCandidateId: 'scope-1', warnings: [] });
  assert.deepEqual(raw, before); assert.equal(llm.config, parentConfig); assert.equal(llm.config.enabled, false); assert.equal(llm.config.limits.maxActivePerModel, 3);
  assert.equal(calls.writes, 0); assert.equal(calls.publicStream, 0); assert.equal(calls.prepare.length, 1); assert.equal(calls.stream.length, 1);
  assert.deepEqual(calls.prepare[0].options, { provider: 'gen-provider', model: 'generator', reasoningEffort: 'high', maxTokens: 8192 });
  const options = calls.stream[0]; assert.equal(options.provider, 'gen-provider'); assert.equal(options.model, 'generator'); assert.equal(options.reasoningEffort, 'high');
  assert.equal(options.signal, calls.prepare[0].signal); assert.equal(typeof options.system, 'string'); assert.equal(options.messages.length, 1);
  assert.deepEqual(Object.keys(options.messages[0]), ['role', 'content']); assert.equal(options.messages[0].role, 'user'); assert.equal(options.messages[0].content[0].type, 'text');
  assert.deepEqual(JSON.parse(options.messages[0].content[0].text).scope.map(value => value.ref), ['scope-1', 'scope-2']);
  for (const key of ['tools', 'toolChoice', 'session', 'agent', 'cwd']) assert.equal(Object.hasOwn(options, key), false);
  assert.equal(calls.metadata.length, 3); assert.deepEqual(calls.metadata.map(value => value.model), ['generator', 'worker', 'worker']);
  assert.equal(service.active.size, 0);
});

test('a confirmed effort-less generator omits reasoningEffort from prepare and stream', async () => {
  const { service, calls } = harness({ resolve: (provider, model) => metadata({ provider, model, ...(model === 'generator' ? { reasoning: undefined } : {}) }) });
  await service.generateDraft(request({ generator: { ...request().generator, effort: null } }));
  assert.equal(Object.hasOwn(calls.prepare[0].options, 'reasoningEffort'), false);
  assert.equal(Object.hasOwn(calls.stream[0], 'reasoningEffort'), false);
});

test('prepared provider/model/effort changes reject before streaming without fallback', async () => {
  for (const change of [{ provider: 'fallback' }, { model: 'other' }, { reasoningEffort: 'low' }, { reasoningEffort: undefined }]) {
    const { service, calls } = harness({ prepare: prepared => ({ ...prepared, config: { ...prepared.config, ...change } }) });
    await assert.rejects(service.generateDraft(request()), coded('GENERATOR_ROUTE_CHANGED'));
    assert.equal(calls.prepare.length, 1); assert.equal(calls.stream.length, 0); assert.equal(calls.writes, 0);
  }
  const { service, calls } = harness({ resolve: () => metadata({ reasoning: undefined }), prepare: prepared => ({ ...prepared, config: { ...prepared.config, reasoningEffort: 'default' } }) });
  await assert.rejects(service.generateDraft(request({ generator: profile({ effort: null }), scope: [profile({ effort: null })] })), coded('GENERATOR_ROUTE_CHANGED'));
  assert.equal(calls.stream.length, 0);
});

test('a prepared call without text input is rejected, even if catalog advertised text', async () => {
  for (const inputModalities of [undefined, [], ['image']]) {
    const { service, calls } = harness({ prepare: prepared => ({ ...prepared, inputModalities }) });
    await assert.rejects(service.generateDraft(request()), coded('INVALID_PROFILE'));
    assert.equal(calls.stream.length, 0);
  }
});

test('invalid generation/validation input fails before metadata, prepare or stream', () => {
  for (const raw of [null, {}, request({ scope: [] }), request({ requirements: '' }), request({ generator: { ...request().generator, effort: 'default' } }), request({ enabled: true })]) {
    const { service, calls } = harness(); assert.throws(() => service.generateDraft(raw), coded('INVALID_GENERATION_REQUEST'));
    assert.deepEqual(calls, { metadata: [], prepare: [], stream: [], publicStream: 0, writes: 0 });
  }
  for (const raw of [null, {}, { ...draftRequest(), candidates: [] }, { ...draftRequest(), enabled: true }]) {
    const { service, calls } = harness(); assert.throws(() => service.validateDraft(raw), coded('INVALID_DRAFT_REQUEST'));
    assert.equal(calls.metadata.length, 0); assert.equal(calls.prepare.length, 0); assert.equal(calls.stream.length, 0);
  }
});

test('missing or failed metadata and unsupported scope profiles prevent any inference', async () => {
  for (const resolve of [() => undefined, () => null, () => { throw Error('adapter unavailable'); }, () => metadata({ reasoning: {} }), (provider, model) => metadata({ provider, model, ...(model === 'worker' ? { inputModalities: ['image'] } : {}) })]) {
    const { service, calls } = harness({ resolve });
    await assert.rejects(service.generateDraft(request()), error => { assert.ok(['MODEL_METADATA_UNAVAILABLE', 'INVALID_MODEL_METADATA', 'INVALID_PROFILE'].includes(error.code)); return true; });
    assert.equal(calls.prepare.length, 0); assert.equal(calls.stream.length, 0); assert.equal(calls.publicStream, 0); assert.equal(calls.writes, 0);
  }
});

test('catalog drift after generation discards the draft rather than substituting effort', async () => {
  const { service, calls } = harness({ resolve: (provider, model, signal, number) => metadata({ provider, model, ...(number === 3 ? { reasoning: { efforts: [{ id: 'other', name: 'Other' }] } } : {}) }) });
  await assert.rejects(service.generateDraft(request()), coded('INVALID_PROFILE'));
  assert.equal(calls.prepare.length, 1); assert.equal(calls.stream.length, 1); assert.equal(calls.writes, 0);
});

test('validateDraft performs metadata checks only and does not call any inference entrypoint', async () => {
  const { service, calls } = harness(); const raw = draftRequest(); const before = structuredClone(raw);
  const result = await service.validateDraft(raw);
  assert.deepEqual(result, { candidates: [candidate()], defaultCandidateId: 'scope-1' }); assert.deepEqual(raw, before);
  assert.equal(calls.metadata.length, 1); assert.equal(calls.prepare.length, 0); assert.equal(calls.stream.length, 0); assert.equal(calls.publicStream, 0); assert.equal(calls.writes, 0);
});

test('conflict and malformed JSON are rejected after one inference and never persisted', async () => {
  for (const [text, code] of [['{"conflict":"Required capability is unavailable"}', 'GENERATION_CONFLICT'], ['not JSON', 'INVALID_GENERATED_DRAFT']]) {
    const { service, calls } = harness({ chunks: [block(text), finish()] });
    await assert.rejects(service.generateDraft(request()), coded(code)); assert.equal(calls.stream.length, 1); assert.equal(calls.writes, 0);
  }
});

test('block-end is authoritative, ordered by index, and reasoning is excluded from draft JSON', async () => {
  const json = generatedText(); const middle = Math.floor(json.length / 2);
  const chunks = [{ type: 'text-delta', index: 1, text: 'not authoritative' }, { type: 'reasoning-delta', index: 0, text: 'private reasoning' }, block('private reasoning', 0, 'reasoning'), block(json.slice(middle), 2), block(json.slice(0, middle), 1), finish()];
  assert.equal(await collectDraftText(iterable(chunks), new AbortController().signal), json);
  const { service } = harness({ chunks }); assert.deepEqual((await service.generateDraft(request())).candidates, [candidate()]);
});

test('error, aborted, max-tokens and missing finish refuse even complete-looking draft JSON', async () => {
  for (const kind of ['error', 'aborted', 'max-tokens', 'tool-calls', 'unknown', undefined]) {
    const chunks = [block(generatedText()), ...(kind === undefined ? [] : [finish(kind)])];
    const { service, calls } = harness({ chunks });
    await assert.rejects(service.generateDraft(request()), coded('GENERATION_INCOMPLETE'));
    assert.equal(calls.stream.length, 1); assert.equal(calls.prepare.length, 1); assert.equal(calls.writes, 0);
  }
});

test('a block after finish, duplicate/invalid indices and non-string block text are rejected', async () => {
  for (const chunks of [[finish(), block(generatedText())], [block(generatedText()), finish(), finish()], [block('a'), block('b')], [block('a', -1)], [block('a', 1.1)], [block('a', '0')], [block(null)]]) {
    await assert.rejects(collectDraftText(iterable(chunks), new AbortController().signal), coded('INVALID_GENERATION_STREAM'));
  }
});

test('tool blocks, tool deltas and other content blocks cannot produce a draft or tool invocation', async () => {
  for (const malicious of [{ type: 'tool-call-delta', index: 0, id: 'tool-1', name: 'shell', argumentsDelta: '{}' }, { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'tool-1', name: 'shell', arguments: '{}' } }, { type: 'block-end', index: 0, block: { type: 'image', url: 'https://invalid/' } }]) {
    const { service, calls } = harness({ chunks: [malicious, finish()] });
    await assert.rejects(service.generateDraft(request()), coded('INVALID_GENERATION_STREAM'));
    assert.equal(calls.stream.length, 1); assert.equal(calls.writes, 0);
  }
});

test('empty or >64 KiB text, >256 KiB accumulated output and >256 blocks are rejected', async () => {
  for (const text of ['', '   ', 'x'.repeat(65537), '界'.repeat(22000)]) await assert.rejects(collectDraftText(iterable([block(text), finish()]), new AbortController().signal), coded('INVALID_GENERATED_DRAFT'));
  for (const chunks of [[{ type: 'text-delta', index: 1, text: 'x'.repeat(262145) }], [{ type: 'reasoning-delta', index: 0, text: '界'.repeat(88000) }], [block('x'.repeat(262145), 0, 'reasoning')], Array.from({ length: 257 }, (_, index) => block('', index))]) {
    await assert.rejects(collectDraftText(iterable(chunks), new AbortController().signal), coded('GENERATION_TOO_LARGE'));
  }
  const text = 'x'.repeat(65536); assert.equal(await collectDraftText(iterable([block(text), finish()]), new AbortController().signal), text);
});

test('concurrent generate and validate calls share a single slot and never duplicate inference', async () => {
  const entered = deferred(), release = deferred();
  const { service, calls } = harness({ stream: async function* () { entered.resolve(); await release.promise; yield* normalChunks(); } });
  const pending = service.generateDraft(request()); await entered.promise;
  await assert.rejects(service.generateDraft(request()), coded('GENERATOR_BUSY'));
  await assert.rejects(service.validateDraft(draftRequest()), coded('GENERATOR_BUSY'));
  assert.equal(calls.stream.length, 1); release.resolve(); await pending; assert.equal(service.active.size, 0);
  await service.validateDraft(draftRequest()); assert.equal(calls.stream.length, 1);
});

test('timeout rejects promptly with no automatic retry; noncooperative stream retains its slot until settled', async t => {
  keepTimeoutAlive(t); const entered = deferred(), release = deferred(), finished = deferred();
  const { service, calls } = harness({ timeoutMs: 10, stream: async function* () { entered.resolve(); try { await release.promise; yield* normalChunks(); } finally { finished.resolve(); } } });
  const pending = service.generateDraft(request()); const rejected = assert.rejects(pending, coded('GENERATION_TIMEOUT')); await entered.promise; await rejected;
  assert.equal(calls.stream.length, 1); assert.equal(calls.prepare.length, 1); assert.equal(calls.stream[0].signal.aborted, true);
  await assert.rejects(service.generateDraft(request()), coded('GENERATOR_BUSY')); assert.equal(calls.stream.length, 1);
  release.resolve(); await finished.promise;
  // Let the service's work-finally release the slot; there is no retry timer.
  await new Promise(resolve => setImmediate(resolve)); assert.equal(service.active.size, 0); assert.equal(calls.stream.length, 1); assert.equal(calls.writes, 0);
});

test('prepare timeout never streams after late adapter resolution or silently retries', async t => {
  keepTimeoutAlive(t); const entered = deferred(), release = deferred();
  const { service, calls } = harness({ timeoutMs: 10, prepare: async prepared => { entered.resolve(); await release.promise; return prepared; } });
  const pending = service.generateDraft(request()); const rejected = assert.rejects(pending, coded('GENERATION_TIMEOUT')); await entered.promise; await rejected;
  await assert.rejects(service.validateDraft(draftRequest()), coded('GENERATOR_BUSY')); assert.equal(calls.prepare.length, 1); assert.equal(calls.stream.length, 0);
  release.resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(service.active.size, 0); assert.equal(calls.stream.length, 0); assert.equal(calls.prepare.length, 1);
});

test('metadata timeout prevents preparation/inference even if resolver returns late', async t => {
  keepTimeoutAlive(t); const entered = deferred(), release = deferred();
  const { service, calls } = harness({ timeoutMs: 10, resolve: async () => { entered.resolve(); await release.promise; return metadata(); } });
  const pending = service.generateDraft(request()); const rejected = assert.rejects(pending, coded('GENERATION_TIMEOUT')); await entered.promise; await rejected;
  release.resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.prepare.length, 0); assert.equal(calls.stream.length, 0); assert.equal(calls.metadata.length, 1);
});

test('parent cancellation aborts prepared streaming and prevents post-generation metadata or writes', async () => {
  const parent = new AbortController(); const entered = deferred(), release = deferred();
  const { service, calls } = harness({ stream: async function* () { entered.resolve(); await release.promise; yield* normalChunks(); } });
  const pending = service.generateDraft(request(), parent.signal); await entered.promise;
  const reason = Object.assign(Error('Cancelled'), { code: 'ABORTED' }); parent.abort(reason);
  await assert.rejects(pending, error => error === reason); assert.equal(calls.stream[0].signal.aborted, true);
  release.resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(getEventListeners(parent.signal, 'abort').length, 0); assert.equal(calls.metadata.length, 2); assert.equal(calls.writes, 0);
});

test('pre-aborted calls do no work, and normal completion removes parent listeners', async () => {
  const { service, calls } = harness(); const reason = Object.assign(Error('Already stopped'), { code: 'ABORTED' });
  await assert.rejects(service.generateDraft(request(), AbortSignal.abort(reason)), error => error === reason); assert.equal(calls.metadata.length, 0);
  const parent = new AbortController(); await service.validateDraft(draftRequest(), parent.signal); assert.equal(getEventListeners(parent.signal, 'abort').length, 0); assert.equal(service.active.size, 0);
});

test('close is idempotent, cancels active work and permanently rejects later requests', async () => {
  const entered = deferred(), release = deferred();
  const { service, calls } = harness({ stream: async function* () { entered.resolve(); await release.promise; yield* normalChunks(); } });
  const pending = service.generateDraft(request()); await entered.promise; service.close(); service.close();
  await assert.rejects(pending, coded('GENERATOR_CLOSED')); await assert.rejects(service.generateDraft(request()), coded('GENERATOR_CLOSED')); await assert.rejects(service.validateDraft(draftRequest()), coded('GENERATOR_CLOSED'));
  release.resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.stream.length, 1); assert.equal(calls.writes, 0); assert.equal(service.active.size, 0);
});

test('adapter failures do not trigger another prepare, stream, model or retry', async () => {
  for (const options of [{ prepare: () => { throw Error('prepare failed'); } }, { stream: async function* () { throw Error('stream failed'); } }]) {
    const { service, calls } = harness(options); await assert.rejects(service.generateDraft(request()), /failed/);
    assert.equal(calls.prepare.length, 1); assert.ok(calls.stream.length <= 1); assert.equal(calls.writes, 0); assert.equal(service.active.size, 0);
  }
});

class FakeRemoteError extends Error { constructor(code, message, data) { super(message); this.code = code; this.data = data; } }
function remoteHost(draftService, principal = { kind: 'owner' }) { return { draftService, draftRemoteError: FakeRemoteError, ctx: { invocation: { peer: { principal } } } }; }

test('remote owner gate rejects unauthenticated/workspace principals before service calls', async () => {
  let called = 0; const service = { generateDraft() { called++; return {}; } };
  for (const principal of [null, {}, { kind: 'workspace' }, { kind: 'anonymous' }]) await assert.rejects(invokeDraftRemote(remoteHost(service, principal), 'generateDraft', request()), { code: 'gateway/forbidden' });
  assert.equal(called, 0);
  await invokeDraftRemote(remoteHost(service), 'generateDraft', request()); assert.equal(called, 1);
});

test('remote preserves only genuine validation/service diagnostics and suppresses terminal adapter details', async () => {
  const { service } = harness();
  await assert.rejects(invokeDraftRemote(remoteHost(service), 'generateDraft', {}), error => { assert.equal(error.data.code, 'INVALID_GENERATION_REQUEST'); return true; });
  service.close();
  await assert.rejects(invokeDraftRemote(remoteHost(service), 'generateDraft', request()), error => { assert.equal(error.data.code, 'GENERATOR_CLOSED'); return true; });
  for (const kind of ['error', 'aborted']) {
    const host = harness({ chunks: [block(generatedText()), finish(kind)] });
    await assert.rejects(invokeDraftRemote(remoteHost(host.service), 'generateDraft', request()), error => {
      assert.equal(error.data.code, 'GENERATION_INCOMPLETE'); assert.ok(!error.message.includes('upstream secret')); return true;
    });
    assert.equal(host.calls.stream.length, 1);
  }
});

test('remote descriptor codecs strictly validate both request shapes and expose cancellation', () => {
  const descriptors = draftDescriptors(); assert.deepEqual(descriptors.map(value => value.method), ['generateDraft', 'validateDraft']);
  for (const descriptor of descriptors) {
    assert.deepEqual(descriptor.cancellation, { parameter: 'signal' }); assert.equal(descriptor.parameters.length, 1);
    assert.equal(descriptor.parameters[0].codec.mode, 'strict'); const codec = descriptor.parameters[0].codec.create();
    assert.throws(() => codec.parse({ arbitrary: true }));
    assert.ok(codec.parse(descriptor.method === 'generateDraft' ? request() : draftRequest()));
  }
});

test('remote sanitizes raw adapter failure messages regardless of a plausible error code prefix', async () => {
  const secret = 'https://vendor.invalid/?api_key=DO_NOT_EXPOSE';
  for (const code of [undefined, 'NETWORK_FAILURE', 'INVALID_PROVIDER_RESPONSE', 'GENERATION_ADAPTER_ERROR', 'MODEL_METADATA_INTERNAL']) {
    const service = { async generateDraft() { throw Object.assign(new Error(secret), code ? { code } : {}); } };
    await assert.rejects(invokeDraftRemote(remoteHost(service), 'generateDraft', request()), error => {
      assert.equal(error.code, 'delegation-router/draft'); assert.ok(!error.message.includes('DO_NOT_EXPOSE'), 'raw adapter message leaked for ' + code); return true;
    });
  }
});

test('mount without remote registry is inert; registered disposal closes the draft service', async () => {
  const absent = { ctx: { get: () => undefined } }; await mountDraftRemote(absent); assert.equal(absent.draftService, undefined);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@deepseek-ai/dsh-typert-protocol') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const bindTypertRemote=()=>({}); export class RemoteError extends Error {}') };
    return next(specifier, context);
  } });
  try {
    const effects = [], registered = []; const { llm } = harness();
    const host = { ctx: { llm, get: () => ({ register(value) { registered.push(value); } }), effect(factory) { effects.push(factory()); } } };
    await mountDraftRemote(host); assert.ok(host.draftService instanceof DraftService); assert.equal(registered.length, 1); assert.equal(effects.length, 2);
    for (const dispose of effects.reverse()) dispose(); assert.equal(host.draftService.closed, true); await assert.rejects(host.draftService.generateDraft(request()), coded('GENERATOR_CLOSED'));
  } finally { hooks.deregister(); }
});
