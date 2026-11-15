import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
// Isolated Host API stubs: this suite never loads an installed plugin, edits a
// profile, creates an audit file, or creates a child. Production code is imported.
const schema = 'const node=new Proxy(function(){return node},{get(){return node},apply(_target,receiver,args){return receiver===undefined&&args[0]&&typeof args[0]==="object"?args[0]:node}});export default node;export const z=node;';
const modules = {
  '@deepseek-ai/cordis': 'export class Service {static init=Symbol.for("identity-test-init");constructor(ctx,name){this.ctx=ctx;ctx.services.set(name,this)}}',
  '@deepseek-ai/schemastery': schema,
  '@deepseek-ai/cosmokit': 'export const isVolatile=()=>false;',
  zod: schema,
  '@deepseek-ai/dsh-tools': 'export const defineTool=value=>value;',
  '@deepseek-ai/dsh-tools/pipeline': 'export class ToolExecutionPipeline {}',
  '@deepseek-ai/dsh-subagent': 'export const parentAgentOptionsForDelegation=parent=>({...parent.session.requestHeader().config});'
};
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (Object.hasOwn(modules, specifier)) return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
  return next(specifier, context);
} });
after(() => hooks.deregister());
const { default: RouterService } = await import('../src/plugin.js');
const { authorizationProjection, createAuthorizationReader } = await import('../src/authorization.js');
const { compilePluginConfig } = await import('../src/ui-config.js');
const read = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const manifest = JSON.parse(await read('package.json'));
const sample = JSON.parse(await read('examples/ui-glm.json'));
const presetSample = JSON.parse(await read('examples/presets.json'));
const policySample = presetSample.ui;
const browserSource = await read('client.js');
let definition;
vm.runInNewContext(browserSource, { setTimeout, clearTimeout, window: { __ModuleLoader__: { load: value => { definition = value; } } } });
const client = definition.factory(name => { assert.equal(name, 'react'); return { createElement: (type, props) => ({ type, props }) }; });
const profileDir = path.join(tmpdir(), 'delegation-router-identity-profile');
function host(config = {}) {
  const services = new Map(), tools = new Map(), effects = [];
  const ctx = {
    services, get: name => name === 'profileContext' ? { dir: profileDir } : services.get(name),
    agents: { get() {} }, tools: { register: (tool, options) => tools.set(tool.name, { tool, options }) },
    llm: {}, on() {}, effect: fn => effects.push(fn()),
    sessionProjections: { async register(projection) { ctx.projection = projection; return { stateOf: () => null }; } }
  };
  const service = new RouterService(ctx, config);
  return { ctx, service, services, tools, dispose() { for (const off of effects.reverse()) off(); } };
}
function browserHost() {
  let snapshot = { status: 'ready', writable: true, revision: 1, value: { ui: copy(client.defaults()) }, user: {} };
  const namespaces = [], slots = [], mutations = [], effects = [];
  const form = { getSnapshot: () => snapshot, subscribe: () => () => {} };
  const ctx = {
    configForms: { get: name => { namespaces.push(['form', name]); return form; }, describe: () => ({ async load() {} }) },
    locale: { bind: name => { namespaces.push(['bind', name]); return key => key; }, register: name => { namespaces.push(['locale', name]); return () => {}; } },
    remote: { $on: () => () => {}, session: { async modelCatalog() { return { ok: true, value: { groups: [], failures: [] } }; } }, settings: { async mutate(name, ops, revision) {
      mutations.push({ name, ops: copy(ops), revision });
      snapshot = { ...snapshot, revision: revision + 1, value: { ui: copy(ops[1].value) }, user: { ui: copy(ops[1].value) } };
      return { ok: true };
    } } },
    on() {}, effect: fn => effects.push(fn()),
    slots: { inject: (_name, fn) => fn(), register: (options, component) => { slots.push({ options: copy(options), component }); return () => {}; } }
  };
  return { ctx, namespaces, slots, mutations, dispose() { for (const off of effects.reverse()) off(); } };
}

test('published manifest, repository, exports and disabled Cordis patch use the independent identity', async () => {
  assert.equal(manifest.name, 'dsh-delegation-router'); assert.equal(manifest.version, '0.8.2');
  assert.equal(manifest.repository.url, 'git+https://github.com/CainDez/dsh-delegation-router.git');
  assert.equal(manifest.exports['.'], './src/plugin.js'); assert.equal(manifest.exports['./client'], './client.js');
  assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './client', './locale/*.json', './icon', './package.json'].sort());
  for(const name of ['core','policy','config','ui-config','team-compat'])assert.throws(()=>import.meta.resolve(manifest.name+'/'+name),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  for(const name of ['test','scripts','compat'])assert.equal(manifest.files.includes(name),false);
  for(const name of ['@deepseek-ai/dsh-llm','@deepseek-ai/dsh-brand'])assert.equal(Object.hasOwn(manifest.peerDependencies,name),false);
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-api-remotes'));
  const patch = await read('cordis.patch.yml');
  assert.match(patch, /id: delegation-router/); assert.match(patch, /name: dsh-delegation-router/); assert.match(patch, /config: [{][}]/);
  assert.doesNotMatch(patch, /enabled: true|agent-team|subagent-router/);

});

