# Unified delegation — isolated DSH host fixture

Run from the plugin checkout with Node 24.9+ and a separate DSH **source worktree**
whose frozen dependencies are already installed. The default (patched) mode
requires the native model-route resolver and its in-process fork integration.
Use `--stock` for an unmodified DSH 0.2.2-rc.5 worktree. Do not point the runner at
an installed or running DSH.

```powershell
node scripts/host-fixtures/run-unified-router.mjs "<path-to-isolated-patched-dsh-worktree>" --reporter=verbose
node scripts/host-fixtures/run-unified-router.mjs "<path-to-isolated-stock-dsh-worktree>" --stock --reporter=verbose
```

The runner stages the current plugin `src/` and test in a uniquely named child
directory of the host Team tests. Vite uses `@router-source` for that staged
plugin and the host’s `tsconfig.base.json` aliases for shared host modules.
The runner does not install dependencies or patch host source and removes its
staging directory on ordinary exits. Tests use temporary JSONL session and
audit files; the only LLM transport is the host `MockAdapter`. Fetch and
socket connection attempts in the fixture are rejected and counted as failures.

The suite mounts the host AgentLoop, Team service and tools, native spawn and
fork providers, JSONL persistence, and SessionQuery, following the host
`tool-team.spec.ts` composition. Fork deliberately leaves `modelSelection`
unset, like the standard product composition. Preset changes and the toggle
use the host’s volatile settings reference without remounting the plugin;
this does not exercise browser settings or the profile loader UI.

The stock cases verify that two presets appear in the actual root request's
system prompt, that scripted model calls to `routed_subagent` hit those child routes
with and without Teams, and that the returned name is assignable to a Team task.
They also verify the guidance disappears when disabled, direct native calls are
unchanged, and exposing fork model selection alone does not supersede inherited
request routing after a completed parent turn.

Assertions link the child catalog and plugin audit to the first MockAdapter
request, first child-owned persisted `request/header`, and SessionQuery read.
They cover both presets on the native entrances and the routed tools, disabled
fallback, inherited history (without the in-flight parent turn), parent route
isolation, unauthorized/ambiguous/draft-only refusals, and repeated call/audit
idempotency. The plugin fork case also checks that the native guard receives the
selected route, a denial creates no child, and stock mode does not advertise
the plugin fork.

The suite is not an installed-build, browser, or external-provider test. To run
the original Team baseline separately, change to the host worktree and run:

```powershell
node ./node_modules/vitest/vitest.mjs run packages/team/tool-agent-team/tests/tool-team.spec.ts
```
