/**
 * Read-only actual-host catalog preflight; run manually, never as npm test.
 * Usage: matching Electron executable in ELECTRON_RUN_AS_NODE=1 mode, this script,
 * then the matching DSH runtime package.json. No live service is constructed.
 */
import assert from 'node:assert/strict';
import {createRequire, syncBuiltinESMExports} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';

if (!process.argv[2] || process.argv.length !== 3) {
  throw Error('Pass exactly one matching DSH runtime package.json path; ASAR hosts require Electron Node mode.');
}
const hostRequire = createRequire(resolve(process.argv[2]));
const counters = {networkAttempts: 0, processAttempts: 0, forbiddenContextAccesses: 0,
  modelCalls: 0, settingsWrites: 0, credentialReads: 0};
const restores = [];
function block(object, key, counter) {
  const before = object[key];
  object[key] = function () {
    counters[counter]++;
    throw Error('Forbidden preflight side effect: ' + key);
  };
  restores.push(() => { object[key] = before; });
}
// Fail closed before importing host modules. These patches affect this script
// process only; no server, profile, installed file, or user window is touched.
block(globalThis, 'fetch', 'networkAttempts');
for (const mod of [http, https]) for (const key of ['request', 'get']) block(mod, key, 'networkAttempts');
for (const key of ['connect', 'createConnection']) block(net, key, 'networkAttempts');
block(net.Socket.prototype, 'connect', 'networkAttempts');
block(tls, 'connect', 'networkAttempts');
block(dgram.Socket.prototype, 'send', 'networkAttempts');
for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
  block(childProcess, key, 'processAttempts');
}
syncBuiltinESMExports();

function guarded(values, label) {
  return new Proxy(Object.freeze(values), {
    get(target, key, receiver) {
      if (Reflect.has(target, key)) return Reflect.get(target, key, receiver);
      counters.forbiddenContextAccesses++;
      if (label === 'ctx' && key === 'credentials') counters.credentialReads++;
      if (label === 'ctx' && key === 'settings') counters.settingsWrites++;
      if (label === 'llm') counters.modelCalls++;
      throw Error('Unexpected detached service access: ' + label + '.' + String(key));
    },
    set() { throw Error('Detached preflight services are read-only'); }
  });
}
const detached = value => JSON.parse(JSON.stringify(value));

