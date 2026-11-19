/** Run all detached host contracts against a trusted, installed DSH distribution. */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = 'Usage: node scripts/verify-host-matrix.js <runtime/package.json> [<exact-version>]\n' +
  'For a Desktop ASAR, use its matching Electron executable with ELECTRON_RUN_AS_NODE=1 instead of node.';
const versionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const runtimeNames = new Set(['@deepseek-ai/dsh', '@deepseek-ai/dsh-desktop-runtime']);
const checks = [
  ['verify-host-api.js', 'realHostSchemaAndToolLibrary'],
  ['verify-host-draft.js', 'actualScopedBrowserPlugin'],
  ['verify-host-lifecycle.js', 'shippedSessionQuery'],
  ['verify-host-model-catalog.js', 'actualGeneratedResultSchema'],
];

function isolatedEnv(home) {
  // Do not inherit DSH settings, Node preloads, credentials, or CI secrets.
  const env = Object.fromEntries(['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMPDIR', 'TEMP', 'TMP',
    'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME'].map(key => [key, home]));
  for (const key of ['SYSTEMROOT', 'WINDIR']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1';
  return env;
}

async function run(args) {
  const [manifestPath, expectedVersion] = args;
  if (!manifestPath || args.length > 2 || basename(manifestPath) !== 'package.json' ||
      (expectedVersion !== undefined && !versionPattern.test(expectedVersion))) throw Error(usage);
  const manifest = resolve(manifestPath);
  if (/\.asar[/\\]/i.test(manifest) && !process.versions.electron) throw Error(usage);
  const {name, version} = JSON.parse(await readFile(manifest, 'utf8'));
  if (!runtimeNames.has(name) || typeof version !== 'string' || !versionPattern.test(version)) {
    throw Error('Expected an official @deepseek-ai/dsh or @deepseek-ai/dsh-desktop-runtime package.json.');
  }
  if (expectedVersion !== undefined && version !== expectedVersion) {
    throw Error(`Expected DSH ${expectedVersion}, received ${version}.`);
  }
  const home = await mkdtemp(join(tmpdir(), 'dsh-host-contract-'));
  const failed = [];
  console.log(`Checking ${name}@${version} (Node ${process.versions.node}${process.versions.electron ? ', Electron ' + process.versions.electron : ''}).`);
  try {
    for (const [script, proof] of checks) {
      console.log(`
--- ${script} ---`);
      const child = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), manifest], {
        cwd: home, env: isolatedEnv(home), shell: false, windowsHide: true, encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
      });
      if (child.stdout) process.stdout.write(child.stdout);
      if (child.stderr) process.stderr.write(child.stderr);
      try {
        if (child.error) throw child.error;
        if (child.status !== 0 || child.signal) throw Error(`exit=${child.status}, signal=${child.signal}`);
        const report = JSON.parse(child.stdout);
        if (report?.[proof] !== true || report.networkAttempts !== 0 ||
            report.processAttempts !== 0 || report.paidCalls !== 0 ||
            (script !== 'verify-host-model-catalog.js' && report.hostVersion !== version)) {
          throw Error('Missing successful detached-host contract evidence.');
        }
      } catch (error) {
        failed.push(script);
        console.error(`FAIL ${script}: ${error.message}`);
      }
    }
  } finally {
    await rm(home, {recursive: true, force: true});
  }
  if (failed.length) throw Error(`DSH ${version}: failed ${failed.length}/${checks.length} host checks: ${failed.join(', ')}.`);
  console.log(`
DSH ${version}: all ${checks.length} detached host checks passed.`);
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
