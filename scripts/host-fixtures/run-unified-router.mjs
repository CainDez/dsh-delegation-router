import { spawnSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [hostInput, ...vitestArgs] = process.argv.slice(2);
if (!hostInput) {
  console.error('Usage: node scripts/host-fixtures/run-unified-router.mjs <isolated-dsh-source-worktree> [Vitest flags]');
  process.exit(2);
}
const host = realpathSync(resolve(hostInput));
const intendedParent = join(host, 'packages', 'team', 'tool-agent-team', 'tests');
const parent = realpathSync(intendedParent);
if (parent !== intendedParent) throw Error('Expected a physical host Team tests directory (no symlink/junction)');
const vitest = join(host, 'node_modules', 'vitest', 'vitest.mjs');
for (const file of [join(parent, 'tool-team.spec.ts'), join(host, 'vitest.shared.ts'), join(host, 'tsconfig.base.json'), vitest]) {
  if (!existsSync(file)) throw Error('Expected a DSH source worktree with its frozen dependencies installed; missing ' + file);
}

const here = dirname(fileURLToPath(import.meta.url));
const prefix = 'delegation-router-host-fixture-';
const staged = mkdtempSync(join(parent, prefix));
try {
  cpSync(join(here, '..', '..', 'src'), join(staged, 'plugin-src'), { recursive: true, errorOnExist: true, force: false });
  for (const file of ['unified-router.spec.ts', 'unified-router.vitest.config.ts']) {
    copyFileSync(join(here, file), join(staged, file));
  }
  const result = spawnSync(process.execPath, [vitest, 'run', '--config', join(staged, 'unified-router.vitest.config.ts'), ...vitestArgs], {
    cwd: host,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  const target = realpathSync(staged);
  if (dirname(target) !== parent || !basename(target).startsWith(prefix) || relative(parent, target).includes(sep)) {
    throw Error('Refusing to remove an unexpected staging path: ' + target);
  }
  rmSync(target, { recursive: true });
}
