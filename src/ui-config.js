import z from '@deepseek-ai/schemastery';
import { compileStoredConfig } from './config-sets.js';

// Preserve the raw ui source through native Settings. The schema must never
// default, relabel or silently rewrite an unsupported configuration source.
export const RouterConfig = z.object({
  ui: z.any().default(undefined).volatile().description('执行档案入口 ui：每个候选固定 provider/model 与精确 effort（null 表示明确无档位）；支持 AI 生成草稿、校验确认后应用，亦可手动编辑。启用时必须提供有效 defaultCandidateId；未提供 ui 时为空禁用配置。显式提供（含空对象）必须声明 schemaVersion 5（独立命名预设）或兼容的 schemaVersion 3 / schemaVersion 4。v5 的顶层候选模型池仅用于生成草稿；运行时仅使用当前预设的完整档案及默认候选。启用状态和限制全局共享。候选必须提供固定 provider/model/effort。'),
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
  // Storage-only fields and inactive presets never enter the LiveRouter digest.
  const policy = compileStoredConfig(copied.ui);
  return Object.freeze({ policy, ...(auditFile === undefined ? {} : { auditFile }) });
}


    const BORDER = '1px solid var(--dsw-alias-border-secondary, #777)';
    const paragraphStyle = { maxWidth: '76ch', overflowWrap: 'anywhere' };
    const fieldStyle = { display: 'grid', gap: 8, minWidth: 0 };
    const inputStyle = { width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: BORDER, color: 'inherit', background: 'var(--dsw-alias-background-primary, transparent)', font: 'inherit' };
    const buttonStyle = { ...inputStyle, width: 'auto', cursor: 'pointer' };

export function ConfigSetsPanel({ editor, state, t, children }) {
      const [name, setName] = React.useState('');
      const [deleteId, setDeleteId] = React.useState(undefined);
      const viewToken = editor.viewToken();
      const sets = state.configSet, blocked = !state.canManageConfigs;
      const active = sets.configs.find(row => row.id === sets.activeConfigId);
      const validNew = editor.availableConfigName(name), validRename = editor.availableConfigName(name, sets.activeConfigId);
      const button = (key, action, off = blocked) => h('button', { type: 'button', style: buttonStyle, disabled: off, onClick: () => editor.matchesView(viewToken) && action() }, t(key));
      const act = async operation => { if (!editor.matchesView(viewToken)) return; if (await operation()) { setName(''); setDeleteId(undefined); } };
      return h('section', { 'data-config-sets': true, style: { minWidth: 0, margin: '24px 0' }, 'aria-label': t('configSets') },
        h('h3', null, t('configSets')), h('p', { style: paragraphStyle }, t('configSetsHelp')),
        h('label', { style: fieldStyle }, h('span', null, t('activeConfig')),
          h('select', { style: inputStyle, 'aria-label': t('activeConfig'), value: sets.activeConfigId, disabled: blocked, onChange: event => { setDeleteId(undefined); if (editor.matchesView(viewToken)) void editor.switchConfig(event.target.value); } },
            sets.configs.map(row => h('option', { key: row.id, value: row.id }, row.name)))),
        h('p', { style: paragraphStyle }, t('configSwitchHelp')),
        children,
        state.dirty || state.saving || state.receiptUnverified || state.savedButNotLive ? h('p', { role: 'status', style: paragraphStyle }, t('configNotConfirmed')) : null,
        state.error ? h('p', { role: 'alert', style: paragraphStyle }, state.error) : null,
        blocked ? h('p', { role: 'status', style: paragraphStyle }, t('configSetProtected')) : null,
        h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer', fontWeight: 600 } }, t('manageConfigs') + ' · ' + sets.configs.length + '/32'),
          h('label', { style: { ...fieldStyle, marginTop: 16 } }, h('span', null, t('configName')),
            h('input', { style: inputStyle, 'aria-label': t('configName'), maxLength: 120, value: name, disabled: blocked, placeholder: t('configNameHint'), onChange: event => setName(event.target.value) })),
          name && !validRename ? h('p', { role: 'alert' }, t('invalidConfigName')) : null,
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 } },
            button('newConfig', () => act(() => editor.createConfig(name)), blocked || !validNew || sets.configs.length >= 32),
            button('copyConfig', () => act(() => editor.createConfig(name, true)), blocked || !validNew || sets.configs.length >= 32),
            button('renameConfig', () => act(() => editor.renameConfig(name)), blocked || !validRename || configName(name) === active?.name)),
          h('p', { style: paragraphStyle }, t('configSetLimit')),
          h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, sets.configs.map(row => h('li', { key: row.id, style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-secondary, #777)' } },
            h('span', { style: { flex: '1 1 200px', minWidth: 0, overflowWrap: 'anywhere' } }, row.name),
            row.id === sets.activeConfigId ? h('span', null, t('configActiveBadge')) : h('button', { type: 'button', style: buttonStyle, disabled: blocked, 'aria-label': t('deleteConfig') + ' ' + row.name, onClick: () => { if (editor.matchesView(viewToken)) setDeleteId(row.id); } }, t('deleteConfig'))))),
          deleteId && sets.configs.some(row => row.id === deleteId && row.id !== sets.activeConfigId) ? h('div', { role: 'group', 'aria-label': t('confirmDeleteConfig'), style: { marginTop: 16 } },
            h('p', { role: 'alert', style: paragraphStyle }, t('deleteConfigWarning') + ' ' + sets.configs.find(row => row.id === deleteId).name),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, button('confirmDeleteConfig', () => act(() => editor.deleteConfig(deleteId, true))), button('cancelDeleteConfig', () => setDeleteId(undefined), false))) : null));
    }
