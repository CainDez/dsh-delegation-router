import { normalizeConfig } from './config.js';

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_CONFIGS = 32;

function invalid(message) {
  throw Object.assign(new Error(message), { code: 'INVALID_CONFIG' });
}
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(label + ' must be a plain object');
}
// Inspect every descriptor, including inactive presets, before reading any value.
function safeData(value, depth = 0, seen = new Set(), budget = { nodes: 0 }) {
  if (++budget.nodes > 50000 || depth > 32) invalid('Stored configuration exceeds structural limits');
  if (value === null || ['boolean', 'undefined'].includes(typeof value)) return;
  if (typeof value === 'string') {
    if (value.length > 100000) invalid('Configuration text is too long');
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object') invalid('Stored configuration must contain only JSON-like data');
  if (seen.has(value)) invalid('Stored configuration must not contain cycles');
  const array = Array.isArray(value);
  if (array) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 1024) invalid('Invalid configuration array');
  } else plain(value, 'Configuration object');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || FORBIDDEN.has(key)) invalid('Forbidden configuration key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!('value' in descriptor)) invalid('Configuration accessors are forbidden');
    if (array && key === 'length') continue;
    if (!descriptor.enumerable) invalid('Nonenumerable configuration properties are forbidden');
    if (array && !/^(0|[1-9][0-9]*)$/.test(key)) invalid('Invalid configuration array property');
    safeData(descriptor.value, depth + 1, seen, budget);
  }
  if (array && Object.keys(value).length !== value.length) invalid('Sparse configuration arrays are forbidden');
  seen.delete(value);
}
function keys(value, allowed, label) {
  plain(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid('Unknown ' + label + ' key: ' + key);
}
function configId(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value)) invalid('Invalid ' + label);
  return value;
}
function text(value, label, max) {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value || /[\x00-\x1f\x7f]/.test(value)) invalid('Invalid ' + label);
  return value;
}
function configName(value) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) invalid('Invalid configuration name');
  const name = value.trim();
  if (!name.length || name.length > 120) invalid('Invalid configuration name');
  return name;
}

/** Strict v4 storage: one shared candidate pool and lightweight named presets. */
export function normalizeConfigSets(raw) {
  safeData(raw);
  keys(raw, ['schemaVersion', 'enabled', 'candidates', 'limits', 'activeConfigId', 'configs'], 'configuration sets');
  if (raw.schemaVersion !== 4) invalid('Unsupported schemaVersion; configuration sets require schemaVersion 4');
  const activeConfigId = configId(raw.activeConfigId, 'activeConfigId');
  if (!Array.isArray(raw.configs) || !raw.configs.length || raw.configs.length > MAX_CONFIGS) invalid('Configuration sets must contain between 1 and 32 configurations');
  const enabled = raw.enabled === undefined ? false : raw.enabled;
  if (typeof enabled !== 'boolean') invalid('Invalid enabled');
  // Validate global route data with the unchanged strict v3 normalizer. Defaults
  // belong to presets, so do not invent a global default to validate this pool.
  const shared = normalizeConfig({ schemaVersion: 3, enabled: false, candidates: raw.candidates, limits: raw.limits });
  if (enabled && !shared.candidates.length) invalid('Invalid candidates list');
  const candidateIds = new Set(shared.candidates.map(candidate => candidate.id));
  const ids = new Set(), names = new Set();
  const configs = raw.configs.map(entry => {
    keys(entry, ['id', 'name', 'defaultCandidateId', 'overrides'], 'configuration preset');
    const id = configId(entry.id, 'configuration id'), name = configName(entry.name);
    if (ids.has(id)) invalid('Duplicate configuration id: ' + id);
    if (names.has(name.toLowerCase())) invalid('Duplicate configuration name: ' + name);
    ids.add(id); names.add(name.toLowerCase());
    const defaultCandidateId = entry.defaultCandidateId;
    if ((enabled || defaultCandidateId !== undefined) && !candidateIds.has(defaultCandidateId)) invalid('Preset defaultCandidateId must explicitly reference a global candidate id');
    const overridesRaw = entry.overrides === undefined ? [] : entry.overrides;
    if (!Array.isArray(overridesRaw) || overridesRaw.length > shared.candidates.length) invalid('Invalid preset overrides list');
    const overrideIds = new Set();
    const overrides = overridesRaw.map(override => {
      keys(override, ['id', 'name', 'description'], 'candidate override');
      if (!candidateIds.has(override.id) || overrideIds.has(override.id)) invalid('Candidate overrides must uniquely reference global candidate ids');
      overrideIds.add(override.id);
      const result = { id: override.id, name: text(override.name, 'candidate override name', 120) };
      if (override.description !== undefined) result.description = override.description === '' ? '' : text(override.description, 'candidate override description', 1000);
      return Object.freeze(result);
    });
    const result = { id, name, overrides: Object.freeze(overrides) };
    if (defaultCandidateId !== undefined) result.defaultCandidateId = defaultCandidateId;
    return Object.freeze(result);
  });
  if (!ids.has(activeConfigId)) invalid('activeConfigId must explicitly reference a configuration id');
  return Object.freeze({ schemaVersion: 4, enabled, candidates: shared.candidates, limits: shared.limits, activeConfigId, configs: Object.freeze(configs) });
}

/** Compile only preset labels/default over global routes, enablement and limits. */
export function compileStoredConfig(raw) {
  safeData(raw);
  if (raw && typeof raw === 'object' && raw.schemaVersion === 4) {
    const normalized = normalizeConfigSets(raw);
    const active = normalized.configs.find(entry => entry.id === normalized.activeConfigId);
    const overrides = new Map(active.overrides.map(override => [override.id, override]));
    return normalizeConfig({ schemaVersion: 3, enabled: normalized.enabled, limits: normalized.limits,
      candidates: normalized.candidates.map(candidate => ({ ...candidate, ...overrides.get(candidate.id) })),
      ...(active.defaultCandidateId === undefined ? {} : { defaultCandidateId: active.defaultCandidateId }) });
  }
  return normalizeConfig(raw);
}
