import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { updateVolatile } from '@deepseek-ai/cosmokit'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, ReasoningEffortId, ToolCallId, type GenerateOptions } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import SubagentService from '@deepseek-ai/dsh-subagent'
import * as SubagentFork from '@deepseek-ai/dsh-subagent-fork-in-process'
import * as SubagentSpawn from '@deepseek-ai/dsh-subagent-spawn-in-process'
import * as ToolSubagent from '@deepseek-ai/dsh-tool-subagent'
import * as ToolSubagentControl from '@deepseek-ai/dsh-tool-subagent-control'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { MockAdapter, textResponse, toolCallResponse } from '../../../../core/agent-loop/tests/mock-adapter.ts'
import { mountWorkingDirectoryFixture } from '../../../../subagent/subagent/tests/working-directory-fixture.ts'
import TeamService from '../../../agent-team/src/index.ts'
import * as ToolTeam from '../../src/index.ts'
import Router from '@router-source/plugin.js'
import { RouterConfig, compilePluginConfig } from '@router-source/ui-config.js'

const SIGNAL = new AbortController().signal
const ROOT_ROUTE = { provider: 'mock-lead', model: 'lead-model', reasoningEffort: ReasoningEffortId('high') }
const ROUTE_A = { provider: 'mock-child-a', model: 'model-a', effort: 'low' }
const ROUTE_B = { provider: 'mock-child-b', model: 'model-b', effort: 'medium' }
const FORBIDDEN = { provider: 'mock-denied', model: 'forbidden-model', effort: 'low' }
const ALTERNATES = { provider: 'mock-child-a', model: 'model-a', effort: 'high' }
const POOL_ONLY = { provider: 'mock-lead', model: 'pool-only-model', effort: 'medium' }
const ENTRIES = ['subagent', 'routed_subagent', 'subagent_fork'] as const
type Entry = typeof ENTRIES[number]
type FixedRoute = { provider: string; model: string; effort: string }
const candidate = (id: string, route: FixedRoute) => ({ id, name: id, ...route })
const makeUi = (activeConfigId = 'first', enabled = true) => ({
  schemaVersion: 5,
  enabled,
  activeConfigId,
  candidates: [candidate('draft-only', POOL_ONLY)],
  configs: [
    { id: 'first', name: 'First preset', defaultCandidateId: 'a', candidates: [candidate('a', ROUTE_A), candidate('a-high', ALTERNATES), candidate('forbidden', FORBIDDEN)] },
    { id: 'second', name: 'Second preset', defaultCandidateId: 'b', candidates: [candidate('b', ROUTE_B)] },
    { id: 'denied-default', name: 'Denied preset', defaultCandidateId: 'forbidden', candidates: [candidate('forbidden', FORBIDDEN), candidate('a', ROUTE_A)] },
  ],
})

class FixtureSessionQuery extends SessionQueryEngine {
  override searchSessions(): Promise<never> { return Promise.reject(new Error('Search is not part of this fixture')) }
  override searchEvents(): Promise<never> { return Promise.reject(new Error('Search is not part of this fixture')) }
}

// Extend only advertised capabilities; the host MockAdapter is still the entire model transport.
class FixtureAdapter extends MockAdapter {
  override async resolveModel(provider: string, model: string) {
    return { ...await super.resolveModel(provider, model), inputModalities: ['text' as const], context: { contextWindow: 65_536 } }
  }
}

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  try {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
    if (vi.isMockFunction(globalThis.fetch)) expect(globalThis.fetch).not.toHaveBeenCalled()
    if (vi.isMockFunction(Socket.prototype.connect)) expect(Socket.prototype.connect).not.toHaveBeenCalled()
  } finally {
    vi.restoreAllMocks()
  }
})

