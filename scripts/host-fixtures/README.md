# Unified delegation — isolated DSH host fixture

Run from the plugin checkout with Node 24.9+ and a separate DSH **source worktree**
whose frozen dependencies are already installed. The host must include the
native model-route resolver implementation and its in-process fork integration.
Do not point this runner at an installed or running DSH.

```powershell
node scripts/host-fixtures/run-unified-router.mjs "<path-to-isolated-dsh-worktree>" --reporter=verbose
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

Assertions link the child catalog and plugin audit to the first MockAdapter
request, first child-owned persisted `request/header`, and SessionQuery read.
They cover both presets on all three entrances, disabled fallback, inherited
fork history (without the in-flight parent turn), parent route isolation,
unauthorized/ambiguous/draft-only refusals, and repeated call/audit idempotency.

The suite is not an installed-build, browser, or external-provider test. To run
the original Team baseline separately, change to the host worktree and run:

```powershell
node ./node_modules/vitest/vitest.mjs run packages/team/tool-agent-team/tests/tool-team.spec.ts
```
