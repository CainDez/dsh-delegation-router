import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const sources = ['client.js', ...readdirSync(resolve(root, 'src')).filter(name => name.endsWith('.js')).map(name => 'src/' + name)];
for (const file of sources) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'inherit' });
  assert.equal(result.status, 0, 'Invalid JavaScript: ' + file);
}
const pkg = JSON.parse(read('package.json'));
for (const path of Object.values(pkg.exports).filter(path => !path.includes('*'))) assert.ok(existsSync(resolve(root, path)), 'Missing export: ' + path);
for (const name of ['zh', 'zh-CN', 'en', 'en-US']) JSON.parse(read('locale/' + name + '.json'));
const sample = JSON.parse(read('examples/candidates.json'));
normalizeConfig(sample.ui);
assert.equal(sample.ui.enabled, false, 'Example must stay opt-in');
assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-api-remotes'));
const client = read('client.js');
assert.ok(client.includes('this.ctx.remote.session.modelCatalog()'));
assert.ok(client.includes('window.__ModuleLoader__.load'));
assert.ok(client.includes("'dsh-delegation-router#delegation-router'"));
console.log('Syntax, exports, locales, sample and native client bindings verified.');