try {
  const mainPath = hostRequire.resolve('@deepseek-ai/dsh-api-session-controller');
  const {SessionController} = await import(pathToFileURL(mainPath).href);
  const {default: remoteInfo} = await import(pathToFileURL(join(dirname(mainPath), 'typert.remote-client.js')).href);
  const endpoint = remoteInfo.methods['session/modelCatalog'];
  assert.ok(endpoint, 'actual generated public modelCatalog declaration is required');
  assert.equal(endpoint.service, 'sessionController');
  assert.deepEqual(endpoint.invocation, {kind: 'direct'});
  assert.deepEqual(endpoint.parameters, []);
  assert.equal(endpoint.result.mode, 'strict');
  assert.equal(endpoint.result.typeSymbol, '@deepseek-ai/dsh-api-session-controller/types#ModelCatalog');
  assert.equal(typeof endpoint.result.create, 'function');
  const schema = endpoint.result.create();
  assert.equal(typeof schema.parse, 'function');
  assert.equal(typeof SessionController.prototype.modelCatalog, 'function');

  // Capture the existing browser module without apply(), React rendering, any
  // remote service, settings, subscriptions, DOM, or injected live context.
  let factory;
  runInNewContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), {
    window: {__ModuleLoader__: {load(definition) {
      assert.equal(factory, undefined, 'one module registration only');
      assert.equal(definition.id, 'dsh-delegation-router');
      factory = definition.factory;
    }}}
  }, {filename: 'delegation-router-client-preflight', timeout: 1000,
    codeGeneration: {strings: false, wasm: false}});
  assert.equal(typeof factory, 'function');
  const client = factory(name => {
    assert.equal(name, 'react', 'unexpected browser dependency');
    return {createElement() { throw Error('Rendering is forbidden in catalog preflight'); }};
  });
  assert.equal(typeof client.normalizeCatalog, 'function', 'client must export its actual normalizeCatalog(value)');

  const selection = Object.freeze({provider: 'deployment-default', model: 'unlisted-default', reasoningEffort: 'unchanged'});
  const listed = {
    alpha: [{id: 'thought', name: 'Thought display', description: 'Visible description', badge: {text: {en: 'Preview', zh: '预览'}, tone: 'info'}},
      {id: 'plain', name: 'Plain display'}],
    beta: [{id: 'no-default', name: 'No default display'}],
    empty: [], broken: [], badExact: [{id: 'good', name: 'Good but provider fails'}, {id: 'bad', name: 'Bad exact'}]
  };
  const reasoning = {efforts: [{id: 'tiny', name: 'Short thought', description: 'Native effort label'},
    {id: 'deep-native', name: 'Long thought'}], defaultEffort: 'tiny'};
  const observed = [];
  function contextFor(providers) {
    const calls = {providers: 0, models: [], resolved: [], defaults: 0};
    const ctx = guarded({
      agentDefaultModel: guarded({currentSelection() { calls.defaults++; return selection; }}, 'agentDefaultModel'),
      llm: guarded({
        listProviders() { calls.providers++; return providers.map(id => ({id, name: id + ' provider'})); },
        async listModels(provider) {
          calls.models.push(provider);
          if (provider === 'broken') throw Error('detached provider listing failed');
          return structuredClone(listed[provider]);
        },
        async resolveModelInfo(provider, model) {
          calls.resolved.push([provider, model]);
          if (provider === 'badExact' && model === 'bad') throw Error('detached exact lookup failed');
          return {provider, id: model, name: 'Resolved ' + model,
            ...(provider === 'alpha' && model === 'thought' ? {reasoning: structuredClone(reasoning)} :
              provider === 'beta' ? {reasoning: {efforts: [{id: 'custom-effort', name: 'Adapter custom effort'}]}} : {})};
        }
      }, 'llm')
    }, 'ctx');
    return {ctx, calls};
  }
  async function check(name, providers) {
    const {ctx, calls} = contextFor(providers);
    // Execute the imported, public actual-host method. No constructor/init,
    // extracted function, copied algorithm, app import, Gateway, or liveMount.
    const value = await SessionController.prototype.modelCatalog.call({ctx});
    assert.deepEqual(schema.parse(value), value, 'actual generated schema accepts actual public handler output');
    assert.deepEqual(value.default, selection);
    assert.notEqual(value.default, selection, 'default selection must be detached');
    assert.equal(calls.providers, 1);
    assert.equal(calls.defaults, 1);
    assert.deepEqual(calls.models, providers);
    const before = JSON.stringify(value);
    const normalized = detached(client.normalizeCatalog(value));
    assert.equal(JSON.stringify(value), before, 'normalization must not change host values');
    assert.deepEqual(Object.keys(normalized).sort(), ['failures', 'groups']);
    assert.equal(Object.hasOwn(normalized, 'default'), false, 'deployment default is not router configuration');
    assert.deepEqual(normalized.groups.map(g => g.id), value.groups.map(g => g.id));
    assert.deepEqual(normalized.failures, value.failures);
    for (let i = 0; i < value.groups.length; i++) {
      const actual = value.groups[i], clean = normalized.groups[i];
      assert.equal(clean.name, actual.name);
      assert.deepEqual(clean.models.map(m => [m.id, m.name]), actual.models.map(m => [m.id, m.name]));
      for (let j = 0; j < actual.models.length; j++) {
        const model = actual.models[j], normalizedModel = clean.models[j];
        if (model.reasoning === undefined) {
          assert.equal(Object.hasOwn(normalizedModel, 'reasoning'), false, 'no fabricated reasoning for non-reasoning model');
        } else {
          assert.deepEqual(normalizedModel.reasoning.efforts, model.reasoning.efforts.map(({id, name}) => ({id, name})));
          assert.equal(normalizedModel.reasoning.defaultEffort, model.reasoning.defaultEffort);
          assert.deepEqual(Object.keys(normalizedModel.reasoning).sort(), ['defaultEffort', 'efforts'].filter(key => normalizedModel.reasoning[key] !== undefined).sort());
        }
      }
    }
    observed.push({name, providers: providers.length, groups: value.groups.length,
      models: value.groups.reduce((n, group) => n + group.models.length, 0), failures: value.failures.length});
    return {value, normalized, calls};
  }

  const mixed = await check('mixed-partial-provider-failure', ['alpha', 'beta', 'empty', 'broken', 'badExact']);
  assert.deepEqual(mixed.value.routableProviders, ['alpha', 'beta']);
  assert.deepEqual(mixed.value.failures.map(f => f.id), ['broken', 'badExact']);
  assert.equal(mixed.value.groups.some(g => g.id === 'badExact'), false, 'a resolve failure isolates the entire provider');
  assert.equal(mixed.value.groups.some(g => g.id === 'empty'), false, 'empty providers are not selectable');
  assert.deepEqual(mixed.normalized.groups[0].models[0].reasoning,
    {efforts: [{id: 'tiny', name: 'Short thought'}, {id: 'deep-native', name: 'Long thought'}], defaultEffort: 'tiny'});
  assert.equal(Object.hasOwn(mixed.normalized.groups[0].models[1], 'reasoning'), false);
  assert.equal(Object.hasOwn(mixed.normalized.groups[1].models[0].reasoning, 'defaultEffort'), false,
    'missing adapter default cannot be invented from the first effort');
  assert.equal(mixed.value.groups[0].models[0].name, 'Thought display', 'listing display identity is preserved');
  assert.deepEqual(mixed.value.groups[0].models[0].badge, listed.alpha[0].badge);
  assert.equal(Object.hasOwn(mixed.normalized.groups[0].models[0], 'badge'), false, 'picker whitelist discards unrelated metadata');
  await check('no-providers', []);
  const empty = await check('empty-provider', ['empty']);
  assert.deepEqual(empty.value.groups, []);
  assert.deepEqual(empty.value.failures, []);
  const failed = await check('all-providers-failed', ['broken', 'badExact']);
  assert.deepEqual(failed.value.groups, []);
  assert.equal(failed.value.failures.length, 2);

  // This exercises the real result schema too, rather than only searching source.
  const malformed = detached(mixed.value);
  malformed.groups[0].models[0].reasoning.efforts[0].id = 42;
  assert.throws(() => schema.parse(malformed));
  const oldShape = detached(mixed.value);
  oldShape.groups[0].models[0].reasoning = {levels: [{effort: 'tiny', label: 'Old shape'}]};
  assert.throws(() => schema.parse(oldShape), 'actual host schema must reject the stale levels contract');
  assert.deepEqual(selection, {provider: 'deployment-default', model: 'unlisted-default', reasoningEffort: 'unchanged'});
  assert.ok(Object.values(counters).every(value => value === 0), 'no forbidden service or network access');
  console.log(JSON.stringify({
    actualHostPublicMethod: 'SessionController.prototype.modelCatalog',
    actualGeneratedEndpoint: 'session/modelCatalog', actualGeneratedResultSchema: true,
    actualClientNormalizeCatalog: true, detachedLlmOnly: true, cases: observed,
    malformedReasoningRejected: true, liveCordisMount: false,
    liveRpcResultEnvelopeExecuted: false, profileChanged: false, filesWritten: 0,
    parentRouteChanged: false, routeAuthorizationTested: false, routingAccepted: false,
    nonReasoningCatalogMembershipDoesNotProveRoutability: true, ...counters, paidCalls: 0
  }, null, 2));
} finally {
  for (const restore of restores.reverse()) restore();
  syncBuiltinESMExports();
}
