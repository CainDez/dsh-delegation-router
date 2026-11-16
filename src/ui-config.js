import z from '@deepseek-ai/schemastery';
import { compileStoredConfig } from './config-sets.js';

// Preserve the raw ui source through native Settings. The schema must never
// default, relabel or silently rewrite an unsupported configuration source.
export const RouterConfig = z.object({
  ui: z.any().default(undefined).volatile().description('执行档案入口 ui：每个候选固定 provider/model 与精确 effort（null 表示明确无档位）；支持 AI 生成草稿、校验确认后应用，亦可手动编辑。启用时必须提供有效 defaultCandidateId；未提供 ui 时为空禁用配置。显式提供（含空对象）必须是 schemaVersion 3 或 schemaVersion 4 命名配置集；候选模型池、启用状态和限制全局共享；每套预设仅保存默认候选及候选名称/说明覆盖，切换不改变模型池或固定路由。候选必须提供固定 provider/model/effort。'),
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

/** Compile the explicit ui source to its active policy; auditFile remains global. */
export function compilePluginConfig(raw = {}) {
  const copied = dataCopy(raw);
  keys(copied, ['ui', 'auditFile'], 'plugin configuration');
  if (copied.auditFile !== undefined && typeof copied.auditFile !== 'string') invalid('auditFile must be text');
  const auditFile = copied.auditFile?.trim() ? copied.auditFile : undefined;
  // Storage-only preset names and inactive overrides never enter the LiveRouter digest.
  const policy = compileStoredConfig(copied.ui);
  return Object.freeze({ policy, ...(auditFile === undefined ? {} : { auditFile }) });
}
