import { fail } from './errors.js';

const nonEmpty = value => typeof value === 'string' && value.length > 0 && value.length <= 200
  && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);

/** Map an already parsed host model choice to the same candidate IDs as routed_subagent.
 * Undefined means the caller explicitly omitted all routing fields, not a lookup miss.
 * Never consult the draft pool, authorization list, model defaults or catalog to break a tie.
 */
export function nativeCandidateId(policy, { candidate_id, provider, model, reasoning_effort } = {}) {
  const explicitRoute = [provider, model, reasoning_effort].some(value => value !== undefined);
  if (candidate_id !== undefined) {
    if (!nonEmpty(candidate_id) || candidate_id.length > 120 || explicitRoute) {
      fail('INVALID_NATIVE_SELECTION', 'Supply one candidate_id or one native route, not both');
    }
    if (!policy.candidates.some(candidate => candidate.id === candidate_id)) fail('NO_ROUTE', 'Selected candidate does not exist in the current preset');
    return candidate_id;
  }
  if (!explicitRoute) return undefined;
  if (!nonEmpty(provider) || !nonEmpty(model) || (reasoning_effort !== undefined && !nonEmpty(reasoning_effort))) {
    fail('INVALID_NATIVE_SELECTION', 'Supply both provider and model, and optionally a reasoning_effort');
  }
  const matches = policy.candidates.filter(candidate => candidate.provider === provider && candidate.model === model
    && (reasoning_effort === undefined || candidate.effort === reasoning_effort));
  if (matches.length === 0) fail('NO_ROUTE', 'Native model route does not match the current preset');
  if (matches.length !== 1) fail('AMBIGUOUS_NATIVE_SELECTION', 'Native model route matches several candidates; select an exact candidate_id');
  return matches[0].id;
}
