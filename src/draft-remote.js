import { DraftService, isDraftServiceError } from './draft-service.js';
import { normalizeGenerationRequest, validateDraftRequest, isDraftValidationError } from './config-draft.js';

const codec = (name, parse) => ({ mode: 'strict', typeSymbol: 'dsh-delegation-router#' + name, create: () => ({ parse }) });
function draftResult(value) {
  if (!value || !Array.isArray(value.candidates) || typeof value.defaultCandidateId !== 'string') throw Error('Invalid draft service result');
  // Results are assembled by the bounded domain validator, never raw model output.
  return value;
}
export function draftDescriptors() {
  return [
    ['generateDraft', normalizeGenerationRequest],
    ['validateDraft', validateDraftRequest],
  ].map(([method, parse]) => ({
    id: 'dsh-delegation-router#delegationRouter/' + method,
    service: 'delegationRouter', namespace: 'delegationRouter', method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec(method + 'Request', parse) }],
    cancellation: { parameter: 'signal' },
    result: codec(method + 'Result', draftResult),
  }));
}

/** Optional settings RPC face; CLI/headless routing continues without a gateway. */
export async function mountDraftRemote(service) {
  const registry = service.ctx.get('typert');
  if (!registry) return;
  const { bindTypertRemote, RemoteError } = await import('@deepseek-ai/dsh-typert-protocol');
  service.typertRemote = bindTypertRemote(service, 'delegationRouter');
  service.draftService = new DraftService(service.ctx.llm);
  service.draftRemoteError = RemoteError;
  service.ctx.effect(() => () => service.draftService.close(), 'delegationRouter.draft-generation');
  registry.register({ package: 'dsh-delegation-router', face: 'host', schemas: [], model: { services: [], events: [], objects: [] }, invocations: draftDescriptors() });
}

export async function invokeDraftRemote(service, method, request, signal) {
  // Configuration generation is an owner settings action, never a session tool
  // or a new entitlement for workspace-scoped remote principals.
  const RemoteError = service.draftRemoteError;
  if (!RemoteError || service.ctx.invocation?.peer?.principal?.kind !== 'owner') {
    if (RemoteError) throw new RemoteError('gateway/forbidden', 'Configuration drafts require the authenticated owner settings connection.', {});
    throw Error('Configuration draft RPC is unavailable.');
  }
  try { return await service.draftService[method](request, signal); }
  catch (error) {
    // Never send adapter exception text (it may contain URLs or credential details).
    const safe = isDraftServiceError(error) || isDraftValidationError(error);
    const code = safe ? error.code : 'GENERATION_FAILED';
    const message = safe ? error.message : 'Configuration request failed. No retry, model substitution or settings write was attempted.';
    throw new RemoteError('delegation-router/draft', message, { code });
  }
}
