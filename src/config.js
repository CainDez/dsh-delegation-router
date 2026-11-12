import { createDefaultPresets, DEFAULT_PRESET_ID } from './default-presets.js';

/** Strict, data-only presets for child-agent creation. */
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_PRESETS = 128;

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

export function normalizeConfig(raw = {}) {
  safeData(raw);
  keys(raw, ['schemaVersion', 'enabled', 'presets', 'defaultPreset', 'limits', 'teams'], 'configuration');
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 2) invalid('Unsupported schemaVersion; back up the original and manually replace it with v2 presets');
  // The sole deprecated read alias is exact teams:{enabled:false}; never emit it.
  if (Object.hasOwn(raw, 'teams')) {
    keys(raw.teams, ['enabled'], 'teams');
    if (raw.teams.enabled === true) throw Object.assign(new Error('Team routing was removed. Remove the teams setting and review the ordinary subagent policy before enabling routing.'), { code: 'TEAM_ROUTING_REMOVED' });
    if (Object.keys(raw.teams).length !== 1 || raw.teams.enabled !== false) invalid('Only the deprecated teams:{enabled:false} read alias is accepted');
  }
  const enabled = boolean(raw.enabled, 'enabled', false);
  const useDefaults = raw.presets === undefined;
  const presetsRaw = useDefaults ? createDefaultPresets() : raw.presets;
  if (!Array.isArray(presetsRaw) || presetsRaw.length > MAX_PRESETS || (enabled && !presetsRaw.length)) invalid('Invalid presets list');
  const ids = new Set();
  const presets = presetsRaw.map(preset => {
    keys(preset, ['id', 'name', 'modelSource', 'provider', 'model', 'effort', 'description'], 'preset');
    const inheritsParent = Object.hasOwn(preset, 'modelSource');
    if (inheritsParent && preset.modelSource !== 'parent') invalid('Invalid preset modelSource');
    if (inheritsParent && (Object.hasOwn(preset, 'provider') || Object.hasOwn(preset, 'model'))) invalid('Inherited presets cannot specify provider or model');
    const presetId = id(preset.id, 'preset id');
    if (ids.has(presetId)) invalid('Duplicate preset id: ' + presetId);
    ids.add(presetId);
    const effort = preset.effort === null ? null : text(preset.effort, 'preset effort');
    if (effort === 'default') invalid('Preset effort must be an exact advertised value, not default');
    const result = { id: presetId, name: text(preset.name, 'preset name', 120),
      ...(inheritsParent ? { modelSource: 'parent' } : { provider: text(preset.provider, 'provider'), model: text(preset.model, 'model') }), effort };
    if (preset.description !== undefined) result.description = preset.description === '' ? '' : text(preset.description, 'preset description', 1000);
    return result;
  });
  const defaultPreset = useDefaults && raw.defaultPreset === undefined ? DEFAULT_PRESET_ID : raw.defaultPreset;
  if ((enabled || defaultPreset !== undefined) && !ids.has(defaultPreset)) invalid('defaultPreset must explicitly reference a preset id');
  const limitsRaw = raw.limits === undefined ? {} : raw.limits;
  keys(limitsRaw, ['maxPendingStarts', 'maxActivePerModel', 'maxCreationsPerParent', 'metadataTimeoutMs'], 'limits');
  const limits = {
    maxPendingStarts: integer(limitsRaw.maxPendingStarts, 'maxPendingStarts', 32),
    maxActivePerModel: integer(limitsRaw.maxActivePerModel, 'maxActivePerModel', 8),
    maxCreationsPerParent: integer(limitsRaw.maxCreationsPerParent, 'maxCreationsPerParent', 64),
    metadataTimeoutMs: integer(limitsRaw.metadataTimeoutMs, 'metadataTimeoutMs', 5000, 600000),
  };
  const result = { schemaVersion: 2, enabled, presets, limits };
  if (defaultPreset !== undefined) result.defaultPreset = defaultPreset;
  return freeze(result);
}
