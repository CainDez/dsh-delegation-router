import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('package.json'));

test('public metadata preserves npm publish guard and independent plugin identity', () => {
  assert.equal(manifest.private, true);
  assert.equal(manifest.homepage, 'https://github.com/CainDez/dsh-delegation-router#readme');
  assert.equal(manifest.bugs.url, 'https://github.com/CainDez/dsh-delegation-router/issues');
  assert.ok(manifest.keywords.includes('dsh-plugin'));
});

test('locale aliases stay identical and describe autosave and authorization', async () => {
  for (const [canonical, alias] of [['zh-CN', 'zh'], ['en-US', 'en']]) {
    const locale = JSON.parse(await read('locale/' + canonical + '.json'));
    assert.deepEqual(locale, JSON.parse(await read('locale/' + alias + '.json')));
    assert.match(locale.meta.description, /自动保存|autosaved/);
    assert.match(locale.meta.description, /授权|authorization/);
  }
});

test('shipped user documentation has no broken relative Markdown links', async () => {
  const files = new Set([...manifest.files, 'package.json']);
  for (const file of manifest.files.filter(name => name.endsWith('.md'))) {
    const text = await read(file);
    for (const match of text.matchAll(/\]\(<([^>]+)>\)/g)) {
      const target = match[1].split('#')[0];
      if (/^[a-z]+:/i.test(target) || !target) continue;
      assert.ok(files.has(target), file + ': linked file is not shipped: ' + target);
      await read(target);
    }
  }
});

test('installation example uses a portable archive path', async () => {
  const installation = await read('INSTALLATION.md');
  assert.ok(installation.includes('./dsh-delegation-router-' + manifest.version + '.tgz'));
  assert.doesNotMatch(installation, /[A-Z]:\\|\/Users\/|\/home\//);
});