async function setup(activeConfigId = 'first') {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw Error('The offline host fixture forbids network fetch') })
  vi.spyOn(Socket.prototype, 'connect').mockImplementation(() => { throw Error('The offline host fixture forbids socket connections') })
  const root = mkdtempSync(join(tmpdir(), 'dsh-unified-router-'))
  const auditFile = join(root, 'audit.jsonl')
  const ctx = new Context()
  cleanups.push(async () => {
    try {
      await ctx.fiber.dispose()
      expect(existsSync(auditFile + '.lock')).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  await mountAgentLoopTestDependencies(ctx)
  await mountWorkingDirectoryFixture(ctx)
  await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions') })
  await ctx.plugin(FixtureSessionQuery)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(SubagentService)
  expect(typeof ctx.subagents.registerModelRouteResolver, 'Apply the host model-route resolver changes before running this fixture').toBe('function')
  await ctx.plugin(ToolSubagentControl)
  await ctx.plugin(SubagentSpawn, { providerName: 'spawn' })
  await ctx.plugin(SubagentFork, { providerName: 'fork' })
  await ctx.plugin(TeamService)
  await ctx.plugin(ToolTeam)
  await ctx.plugin(ToolSubagent, { provider: 'spawn', toolName: 'subagent', modelSelection: true, modelDiscovery: true })
  // Deliberately omit modelSelection, as in the standard product fork composition.
  await ctx.plugin(ToolSubagent, { provider: 'fork', toolName: 'subagent_fork' })

  const scripts: ConstructorParameters<typeof MockAdapter>[0] = Array.from({ length: 64 }, () => textResponse('fixture response'))
  const adapter = new FixtureAdapter(scripts, {
    efforts: ['low', 'medium', 'high', 'adapter-default'].map(id => ({ id: ReasoningEffortId(id), name: id })),
    defaultEffort: ReasoningEffortId('adapter-default'),
  })
  ctx.llm.registerAdapter([ROOT_ROUTE.provider, ROUTE_A.provider, ROUTE_B.provider, FORBIDDEN.provider], adapter)
  const routerFiber = await ctx.plugin(Router, { ui: makeUi(activeConfigId), auditFile })
  const config = routerFiber.effectiveConfig as ReturnType<typeof RouterConfig>
  const lead = await ctx.agentLoop.create(SessionId('unified-router-lead'), ROOT_ROUTE)
  lead.session.append('subagent/model-selection-policy', {
    allowedModels: [ROOT_ROUTE, ROUTE_A, ROUTE_B, POOL_ONLY].map(({ provider, model }) => ({ provider, model })),
  })
  await ctx.agentTeams.setEnabled(lead, true)
  const team = await execute(ctx, lead, 'team_task_list', {})
  expect(team).toMatchObject({ isError: false, value: { tasks: [] } })
  const status = await execute(ctx, lead, 'router_status', {})
  expect(status).toMatchObject({ isError: false, value: { enabled: true, nativeRouteResolverAvailable: true, nativeSubagentAvailable: true } })

  const rows = (): AuditRow[] => existsSync(auditFile)
    ? readFileSync(auditFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    : []
  return {
    ctx, lead, adapter, scripts, rows,
    setUi(ui: ReturnType<typeof makeUi>) {
      // Host's stable volatile ref: the plugin is not disposed or re-mounted.
      updateVolatile(config.ui, RouterConfig({ ui, auditFile }).ui)
    },
  }
}
type Fixture = Awaited<ReturnType<typeof setup>>
type AuditRow = FixedRoute & { decisionId: string; candidateId: string; policyRevision: string; parentId: string; childId?: string; entry?: Entry; status: string }

let callNumber = 0
async function execute(ctx: Context, agent: Agent, name: string, args: object, id = 'fixture-call-' + ++callNumber) {
  const toolSet = await ctx.tools.resolve({ agent, modelSelection: ROOT_ROUTE, signal: SIGNAL })
  try {
    return await executeToolFixture(ctx, { name, callId: ToolCallId(id), arguments: args, signal: SIGNAL, agent, toolSet })
  } finally {
    toolSet.dispose()
  }
}

const task = (prompt: string) => ({ prompt, description: 'Read fixed fixture marker' })
const routeExpected = ({ provider, model, effort }: FixedRoute) => ({ provider, model, reasoningEffort: effort })
const offlineRevision = (ui: ReturnType<typeof makeUi>) => createHash('sha256').update(JSON.stringify(compilePluginConfig({ ui }).policy)).digest('hex')

async function runParent(lead: Agent, text: string) {
  lead.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
  await lead.whenIdle()
}

function modelText(request: GenerateOptions) {
  return request.messages.flatMap(message => message.content.flatMap(block => block.type === 'text' ? [block.text] : [])).join('\n')
}

async function evidence(f: Fixture, childId: SessionId, route: { provider: string; model: string; reasoningEffort: string }, prompt: string, inherited: boolean) {
  const first = await vi.waitFor(() => {
    const request = f.adapter.requests.find(request => request.sessionId === childId)
    expect(request, 'child must reach the real host LLM stream').toBeDefined()
    return request!
  }, { timeout: 5000 })
  expect(first, 'First transport request for: ' + prompt).toMatchObject(route)
  expect(modelText(first)).toContain(prompt)
  const persisted = await vi.waitFor(async () => {
    await using stored = await f.ctx.sessionPersistence.open(childId, 'read')
    const { events } = await stored.read()
    const own = events.slice(stored.inheritedEventCount)
    expect(own.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')).toBe(true)
    return { header: stored.header, events, inheritedEventCount: stored.inheritedEventCount }
  }, { timeout: 5000 })
  expect(persisted.header).toMatchObject({ id: childId, origin: 'subagent', parentSession: f.lead.id })
  const firstOwnedHeader = persisted.events.slice(persisted.inheritedEventCount).find(event => event.type === 'request/header')
  expect(firstOwnedHeader?.data.header.config, 'persisted first owned child request header').toMatchObject(route)
  expect(persisted.inheritedEventCount > 0, 'only a fork should have an inherited event prefix').toBe(inherited)
  using observed = await f.ctx.sessionQuery.observeSession(childId, { projectionMode: 'none' })
  expect(observed.header).toEqual(persisted.header)
  expect(observed.inheritedEventCount).toBe(persisted.inheritedEventCount)
  expect(observed.events.slice(observed.inheritedEventCount).find(event => event.type === 'request/header')?.data.header.config).toMatchObject(route)
  return first
}

async function start(f: Fixture, entry: Entry, prompt: string, selection = {}, callId?: string) {
  const result = await execute(f.ctx, f.lead, entry, { ...task(prompt), ...selection }, callId)
  expect(result.isError, entry + ': ' + JSON.stringify(result.content)).toBe(false)
  expect(result.value).toMatchObject({ kind: 'activation', name: expect.any(String) })
  const value = result.value as { kind: 'activation'; name: string; childId?: string }
  const found = await f.ctx.subagents.listDescendants(f.lead.id)
  const child = found.find(row => row.depth === 1 && row.name === value.name)
  expect(child, 'activation name must identify a direct catalog child').toBeDefined()
  if (entry === 'routed_subagent') expect(value.childId).toBe(child!.id)
  return { childId: child!.id, result }
}

async function audit(f: Fixture, childId: SessionId, entry: Entry, candidateId: string, route: FixedRoute, revision: string) {
  const group = await vi.waitFor(() => {
    const records = f.rows()
    const accepted = records.filter(row => row.childId === childId && row.status === 'accepted')
    expect(accepted).toHaveLength(1)
    const group = records.filter(row => row.decisionId === accepted[0]!.decisionId)
    expect(group.map(row => row.status)).toEqual(['intent', 'accepted', 'settled'])
    return group
  }, { timeout: 5000 })
  for (const row of group) {
    expect(row).toMatchObject({ ...route, candidateId, parentId: f.lead.id, policyRevision: revision })
    if (entry !== 'routed_subagent') expect(row.entry).toBe(entry)
    else expect([entry, undefined]).toContain(row.entry) // Legacy rows predate the explicit entry marker.
  }
  const status = await execute(f.ctx, f.lead, 'router_status', { child_id: childId })
  expect(status).toMatchObject({ isError: false, value: { observedChildRequestRoute: route } })
}

describe('one routing policy across real host creation tools', () => {
  it('routes all three defaults in both presets, then one off switch restores native routes and hides routed creation', async () => {
    const f = await setup()
    const history = 'FIRST_COMPLETED_PARENT_USER_TURN'
    await runParent(f.lead, history)
    for (const [preset, candidateId, route] of [['first', 'a', ROUTE_A], ['second', 'b', ROUTE_B]] as const) {
      const ui = makeUi(preset)
      if (preset === 'second') f.setUi(ui)
      const revision = offlineRevision(ui)
      const listing = await execute(f.ctx, f.lead, 'delegation_routes', {})
      expect(listing).toMatchObject({ isError: false, value: { defaultCandidateId: candidateId, policy_revision: revision } })
      for (const entry of ENTRIES) {
        const prompt = 'Create ' + entry + ' under ' + preset
        const { childId } = await start(f, entry, prompt)
        const first = await evidence(f, childId, routeExpected(route), prompt, entry === 'subagent_fork')
        expect(modelText(first).includes(history)).toBe(entry === 'subagent_fork')
        await audit(f, childId, entry, candidateId, route, revision)
      }
    }
    expect(f.rows()).toHaveLength(18)
    expect(new Set(f.rows().map(row => row.decisionId)).size).toBe(6)
    const checkpoint = f.rows()
    f.setUi(makeUi('second', false))
    const toolSet = await f.ctx.tools.resolve({ agent: f.lead, modelSelection: ROOT_ROUTE, signal: SIGNAL })
    try {
      const names = f.ctx.tools.schemas(f.lead, toolSet).map(tool => tool.name)
      expect(names).toEqual(expect.arrayContaining(['subagent', 'subagent_fork', 'team_task_list']))
      expect(names).not.toContain('routed_subagent')
    } finally { toolSet.dispose() }
    const out = await execute(f.ctx, f.lead, 'routed_subagent', task('must not create'))
    expect(out.isError).toBe(true)
    for (const entry of ['subagent', 'subagent_fork'] as const) {
      const prompt = 'Disabled fallback for ' + entry
      const { childId } = await start(f, entry, prompt)
      await evidence(f, childId, ROOT_ROUTE, prompt, entry === 'subagent_fork')
    }
    expect(f.rows()).toEqual(checkpoint)
    expect(await f.ctx.subagents.listDescendants(f.lead.id)).toHaveLength(8)
    expect(f.lead.session.requestHeader()?.config).toMatchObject(ROOT_ROUTE)
    expect(f.adapter.requests.filter(r => r.sessionId === f.lead.id).every(r => r.provider === ROOT_ROUTE.provider && r.model === ROOT_ROUTE.model && r.reasoningEffort === ROOT_ROUTE.reasoningEffort)).toBe(true)
  })

  it('routes a model-issued Team fork without inheriting the parent turn that issues it', async () => {
    const f = await setup()
    await runParent(f.lead, 'TEAM_FORK_COMPLETED_PARENT_TURN')
    const prompt = 'TEAM_FORK_NEW_WORK'
    f.scripts.unshift(toolCallResponse('model-team-fork', 'subagent_fork', { ...task(prompt), name: 'team-fork-run' }))
    await runParent(f.lead, 'TEAM_FORK_IN_FLIGHT_PARENT_TURN')
    const rootRequests = f.adapter.requests.filter(r => r.sessionId === f.lead.id)
    expect(rootRequests.find(r => modelText(r).includes('TEAM_FORK_IN_FLIGHT_PARENT_TURN'))?.tools?.map(tool => tool.name)).toEqual(expect.arrayContaining(['subagent_fork', 'team_task_list']))
    const child = (await f.ctx.subagents.listDescendants(f.lead.id)).find(row => row.name === 'team-fork-run')
    expect(child).toBeDefined()
    const first = await evidence(f, child!.id, routeExpected(ROUTE_A), prompt, true)
    expect(modelText(first)).toContain('TEAM_FORK_COMPLETED_PARENT_TURN')
    expect(modelText(first)).not.toContain('TEAM_FORK_IN_FLIGHT_PARENT_TURN')
    await audit(f, child!.id, 'subagent_fork', 'a', ROUTE_A, offlineRevision(makeUi()))
  })

  it('rejects unauthorized defaults on all entries, and rejects ambiguous selectors and draft-only ids without creating or auditing', async () => {
    const f = await setup('denied-default')
    await runParent(f.lead, 'prior completed turn')
    const requestCount = f.adapter.requests.length
    for (const entry of ENTRIES) {
      const result = await execute(f.ctx, f.lead, entry, task('unauthorized default'))
      expect(result.isError, JSON.stringify(result.content)).toBe(true)
      expect(JSON.stringify(result.content)).toMatch(/authorized|no route|eligible/i)
    }
    f.setUi(makeUi())
    for (const [entry, selection, expected] of [
      ['subagent', { provider: ROUTE_A.provider, model: ROUTE_A.model }, /several candidates|ambiguous/i],
      ['subagent', { candidate_id: 'draft-only' }, /does not exist/i],
      ['subagent_fork', { candidate_id: 'draft-only' }, /does not exist/i],
      ['routed_subagent', { candidate_id: 'draft-only' }, /does not exist/i],
    ] as const) {
      const result = await execute(f.ctx, f.lead, entry, { ...task('reject invalid selection'), ...selection })
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result.content)).toMatch(expected)
    }
    expect(f.adapter.requests).toHaveLength(requestCount)
    expect(await f.ctx.subagents.listDescendants(f.lead.id)).toEqual([])
    expect(f.rows()).toEqual([])
  })

  it('pins explicit fixed effort and does not create or audit twice when a call identity is repeated', async () => {
    const f = await setup()
    await runParent(f.lead, 'prior completed turn')
    const revision = offlineRevision(makeUi())
    for (const entry of ENTRIES) {
      const prompt = 'Select explicit effort through ' + entry
      const callId = 'repeat-' + entry
      const selection = entry === 'subagent'
        ? { provider: ALTERNATES.provider, model: ALTERNATES.model, reasoning_effort: ALTERNATES.effort }
        : { candidate_id: 'a-high' }
      const { childId, result } = await start(f, entry, prompt, selection, callId)
      await evidence(f, childId, routeExpected(ALTERNATES), prompt, entry === 'subagent_fork')
      await audit(f, childId, entry, 'a-high', ALTERNATES, revision)
      const checkpoint = f.rows()
      const duplicate = await execute(f.ctx, f.lead, entry, { ...task(prompt), ...selection }, callId)
      if (entry === 'routed_subagent') expect(duplicate).toMatchObject({ isError: false, value: result.value })
      else {
        expect(duplicate.isError).toBe(true)
        expect(JSON.stringify(duplicate.content)).toMatch(/already submitted|already.*dispatch|already.*started/i)
      }
      expect(f.rows()).toEqual(checkpoint)
    }
    expect(await f.ctx.subagents.listDescendants(f.lead.id)).toHaveLength(3)
    expect(f.adapter.requests.filter(r => r.sessionId !== f.lead.id)).toHaveLength(3)
    expect(f.rows()).toHaveLength(9)
  })
})
