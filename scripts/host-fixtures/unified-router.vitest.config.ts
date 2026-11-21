import { relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { standardDecoratorPlugin, vitestExecArgv } from '../../../../../vitest.shared.ts'

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const root = local('../../../../../')

export default defineConfig({
  root,
  cacheDir: local('./vite-cache'),
  plugins: [
    // Same source resolution as the host suites, including the plugin's JS imports.
    tsconfigPaths({ projects: [local('../../../../../tsconfig.base.json')], loose: true }),
    standardDecoratorPlugin(),
  ],
  resolve: { alias: { '@router-source': local('./plugin-src') } },
  test: {
    name: 'delegation-router-host-fixture',
    include: [relative(root, local('./unified-router.spec.ts')).split(sep).join('/')],
    execArgv: vitestExecArgv,
    pool: 'forks',
    testTimeout: 15_000,
  },
})
