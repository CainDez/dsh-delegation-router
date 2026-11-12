import { z } from 'zod';
import { parentAgentOptionsForDelegation } from '@deepseek-ai/dsh-subagent';
import { fail } from './errors.js';

function validatedRoutes(routes) {
  if (!Array.isArray(routes) || !routes.length) fail('AUTHORIZATION_INVALID', 'Native model-selection policy must contain exact routes');
  const seen = new Set();
  return routes.map(route => {
    if (!route || typeof route !== 'object' || Array.isArray(route) || typeof route.provider !== 'string' || !route.provider || typeof route.model !== 'string' || !route.model) {
      fail('AUTHORIZATION_INVALID', 'Native model-selection policy contains an invalid route');
    }
    const key = route.provider + '\0' + route.model;
    if (seen.has(key)) fail('AUTHORIZATION_INVALID', 'Native model-selection policy repeats a route');
    seen.add(key);
    return { provider: route.provider, model: route.model };
  });
}

// Independent reader: never writes or changes the native policy projection/events.
export const authorizationProjection = {
  key: 'delegationRouterAuthorization',
  stateVersion: 1,
  stateSchema: z.array(z.object({ provider: z.string().min(1), model: z.string().min(1) }).strict()).min(1).nullable(),
  init: () => null,
  apply: (state, event) => {
    if (state !== null || event.type !== 'subagent/model-selection-policy') return state;
    return validatedRoutes(event.data.allowedModels);
  }
};

/** Read only the effective request route, never credentials or other Agent options. */
export function parentRouteSnapshot(parent) {
  const options=parentAgentOptionsForDelegation(parent);
  return { provider:options.provider ?? null,model:options.model ?? null,effort:options.reasoningEffort ?? null };
}
export function createAuthorizationReader(handle) {
  return parent => {
    const state = handle.stateOf(parent.session);
    if (state === undefined) fail('AUTHORIZATION_UNAVAILABLE', 'Authorization projection is not ready');
    if (state !== null) return validatedRoutes(state);
    // Uses captured request config, not stale Agent creation defaults.
    const options = parentAgentOptionsForDelegation(parent);
    if (typeof options.provider !== 'string' || !options.provider || typeof options.model !== 'string' || !options.model) {
      fail('AUTHORIZATION_UNAVAILABLE', 'Parent delegation route is unresolved');
    }
    return [{ provider: options.provider, model: options.model }];
  };
}