test('actual browser module binds new locale, configuration namespace and keyed slots together', () => {
  assert.equal(definition.id, manifest.name);
  const h = browserHost(); client.apply(h.ctx);
  assert.deepEqual(h.namespaces, [['bind', 'delegationRouter'], ['locale', 'delegationRouter'], ['form', 'delegation-router']]);
  assert.deepEqual(h.slots.map(row => row.options), [
    { name: 'plugins.bundle.config', key: 'dsh-delegation-router' },
    { name: 'plugins.row.config', key: 'dsh-delegation-router#delegation-router' }
  ]);
  h.dispose();
});

test('browser saves only the new entry with an atomic revision-protected policy/UI mutation', async () => {
  const h = browserHost(), editor = new client.RouterEditor(h.ctx, key => key);
  editor.edit(draft=>{draft.limits.maxCreationsPerParent=12;}); assert.equal(await editor.save(), true);
  assert.equal(h.mutations.length, 1); assert.equal(h.mutations[0].name, 'delegation-router'); assert.equal(h.mutations[0].revision, 1);
  assert.deepEqual(h.mutations[0].ops.map(op => [op.op, op.path]), [['unset', ['policy']], ['set', ['ui']]]);
  assert.equal(h.mutations[0].ops[1].value.enabled, false); assert.equal(Object.hasOwn(h.mutations[0].ops[1].value,'teams'), false);
  editor.dispose(); h.dispose();
});

test('Cordis service, independent authorization projection and all four public tool names remain aligned', async () => {
  const h = host(); await h.service[Symbol.for('identity-test-init')]();
  assert.equal(h.services.get('delegationRouter'), h.service); assert.equal(h.services.has('subagentRouter'), false);
  assert.equal(h.ctx.projection.key, 'delegationRouterAuthorization');
  assert.deepEqual([...h.tools.keys()].sort(), ['delegation_routes', 'routed_subagent', 'router_status', 'router_reconcile'].sort());
  assert.equal(h.service.configuration().policy.enabled, false); assert.equal(Object.hasOwn(h.service.configuration().policy,'teams'), false);
  assert.equal(h.service.manager.status().enabled, false); assert.equal(h.service.manager.journal, undefined);
  h.dispose();
});

test('new default audit directory is profile-local while explicit legacy audit paths are never rewritten', () => {
  const h = host(); assert.equal(h.service.auditFile, path.join(profileDir, 'delegation-router', 'audit.jsonl'));
  const legacyPath = path.join(profileDir, 'subagent-router', 'audit.jsonl');
  const config = copy(sample); config.ui.enabled = true; config.auditFile = legacyPath;
  const before = copy(config); const explicit = host(config);
  assert.equal(explicit.service.auditFile, legacyPath); assert.equal(explicit.service.configuration().auditFile, legacyPath);
  assert.equal(compilePluginConfig(config).auditFile, legacyPath); assert.deepEqual(config, before);
  // Construction alone must never open, copy, recover, migrate or clear a journal.
  assert.equal(explicit.service.manager, undefined); assert.equal(h.service.manager, undefined);
});

test('rename does not expand native authorization or replace its first-event source', () => {
  assert.equal(authorizationProjection.key, 'delegationRouterAuthorization');
  assert.notEqual(authorizationProjection.key, 'subagentModelSelectionPolicy');
  const first = { type: 'subagent/model-selection-policy', data: { allowedModels: [{ provider: 'authorized', model: 'exact' }] } };
  const original = copy(first); const state = authorizationProjection.apply(null, first);
  assert.deepEqual(state, first.data.allowedModels); assert.deepEqual(first, original);
  assert.equal(authorizationProjection.apply(state, { type: first.type, data: { allowedModels: [{ provider: 'other', model: 'other' }] } }), state);
  const parent = { options: Object.freeze({ provider: 'stale', model: 'stale' }), session: { requestHeader: () => ({ config: { provider: 'current', model: 'current' } }) } };
  assert.deepEqual(createAuthorizationReader({ stateOf: () => null })(parent), [{ provider: 'current', model: 'current' }]);
  assert.throws(() => createAuthorizationReader({ stateOf: () => undefined })(parent), { code: 'AUTHORIZATION_UNAVAILABLE' });
});

test('runtime sources and shipped identity-bearing configuration contain no legacy service or namespace', async () => {
  const sources = (await readdir(new URL('../src/', import.meta.url))).filter(name => name.endsWith('.js')).map(name => 'src/' + name);
  for (const relative of [...sources, 'client.js', 'cordis.patch.yml']) {
    assert.doesNotMatch(await read(relative), /subagentRouter|dsh-subagent-router|['"]subagent-router['"]/, relative);
  }
});

test('both example entry paths and UI defaults stay opt-in and never automatically enable Team routing', () => {
  for (const input of [{}, sample, presetSample, {policy:policySample}]) {
    const compiled = compilePluginConfig(input);
    assert.equal(compiled.policy.schemaVersion,2); assert.equal(compiled.migrationRequired,false);
    assert.equal(compiled.policy.enabled, false); assert.equal(Object.hasOwn(compiled.policy,'teams'), false);
    for(const field of ['models','rules','lanes','review','guidance'])assert.equal(Object.hasOwn(compiled.policy,field),false);
  }
  for (const ui of [client.defaults(), client.draftFrom({})]) {
    assert.equal(ui.enabled, false); assert.equal(Object.hasOwn(ui,'teams'), false);
  }
});
