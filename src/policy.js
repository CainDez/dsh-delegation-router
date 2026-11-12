import { normalizeConfig } from './config.js';

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function own(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
const validText = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
function dataObject(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return allowed.includes(key) && descriptor.enumerable && 'value' in descriptor;
  });
}
function capacity(metadata) {
  const context = own(metadata, 'context');
  return typeof context === 'number' ? context : own(context, 'maxInputTokens') ?? own(context, 'maxTokens') ?? own(context, 'window');
}
export function authorized(candidate, routes) {
  return routes.some(route => {
    if (!dataObject(route, ['provider', 'model', 'effort', 'efforts'])) return false;
    if (own(route, 'provider') !== candidate.provider || own(route, 'model') !== candidate.model) return false;
    const effort = own(route, 'effort'), efforts = own(route, 'efforts');
    if (effort !== undefined && effort !== candidate.effort) return false;
    if (efforts !== undefined && (!Array.isArray(efforts) || !efforts.includes(candidate.effort))) return false;
    return true;
  });
}
/** Resolve only provider/model; effort is always the exact preset value. */
export function resolvePresetTarget(preset, parentRoute) {
  if (preset.modelSource !== 'parent') return { provider: preset.provider, model: preset.model };
  const provider = own(parentRoute, 'provider'), model = own(parentRoute, 'model');
  if (!validText(provider) || !validText(model)) fail('PARENT_ROUTE_UNAVAILABLE', 'The current parent provider/model must be resolved synchronously');
  return { provider, model };
}
/** Exactly one preset, never fallback, task inference or route orchestration. */
export function selectRoute(rawConfig, { facts = {}, proposal, catalog, authorizedRoutes, parentRoute } = {}) {
  const config = normalizeConfig(rawConfig);
  if (!config.enabled) fail('ROUTER_DISABLED', 'Child-agent model routing is disabled');
  if (!(catalog instanceof Map)) fail('INVALID_CATALOG', 'catalog must be a Map keyed by preset id');
  if (!Array.isArray(authorizedRoutes)) fail('INVALID_AUTHORIZATION', 'authorizedRoutes must be an authoritative array');
  if (proposal !== undefined && (!dataObject(proposal, ['presetId']) || !validText(own(proposal, 'presetId')))) fail('INVALID_PROPOSAL', 'Only an exact presetId proposal is supported');
  const presetId = proposal === undefined ? config.defaultPreset : own(proposal, 'presetId');
  const preset = config.presets.find(item => item.id === presetId);
  if (!preset) fail('NO_ROUTE', 'Selected preset does not exist; no fallback is permitted');
  const target = resolvePresetTarget(preset, parentRoute);
  const metadata = catalog.get(presetId);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('NO_ROUTE', 'Selected preset metadata is unavailable');
  if (own(metadata, 'provider') !== undefined && own(metadata, 'provider') !== target.provider || own(metadata, 'model') !== undefined && own(metadata, 'model') !== target.model) fail('NO_ROUTE', 'Selected preset metadata identity does not match');
  const supported = own(own(metadata, 'reasoning'), 'efforts');
  // The normalizer marks a successful, explicitly effort-less host model with [].
  // Missing or malformed metadata is never equivalent to an empty advertised list.
  if (!Array.isArray(supported) || !supported.every(value => validText(value) && value !== 'default') || new Set(supported).size !== supported.length) fail('NO_ROUTE', 'Selected preset reasoning capability is unknown or malformed');
  if (preset.effort === null ? supported.length !== 0 : !supported.includes(preset.effort)) fail('NO_ROUTE', 'Selected preset effort is not supported; no replacement is permitted');
  const payload = own(facts, 'payload');
  const inputModalities = own(payload, 'inputModalities');
  if (inputModalities !== undefined && (!Array.isArray(inputModalities) || inputModalities.length > 128 || !inputModalities.every(validText))) fail('INVALID_FACTS', 'payload.inputModalities must be a bounded string array');
  const modalities = own(metadata, 'inputModalities');
  if (inputModalities?.length && (!Array.isArray(modalities) || !inputModalities.every(item => modalities.includes(item)))) fail('NO_ROUTE', 'Selected preset does not support the input modalities');
  const context = own(payload, 'context');
  const demand = typeof context === 'number' ? context : own(context, 'inputTokens') ?? own(context, 'tokens');
  if (demand !== undefined && (typeof demand !== 'number' || !Number.isFinite(demand) || demand < 0)) fail('INVALID_FACTS', 'Context token demand must be nonnegative and finite');
  const availableContext = capacity(metadata);
  if (demand !== undefined && (typeof availableContext !== 'number' || !Number.isFinite(availableContext) || availableContext < demand)) fail('NO_ROUTE', 'Selected preset context capacity is unknown or insufficient');
  const selected = { presetId, provider: target.provider, model: target.model, effort: preset.effort };
  if (!authorized(selected, authorizedRoutes)) fail('NO_ROUTE', 'Selected preset is not authorized');
  return { ...selected, reason: proposal === undefined ? 'default-preset' : 'explicit-preset' };
}
