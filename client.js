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
  "autosaveIncomplete": "更改尚未保存，请补全必填项、有效默认候选及范围内的整数配额。",
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
  "executionEvidence": "保存或列出候选不会执行委派，也不能证明子 Agent 的实际路由；实际父作用域证据请通过 router_status 查询。",
  "title": "委派候选模型",
  "summary": "由用户维护候选模型：精确 provider / model / 思考档位，外加一个默认项；主 Agent 创建子 Agent 时直接选择其一，不新增选型调用，也不切换主 Agent。",
  "candidates": "候选清单",
  "addCandidate": "添加候选",
  "name": "候选名称",
  "description": "适用说明（一句话）",
  "effort": "思考档位",
  "defaultCandidate": "默认候选",
  "chooseDefault": "未指定默认候选（仅关闭时允许）",
  "noCandidates": "尚无候选。添加一个候选，并从目录选择精确 provider / model / 思考档位。",
  "catalogHelp": "候选模型从 DSH 原生目录选择，档位为目录公示的真实值单选；明确无可选档位时保存 null，不补造 default。目录可见不代表授权或通过后端预检。",
  "noReasoning": "目录确认此模型没有可选思考档位；本候选使用 null，不发送思考档位。",
  "noEffort": "无可选档位（null）",
  "effortRequired": "请选择一个真实档位；default 哨兵不会自动迁移。",
  "invalidDraft": "请补全每个候选的名称、唯一 ID、模型和单个档位；启用前必须明确选择有效默认候选。",
  "authority": "候选说明仅为选型资料，不授予能力、权限或安排任务。非法提案将被拒绝，不自动换模型。当前创建仅传文本，不转发图片。",
  "advanced": "高级与安全设置",
  "auditFile": "审计路径（由原生设置管理）",
  "auditHelp": "此表单保留既有 auditFile，不清除日志或锁。需要修改时请使用原生设置。",
  "invalidSource": "配置结构无效（需要 v3 候选配置），已阻止此表单覆盖原文；请在原生设置核对修复。",
  "invalidSourceTitle": "无效配置",
  "originalConfiguration": "原始配置（只读）"
};
    const en = {
  "loading": "Reading profile configuration…",
  "unavailable": "Routing settings are unavailable in this profile. Enable the plugin first.",
  "readOnly": "This configuration is read-only.",
  "autosave": "Changes save automatically after 0.6 seconds of inactivity; no manual submission needed.",
  "autosavePending": "Changes pending automatic save…",
  "autosaveIncomplete": "Not saved yet. Complete required fields, choose a valid default candidate and use integer quotas within range.",
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
  "executionEvidence": "Saving or listing candidates does not execute delegation or prove actual child routing; query actual parent-scoped evidence with router_status.",
  "title": "Delegation candidates",
  "summary": "Candidates are maintained by the user: exact provider / model / reasoning effort plus one default. The main Agent picks one directly at child creation; no extra selection calls and never switches the main Agent.",
  "candidates": "Candidate list",
  "addCandidate": "Add candidate",
  "name": "Candidate name",
  "description": "Usage description (one sentence)",
  "effort": "Reasoning effort",
  "defaultCandidate": "Default candidate",
  "chooseDefault": "No default candidate (disabled routing only)",
  "noCandidates": "No candidates yet. Add one and choose an exact provider / model / effort from the catalog.",
  "catalogHelp": "Candidate models use the native DSH catalog and one real advertised effort. Confirmed effort-less entries use null, never an invented default. Catalog visibility is not authorization or backend preflight approval.",
  "noReasoning": "The catalog confirms no selectable reasoning efforts for this model. This candidate uses null and sends no reasoning effort.",
  "noEffort": "No selectable effort (null)",
  "effortRequired": "Choose a real effort. The default sentinel is never migrated automatically.",
  "invalidDraft": "Complete each candidate name, unique ID, model and single effort; explicitly choose a valid default candidate before enabling.",
  "authority": "Candidate descriptions are selection data, not capability, authorization or task assignments. Invalid proposals are rejected without switching models. Creation is text-only and does not forward images.",
  "advanced": "Advanced and safety settings",
  "auditFile": "Audit path (managed in native settings)",
  "auditHelp": "This form preserves auditFile and never clears journals or locks. Change the path through native settings.",
  "invalidSource": "Invalid configuration structure (v3 candidates required). This form cannot overwrite the original; review and repair it in native settings.",
  "invalidSourceTitle": "Invalid configuration",
  "originalConfiguration": "Original configuration (read-only)"
};
    // Validate the sole fixed-candidate configuration before exposing an editable draft.
    const emptyDraft = () => ({ schemaVersion: 3, enabled: false, candidates: [], limits: { maxPendingStarts: 32, maxActivePerModel: 8, maxCreationsPerParent: 64, metadataTimeoutMs: 5000 } });
    const PLUGIN_KEYS = ['ui', 'auditFile'];
    const UI_KEYS = ['schemaVersion', 'enabled', 'candidates', 'defaultCandidateId', 'limits'];
    const CANDIDATE_KEYS = ['id', 'name', 'provider', 'model', 'effort', 'description'];
    const LIMIT_KEYS = ['maxPendingStarts', 'maxActivePerModel', 'maxCreationsPerParent', 'metadataTimeoutMs'];
    function withDefaults(value) {
      const raw = clone(value), ui = { ...emptyDraft(), ...raw };
      ui.limits = { ...emptyDraft().limits, ...ui.limits };
      return ui;
    }
    // Strict v3 guard: a stored policy key (even undefined-valued), a non-v3
    // schemaVersion, malformed structures or any unrecognized persistent key is
    // read-only invalid data, never a fresh empty draft and never auto-repaired.
    function invalidSource(value) {
      if (value && typeof value === 'object' && !Array.isArray(value) &&
          (Object.hasOwn(value, 'policy') || Object.keys(value).some(key => !PLUGIN_KEYS.includes(key)) ||
           value.auditFile !== undefined && typeof value.auditFile !== 'string')) return true;
      const source = value?.ui;
      if (source === undefined) return false;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return true;
      const object = item => item && typeof item === 'object' && !Array.isArray(item);
      if (source.schemaVersion !== 3) return true;
      for (const key of Object.keys(source)) if (!UI_KEYS.includes(key)) return true;
      if (source.enabled !== undefined && typeof source.enabled !== 'boolean') return true;
      if (source.candidates !== undefined && (!Array.isArray(source.candidates) || source.candidates.some(item =>
        !object(item) || Object.keys(item).some(key => !CANDIDATE_KEYS.includes(key))))) return true;
      if (source.limits !== undefined && (!object(source.limits) || Object.keys(source.limits).some(key => !LIMIT_KEYS.includes(key)))) return true;
      return false;
    }
    function draftFrom(value) {
      if (invalidSource(value)) return emptyDraft();
      return withDefaults(value?.ui);
    }
    // Equality normalization fills documented defaults only for legitimate v3
    // sources; a bad source (for example an explicit empty {}) is preserved as-is
    // so comparisons stay unequal instead of fabricating a valid acknowledgement.
    function normalizeAckUi(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      if (invalidSource({ ui: value })) return value;
      const ui = withDefaults(value);
      if (Array.isArray(ui.candidates)) ui.candidates = ui.candidates.map(candidate => ({ description: '', ...candidate }));
      return ui;
    }
    function validDraft(ui) {
      if (ui.schemaVersion !== 3 || !Array.isArray(ui.candidates) || ui.candidates.length > 128) return false;
      const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
      const limits = ui.limits;
      for (const key of Object.keys(ui)) if (!UI_KEYS.includes(key)) return false;
      if (ui.enabled !== undefined && typeof ui.enabled !== 'boolean') return false;
      if (limits !== undefined) {
        if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return false;
        for (const key of Object.keys(limits)) if (!LIMIT_KEYS.includes(key)) return false;
        for (const key of LIMIT_KEYS) {
          const value = limits[key], max = key === 'metadataTimeoutMs' ? 600000 : 1000000;
          if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > max)) return false;
        }
      }
      const ids = new Set();
      for (const candidate of ui.candidates) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
        for (const key of Object.keys(candidate)) if (!CANDIDATE_KEYS.includes(key)) return false;
        if (!text(candidate.id,120) || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(candidate.id) || ids.has(candidate.id) || !text(candidate.name,120)) return false;
        if (!text(candidate.provider,200) || !text(candidate.model,200)) return false;
        if (candidate.effort !== null && (!text(candidate.effort,200) || candidate.effort === 'default')) return false;
        if (candidate.description !== undefined && candidate.description !== '' && !text(candidate.description,1000)) return false;
        ids.add(candidate.id);
      }
      return (!ui.enabled || ids.has(ui.defaultCandidateId)) && (ui.defaultCandidateId === undefined || ids.has(ui.defaultCandidateId));
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
        const candidate = editor.getSnapshot().draft.candidates[index];
        if (!candidate || expected && stable(candidate) !== stable(expected)) return false;
        for (const group of this.snapshot.groups) for (const model of group.models) {
          if (key !== modelKey({ provider: group.id, model: model.id }) || !this.find(group.id, model.id)) continue;
          const options = catalogEfforts(model, editor.t);
          // Only a verified effort-less record yields null; no catalog is not null.
          const effort = options.some(option => option.id === null) ? null : options.some(option => option.id === model.reasoning?.defaultEffort) ? model.reasoning.defaultEffort : '';
          return editor.edit(next => { Object.assign(next.candidates[index], { provider: group.id, model: model.id, effort }); });
        }
        return false;
      }
      setEffort(editor, index, value, expected) {
        const candidate = editor.getSnapshot().draft.candidates[index];
        if (this.disposed || !candidate || expected && (candidate.id !== expected.id || modelKey(candidate) !== modelKey(expected))) return false;
        const option = catalogEfforts(this.find(candidate.provider, candidate.model), editor.t).find(option => effortKey(option.id) === value);
        if (!option) return false;
        return editor.edit(next => { next.candidates[index].effort = option.id; });
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
        const badDoc = invalidSource(this.host?.user) ? this.host.user : invalidSource(this.host?.value) ? this.host.value : undefined;
        const invalidOriginal = badDoc ? clone(Object.keys(badDoc).some(key => key !== 'policy' && !PLUGIN_KEYS.includes(key)) ||
          badDoc.auditFile !== undefined && typeof badDoc.auditFile !== 'string' ? badDoc : badDoc.policy !== undefined ? badDoc.policy : badDoc.ui) : undefined;
        this.snapshot = { status: this.host?.status, writable: this.host?.writable, draft: this.draft, dirty: this.dirty, saving: this.saving, reloading: this.reloading, saved: this.saved, savedButNotLive: this.savedButNotLive, autosavePaused: this.autosavePaused, error: this.error, conflicted: this.conflicted, invalidSource: !!badDoc, invalidOriginal, auditFile: this.host?.value?.auditFile, receiptUnverified: this.receiptUnverified, connectionReset: this.connectionReset };
        for (const listener of this.listeners) listener();
      }
      subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
      getSnapshot = () => this.snapshot;
      editable() {
        return !this.disposed && !this.conflicted && !this.saving && !this.reloading && !this.connectionReset && this.host.writable && this.host.status === 'ready' && !this.receiptUnverified && !invalidSource(this.host.value) && !invalidSource(this.host.user);
      }
      edit(update) {
        if (!this.editable()) return false;
        const next = clone(this.draft); update(next);
        this.draft = next; this.dirty = true; this.saved = false;
        if (!this.autosavePaused) { this.savedButNotLive = false; this.error = ''; }
        this.scheduleAutosave(); this.publish(); return true;
      }
      addCandidate() {
        if (this.draft.candidates.length >= 128) return false;
        let index = 1; while (this.draft.candidates.some(candidate => candidate.id === 'candidate-' + index)) index++;
        // A fresh candidate is deliberately unfinished: empty strings block autosave
        // until the user picks an exact model and effort; never null, never a tier.
        return this.edit(next => next.candidates.push({ id: 'candidate-' + index, name: '', provider: '', model: '', effort: '', description: '' }));
      }
      resetConnection() {
        if (this.disposed) return;
        this.cancelAutosave(); this.composing = false;
        this.generation++; this.connectionReset = true; this.conflicted = true;
        this.receiptUnverified ||= this.saving; this.saving = false; this.reloading = false; this.saved = false; this.savedButNotLive = false;
        this.error = this.t('connectionReset'); this.publish();
      }
      confirmReceipt(current) {
        if (current.status !== 'ready' || stable(current.user?.ui) !== stable(this.pendingDesired)) return false;
        // An effective match alone is not a receipt: the surrounding documents must
        // also be legitimate v3 sources; outer illegal keys keep the save not-live.
        const effective = !invalidSource(current.user) && !invalidSource(current.value) &&
          stable(normalizeAckUi(current.value?.ui)) === stable(normalizeAckUi(this.pendingDesired));
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
        // Only a verified receipt (or explicit reload) releases automatic saving.
        this.autosavePaused = true;
        this.saving = true; this.error = ''; this.saved = false; this.pendingDesired = desired; this.receiptUnverified = true; this.publish();
        let accepted = false;
        try {
          const response = await this.ctx.remote.settings.mutate(ENTRY, [ { op: 'set', path: ['ui'], value: desired } ], revision);
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
      const ui = state.draft ?? emptyDraft();
      const busy = state.status !== 'ready' || !state.writable || state.saving || state.reloading || state.connectionReset || state.receiptUnverified || state.invalidSource;
      const disabled = busy || state.conflicted;
      const edit = update => editor.edit(update);
      const button = (key, action, off = false) => h('button', { type: 'button', style: buttonStyle, disabled: off, onClick: action }, t(key));
      const input = (key, value, set, type = 'text', off = disabled, maxLength) => h('label', { style: fieldStyle }, h('span', null, t(key)), h('input', { style: type === 'checkbox' ? { minWidth: 24, minHeight: 24 } : inputStyle, 'aria-label': t(key), type, disabled: off, maxLength, onCompositionStart: () => editor.setComposing(true), onCompositionEnd: () => editor.setComposing(false), ...(type === 'checkbox' ? { checked: !!value } : { value: value ?? '' }), onChange: event => set(type === 'checkbox' ? event.target.checked : type === 'number' ? Number(event.target.value) : event.target.value) }));
      const group = (title, children) => h('fieldset', { style: { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-secondary, #777)', borderRadius: 8, padding: 16, margin: '16px 0' } }, h('legend', { style: { maxWidth: '100%', overflowWrap: 'anywhere' } }, title), children);
      const grid = children => h('div', { style: { display: 'grid', minWidth: 0, gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 16, alignItems: 'end' } }, children);
      const json = value => h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' } }, JSON.stringify(value, null, 2));
      const rows = ui.candidates.map((candidate, index) => {
        const set = (key, value) => edit(next => { if (next.candidates[index]?.id === candidate.id) next.candidates[index][key] = value; });
        const current = catalog?.find(candidate.provider, candidate.model);
        const options = catalogEfforts(current, t);
        const known = options.some(option => option.id === candidate.effort);
        const failed = catalogState.failures.some(failure => failure.id === candidate.provider);
        const missing = !current && !!candidate.provider && !!candidate.model;
        const modelPicker = h('label', { style: fieldStyle }, h('span', null, t('chooseModel')),
          h('select', { style: inputStyle, 'aria-label': t('chooseModel'), disabled, value: candidate.provider && candidate.model ? modelKey(candidate) : '', onChange: event => catalog?.select(editor, index, event.target.value, candidate) },
            !candidate.provider && !candidate.model ? h('option', { value: '', disabled: true }, t('chooseModel')) : null,
            missing ? h('option', { value: modelKey(candidate), disabled: true }, candidate.provider + ' / ' + candidate.model) : null,
            catalogState.groups.map(provider => h('optgroup', { key: provider.id, label: provider.name + ' (' + provider.id + ')', disabled: catalogState.status !== 'ready' || catalogState.failures.some(failure => failure.id === provider.id) },
              provider.models.map(item => h('option', { key: item.id, value: modelKey({ provider: provider.id, model: item.id }) }, item.name + ' — ' + item.id))))),
          candidate.provider && candidate.model ? h('code', { style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, candidate.provider + ' / ' + candidate.model) : null,
          missing ? h('span', { role: 'status' }, t(catalogState.status === 'ready' && !failed ? 'catalogMissing' : 'catalogUnverified')) : null);
        const effortPicker = h('label', { style: fieldStyle }, h('span', null, t('effort')),
          h('select', { style: inputStyle, 'aria-label': t('effort'), value: candidate.effort === '' || candidate.effort === undefined ? '' : effortKey(candidate.effort), disabled: disabled || !current, onChange: event => catalog?.setEffort(editor, index, event.target.value, candidate) },
            h('option', { value: '', disabled: true }, t('chooseEffort')),
            !known && candidate.effort !== '' && candidate.effort !== undefined ? h('option', { value: effortKey(candidate.effort), disabled: true }, String(candidate.effort) + ' — ' + t('unknownEffort')) : null,
            options.map(option => h('option', { key: effortKey(option.id), value: effortKey(option.id) }, option.name + (option.id === null ? '' : ' (' + option.id + ')')))),
          candidate.effort === '' || candidate.effort === undefined ? h('span', { role: 'status' }, t('effortRequired')) : null,
          options.some(option => option.id === null) ? h('span', { role: 'status' }, t('noReasoning')) : null);
        return h('div', { key: index, 'data-candidate': candidate.id }, group(candidate.name || t('name') + ' ' + (index + 1), [
          grid([h('div', { style: fieldStyle }, input('name', candidate.name, value => set('name', value), 'text', disabled, 120), h('code', { 'aria-label': t('id'), style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, t('id') + ': ' + candidate.id)), modelPicker, effortPicker]),
          h('div', { style: { marginTop: 16 } }, input('description', candidate.description, value => set('description', value), 'text', disabled, 1000)),
          h('div', { style: { marginTop: 16 } }, button('remove', () => edit(next => { if (next.candidates[index]?.id === candidate.id) next.candidates.splice(index, 1); }), disabled))
        ]));
      });
      return h('section', { style: { color: 'var(--dsw-alias-label-primary, inherit)', padding: '16px 0', minWidth: 0, maxWidth: '100%', lineHeight: 1.6 } },
        h('h2', null, t('title')), h('p', null, t('summary')),
        state.status !== 'ready' ? h('p', { role: 'status' }, t(state.status === 'loading' ? 'loading' : 'unavailable')) : null,
        state.status === 'ready' && !state.writable ? h('p', { role: 'status' }, t('readOnly')) : null,
        state.invalidSource ? group(t('invalidSourceTitle'), [h('p', { role: 'alert' }, t('invalidSource')), h('details', null, h('summary', null, t('originalConfiguration')), json(state.invalidOriginal))]) : null,
        h('div', { 'data-autosave': true, style: { position: 'sticky', top: 0, zIndex: 1, padding: '12px 0', background: 'var(--dsw-alias-background-primary, #fff)', borderBottom: '1px solid var(--dsw-alias-border-secondary, #777)' } },
          h('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, t(state.saving ? 'saving' : state.savedButNotLive ? 'savedButNotLive' : state.error || state.conflicted ? 'autosaveFailed' : state.dirty ? validDraft(ui) ? 'autosavePending' : 'autosaveIncomplete' : state.saved ? 'saved' : 'autosave')),
          state.conflicted ? h('p', { role: 'alert' }, t('conflict')) : null,
          state.error ? h('p', { role: 'alert' }, state.error) : null,
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 } },
            state.error && state.dirty && !state.receiptUnverified && !state.connectionReset && !state.conflicted ? button('retry', () => editor.save(), disabled || !validDraft(ui)) : null,
            button(state.dirty && !state.receiptUnverified || state.connectionReset ? 'cancel' : 'refresh', () => editor.reload(), state.saving || state.reloading))),
        grid([input('enabled', ui.enabled, value => edit(next => { next.enabled = value; }), 'checkbox'),
          h('label', { style: fieldStyle }, h('span', null, t('defaultCandidate')), h('select', { style: inputStyle, 'aria-label': t('defaultCandidate'), value: ui.defaultCandidateId ?? '', disabled, onChange: event => { const draft = editor.getSnapshot().draft; if (event.target.value === '' && !draft.enabled) edit(next => { delete next.defaultCandidateId; }); else if (draft.candidates.filter(candidate => candidate.id === event.target.value).length === 1) edit(next => { next.defaultCandidateId = event.target.value; }); } },
            h('option', { value: '', disabled: !!ui.enabled }, t('chooseDefault')),
            ui.defaultCandidateId && !ui.candidates.some(candidate => candidate.id === ui.defaultCandidateId) ? h('option', { value: ui.defaultCandidateId, disabled: true }, ui.defaultCandidateId) : null,
            ui.candidates.filter(candidate => candidate.id && ui.candidates.filter(other => other.id === candidate.id).length === 1).map(candidate => h('option', { key: candidate.id, value: candidate.id }, (candidate.name || candidate.id) + ' — ' + candidate.id))))]),
        h('p', null, t('authority')),
        h('h3', null, t('catalog')), h('p', null, t('catalogHelp')),
        button('catalogRefresh', () => catalog?.load(), !catalog || catalogState.status === 'loading'),
        catalogState.status === 'loading' ? h('p', { role: 'status' }, t('catalogLoading')) : null,
        catalogState.status === 'error' ? h('p', { role: 'alert' }, t('catalogFailed') + ' ' + catalogState.error) : null,
        catalogState.failures.length ? h('div', { role: 'alert' }, h('p', null, t('catalogPartial')), h('ul', null, catalogState.failures.map(failure => h('li', { key: failure.id }, failure.name + ' (' + failure.id + '): ' + failure.message)))) : null,
        catalogState.status === 'ready' && !catalogState.groups.some(provider => provider.models.length) ? h('p', { role: 'status' }, t('catalogEmpty')) : null,
        h('h3', null, t('candidates')), rows.length ? rows : h('p', null, t('noCandidates')),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, button('addCandidate', () => editor.addCandidate(), disabled || ui.candidates.length >= 128)),
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
    return { inject: ['slots', 'locale', 'configForms', 'remote', 'remote.settings', 'remote.session'], apply, RouterEditor, RouterPage, ModelCatalog, normalizeCatalog, modelKey, catalogEfforts, effortKey, CATALOG_EVENTS, emptyDraft, draftFrom, normalizeAckUi, validDraft, dictionaries: { zh, en } };
  }
});
