/** Strict, data-only fixed candidates for child-agent creation. */
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_CANDIDATES = 128;

function invalid(message) {
  throw Object.assign(new Error(message), { code: 'INVALID_CONFIG' });
}
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(label + ' must be a plain object');
}
// Inspect descriptors before accessing values: no getters, exotic prototypes or pollution keys.
function safeData(value, depth = 0, seen = new Set(), budget = { nodes: 0 }) {
  if (++budget.nodes > 50000 || depth > 32) invalid('Configuration data exceeds structural limits');
  if (value === null || ['string', 'boolean', 'undefined'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') invalid('Configuration must contain only JSON-like data');
  if (seen.has(value)) invalid('Configuration must not contain cycles');
  if (!Array.isArray(value)) plain(value, 'Configuration object');
  else if (Object.getPrototypeOf(value) !== Array.prototype) invalid('Invalid array prototype');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || FORBIDDEN.has(key)) invalid('Forbidden configuration key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!('value' in descriptor)) invalid('Configuration accessors are forbidden');
    if (Array.isArray(value) && key === 'length') continue;
    if (!descriptor.enumerable) invalid('Nonenumerable configuration properties are forbidden');
    if (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key)) invalid('Invalid array property');
    safeData(descriptor.value, depth + 1, seen, budget);
  }
  if (Array.isArray(value) && Object.keys(value).length !== value.length) invalid('Sparse configuration arrays are forbidden');
  seen.delete(value);
}
function keys(value, allowed, label) {
  plain(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid('Unknown ' + label + ' key: ' + key);
}
function text(value, label, max = 200) {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value || /[\x00-\x1f\x7f]/.test(value)) invalid('Invalid ' + label);
  return value;
}
function id(value, label) {
  text(value, label, 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value)) invalid('Invalid ' + label);
  return value;
}
function integer(value, label, fallback, max = 1000000) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > max) invalid('Invalid ' + label);
  return value;
}
function boolean(value, label, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') invalid('Invalid ' + label);
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function normalizeConfig(raw = { schemaVersion: 3 }) {
  safeData(raw);
  keys(raw, ['schemaVersion', 'enabled', 'candidates', 'defaultCandidateId', 'limits'], 'configuration');
  // Only the absent entry initializes a fresh empty configuration; every provided source, including {}, must declare v3 itself.
  if (raw.schemaVersion !== 3) invalid('Unsupported schemaVersion; only schemaVersion 3 configurations are accepted. Reconfigure routing with v3 fixed candidates');
  const enabled = boolean(raw.enabled, 'enabled', false);
  const candidatesRaw = raw.candidates === undefined ? [] : raw.candidates;
  if (!Array.isArray(candidatesRaw) || candidatesRaw.length > MAX_CANDIDATES || (enabled && !candidatesRaw.length)) invalid('Invalid candidates list');
  const ids = new Set();
  const candidates = candidatesRaw.map(candidate => {
    keys(candidate, ['id', 'name', 'provider', 'model', 'effort', 'description'], 'candidate');
    const candidateId = id(candidate.id, 'candidate id');
    if (ids.has(candidateId)) invalid('Duplicate candidate id: ' + candidateId);
    ids.add(candidateId);
    const effort = candidate.effort === null ? null : text(candidate.effort, 'candidate effort');
    if (effort === 'default') invalid('Candidate effort must be an exact advertised value, not default');
    const result = { id: candidateId, name: text(candidate.name, 'candidate name', 120),
      provider: text(candidate.provider, 'provider'), model: text(candidate.model, 'model'), effort };
    if (candidate.description !== undefined) result.description = candidate.description === '' ? '' : text(candidate.description, 'candidate description', 1000);
    return result;
  });
  const defaultCandidateId = raw.defaultCandidateId;
  if ((enabled || defaultCandidateId !== undefined) && !ids.has(defaultCandidateId)) invalid('defaultCandidateId must explicitly reference a candidate id');
  const limitsRaw = raw.limits === undefined ? {} : raw.limits;
  keys(limitsRaw, ['maxPendingStarts', 'maxActivePerModel', 'maxCreationsPerParent', 'metadataTimeoutMs'], 'limits');
  const limits = {
    maxPendingStarts: integer(limitsRaw.maxPendingStarts, 'maxPendingStarts', 32),
    maxActivePerModel: integer(limitsRaw.maxActivePerModel, 'maxActivePerModel', 8),
    maxCreationsPerParent: integer(limitsRaw.maxCreationsPerParent, 'maxCreationsPerParent', 64),
    metadataTimeoutMs: integer(limitsRaw.metadataTimeoutMs, 'metadataTimeoutMs', 5000, 600000),
  };
  const result = { schemaVersion: 3, enabled, candidates, limits };
  if (defaultCandidateId !== undefined) result.defaultCandidateId = defaultCandidateId;
  return freeze(result);
}
