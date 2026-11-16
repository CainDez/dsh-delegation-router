import { DraftService, isDraftServiceError } from './draft-service.js';
import { loadModelCatalog } from './model-catalog.js';
import { normalizeGenerationRequest, validateDraftRequest, isDraftValidationError } from './config-draft.js';

const codec = (name, parse) => ({ mode: 'strict', typeSymbol: 'dsh-delegation-router#' + name, create: () => ({ parse }) });
function draftResult(value) {
  if (!value || !Array.isArray(value.candidates) || typeof value.defaultCandidateId !== 'string') throw Error('Invalid draft service result');
  // Results are assembled by the bounded domain validator, never raw model output.
  return value;
}
export function catalogDescriptors() {
  return [{
    id: 'dsh-delegation-router#delegationRouter/modelCatalog',
    service: 'delegationRouter', namespace: 'delegationRouter', method: 'modelCatalog',
    invocation: { kind: 'direct' }, parameters: [], cancellation: { parameter: 'signal' },
    result: codec('ModelCatalog', value => {
      if (!value || !Array.isArray(value.groups) || !Array.isArray(value.failures)) throw Error('Invalid catalog result');
      return value;
    }),
  }];
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
  service.catalogRequests = new Set();
  service.ctx.effect(() => () => { for (const controller of service.catalogRequests) controller.abort(); service.catalogRequests.clear(); }, 'delegationRouter.catalog');
  service.ctx.effect(() => () => service.draftService.close(), 'delegationRouter.draft-generation');
  registry.register({ package: 'dsh-delegation-router', face: 'host', schemas: [], model: { services: [], events: [], objects: [] }, invocations: [...draftDescriptors(), ...catalogDescriptors()] });
}

export async function invokeDraftRemote(service, method, request, signal) {
  // Configuration generation is an owner settings action, never a session tool
  // or a new entitlement for workspace-scoped remote principals.
  const RemoteError = service.draftRemoteError;
  if (!RemoteError || service.ctx.invocation?.peer?.principal?.kind !== 'owner') {
    if (RemoteError) throw new RemoteError('gateway/forbidden', 'Configuration drafts require the authenticated owner settings connection.', {});
    throw Error('Configuration draft RPC is unavailable.');
  }
  try {
    if (method === 'modelCatalog') {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
      service.catalogRequests?.add(controller);
      try { return await loadModelCatalog(service.ctx.llm, controller.signal); }
      finally { signal?.removeEventListener('abort', abort); service.catalogRequests?.delete(controller); }
    }
    return await service.draftService[method](request, signal);
  }
  catch (error) {
    // Never send adapter exception text (it may contain URLs or credential details).
    const safe = isDraftServiceError(error) || isDraftValidationError(error);
    const code = safe ? error.code : 'GENERATION_FAILED';
    const message = safe ? error.message : 'Configuration request failed. No retry, model substitution or settings write was attempted.';
    throw new RemoteError('delegation-router/draft', message, { code });
  }
}
