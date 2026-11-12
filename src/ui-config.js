import z from '@deepseek-ai/schemastery';
import { normalizeConfig } from './config.js';

// Preserve raw legacy sources through native Settings. The compiler validates v2;
// schema defaults must never relabel a v1 source or silently discard its rules.
export const RouterConfig = z.object({
  ui: z.any().default(undefined).volatile().description('规范预设入口 ui：新配置提供 Low / High / Max，默认 High；模型可继承主 Agent 或逐项固定，档位在创建时精确校验。既有预设不覆盖；旧配置只读保留且路由禁用；请备份后在原生设置手动改为 v2 预设。'),
  policy: z.any().default(undefined).volatile().description('已弃用的读取兼容别名 policy，不是高级模式；仍可读取既有 v2 预设。规范编辑器保存时原子移除 policy 并写入 ui，不能同时提供两个来源；v1 只读保留且路由禁用，请备份后在原生设置手动改为 v2 预设。'),
  auditFile: z.string().description('审计文件的绝对路径，每个 Profile 独占；不覆盖既有日志或锁。'),
});

function invalid(message) { throw Object.assign(new Error(message), { code: 'INVALID_CONFIG' }); }
function dataCopy(value, depth = 0, seen = new Set(), budget = { nodes: 0 }) {
  if (++budget.nodes > 50000 || depth > 32) invalid('Plugin configuration exceeds structural limits');
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'string') { if (value.length > 100000) invalid('Configuration text is too long'); return value; }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') invalid('Plugin configuration must be data-only');
  if (seen.has(value)) invalid('Plugin configuration cannot contain cycles');
  const array = Array.isArray(value);
  if (array ? Object.getPrototypeOf(value) !== Array.prototype || value.length > 1024 : ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid('Plugin configuration requires plain objects and bounded arrays');
  const result = array ? [] : {};
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid('Unsafe configuration key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!('value' in descriptor) || !descriptor.enumerable) invalid('Configuration accessors and hidden fields are forbidden');
    if (array && !/^(0|[1-9][0-9]*)$/.test(key)) invalid('Invalid configuration array property');
    result[key] = dataCopy(descriptor.value, depth + 1, seen, budget);
  }
  if (array && result.length !== value.length) invalid('Sparse configuration arrays are forbidden');
  if (array && Object.keys(result).length !== result.length) invalid('Sparse configuration arrays are forbidden');
  seen.delete(value);
  return result;
}
function keys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label + ' must be a plain object');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid('Unknown ' + label + ' key: ' + key);
}

export function isLegacyConfig(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (value.schemaVersion === 1 || value.schemaVersion === undefined && !Object.hasOwn(value, 'presets') && Object.keys(value).length > 0);
}

/** Compile one explicit source. Legacy settings mount disabled, never execute. */
export function compilePluginConfig(raw = {}) {
  const copied = dataCopy(raw);
  keys(copied, ['ui', 'policy', 'auditFile'], 'plugin configuration');
  if (copied.ui !== undefined && copied.policy !== undefined) invalid('Specify ui OR policy, not both');
  if (copied.auditFile !== undefined && typeof copied.auditFile !== 'string') invalid('auditFile must be text');
  const auditFile = copied.auditFile?.trim() ? copied.auditFile : undefined;
  const source = copied.ui !== undefined ? 'ui' : 'policy';
  const value = copied[source] === undefined ? {} : copied[source];
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Configuration source must be a plain object');
  const migrationRequired = isLegacyConfig(value);
  const configurationIssue = value.teams?.enabled === true ? Object.freeze({
    code: 'TEAM_ROUTING_REMOVED',
    message: 'Team routing has been removed. The original configuration is preserved read-only and routing is disabled. Back up the original, then explicitly remove teams in native settings before reconfiguring routing.',
    source, original: dataCopy(value),
  }) : migrationRequired ? Object.freeze({
    code: 'LEGACY_CONFIGURATION',
    message: 'Legacy configuration is preserved read-only and routing is disabled. Back up the original, then manually replace it with v2 presets in native settings. No rules or constraints are automatically converted.',
    source, original: dataCopy(value),
  }) : undefined;
  // Quarantine before normalization so recovery/status tools can mount without
  // executing an unsupported policy or silently rewriting its original source.
  if (!configurationIssue && value.teams !== undefined) {
    keys(value.teams, ['enabled'], 'teams');
    if (value.teams.enabled !== false) invalid('Only the exact legacy teams: { enabled: false } shape is accepted');
  }
  const policy = normalizeConfig(configurationIssue ? { schemaVersion: 2, enabled: false, presets: [] } : value);
  return Object.freeze({ policy, migrationRequired, ...(configurationIssue ? { configurationIssue } : {}), ...(auditFile === undefined ? {} : { auditFile }) });
}
