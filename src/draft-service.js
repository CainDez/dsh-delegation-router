import { normalizeGenerationRequest, validateProfiles, buildGenerationMessages, parseGeneratedDraft, validateDraftRequest } from './config-draft.js';

const serviceErrors = new WeakSet();
const failure = (code, message) => { const error = Object.assign(new Error(message), { code }); serviceErrors.add(error); return error; };
export const isDraftServiceError = error => error !== null && typeof error === 'object' && serviceErrors.has(error);
const routeOf = ({ provider, model, effort }) => ({ provider, model, ...(effort === null ? {} : { reasoningEffort: effort }) });
const profileKey = ({ provider, model, effort }) => JSON.stringify([provider, model, effort]);

/** One-shot settings assistant. No sessions, tools, settings writes, retries or fallback. */
export class DraftService {
  constructor(llm, { timeoutMs = 120000, readScopePool } = {}) {
    this.llm = llm; this.timeoutMs = timeoutMs; this.readScopePool = readScopePool; this.active = new Set(); this.closed = false;
  }
  assertScopeInPool(scope) {
    const pool = this.readScopePool?.();
    // Unnamed v3 (and absent settings) retain their original catalog-only scope.
    if (pool === undefined) return;
    const counts = new Map();
    for (const entry of pool) {
      const key = profileKey(entry);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (scope.some(entry => counts.get(profileKey(entry)) !== 1)) {
      throw failure('DRAFT_SCOPE_NOT_IN_POOL', 'Every scope profile must match exactly one entry in the saved draft pool. Refresh the scope or edit the pool before retrying.');
    }
  }
  async run(operation, parentSignal) {
    if (this.closed) throw failure('GENERATOR_CLOSED', 'Configuration generator has been disposed.');
    if (this.active.size) throw failure('GENERATOR_BUSY', 'A configuration request is still running; no duplicate call was started.');
    parentSignal?.throwIfAborted();
    const controller = new AbortController(); this.active.add(controller);
    const abort = () => controller.abort(parentSignal.reason);
    parentSignal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(failure('GENERATION_TIMEOUT', 'Configuration request timed out. No retry or model substitution was attempted.')), this.timeoutMs);
    timer.unref?.();
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason ?? failure('ABORTED', 'Configuration request cancelled.'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const work = Promise.resolve().then(() => { controller.signal.throwIfAborted(); return operation(controller.signal); });
    // Keep the concurrency slot until the underlying adapter really settles, even
    // if a non-cooperative adapter ignores cancellation after a timeout.
    const settled = work.finally(() => {
      clearTimeout(timer); parentSignal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', onAbort); this.active.delete(controller);
    });
    return Promise.race([settled, aborted]);
  }
  generateDraft(raw, signal) {
    const request = normalizeGenerationRequest(raw);
    return this.run(async signal => {
      this.assertScopeInPool(request.scope);
      await validateProfiles([request.generator, ...request.scope], (p, m, s) => this.llm.resolveModelInfo(p, m, s), signal);
      signal.throwIfAborted();
      this.assertScopeInPool(request.scope);
      const route = routeOf(request.generator);
      const call = await this.llm.prepareCall({ ...route, maxTokens: 8192 }, signal);
      signal.throwIfAborted();
      if (call.config.provider !== route.provider || call.config.model !== route.model || call.config.reasoningEffort !== route.reasoningEffort) {
        throw failure('GENERATOR_ROUTE_CHANGED', 'Prepared provider, model or effort differs from the selected execution profile.');
      }
      if (!call.inputModalities?.includes('text')) throw failure('INVALID_PROFILE', 'Prepared generator does not advertise text input.');
      const messages = buildGenerationMessages(request);
      const system = messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
      const options = { ...call.config, system, messages: messages.filter(message => message.role === 'user').map(message => ({ role: 'user', content: [{ type: 'text', text: message.content }] })), signal };
      const text = await collectDraftText(call.stream(options), signal);
      signal.throwIfAborted();
      const draft = parseGeneratedDraft(text, request);
      // Reject catalog drift during generation, rather than quietly changing effort.
      await validateProfiles(request.scope, (p, m, s) => this.llm.resolveModelInfo(p, m, s), signal);
      signal.throwIfAborted();
      this.assertScopeInPool(request.scope);
      return draft;
    }, signal);
  }
  validateDraft(raw, signal) {
    const draft = validateDraftRequest(raw);
    return this.run(async signal => {
      this.assertScopeInPool(draft.scope);
      await validateProfiles(draft.scope, (p, m, s) => this.llm.resolveModelInfo(p, m, s), signal);
      signal.throwIfAborted();
      this.assertScopeInPool(draft.scope);
      return { candidates: draft.candidates, defaultCandidateId: draft.defaultCandidateId };
    }, signal);
  }
  close() {
    this.closed = true;
    for (const controller of this.active) controller.abort(failure('GENERATOR_CLOSED', 'Configuration generator has been disposed.'));
  }
}

/** Host block-end is authoritative; deltas only enforce an early output bound. */
export async function collectDraftText(stream, signal) {
  const blocks = new Map(); let finish; let deltaBytes = 0; let blockBytes = 0;
  for await (const chunk of stream) {
    signal.throwIfAborted();
    if (finish) throw failure('INVALID_GENERATION_STREAM', 'Generator emitted data after its terminal finish.');
    if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      deltaBytes += Buffer.byteLength(chunk.text, 'utf8');
      if (deltaBytes > 262144) throw failure('GENERATION_TOO_LARGE', 'Generator output exceeded the bounded configuration response size.');
    } else if (chunk.type === 'block-end') {
      if (!Number.isSafeInteger(chunk.index) || chunk.index < 0 || blocks.has(chunk.index)) throw failure('INVALID_GENERATION_STREAM', 'Invalid or duplicate response block.');
      const block = chunk.block;
      if (block.type !== 'text' && block.type !== 'reasoning') throw failure('INVALID_GENERATION_STREAM', 'Configuration generation may return text only; tool calls are not allowed.');
      if (typeof block.text !== 'string') throw failure('INVALID_GENERATION_STREAM', 'Malformed text response.');
      blockBytes += Buffer.byteLength(block.text, 'utf8');
      if (blockBytes > 262144 || blocks.size >= 256) throw failure('GENERATION_TOO_LARGE', 'Generator response exceeded its size limit.');
      blocks.set(chunk.index, block);
    } else if (chunk.type === 'finish') finish = chunk.reason;
    else if (chunk.type === 'tool-call-delta') throw failure('INVALID_GENERATION_STREAM', 'Configuration generation cannot execute tools.');
  }
  signal.throwIfAborted();
  if (finish?.kind !== 'stop') {
    const reason = ['error', 'aborted', 'max-tokens', 'tool-calls'].includes(finish?.kind) ? finish.kind : finish ? 'unknown finish' : 'missing finish';
    throw failure('GENERATION_INCOMPLETE', 'Generator did not finish successfully (' + reason + '). No configuration was applied.');
  }
  const text = [...blocks].sort(([a], [b]) => a - b).filter(([, block]) => block.type === 'text').map(([, block]) => block.text).join('');
  if (!text.trim() || Buffer.byteLength(text, 'utf8') > 65536) throw failure('INVALID_GENERATED_DRAFT', 'Generator returned empty or oversized configuration text.');
  return text;
}
