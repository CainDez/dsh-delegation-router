/* Native Settings companion: no separate page, server, or parent model changes. */
window.__ModuleLoader__.load({
  id: 'dsh-delegation-router',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'delegationRouter', ENTRY = 'delegation-router';
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const stable = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    const zh = {
  "loading": "正在读取当前 Profile 配置…",
  "unavailable": "此 Profile 尚未提供路由配置，请先启用插件。",
  "readOnly": "当前配置为只读。",
  "autosave": "停止输入约 0.6 秒后自动保存，无需手动提交。",
  "autosavePending": "更改待自动保存…",
  "autosaveIncomplete": "更改尚未保存，请补全必填项、有效默认预设及范围内的整数配额。",
  "autosaveFailed": "自动保存未完成，更改已保留。",
  "retry": "重试自动保存",
  "saving": "正在保存…",
  "saved": "已保存；下一次创建使用新配置。",
  "savedButNotLive": "已保存到当前 Profile，但有效配置被更高层覆盖；本次设置未生效。",
  "saveFailed": "保存未被宿主接受，草稿已保留。",
  "verifyFailed": "宿主已接受写入，但刷新尚未确认；请刷新核对，勿重复保存。",
  "connectionReset": "连接已重置，草稿已保留；请明确刷新或取消草稿后再编辑。",
  "conflict": "配置已被其他页面修改。草稿已保留，请取消草稿并重新读取后再编辑；不会自动重试。",
  "cancel": "取消草稿并重新读取",
  "refresh": "刷新",
  "enabled": "启用创建路由",
  "remove": "删除",
  "id": "ID",
  "catalog": "DSH 原生模型目录",
  "catalogRefresh": "刷新模型目录",
  "catalogLoading": "正在读取模型目录…",
  "catalogEmpty": "目录中暂无可用模型。",
  "catalogFailed": "目录读取失败；现有配置保留，不能据此判断模型已删除。",
  "catalogPartial": "部分 Provider 目录读取失败；仅可选择成功返回的模型，失败 Provider 的旧配置不视为不存在。",
  "catalogMissing": "已保存的模型不在当前成功目录中；值保持不变，请确认后明确重新选择。",
  "catalogUnverified": "尚未确认此模型的当前目录信息；现有模型与档位保持不变。",
  "chooseModel": "模型",
  "unknownEffort": "已保存的未知档位（保留，不可新选）",
  "chooseEffort": "请选择真实思考档位",
  "limits": "配额与超时",
  "maxPendingStarts": "最大等待创建数",
  "maxActivePerModel": "每模型最大活动数",
  "maxCreationsPerParent": "父会话累计创建上限",
  "metadataTimeoutMs": "元数据与预检超时（毫秒）",
  "teamRemoved": "Team 路由已移除，原配置只读保留，路由已停用。请先备份原文，再在原生设置中明确移除 teams 后重新配置路由。",
  "legacyConfiguration": "旧配置只读保留，路由已停用。请先备份原文，再在原生设置中手动替换为 v2 预设；不会自动转换规则或硬约束。",
  "configurationOriginal": "配置原文（只读保留）",
  "executionEvidence": "保存或列出预设不会执行委派，也不能证明子 Agent 的实际路由；实际父作用域证据请通过 router_status 查询。",
  "title": "委派预设",
  "summary": "新配置提供 Low / High / Max，初始默认 High；模型可继承主 Agent 或逐档固定，不切换主 Agent。",
  "presets": "预设清单",
  "addPreset": "添加预设",
  "addDefaults": "添加默认预设",
  "defaultsHelp": "仅补入缺少的 Low / High / Max ID，不覆盖同 ID 的自定义预设或当前默认选择。",
  "inheritModel": "继承主模型",
  "inheritHelp": "创建时解析主 Agent 模型并校验档位；此页不猜测当前主模型。",
  "templateEffort": "模板档位（创建时校验）",
  "inheritEffortHelp": "Low / High / Max 是模板值，尚未通过当前主模型的目录验证；不支持时拒绝创建，不回退档位。",
  "retainedEffort": "已保存的精确值（保留，创建时校验）",
  "name": "预设名称",
  "description": "适用说明（一句话）",
  "effort": "思考档位",
  "defaultPreset": "默认预设",
  "chooseDefault": "未指定默认预设（仅关闭时允许）",
  "noPresets": "尚无预设。可添加继承主模型的预设，或补入默认三档。",
  "catalogHelp": "固定模型从 DSH 原生目录选择，真实档位单选；明确无可选档位时保存 null，不补造 default。继承模式在创建时校验，目录可见不代表授权或通过后端预检。",
  "noReasoning": "目录确认此模型没有可选思考档位；本预设使用 null，不发送思考档位。",
  "noEffort": "无可选档位（null）",
  "effortRequired": "请选择一个真实档位；default 哨兵不会自动迁移。",
  "invalidDraft": "请补全每个预设的名称、唯一 ID、模型和单个档位；启用前必须明确选择有效默认预设。",
  "authority": "预设说明仅为选型资料，不授予能力、权限或安排任务。非法提案将被拒绝，不自动换模型。当前创建仅传文本，不转发图片。",
  "advanced": "高级与安全设置",
  "auditFile": "审计路径（由原生设置管理）",
  "auditHelp": "此表单保留既有 auditFile，不清除日志或锁。需要修改时请使用原生设置。",
  "policySource": "从已弃用的 policy 读取兼容别名载入 v2 预设，并非高级模式；保存将原子移除 policy 并写入规范入口 ui，其他设置保留。",
  "sourceConflict": "同时存在 ui 和 policy；不能合并或覆盖，请先在原生设置明确保留一个来源。",
  "invalidSource": "配置结构无效，已阻止此表单覆盖原文；请在原生设置核对修复。"
};
    const en = {
  "loading": "Reading profile configuration…",
  "unavailable": "Routing settings are unavailable in this profile. Enable the plugin first.",
  "readOnly": "This configuration is read-only.",
  "autosave": "Changes save automatically after 0.6 seconds of inactivity; no manual submission needed.",
  "autosavePending": "Changes pending automatic save…",
  "autosaveIncomplete": "Not saved yet. Complete required fields, choose a valid default preset and use integer quotas within range.",
  "autosaveFailed": "Automatic save did not finish. Your changes were retained.",
  "retry": "Retry automatic save",
  "saving": "Saving…",
  "saved": "Saved; new creations use the updated configuration.",
  "savedButNotLive": "Saved to this profile, but a higher-priority configuration overrides it. These settings are not effective.",
  "saveFailed": "The host did not accept the save. Your draft was retained.",
  "verifyFailed": "The host accepted the write, but refresh has not verified it. Refresh to verify; do not save again.",
  "connectionReset": "The connection was reset. Your draft was retained. Explicitly refresh or discard the draft before editing.",
  "conflict": "Another page changed this configuration. Your draft was retained. Discard and reload before editing; no automatic retry will occur.",
  "cancel": "Discard draft and reload",
  "refresh": "Refresh",
  "enabled": "Enable creation routing",
  "remove": "Delete",
  "id": "ID",
  "catalog": "Native DSH model catalog",
  "catalogRefresh": "Refresh model catalog",
  "catalogLoading": "Reading model catalog…",
  "catalogEmpty": "No models are available in the catalog.",
  "catalogFailed": "Catalog loading failed. Existing configuration is retained; this does not mean its models were removed.",
  "catalogPartial": "Some provider catalogs failed. Only successfully returned models can be selected; saved models from failed providers are not considered missing.",
  "catalogMissing": "This saved model is absent from the successfully loaded catalog. Its value is retained until you explicitly choose another model.",
  "catalogUnverified": "Current catalog information for this model is unverified. Its saved model and effort values are retained.",
  "chooseModel": "Model",
  "unknownEffort": "Saved unknown effort (retained; cannot select anew)",
  "chooseEffort": "Choose an advertised reasoning effort",
  "limits": "Quotas and timeouts",
  "maxPendingStarts": "Maximum pending creations",
  "maxActivePerModel": "Maximum active children per model",
  "maxCreationsPerParent": "Cumulative creation limit per parent",
  "metadataTimeoutMs": "Metadata and preflight timeout (milliseconds)",
  "teamRemoved": "Team routing has been removed. The original configuration is preserved read-only and routing is disabled. Back up the original, then explicitly remove teams in native settings before reconfiguring routing.",
  "legacyConfiguration": "Legacy configuration is preserved read-only and routing is disabled. Back up the original, then manually replace it with v2 presets in native settings. No rules or constraints are automatically converted.",
  "configurationOriginal": "Original configuration (preserved read-only)",
  "executionEvidence": "Saving or listing presets does not execute delegation or prove actual child routing; query actual parent-scoped evidence with router_status.",
  "title": "Delegation presets",
  "summary": "Low / High / Max presets, with High as the initial default. Inherit the main Agent model or fix a model per preset; never switches the main Agent.",
  "presets": "Preset list",
  "addPreset": "Add preset",
  "addDefaults": "Add default presets",
  "defaultsHelp": "Add only missing Low / High / Max IDs; never replace custom presets with those IDs or change the current default selection.",
  "inheritModel": "Inherit main model",
  "inheritHelp": "Resolve the main Agent model and validate the effort at creation; this page does not guess the current main model.",
  "templateEffort": "Template effort (validated at creation)",
  "inheritEffortHelp": "Low / High / Max are template values, not catalog-validated for the current main model. Unsupported efforts reject creation without fallback.",
  "retainedEffort": "Saved exact value (retained; validated at creation)",
  "name": "Preset name",
  "description": "Usage description (one sentence)",
  "effort": "Reasoning effort",
  "defaultPreset": "Default preset",
  "chooseDefault": "No default preset (disabled routing only)",
  "noPresets": "No presets yet. Add a preset inheriting the main model, or add the three default templates.",
  "catalogHelp": "Fixed models use the native DSH catalog and one real effort. Confirmed effort-less entries use null, never an invented default. Inherited routes are validated at creation; catalog visibility is not authorization or backend preflight approval.",
  "noReasoning": "The catalog confirms no selectable reasoning efforts for this model. This preset uses null and sends no reasoning effort.",
  "noEffort": "No selectable effort (null)",
  "effortRequired": "Choose a real effort. The default sentinel is never migrated automatically.",
  "invalidDraft": "Complete each preset name, unique ID, model and single effort; explicitly choose a valid default preset before enabling.",
  "authority": "Preset descriptions are selection data, not capability, authorization or task assignments. Invalid proposals are rejected without switching models. Creation is text-only and does not forward images.",
  "advanced": "Advanced and safety settings",
  "auditFile": "Audit path (managed in native settings)",
  "auditHelp": "This form preserves auditFile and never clears journals or locks. Change the path through native settings.",
  "policySource": "Loaded v2 presets from the deprecated policy read alias, not an advanced mode. Saving atomically removes policy and writes canonical ui, preserving other settings.",
  "sourceConflict": "Both ui and policy are present. They cannot be merged or overwritten; explicitly retain one source in native settings first.",
  "invalidSource": "Invalid configuration structure. This form cannot overwrite the original; review and repair it in native settings."
};
    // Native loader script has no ESM imports. Keep this browser mirror in parity
    // with src/default-presets.js; the client regression compares every field.
    const DEFAULT_PRESET_ID = 'default-high', PARENT_MODEL_KEY = 'parent';
    const createDefaultPresets = () => [
      { id: 'default-low', name: 'Low', modelSource: 'parent', effort: 'low', description: '轻量、范围明确的任务。' },
      { id: 'default-high', name: 'High', modelSource: 'parent', effort: 'high', description: '需要较充分推理的常规任务。' },
      { id: 'default-max', name: 'Max', modelSource: 'parent', effort: 'max', description: '需要深入推理的复杂任务。' }
    ];
    const emptyDraft = () => ({ schemaVersion: 2, enabled: false, presets: [], limits: { maxPendingStarts: 32, maxActivePerModel: 8, maxCreationsPerParent: 64, metadataTimeoutMs: 5000 } });
    const defaults = () => ({ ...emptyDraft(), presets: createDefaultPresets(), defaultPreset: DEFAULT_PRESET_ID });
    const legacyTeamsDisabled = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && value.enabled === false;
    function configurationIssue(value) {
      for (const source of ['ui', 'policy']) if (value?.[source]?.teams?.enabled === true) return { code: 'TEAM_ROUTING_REMOVED', message: en.teamRemoved, source, original: clone(value[source]) };
      for (const source of ['ui', 'policy']) if (isLegacyConfig(value?.[source])) return { code: 'LEGACY_CONFIGURATION', message: en.legacyConfiguration, source, original: clone(value[source]) };
    }
    function withDefaults(value) {
      const raw = clone(value), ui = { ...emptyDraft(), ...raw };
      if (raw?.presets === undefined) { ui.presets = createDefaultPresets(); if (ui.defaultPreset === undefined) ui.defaultPreset = DEFAULT_PRESET_ID; }
      ui.limits = { ...emptyDraft().limits, ...ui.limits };
      if (legacyTeamsDisabled(ui.teams)) delete ui.teams;
      return ui;
    }
    const sourceConflict = value => value?.ui !== undefined && value?.policy !== undefined;
    const migrationRequired = value => ['ui', 'policy'].some(source => isLegacyConfig(value?.[source]));
    const isLegacyConfig = value => !!value && typeof value === 'object' && !Array.isArray(value) && (value.schemaVersion === 1 || value.schemaVersion === undefined && !Object.hasOwn(value, 'presets') && Object.keys(value).length > 0);
    function invalidSource(value) {
      const source = value?.ui !== undefined ? value.ui : value?.policy;
      if (source === undefined) return false;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return true;
      if (source.teams !== undefined && source.teams?.enabled !== true && !legacyTeamsDisabled(source.teams)) return true;
      if (isLegacyConfig(source)) return false;
      const object = item => item && typeof item === 'object' && !Array.isArray(item);
      return source.schemaVersion !== undefined && source.schemaVersion !== 2 ||
        source.presets !== undefined && (!Array.isArray(source.presets) || source.presets.some(item => !object(item))) ||
        source.limits !== undefined && !object(source.limits) || source.teams !== undefined && !object(source.teams);
    }
    function draftFrom(value) {
      if (configurationIssue(value) || invalidSource(value)) return emptyDraft();
      return withDefaults(value?.ui ?? value?.policy);
    }
    // Equality normalization fills documented defaults only; never hides extras.
    function normalizeAckUi(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const ui = withDefaults(value);
      if (Array.isArray(ui.presets)) ui.presets = ui.presets.map(preset => ({ description: '', ...preset }));
      return ui;
    }
    function validDraft(ui) {
      if (ui.schemaVersion !== 2 || !Array.isArray(ui.presets) || ui.presets.length > 128 || ui.teams !== undefined && !legacyTeamsDisabled(ui.teams)) return false;
      const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
      const limits = ui.limits;
      if (ui.enabled !== undefined && typeof ui.enabled !== 'boolean') return false;
      if (limits !== undefined) {
        if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return false;
        for (const key of ['maxPendingStarts', 'maxActivePerModel', 'maxCreationsPerParent', 'metadataTimeoutMs']) {
          const value = limits[key], max = key === 'metadataTimeoutMs' ? 600000 : 1000000;
          if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > max)) return false;
        }
      }
      const ids = new Set();
      for (const preset of ui.presets) {
        if (!preset || !text(preset.id,120) || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(preset.id) || ids.has(preset.id) || !text(preset.name,120)) return false;
        if (preset.modelSource === 'parent') { if (Object.hasOwn(preset, 'provider') || Object.hasOwn(preset, 'model')) return false; }
        else if (Object.hasOwn(preset, 'modelSource') || !text(preset.provider,200) || !text(preset.model,200)) return false;
        if (preset.effort !== null && (!text(preset.effort,200) || preset.effort === 'default')) return false;
        if (preset.description !== undefined && preset.description !== '' && !text(preset.description,1000)) return false;
        ids.add(preset.id);
      }
      return (!ui.enabled || ids.has(ui.defaultPreset)) && (ui.defaultPreset === undefined || ids.has(ui.defaultPreset));
    }
    const CATALOG_EVENTS = ['llm/adapters-updated', 'llm/models-updated', 'settings/document-updated', 'credentials/record-updated', 'credentials/reference-updated'];
    const modelKey = model => JSON.stringify([model.provider, model.model]);
    // The current Host catalog uses reasoning.efforts[{id,name}], not the old
    // extracted levels[{effort,label}] shape. Never retain its full response.
    function normalizeCatalog(value) {
      const invalid = () => { throw Error('Invalid native model catalog'); };
      const text = item => typeof item === 'string' && item.trim().length > 0;
      if (!value || !Array.isArray(value.groups) || !Array.isArray(value.failures)) invalid();
      const seen = new Set();
      const groups = value.groups.map(group => {
        if (!group || !text(group.id) || seen.has(group.id) || !Array.isArray(group.models)) invalid();
        seen.add(group.id); const models = new Set();
        return { id: group.id, name: text(group.name) ? group.name : group.id, models: group.models.map(model => {
          if (!model || !text(model.id) || models.has(model.id)) invalid();
          models.add(model.id); const output = { id: model.id, name: text(model.name) ? model.name : model.id };
          if (model.reasoning !== undefined) {
            if (!model.reasoning || !Array.isArray(model.reasoning.efforts)) invalid();
            const efforts = new Set();
            output.reasoning = { efforts: model.reasoning.efforts.map(effort => {
              if (!effort || !text(effort.id) || efforts.has(effort.id)) invalid();
              efforts.add(effort.id); return { id: effort.id, name: text(effort.name) ? effort.name : effort.id };
            }) };
            if (text(model.reasoning.defaultEffort)) output.reasoning.defaultEffort = model.reasoning.defaultEffort;
          }
          return output;
        }) };
      });
      const failures = value.failures.map(failure => {
        if (!failure || !text(failure.id) || typeof failure.message !== 'string') invalid();
        return { id: failure.id, name: text(failure.name) ? failure.name : failure.id, message: failure.message };
      });
      return { groups, failures };
    }
    function catalogEfforts(model, t) {
      if (!model) return [];
      if (!model.reasoning || model.reasoning.efforts.length === 0) return [{ id: null, name: t('noEffort') }];
      return model.reasoning.efforts.filter(effort => effort.id !== 'default');
    }
    const effortKey = effort => JSON.stringify(effort);
    const emptyCatalog = { status: 'idle', groups: [], failures: [], error: '' };
    class ModelCatalog {
      constructor(ctx) {
        this.ctx = ctx; this.generation = 0; this.disposed = false; this.listeners = new Set(); this.offs = [];
        this.snapshot = emptyCatalog;
        if (typeof ctx.remote?.$on === 'function') for (const event of CATALOG_EVENTS) {
          this.offs.push(ctx.remote.$on(event, () => this.invalidate()));
        }
      }
      subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
      getSnapshot = () => this.snapshot;
      publish(value) { this.snapshot = value; for (const listener of this.listeners) listener(); }
      load() {
        if (this.disposed) return Promise.resolve(false);
        if (this.inFlight) return this.inFlight.promise;
        const generation = this.generation;
        const flight = { generation, promise: undefined };
        this.inFlight = flight;
        flight.promise = Promise.resolve().then(() => {
          if (this.disposed || generation !== this.generation) return;
          if (typeof this.ctx.remote?.session?.modelCatalog !== 'function') throw Error('Native model catalog is unavailable');
          return this.ctx.remote.session.modelCatalog();
        }).then(response => {
          if (this.disposed || generation !== this.generation || this.refreshPending) return false;
          if (!response?.ok) { const error = Error(response?.error?.message ?? 'Native model catalog request failed'); error.code = response?.error?.code; throw error; }
          const catalog = normalizeCatalog(response.value);
          this.publish({ status: 'ready', ...catalog, error: '' }); return true;
        }).catch(error => {
          if (!this.disposed && generation === this.generation && !this.refreshPending) this.publish({ ...emptyCatalog, status: 'error', error: error?.message ?? String(error), errorCode: error?.code });
          return false;
        }).finally(() => {
          if (this.disposed || generation !== this.generation || this.inFlight !== flight) return;
          this.inFlight = undefined;
          if (this.refreshPending) { this.refreshPending = false; void this.load(); }
        });
        this.publish({ ...emptyCatalog, status: 'loading' });
        return flight.promise;
      }
      invalidate() {
        if (this.disposed) return;
        if (this.inFlight) { this.refreshPending = true; this.publish({ ...emptyCatalog, status: 'loading' }); }
        else void this.load();
      }
      resetConnection() {
        if (this.disposed) return;
        this.generation++; this.inFlight = undefined; this.refreshPending = false;
        this.publish({ ...emptyCatalog }); void this.load();
      }
      find(provider, model) {
        if (this.snapshot.status !== 'ready' || this.snapshot.failures.some(failure => failure.id === provider)) return;
        return this.snapshot.groups.find(group => group.id === provider)?.models.find(item => item.id === model);
      }
      select(editor, index, key, expected) {
        if (this.disposed || this.snapshot.status !== 'ready') return false;
        const preset = editor.getSnapshot().draft.presets[index];
        if (!preset || expected && stable(preset) !== stable(expected)) return false;
        for (const group of this.snapshot.groups) for (const model of group.models) {
          if (key !== modelKey({ provider: group.id, model: model.id }) || !this.find(group.id, model.id)) continue;
          const options = catalogEfforts(model, editor.t);
          // Only a verified effort-less record yields null; no catalog is not null.
          const effort = preset.modelSource === 'parent' ? preset.effort : options.some(option => option.id === null) ? null : options.some(option => option.id === model.reasoning?.defaultEffort) ? model.reasoning.defaultEffort : '';
          return editor.edit(next => {
            Object.assign(next.presets[index], { provider: group.id, model: model.id, effort });
            delete next.presets[index].modelSource;
          });
        }
        return false;
      }
      setEffort(editor, index, value, expected) {
        const preset = editor.getSnapshot().draft.presets[index];
        if (this.disposed || !preset || Object.hasOwn(preset, 'modelSource') || expected && (expected.modelSource !== undefined || preset.id !== expected.id || modelKey(preset) !== modelKey(expected))) return false;
        const option = catalogEfforts(this.find(preset.provider, preset.model), editor.t).find(option => effortKey(option.id) === value);
        if (!option) return false;
        return editor.edit(next => { next.presets[index].effort = option.id; });
      }
      dispose() {
        if (this.disposed) return;
        this.disposed = true; this.generation++; this.inFlight = undefined; this.refreshPending = false;
        for (const off of this.offs) off(); this.offs = []; this.listeners.clear(); this.snapshot = emptyCatalog;
      }
    }

    class RouterEditor {
      constructor(ctx, t, timers = globalThis) {
        this.timers = timers; this.autosaveTimer = undefined; this.autosaveEpoch = 0; this.autosavePaused = false; this.composing = false;
        this.ctx = ctx; this.t = t; this.form = ctx.configForms.get(ENTRY); this.mirror = ctx.configForms.describe();
        this.listeners = new Set(); this.disposed = false; this.generation = 0; this.connectionReset = false;
        this.saving = false; this.reloading = false; this.dirty = false; this.conflicted = false;
        this.error = ''; this.saved = false; this.savedButNotLive = false; this.receiptUnverified = false;
        this.read(); this.off = this.form.subscribe(() => this.read());
      }
      read() {
        this.host = this.form.getSnapshot();
        if (!this.dirty && !this.saving && !this.reloading && !this.savedButNotLive && !this.connectionReset) { this.draft = draftFrom(this.host.value); this.baseRevision = this.host.revision; }
        else if (!this.saving && this.host.revision !== this.baseRevision) this.conflicted = true;
        if (!this.editable() || this.conflicted) this.cancelAutosave();
        this.publish();
      }
      cancelAutosave() {
        this.autosaveEpoch++;
        if (this.autosaveTimer !== undefined) this.timers.clearTimeout(this.autosaveTimer);
        this.autosaveTimer = undefined;
      }
      scheduleAutosave() {
        // Queue only from user edits; host notifications must never retry a failed write.
        this.cancelAutosave();
        if (!this.dirty || !this.editable() || this.conflicted || this.autosavePaused || this.composing || !validDraft(this.draft)) return;
        const epoch = this.autosaveEpoch;
        this.autosaveTimer = this.timers.setTimeout(() => {
          if (this.disposed || epoch !== this.autosaveEpoch) return;
          this.autosaveTimer = undefined;
          void this.save();
        }, 600);
      }
      setComposing(value) {
        this.composing = value;
        if (value) this.cancelAutosave(); else this.scheduleAutosave();
      }
      publish() {
        this.snapshot = { status: this.host?.status, writable: this.host?.writable, draft: this.draft, dirty: this.dirty, saving: this.saving, reloading: this.reloading, saved: this.saved, savedButNotLive: this.savedButNotLive, autosavePaused: this.autosavePaused, error: this.error, conflicted: this.conflicted, migrationRequired: migrationRequired(this.host?.value) || migrationRequired(this.host?.user), invalidSource: invalidSource(this.host?.value) || invalidSource(this.host?.user), configurationIssue: configurationIssue(this.host?.value) ?? configurationIssue(this.host?.user), sourceConflict: sourceConflict(this.host?.value) || sourceConflict(this.host?.user), policySource: this.host?.value?.policy !== undefined, auditFile: this.host?.value?.auditFile, receiptUnverified: this.receiptUnverified, connectionReset: this.connectionReset };
        for (const listener of this.listeners) listener();
      }
      subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
      getSnapshot = () => this.snapshot;
      editable() {
        return !this.disposed && !this.conflicted && !this.saving && !this.reloading && !this.connectionReset && this.host.writable && this.host.status === 'ready' && !this.receiptUnverified && !configurationIssue(this.host.value) && !configurationIssue(this.host.user) && !invalidSource(this.host.value) && !invalidSource(this.host.user) && !sourceConflict(this.host.value) && !sourceConflict(this.host.user);
      }
      edit(update) {
        if (!this.editable()) return false;
        const next = clone(this.draft); update(next);
        this.draft = next; this.dirty = true; this.saved = false;
        if (!this.autosavePaused) { this.savedButNotLive = false; this.error = ''; }
        this.scheduleAutosave(); this.publish(); return true;
      }
      addPreset() {
        if (this.draft.presets.length >= 128) return false;
        let index = 1; while (this.draft.presets.some(preset => preset.id === 'preset-' + index)) index++;
        return this.edit(next => next.presets.push({ id: 'preset-' + index, name: '', modelSource: 'parent', effort: 'high', description: '' }));
      }
      addDefaultPresets() {
        const additions = createDefaultPresets().filter(template => !this.draft.presets.some(preset => preset.id === template.id));
        if (!additions.length || this.draft.presets.length + additions.length > 128) return false;
        return this.edit(next => { next.presets.push(...additions); });
      }
      inheritModel(index, expected) {
        const preset = this.draft.presets[index];
        if (!preset || expected && stable(preset) !== stable(expected)) return false;
        return this.edit(next => { next.presets[index].modelSource = 'parent'; delete next.presets[index].provider; delete next.presets[index].model; });
      }
      setInheritedEffort(index, value, expected) {
        const preset = this.draft.presets[index];
        if (!preset || preset.modelSource !== 'parent' || expected && stable(preset) !== stable(expected)) return false;
        const template = createDefaultPresets().find(item => effortKey(item.effort) === value);
        if (!template) return false;
        return this.edit(next => { next.presets[index].effort = template.effort; });
      }
      resetConnection() {
        if (this.disposed) return;
        this.cancelAutosave(); this.composing = false;
        this.generation++; this.connectionReset = true; this.conflicted = true;
        this.receiptUnverified ||= this.saving; this.saving = false; this.reloading = false; this.saved = false; this.savedButNotLive = false;
        this.error = this.t('connectionReset'); this.publish();
      }
      confirmReceipt(current) {
        if (current.status !== 'ready' || current.user?.policy !== undefined || stable(current.user?.ui) !== stable(this.pendingDesired)) return false;
        const effective = current.value?.policy === undefined && stable(normalizeAckUi(current.value?.ui)) === stable(normalizeAckUi(this.pendingDesired));
        this.receiptUnverified = false; this.pendingDesired = undefined;
        this.autosavePaused = !effective;
        this.dirty = false; this.saved = effective; this.savedButNotLive = !effective; this.conflicted = false; this.baseRevision = current.revision;
        this.error = '';
        return true;
      }
      async reload() {
        if (this.saving || this.reloading || this.disposed) return;
        this.cancelAutosave(); this.composing = false;
        const generation = this.generation;
        this.reloading = true; this.publish();
        try {
          await this.mirror.load();
          if (this.disposed || generation !== this.generation) return;
          const current = this.form.getSnapshot();
          if (current.status !== 'ready') this.error = this.t('unavailable');
          else if (this.receiptUnverified && !this.connectionReset) {
            if (!this.confirmReceipt(current)) this.error = this.t('verifyFailed');
          } else {
            // Explicit successful reload is the only way to discard the old
            // connection's draft/fence. Failed refreshes never release it.
            this.dirty = false; this.conflicted = false; this.error = ''; this.saved = false; this.savedButNotLive = false;
            this.receiptUnverified = false; this.pendingDesired = undefined; this.connectionReset = false; this.autosavePaused = false;
          }
        } catch (error) { if (!this.disposed && generation === this.generation) this.error = error.message ?? String(error); }
        finally { if (!this.disposed && generation === this.generation) { this.reloading = false; this.read(); } }
      }
      async save() {
        this.cancelAutosave();
        if (this.disposed || this.composing) return false;
        this.read();
        if (this.disposed || this.saving || this.reloading || this.connectionReset || !this.dirty || !this.host.writable || this.host.status !== 'ready' || this.receiptUnverified) return false;
        if (this.conflicted || this.form.getSnapshot().revision !== this.baseRevision) { this.conflicted = true; this.publish(); return false; }
        if (!this.editable() || !validDraft(this.draft)) { this.error = this.t('invalidDraft'); this.publish(); return false; }
        const desired = clone(this.draft), revision = this.baseRevision, generation = this.generation;
        if (legacyTeamsDisabled(desired.teams)) delete desired.teams;
        // Only a verified receipt (or explicit reload) releases automatic saving.
        this.autosavePaused = true;
        this.saving = true; this.error = ''; this.saved = false; this.pendingDesired = desired; this.receiptUnverified = true; this.publish();
        let accepted = false;
        try {
          const response = await this.ctx.remote.settings.mutate(ENTRY, [ { op: 'unset', path: ['policy'] }, { op: 'set', path: ['ui'], value: desired } ], revision);
          if (this.disposed || generation !== this.generation) return false;
          if (!response.ok) { this.error = response.error.message; this.conflicted = response.error.code === 'settings/conflict'; this.receiptUnverified = false; this.pendingDesired = undefined; }
          else accepted = true;
          await this.mirror.load();
          if (this.disposed || generation !== this.generation) return false;
          const current = this.form.getSnapshot();
          if (accepted) { if (!this.confirmReceipt(current)) this.error = this.t('verifyFailed'); }
          else if (!this.error) this.error = this.t('saveFailed');
        } catch (error) { if (!this.disposed && generation === this.generation && !this.error) this.error = error.message ?? String(error); }
        finally { if (!this.disposed && generation === this.generation) { this.saving = false; this.read(); } }
        return this.saved;
      }
      dispose() { if (this.disposed) return; this.cancelAutosave(); this.disposed = true; this.generation++; this.off(); this.listeners.clear(); }
    }

    // Use the Host theme and native form semantics, not an independent app shell.
    const fieldStyle = { display: 'grid', gap: 8, minWidth: 0 };
    const inputStyle = { width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-secondary, #777)', color: 'inherit', background: 'var(--dsw-alias-background-primary, transparent)', font: 'inherit' };
    const buttonStyle = { ...inputStyle, width: 'auto', cursor: 'pointer' };
    function RouterPage({ editor, catalog, t, view }) {
      const state = React.useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
      const catalogState = React.useSyncExternalStore(catalog?.subscribe ?? (() => () => {}), catalog?.getSnapshot ?? (() => emptyCatalog), catalog?.getSnapshot ?? (() => emptyCatalog));
      if (view === 'summary') return h('span', null, t('summary'));
      const ui = state.draft ?? defaults();
      const busy = state.status !== 'ready' || !state.writable || state.saving || state.reloading || state.connectionReset || state.receiptUnverified || state.sourceConflict || state.invalidSource || !!state.configurationIssue;
      const disabled = busy || state.conflicted;
      const defaultAdditions = createDefaultPresets().filter(template => !ui.presets.some(preset => preset.id === template.id));
      const edit = update => editor.edit(update);
      const button = (key, action, off = false) => h('button', { type: 'button', style: buttonStyle, disabled: off, onClick: action }, t(key));
      const input = (key, value, set, type = 'text', off = disabled, maxLength) => h('label', { style: fieldStyle }, h('span', null, t(key)), h('input', { style: type === 'checkbox' ? { minWidth: 24, minHeight: 24 } : inputStyle, 'aria-label': t(key), type, disabled: off, maxLength, onCompositionStart: () => editor.setComposing(true), onCompositionEnd: () => editor.setComposing(false), ...(type === 'checkbox' ? { checked: !!value } : { value: value ?? '' }), onChange: event => set(type === 'checkbox' ? event.target.checked : type === 'number' ? Number(event.target.value) : event.target.value) }));
      const group = (title, children) => h('fieldset', { style: { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-secondary, #777)', borderRadius: 8, padding: 16, margin: '16px 0' } }, h('legend', { style: { maxWidth: '100%', overflowWrap: 'anywhere' } }, title), children);
      const grid = children => h('div', { style: { display: 'grid', minWidth: 0, gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 16, alignItems: 'end' } }, children);
      const json = value => h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' } }, JSON.stringify(value, null, 2));
      const rows = ui.presets.map((preset, index) => {
        const set = (key, value) => edit(next => { if (next.presets[index]?.id === preset.id) next.presets[index][key] = value; });
        const inherited = preset.modelSource === 'parent';
        const current = inherited ? undefined : catalog?.find(preset.provider, preset.model);
        const options = inherited ? createDefaultPresets().map(template => ({ id: template.effort, name: template.name + ' — ' + t('templateEffort') })) : catalogEfforts(current, t);
        const known = options.some(option => option.id === preset.effort);
        const failed = catalogState.failures.some(failure => failure.id === preset.provider);
        const missing = !inherited && !current && !!preset.provider && !!preset.model;
        const modelPicker = h('label', { style: fieldStyle }, h('span', null, t('chooseModel')),
          h('select', { style: inputStyle, 'aria-label': t('chooseModel'), disabled, value: inherited ? PARENT_MODEL_KEY : preset.provider && preset.model ? modelKey(preset) : '', onChange: event => event.target.value === PARENT_MODEL_KEY ? editor.inheritModel(index, preset) : catalog?.select(editor, index, event.target.value, preset) },
            h('option', { value: PARENT_MODEL_KEY }, t('inheritModel')),
            !inherited && !preset.provider && !preset.model ? h('option', { value: '', disabled: true }, t('chooseModel')) : null,
            missing ? h('option', { value: modelKey(preset), disabled: true }, preset.provider + ' / ' + preset.model) : null,
            catalogState.groups.map(provider => h('optgroup', { key: provider.id, label: provider.name + ' (' + provider.id + ')', disabled: catalogState.status !== 'ready' || catalogState.failures.some(failure => failure.id === provider.id) },
              provider.models.map(item => h('option', { key: item.id, value: modelKey({ provider: provider.id, model: item.id }) }, item.name + ' — ' + item.id))))),
          inherited ? h('span', { role: 'status' }, t('inheritHelp')) : h('code', { style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, preset.provider + ' / ' + preset.model),
          missing ? h('span', { role: 'status' }, t(catalogState.status === 'ready' && !failed ? 'catalogMissing' : 'catalogUnverified')) : null);
        const effortPicker = h('label', { style: fieldStyle }, h('span', null, t('effort')),
          h('select', { style: inputStyle, 'aria-label': t('effort'), value: preset.effort === '' || preset.effort === undefined ? '' : effortKey(preset.effort), disabled: disabled || !inherited && !current, onChange: event => inherited ? editor.setInheritedEffort(index, event.target.value, preset) : catalog?.setEffort(editor, index, event.target.value, preset) },
            h('option', { value: '', disabled: true }, t('chooseEffort')),
            !known && preset.effort !== '' && preset.effort !== undefined ? h('option', { value: effortKey(preset.effort), disabled: true }, String(preset.effort) + ' — ' + t(inherited ? 'retainedEffort' : 'unknownEffort')) : null,
            options.map(option => h('option', { key: effortKey(option.id), value: effortKey(option.id) }, option.name + (option.id === null ? '' : ' (' + option.id + ')')))),
          inherited ? h('span', { role: 'status' }, t('inheritEffortHelp')) : null,
          preset.effort === '' ? h('span', { role: 'status' }, t('effortRequired')) : null,
          options.some(option => option.id === null) ? h('span', { role: 'status' }, t('noReasoning')) : null);
        return h('div', { key: index, 'data-preset': preset.id }, group(preset.name || t('name') + ' ' + (index + 1), [
          grid([h('div', { style: fieldStyle }, input('name', preset.name, value => set('name', value), 'text', disabled, 120), h('code', { 'aria-label': t('id'), style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, t('id') + ': ' + preset.id)), modelPicker, effortPicker]),
          h('div', { style: { marginTop: 16 } }, input('description', preset.description, value => set('description', value), 'text', disabled, 1000)),
          h('div', { style: { marginTop: 16 } }, button('remove', () => edit(next => { if (next.presets[index]?.id === preset.id) next.presets.splice(index, 1); }), disabled))
        ]));
      });
      return h('section', { style: { color: 'var(--dsw-alias-label-primary, inherit)', padding: '16px 0', minWidth: 0, maxWidth: '100%', lineHeight: 1.6 } },
        h('h2', null, t('title')), h('p', null, t('summary')),
        state.status !== 'ready' ? h('p', { role: 'status' }, t(state.status === 'loading' ? 'loading' : 'unavailable')) : null,
        state.status === 'ready' && !state.writable ? h('p', { role: 'status' }, t('readOnly')) : null,
        state.sourceConflict ? h('p', { role: 'alert' }, t('sourceConflict')) : null,
        state.invalidSource ? h('p', { role: 'alert' }, t('invalidSource')) : null,
        state.configurationIssue ? group(state.configurationIssue.code, [h('p', { role: 'alert' }, t(state.configurationIssue.code === 'TEAM_ROUTING_REMOVED' ? 'teamRemoved' : 'legacyConfiguration')), h('details', null, h('summary', null, t('configurationOriginal')), json(state.configurationIssue.original))]) : null,
        h('div', { 'data-autosave': true, style: { position: 'sticky', top: 0, zIndex: 1, padding: '12px 0', background: 'var(--dsw-alias-background-primary, #fff)', borderBottom: '1px solid var(--dsw-alias-border-secondary, #777)' } },
          h('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, t(state.saving ? 'saving' : state.savedButNotLive ? 'savedButNotLive' : state.error || state.conflicted ? 'autosaveFailed' : state.dirty ? validDraft(ui) ? 'autosavePending' : 'autosaveIncomplete' : state.saved ? 'saved' : 'autosave')),
          state.conflicted ? h('p', { role: 'alert' }, t('conflict')) : null,
          state.error ? h('p', { role: 'alert' }, state.error) : null,
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 } },
            state.error && state.dirty && !state.receiptUnverified && !state.connectionReset && !state.conflicted ? button('retry', () => editor.save(), disabled || !validDraft(ui)) : null,
            button(state.dirty && !state.receiptUnverified || state.connectionReset ? 'cancel' : 'refresh', () => editor.reload(), state.saving || state.reloading))),
        state.policySource && !state.configurationIssue ? h('p', { role: 'status' }, t('policySource')) : null,
        grid([input('enabled', ui.enabled, value => edit(next => { next.enabled = value; }), 'checkbox'),
          h('label', { style: fieldStyle }, h('span', null, t('defaultPreset')), h('select', { style: inputStyle, 'aria-label': t('defaultPreset'), value: ui.defaultPreset ?? '', disabled, onChange: event => { const draft = editor.getSnapshot().draft; if (event.target.value === '' && !draft.enabled) edit(next => { delete next.defaultPreset; }); else if (draft.presets.filter(preset => preset.id === event.target.value).length === 1) edit(next => { next.defaultPreset = event.target.value; }); } },
            h('option', { value: '', disabled: !!ui.enabled }, t('chooseDefault')),
            ui.defaultPreset && !ui.presets.some(preset => preset.id === ui.defaultPreset) ? h('option', { value: ui.defaultPreset, disabled: true }, ui.defaultPreset) : null,
            ui.presets.filter(preset => preset.id && ui.presets.filter(other => other.id === preset.id).length === 1).map(preset => h('option', { key: preset.id, value: preset.id }, (preset.name || preset.id) + ' — ' + preset.id))))]),
        h('p', null, t('authority')),
        h('h3', null, t('catalog')), h('p', null, t('catalogHelp')),
        button('catalogRefresh', () => catalog?.load(), !catalog || catalogState.status === 'loading'),
        catalogState.status === 'loading' ? h('p', { role: 'status' }, t('catalogLoading')) : null,
        catalogState.status === 'error' ? h('p', { role: 'alert' }, t('catalogFailed') + ' ' + catalogState.error) : null,
        catalogState.failures.length ? h('div', { role: 'alert' }, h('p', null, t('catalogPartial')), h('ul', null, catalogState.failures.map(failure => h('li', { key: failure.id }, failure.name + ' (' + failure.id + '): ' + failure.message)))) : null,
        catalogState.status === 'ready' && !catalogState.groups.some(provider => provider.models.length) ? h('p', { role: 'status' }, t('catalogEmpty')) : null,
        h('h3', null, t('presets')), rows.length ? rows : h('p', null, t('noPresets')),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, button('addPreset', () => editor.addPreset(), disabled || ui.presets.length >= 128), button('addDefaults', () => editor.addDefaultPresets(), disabled || !defaultAdditions.length || ui.presets.length + defaultAdditions.length > 128)),
        h('p', null, t('defaultsHelp')),
        h('details', { style: { margin: '24px 0' } }, h('summary', null, t('advanced')),
          group(t('limits'), grid(['maxPendingStarts','maxActivePerModel','maxCreationsPerParent','metadataTimeoutMs'].map(key => input(key, ui.limits[key], value => edit(next => { next.limits[key] = value; }), 'number')))),
          h('h3', null, t('auditFile')), h('code', { style: { overflowWrap: 'anywhere' } }, state.auditFile ?? '—'), h('p', null, t('auditHelp'))),
        h('p', null, t('executionEvidence'))
      );
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'delegation-router: locale');
      const editor = new RouterEditor(ctx, t);
      const catalog = new ModelCatalog(ctx);
      ctx.effect(() => {
        const warnUnsaved = event => {
          const state = editor.getSnapshot();
          if (state.dirty || state.saving || state.receiptUnverified) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener?.('beforeunload', warnUnsaved);
        return () => window.removeEventListener?.('beforeunload', warnUnsaved);
      }, 'delegation-router: unsaved changes warning');
      ctx.effect(() => () => editor.dispose(), 'delegation-router: editor subscription');
      ctx.effect(() => () => catalog.dispose(), 'delegation-router: native catalog subscriptions');
      ctx.on('connection/reset', () => { editor.resetConnection(); catalog.resetConnection(); });
      void catalog.load();
      const component = props => h(RouterPage, { ...props, editor, catalog, t });
      for (const [name, key] of [['plugins.bundle.config', 'dsh-delegation-router'], ['plugins.row.config', 'dsh-delegation-router#delegation-router']]) {
        ctx.effect(() => ctx.slots.inject(name, () => ctx.slots.register({ name, key }, component)), 'delegation-router: ' + name);
      }
    }
    return { inject: ['slots', 'locale', 'configForms', 'remote', 'remote.settings', 'remote.session'], apply, RouterEditor, RouterPage, ModelCatalog, normalizeCatalog, modelKey, catalogEfforts, effortKey, CATALOG_EVENTS, createDefaultPresets, DEFAULT_PRESET_ID, PARENT_MODEL_KEY, emptyDraft, defaults, draftFrom, normalizeAckUi, validDraft, dictionaries: { zh, en } };
  }
});
