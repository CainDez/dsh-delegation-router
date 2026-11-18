/* Native Settings companion: no separate page, server, or parent model changes. */
window.__ModuleLoader__.load({
  id: 'dsh-delegation-router',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'delegationRouter', ENTRY = 'delegation-router';
    // This namespace is mounted by this plugin: a required inject would deadlock startup.
    // Cordis get() is the optional, caller-scoped lookup; direct property access throws in a fiber.
    const routerRemote = ctx => typeof ctx.get === 'function' ? ctx.get('remote.delegationRouter') : ctx.remote?.delegationRouter;
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const stable = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    const zh = {
  "draftConfirmPreset": "我已核对变更，确认仅更新当前预设的模型名称、分工说明和默认项；全局可用模型池、档位、启用开关、配额和审计设置不变。",
  "sharedPool": "全局可用模型池",
  "sharedPoolHelp": "这里的新增、删除、模型和档位修改对所有预设生效；切换预设不会改变它们。",
  "presetRoles": "当前预设的模型分工",
  "draftPoolMismatch": "草稿包含全局池中没有的模型／档位，或对应多个候选而无法唯一匹配。未应用。请先在全局可用模型池中添加或明确调整候选，再重新生成。",
  "poolDefaultInUse": "此候选仍是某套预设的默认项。请先切到相关预设更换默认项，再从全局模型池删除。",
  "configSets": "多模型预设",
  "configSetsHelp": "预设由你自由命名，只保存模型分工、名称和默认项。所有预设共用下方的可用模型池、启用开关和配额。",
  "activeConfig": "当前预设",
  "initialConfig": "原有配置",
  "configName": "预设名",
  "configNameHint": "输入名称后新建、复制或重命名当前预设",
  "newConfig": "新建预设",
  "copyConfig": "复制当前预设",
  "renameConfig": "重命名当前预设",
  "manageConfigs": "管理已保存预设",
  "deleteConfig": "删除预设",
  "confirmDeleteConfig": "确认删除",
  "cancelDeleteConfig": "取消删除",
  "deleteConfigWarning": "删除后无法恢复。请确认要删除的配置：",
  "configActiveBadge": "当前预设 · 不可删除",
  "configSetLimit": "最多保存 32 套预设。新建仅清空分工说明并沿用当前默认项；复制保留分工。两者都不改变全局模型池、启用开关或配额。",
  "configSetProtected": "请先保存或放弃当前修改，并处理保存异常后再管理或切换配置。生成或校验期间不可切换。",
  "invalidConfigName": "预设名须为 1–120 个字符，不能含控制符或与其他配置重名（不区分大小写）。",
  "configSwitchHelp": "切换保存成功后用于后续创建；如仍有未结委派，宿主可能拒绝切换。不会取消已有委派。",
  "configNotConfirmed": "当前更改尚未确认生效，实际委派仍以宿主已保存的有效配置为准。请核对下方保存状态。",
  "scopeSearch": "搜索模型或 Provider",
  "catalogReady": "模型已更新",
  "catalogTimeout": "读取超过 20 秒，请重试；现有配置未改变。",
  "providers": "个 Provider",
  "models": "个模型",
  "draftTitle": "生成候选草稿",
  "draftIntro": "选生成模型 → 勾选委派范围 → 填写要求。生成后确认应用，不会自动覆盖配置。",
  "draftGenerator": "1 · 生成模型",
  "draftGeneratorEffort": "思考档位",
  "draftScope": "2 · 允许的委派执行档案",
  "draftScopeHelp": "勾选允许委派的档位，可多选。支持搜索模型。",
  "draftClearScope": "清空委派范围",
  "draftRequirements": "3 · 生成要求（最多 8000 字符）",
  "draftCost": "生成可能产生费用；失败不重试、不换模型。取消会请求中止，但已发生的费用仍可能计入。",
  "draftGenerate": "生成草稿",
  "draftGenerating": "正在生成；现有配置未改变…",
  "draftValidating": "正在服务端校验草稿…",
  "draftApplying": "正在应用并核对单次保存…",
  "draftReady": "草稿未应用 · 请检查变更后确认",
  "draftIdle": "尚未生成草稿",
  "draftApplied": "草稿已应用并确认保存。",
  "draftFailed": "草稿操作失败；没有自动重试。",
  "draftUnavailable": "草稿服务不可用；仍可使用下方手动自动保存。",
  "draftInputRequired": "请选择生成模型及档位、至少一个委派档位，并填写要求。",
  "draftProtected": "可继续选择模型和填写要求。生成前请先保存或放弃手动更改，并处理下方保存异常。",
  "draftStale": "目录、输入或连接已改变。此草稿已失效，必须重新生成。",
  "draftConflict": "现有配置已编辑、保存或刷新，与生成时快照冲突。请核对后重新生成，不会覆盖手动更改。",
  "draftInvalidResult": "草稿格式、默认项或执行档案不合法，或超出所选委派范围；已拒绝。",
  "draftValidationChanged": "服务端校验改变了已确认的草稿内容；未应用，请重新生成并检查。",
  "draftApplyFailed": "未确认草稿保存。请核对下方手动配置状态；不会重复写入。",
  "draftSaveUnverified": "已提交应用 · 请核对下方保存状态",
  "draftCancelled": "请求已在本地取消；迟到结果将忽略，不自动重试。",
  "draftCancel": "取消并忽略结果",
  "draftBefore": "现有配置 →",
  "draftAfter": "草稿（未应用）",
  "draftProfile": "执行档案 · provider / model / effort",
  "draftName": "草稿候选名称",
  "draftDescription": "草稿适用说明",
  "draftDefault": "草稿默认候选",
  "draftChooseDefault": "请选择草稿默认候选",
  "draftConfirm": "我已核对现有 → 草稿变更，确认仅替换候选清单与默认项，保留启用状态、配额及审计设置。",
  "draftApply": "校验并应用",
  "draftRemove": "移除草稿候选",
  "manualTitle": "手动编辑（自动保存）",
  "draftSelected": "已选择的执行档案",
  "draftWarnings": "生成提示",
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
  "writeUncertain": "保存结果未知，可能已经写入。请刷新核对；在确认前禁止再次保存。",
  "connectionReset": "连接已重置，草稿已保留；请明确刷新或取消草稿后再编辑。",
  "conflict": "配置已被其他页面修改。草稿已保留，请取消草稿并重新读取后再编辑；不会自动重试。",
  "cancel": "取消草稿并重新读取",
  "refresh": "刷新",
  "enabled": "启用创建路由",
  "remove": "删除",
  "id": "ID",
  "catalog": "DSH 原生模型目录",
  "catalogRefresh": "刷新模型",
  "catalogLoading": "正在读取模型目录…",
  "catalogEmpty": "目录中暂无可用模型。",
  "catalogFailed": "模型读取失败，请重试。现有配置保持不变。",
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
  "title": "委派执行档案",
  "summary": "选择模型与思考档位，生成并确认配置；也可展开手动编辑。",
  "candidates": "候选清单",
  "addCandidate": "添加候选",
  "name": "候选名称",
  "description": "适用说明（一句话）",
  "effort": "思考档位",
  "defaultCandidate": "默认委派模型",
  "defaultCandidateHelp": "从已配置的模型中选择。更改会自动保存，仅用于当前预设下未指定候选的后续委派。",
  "defaultCandidateEmpty": "暂无可选模型，请先在手动编辑中添加候选。",
  "defaultCandidateNoEffort": "无档位",
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
  "invalidSource": "配置结构无效（需要 v3 单套或 v4 多套配置），已阻止此表单覆盖原文；请在原生设置核对修复。",
  "invalidSourceTitle": "无效配置",
  "originalConfiguration": "原始配置（只读）"
};
    const en = {
  "draftConfirmPreset": "I reviewed the changes and confirm updating only the current preset’s model names, roles and default. The global pool, efforts, enabled state, limits and audit settings remain unchanged.",
  "sharedPool": "Global available model pool",
  "sharedPoolHelp": "Adding, removing or changing models and efforts here affects every preset. Switching presets never changes this pool.",
  "presetRoles": "Current preset model roles",
  "draftPoolMismatch": "The draft contains a model/effort outside the global pool, or an ambiguous candidate match. Nothing was applied. Update the global pool explicitly and generate again.",
  "poolDefaultInUse": "This candidate is still a preset default. Select that preset and change its default before removing the candidate from the global pool.",
  "configSets": "Multi-model presets",
  "configSetsHelp": "Name your presets freely. Only model roles, names and the default are preset-specific. Available models, enabled state and limits are shared globally.",
  "activeConfig": "Current preset",
  "initialConfig": "Original configuration",
  "configName": "Preset name",
  "configNameHint": "Enter a name to create, copy or rename the current configuration",
  "newConfig": "New preset",
  "copyConfig": "Copy current preset",
  "renameConfig": "Rename current preset",
  "manageConfigs": "Manage saved presets",
  "deleteConfig": "Delete preset",
  "confirmDeleteConfig": "Confirm deletion",
  "cancelDeleteConfig": "Cancel deletion",
  "deleteConfigWarning": "Deletion cannot be undone. Confirm the configuration to delete:",
  "configActiveBadge": "Current · cannot delete",
  "configSetLimit": "Save up to 32 presets. New presets clear role descriptions and retain the current default; copies retain roles. Neither changes the global model pool, enabled state or limits.",
  "configSetProtected": "Save or discard pending edits and resolve save issues before managing or switching configurations. Switching is unavailable during generation or validation.",
  "invalidConfigName": "Use 1–120 characters without control characters or duplicate names (case-insensitive).",
  "configSwitchHelp": "After a confirmed save, the selection applies to future starts. Outstanding delegations may prevent switching; existing work is never cancelled.",
  "configNotConfirmed": "These changes are not confirmed effective. Delegation still follows the host’s saved effective configuration. Check the save status below.",
  "scopeSearch": "Search models or providers",
  "catalogReady": "Models updated",
  "catalogTimeout": "Loading exceeded 20 seconds. Retry; existing settings are unchanged.",
  "providers": "providers",
  "models": "models",
  "draftTitle": "Generate candidate draft",
  "draftIntro": "Choose a generator, select allowed profiles, then enter requirements. Review and confirm before applying.",
  "draftGenerator": "1 · Generator model",
  "draftGeneratorEffort": "Reasoning effort",
  "draftScope": "2 · Allowed delegation profiles",
  "draftScopeHelp": "Select allowed efforts for delegation. Search to narrow the list.",
  "draftClearScope": "Clear delegation scope",
  "draftRequirements": "3 · Requirements (maximum 8000 characters)",
  "draftCost": "Generation may incur charges. No automatic retries or model substitution. Cancellation requests abort but may not prevent charges already incurred.",
  "draftGenerate": "Generate draft",
  "draftGenerating": "Generating; existing configuration is unchanged…",
  "draftValidating": "Validating the draft on the server…",
  "draftApplying": "Applying and verifying one save…",
  "draftReady": "Draft not applied · Review changes and confirm",
  "draftIdle": "No draft generated yet",
  "draftApplied": "Draft applied and save verified.",
  "draftFailed": "Draft operation failed; no automatic retry occurred.",
  "draftUnavailable": "Draft service is unavailable; manual autosave below remains available.",
  "draftInputRequired": "Choose a generator and effort, select at least one delegation effort, and enter requirements.",
  "draftProtected": "You can prepare inputs. Before generating, save or discard manual edits and resolve save, conflict or read-only state below.",
  "draftStale": "The catalog, inputs or connection changed. This draft is stale and must be regenerated.",
  "draftConflict": "Existing configuration was edited, saved or refreshed after generation started. Review it and generate again; manual changes will not be overwritten.",
  "draftInvalidResult": "Rejected: draft format, default or execution profiles are invalid or outside the selected delegation scope.",
  "draftValidationChanged": "Server validation changed the confirmed draft; nothing was applied. Generate again and review.",
  "draftApplyFailed": "Draft save was not verified. Check the manual configuration status below; no duplicate write will occur.",
  "draftSaveUnverified": "Application submitted · Check save status below",
  "draftCancelled": "Request cancelled locally; late results will be ignored without automatic retry.",
  "draftCancel": "Cancel and ignore result",
  "draftBefore": "Existing configuration →",
  "draftAfter": "Draft (not applied)",
  "draftProfile": "Execution profile · provider / model / effort",
  "draftName": "Draft candidate name",
  "draftDescription": "Draft usage description",
  "draftDefault": "Draft default candidate",
  "draftChooseDefault": "Choose a draft default",
  "draftConfirm": "I reviewed the existing → draft changes and confirm replacing only candidates and the default, preserving enabled state, quotas and audit settings.",
  "draftApply": "Validate and apply",
  "draftRemove": "Remove draft candidate",
  "manualTitle": "Manual editing (autosave)",
  "draftSelected": "Selected execution profiles",
  "draftWarnings": "Generation warnings",
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
  "writeUncertain": "The save outcome is unknown and may already be committed. Refresh to verify; saving again is blocked until verified.",
  "connectionReset": "The connection was reset. Your draft was retained. Explicitly refresh or discard the draft before editing.",
  "conflict": "Another page changed this configuration. Your draft was retained. Discard and reload before editing; no automatic retry will occur.",
  "cancel": "Discard draft and reload",
  "refresh": "Refresh",
  "enabled": "Enable creation routing",
  "remove": "Delete",
  "id": "ID",
  "catalog": "Native DSH model catalog",
  "catalogRefresh": "Refresh models",
  "catalogLoading": "Reading model catalog…",
  "catalogEmpty": "No models are available in the catalog.",
  "catalogFailed": "Model loading failed. Retry; existing settings are unchanged.",
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
  "title": "Delegation execution profiles",
  "summary": "Choose models and reasoning efforts, generate a draft and confirm. Manual editing is also available.",
  "candidates": "Candidate list",
  "addCandidate": "Add candidate",
  "name": "Candidate name",
  "description": "Usage description (one sentence)",
  "effort": "Reasoning effort",
  "defaultCandidate": "Default delegation model",
  "defaultCandidateHelp": "Choose from configured models. Changes are saved automatically and apply only to future delegations that do not specify a candidate under this preset.",
  "defaultCandidateEmpty": "No models to choose from. Add a candidate in the manual editor first.",
  "defaultCandidateNoEffort": "No effort",
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
  "invalidSource": "Invalid configuration structure (v3 single or v4 named configurations required). This form cannot overwrite the original; review and repair it in native settings.",
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
      if (source.schemaVersion === 4) return !validConfigSets(source);
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
      const source = value?.ui;
      return source?.schemaVersion === 4 ? projectConfigSet(source) : withDefaults(source);
    }
    // Equality normalization fills documented defaults only for legitimate v3
    // sources; a bad source (for example an explicit empty {}) is preserved as-is
    // so comparisons stay unequal instead of fabricating a valid acknowledgement.
    function normalizeAckUi(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      if (invalidSource({ ui: value })) return value;
      if (value.schemaVersion === 4) {
        const pool = normalizeAckUi({ schemaVersion: 3, enabled: false, candidates: value.candidates, limits: value.limits });
        return { ...clone(value), enabled: value.enabled ?? false, candidates: pool.candidates, limits: pool.limits, configs: value.configs.map(row => ({ ...row, overrides: clone(row.overrides ?? []) })) };
      }
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
    // One global candidate pool; presets contain text/default overrides only.
    const CONFIG_SET_KEYS = ['schemaVersion', 'enabled', 'candidates', 'limits', 'activeConfigId', 'configs'];
    const CONFIG_ROW_KEYS = ['id', 'name', 'defaultCandidateId', 'overrides'];
    const OVERRIDE_KEYS = ['id', 'name', 'description'];
    const configName = value => typeof value === 'string' ? value.trim() : '';
    const validConfigName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120 && !/[\x00-\x1f\x7f]/.test(value);
    function projectConfigSet(value, configId = value.activeConfigId) {
      const preset = value.configs.find(row => row.id === configId);
      const overrides = new Map((preset.overrides ?? []).map(row => [row.id, row]));
      const result = withDefaults({ schemaVersion: 3, enabled: value.enabled ?? false, candidates: value.candidates ?? [], limits: value.limits });
      result.candidates = result.candidates.map(row => ({ ...row, ...overrides.get(row.id) }));
      if (preset.defaultCandidateId !== undefined) result.defaultCandidateId = preset.defaultCandidateId;
      return result;
    }
    function validConfigSets(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 4 ||
          Object.keys(value).some(key => !CONFIG_SET_KEYS.includes(key)) || !Array.isArray(value.configs) || value.configs.length < 1 || value.configs.length > 32 ||
          invalidSource({ ui: { schemaVersion: 3, enabled: false, candidates: value.candidates, limits: value.limits } }) ||
          !validDraft(withDefaults({ schemaVersion: 3, enabled: false, candidates: value.candidates, limits: value.limits }))) return false;
      const ids = new Set(), names = new Set(), poolIds = new Set((value.candidates ?? []).map(row => row.id));
      for (const row of value.configs) {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !CONFIG_ROW_KEYS.includes(key)) ||
            typeof row.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(row.id) || ids.has(row.id) || !validConfigName(row.name) ||
            row.overrides !== undefined && !Array.isArray(row.overrides)) return false;
        const name = configName(row.name).toLowerCase(), refs = new Set();
        for (const item of row.overrides ?? []) {
          if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !OVERRIDE_KEYS.includes(key)) ||
              !poolIds.has(item.id) || refs.has(item.id) || typeof item.name !== 'string') return false;
          refs.add(item.id);
        }
        if (names.has(name) || !validDraft(projectConfigSet(value, row.id))) return false;
        ids.add(row.id); names.add(name);
      }
      return ids.has(value.activeConfigId);
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
      constructor(ctx, timers = globalThis, timeoutMs = 20000) {
        this.timers = timers; this.timeoutMs = timeoutMs;
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
          const remote = routerRemote(this.ctx);
          const isolated = typeof remote?.modelCatalog === 'function';
          if (!isolated && typeof this.ctx.remote?.session?.modelCatalog !== 'function') throw Error('Native model catalog is unavailable');
          flight.controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : undefined;
          const request = isolated ? remote.modelCatalog(flight.controller?.signal) : this.ctx.remote.session.modelCatalog();
          if (typeof this.timers.setTimeout !== 'function') return request;
          return Promise.race([request, new Promise((_resolve, reject) => {
            flight.timer = this.timers.setTimeout(() => {
              const error = Error('Model catalog request timed out. Refresh to try again.');
              error.code = 'catalog/timeout'; reject(error); flight.controller?.abort();
            }, this.timeoutMs);
          })]);
        }).then(response => {
          if (this.disposed || generation !== this.generation || this.refreshPending) return false;
          if (!response?.ok) { const error = Error(response?.error?.message ?? 'Native model catalog request failed'); error.code = response?.error?.code; throw error; }
          const catalog = normalizeCatalog(response.value);
          this.publish({ status: 'ready', ...catalog, error: '', loadedAt: Date.now() }); return true;
        }).catch(error => {
          if (!this.disposed && generation === this.generation && !this.refreshPending) this.publish({ ...emptyCatalog, status: 'error', error: error?.message ?? String(error), errorCode: error?.code });
          return false;
        }).finally(() => {
          if (flight.timer !== undefined) this.timers.clearTimeout(flight.timer);
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
        this.inFlight?.controller?.abort();
        if (this.inFlight?.timer !== undefined) this.timers.clearTimeout(this.inFlight.timer);
        this.generation++; this.inFlight = undefined; this.refreshPending = false;
        this.publish({ ...emptyCatalog }); void this.load();
      }
      find(provider, model) {
        if (this.snapshot.status !== 'ready' || this.snapshot.failures.some(failure => failure.id === provider)) return;
        return this.snapshot.groups.find(group => group.id === provider)?.models.find(item => item.id === model);
      }
      select(editor, index, key, expected, viewToken) {
        if (viewToken !== undefined && !editor.matchesView(viewToken)) return false;
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
      setEffort(editor, index, value, expected, viewToken) {
        if (viewToken !== undefined && !editor.matchesView(viewToken)) return false;
        const candidate = editor.getSnapshot().draft.candidates[index];
        if (this.disposed || !candidate || expected && (candidate.id !== expected.id || modelKey(candidate) !== modelKey(expected))) return false;
        const option = catalogEfforts(this.find(candidate.provider, candidate.model), editor.t).find(option => effortKey(option.id) === value);
        if (!option) return false;
        return editor.edit(next => { next.candidates[index].effort = option.id; });
      }
      dispose() {
        if (this.disposed) return;
        this.inFlight?.controller?.abort();
        if (this.inFlight?.timer !== undefined) this.timers.clearTimeout(this.inFlight.timer);
        this.disposed = true; this.generation++; this.inFlight = undefined; this.refreshPending = false;
        for (const off of this.offs) off(); this.offs = []; this.listeners.clear(); this.snapshot = emptyCatalog;
      }
    }

    class RouterEditor {
      constructor(ctx, t, timers = globalThis) {
        this.timers = timers; this.autosaveTimer = undefined; this.autosaveEpoch = 0; this.autosavePaused = false; this.composing = false;
        this.ctx = ctx; this.t = t; this.form = ctx.configForms.get(ENTRY); this.mirror = ctx.configForms.describe();
        this.listeners = new Set(); this.disposed = false; this.generation = 0; this.editRevision = 0; this.generatedLock = undefined; this.connectionReset = false;
        this.saving = false; this.reloading = false; this.dirty = false; this.conflicted = false;
        this.error = ''; this.saved = false; this.savedButNotLive = false; this.receiptUnverified = false;
        this.read(); this.off = this.form.subscribe(() => this.read());
      }
      read() {
        this.host = this.form.getSnapshot();
        if (!this.dirty && !this.saving && !this.reloading && !this.savedButNotLive && !this.connectionReset) {
          this.draft = draftFrom(this.host.value);
          this.configSet = !invalidSource(this.host.value) && this.host.value?.ui?.schemaVersion === 4 ? clone(this.host.value.ui) : undefined;
          this.baseRevision = this.host.revision;
        }
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
        if (this.generatedLock) return;
        this.composing = value;
        if (value) this.cancelAutosave(); else this.scheduleAutosave();
      }
      publish() {
        const badDoc = invalidSource(this.host?.user) ? this.host.user : invalidSource(this.host?.value) ? this.host.value : undefined;
        const invalidOriginal = badDoc ? clone(Object.keys(badDoc).some(key => key !== 'policy' && !PLUGIN_KEYS.includes(key)) ||
          badDoc.auditFile !== undefined && typeof badDoc.auditFile !== 'string' ? badDoc : badDoc.policy !== undefined ? badDoc.policy : badDoc.ui) : undefined;
        this.snapshot = { generatedBusy: !!this.generatedLock, revision: this.baseRevision, editRevision: this.editRevision, status: this.host?.status, writable: this.host?.writable, draft: this.draft, configSet: this.configurationSet(), canManageConfigs: this.canManageConfigs(), dirty: this.dirty, saving: this.saving, reloading: this.reloading, saved: this.saved, savedButNotLive: this.savedButNotLive, autosavePaused: this.autosavePaused, error: this.error, conflicted: this.conflicted, invalidSource: !!badDoc, invalidOriginal, auditFile: this.host?.value?.auditFile, receiptUnverified: this.receiptUnverified, connectionReset: this.connectionReset };
        for (const listener of this.listeners) listener();
      }
      subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
      getSnapshot = () => this.snapshot;
      editable(owner) {
        return (!this.generatedLock || this.generatedLock === owner) && !this.disposed && !this.conflicted && !this.saving && !this.reloading && !this.connectionReset && this.host.writable && this.host.status === 'ready' && !this.receiptUnverified && !invalidSource(this.host.value) && !invalidSource(this.host.user);
      }
      edit(update) {
        if (!this.editable()) return false;
        const next = clone(this.draft); update(next);
        this.editRevision++; this.draft = next; this.dirty = true; this.saved = false;
        if (!this.autosavePaused) { this.savedButNotLive = false; this.error = ''; }
        this.scheduleAutosave(); this.publish(); return true;
      }
      viewToken() { return stable([this.generation, this.baseRevision, this.configSet?.activeConfigId ?? 'config-1']); }
      matchesView(token, requireWritable = true) {
        const current = this.form.getSnapshot();
        const activeId = current.value?.ui?.schemaVersion === 4 ? current.value.ui.activeConfigId : 'config-1';
        if (this.disposed || token !== this.viewToken()) return false;
        // Recovery must work when desired and persisted selections/revisions differ.
        if (!requireWritable) return true;
        const knownActiveId = this.host.value?.ui?.schemaVersion === 4 ? this.host.value.ui.activeConfigId : 'config-1';
        return current.revision === this.baseRevision && activeId === knownActiveId &&
          current.status === 'ready' && current.writable && !invalidSource(current.value) && !invalidSource(current.user);
      }
      configurationSet() {
        if (this.configSet) return this.storedDraft();
        const { enabled, candidates, limits, defaultCandidateId } = clone(this.draft);
        return { schemaVersion: 4, enabled, candidates, limits, activeConfigId: 'config-1', configs: [{ id: 'config-1', name: this.t('initialConfig'), ...(defaultCandidateId === undefined ? {} : { defaultCandidateId }), overrides: [] }] };
      }
      storedDraft() {
        if (!this.configSet) return clone(this.draft);
        const next = clone(this.configSet);
        next.enabled = this.draft.enabled; next.limits = clone(this.draft.limits);
        const base = new Map((this.configSet.candidates ?? []).map(row => [row.id, row]));
        next.candidates = this.draft.candidates.map(row => base.has(row.id) ? { ...clone(base.get(row.id)), provider: row.provider, model: row.model, effort: row.effort } : clone(row));
        const ids = new Set(next.candidates.map(row => row.id));
        for (const preset of next.configs) if (preset.overrides) preset.overrides = preset.overrides.filter(row => ids.has(row.id));
        const current = next.configs.find(item => item.id === next.activeConfigId);
        if (current) {
          if (this.draft.defaultCandidateId === undefined) delete current.defaultCandidateId; else current.defaultCandidateId = this.draft.defaultCandidateId;
          // A model/default-only edit must not rewrite unchanged roles (in
          // particular, an omitted description means inherit, not clear).
          const overrides = new Map((current.overrides ?? []).map(row => [row.id, row]));
          let rolesChanged = false;
          for (const { id, name, description } of this.draft.candidates) {
            const original = base.get(id), override = overrides.get(id);
            if (!original || name === (override?.name ?? original.name) && (description ?? '') === (override?.description ?? original.description ?? '')) continue;
            rolesChanged = true;
            if (name === original.name && (description ?? '') === (original.description ?? '')) overrides.delete(id);
            else overrides.set(id, { id, name, description: description ?? '' });
          }
          if (rolesChanged) current.overrides = [...overrides.values()];
        }
        return next;
      }
      canManageConfigs() {
        return this.editable() && !this.dirty && !this.composing && !this.autosavePaused && !this.savedButNotLive && validDraft(this.draft);
      }
      availableConfigName(name, exceptId) {
        return validConfigName(name) && !this.configurationSet().configs.some(row => row.id !== exceptId && configName(row.name).toLowerCase() === configName(name).toLowerCase());
      }
      async changeConfigSet(update) {
        // Read current host state before capturing the collection. No pending manual
        // edits, writes, generation or connection uncertainty may be discarded.
        const before = stable([this.host.value, this.host.user]), revision = this.baseRevision;
        this.read();
        if (!this.canManageConfigs() || revision !== this.baseRevision || before !== stable([this.host.value, this.host.user])) return false;
        const next = this.configurationSet();
        if (update(next) === false || !validConfigSets(next)) return false;
        this.cancelAutosave(); this.editRevision++;
        this.configSet = next; this.draft = projectConfigSet(next);
        this.dirty = true; this.saved = false; this.error = '';
        this.publish();
        return await this.save();
      }
      createConfig(name, copyCurrent = false) {
        if (typeof copyCurrent !== 'boolean' || !this.availableConfigName(name) || this.configurationSet().configs.length >= 32) return Promise.resolve(false);
        return this.changeConfigSet(next => {
          let index = 1; while (next.configs.some(row => row.id === 'config-' + index)) index++;
          const id = 'config-' + index;
          const source = next.configs.find(row => row.id === next.activeConfigId);
          const overrides = copyCurrent ? clone(source.overrides ?? []) : next.candidates.map(({ id, name }) => ({ id, name, description: '' }));
          next.configs.push({ id, name: configName(name), ...(source.defaultCandidateId === undefined ? {} : { defaultCandidateId: source.defaultCandidateId }), overrides });
          next.activeConfigId = id;
        });
      }
      renameConfig(name) {
        const activeId = this.configurationSet().activeConfigId;
        if (!this.availableConfigName(name, activeId)) return Promise.resolve(false);
        return this.changeConfigSet(next => { next.configs.find(row => row.id === next.activeConfigId).name = configName(name); });
      }
      switchConfig(id) {
        return this.changeConfigSet(next => {
          if (id === next.activeConfigId || !next.configs.some(row => row.id === id)) return false;
          next.activeConfigId = id;
        });
      }
      deleteConfig(id, confirmed = false) {
        if (confirmed !== true) return Promise.resolve(false);
        return this.changeConfigSet(next => {
          if (id === next.activeConfigId || next.configs.length <= 1 || !next.configs.some(row => row.id === id)) return false;
          next.configs = next.configs.filter(row => row.id !== id);
        });
      }
      // A generation baseline includes local edits (even edit-and-revert), saves,
      // connection generation and both host documents, not just the host revision.
      captureGenerated() {
        this.read();
        if (!this.editable() || this.dirty || this.composing || this.autosavePaused || this.savedButNotLive) return;
        return { revision: this.baseRevision, generation: this.generation, editRevision: this.editRevision,
          draft: stable(this.storedDraft()), source: stable([this.host.value, this.host.user]) };
      }
      matchesGenerated(expected, owner) {
        const current = this.form.getSnapshot();
        return !!expected && this.editable(owner) && !this.dirty && !this.composing && !this.autosavePaused && !this.savedButNotLive &&
          current.status === 'ready' && current.writable && !invalidSource(current.value) && !invalidSource(current.user) &&
          expected.generation === this.generation && expected.editRevision === this.editRevision &&
          expected.revision === this.baseRevision && expected.revision === current.revision &&
          expected.draft === stable(this.storedDraft()) && expected.source === stable([current.value, current.user]);
      }
      lockGenerated(owner, expected) {
        if (!this.matchesGenerated(expected, owner)) return false;
        this.generatedLock = owner; this.cancelAutosave(); this.publish(); return true;
      }
      unlockGenerated(owner) {
        if (this.generatedLock !== owner) return;
        this.generatedLock = undefined; if (!this.disposed) this.publish();
      }
      async applyGenerated(result, expected, owner) {
        // No editor.edit(), debounce or merge of service-controlled configuration.
        // The final synchronous fence and one explicit save are inseparable.
        if (!this.matchesGenerated(expected, owner)) return false;
        let next;
        if (this.configSet) {
          const pool = this.draft.candidates;
          const mapped = new Map();
          for (const generated of result.candidates) {
            const matches = pool.filter(row => routeKey(row) === routeKey(generated));
            const target = matches.length === 1 ? matches[0] : undefined;
            if (!target || mapped.has(target.id)) { this.error = this.t('draftPoolMismatch'); this.publish(); return false; }
            mapped.set(target.id, generated);
          }
          const defaultEntry = [...mapped].find(([, row]) => row.id === result.defaultCandidateId);
          if (!defaultEntry) return false;
          next = { ...clone(this.draft), candidates: pool.map(row => mapped.has(row.id) ? { ...row, name: mapped.get(row.id).name, description: mapped.get(row.id).description ?? '' } : clone(row)), defaultCandidateId: defaultEntry[0] };
        } else next = { ...clone(this.draft), candidates: clone(result.candidates), defaultCandidateId: result.defaultCandidateId };
        if (!validDraft(next) || !next.candidates.length || !next.candidates.some(row => row.id === next.defaultCandidateId)) return false;
        this.cancelAutosave(); this.generatedLock = undefined;
        this.editRevision++; this.draft = next; this.dirty = true; this.saved = false;
        return await this.save();
      }
      addCandidate() {
        if (this.draft.candidates.length >= 128) return false;
        // Do not resurrect an unsaved deletion with its old role overrides.
        const reserved = new Set([...this.draft.candidates, ...(this.configSet?.candidates ?? [])].map(candidate => candidate.id));
        let index = 1; while (reserved.has('candidate-' + index)) index++;
        // A fresh candidate is deliberately unfinished: empty strings block autosave
        // until the user picks an exact model and effort; never null, never a tier.
        return this.edit(next => next.candidates.push({ id: 'candidate-' + index, name: '', provider: '', model: '', effort: '', description: '' }));
      }
      removeCandidate(id) {
        if (this.configSet && this.configurationSet().configs.some(row => row.defaultCandidateId === id)) {
          this.error = this.t('poolDefaultInUse'); this.publish(); return false;
        }
        return this.edit(next => { next.candidates = next.candidates.filter(row => row.id !== id); });
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
        if (this.saving || this.reloading || this.disposed || this.generatedLock) return;
        this.editRevision++; this.cancelAutosave(); this.composing = false;
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
        if (this.disposed || this.composing || this.generatedLock) return false;
        this.read();
        if (this.disposed || this.saving || this.reloading || this.connectionReset || !this.dirty || !this.host.writable || this.host.status !== 'ready' || this.receiptUnverified) return false;
        if (this.conflicted || this.form.getSnapshot().revision !== this.baseRevision) { this.conflicted = true; this.publish(); return false; }
        if (!this.editable() || !validDraft(this.draft) || this.configSet && !validConfigSets(this.storedDraft())) { this.error = this.t('invalidDraft'); this.publish(); return false; }
        this.editRevision++;
        const desired = this.storedDraft(), revision = this.baseRevision, generation = this.generation;
        // Only a verified receipt (or explicit reload) releases automatic saving.
        this.autosavePaused = true;
        this.saving = true; this.error = ''; this.saved = false; this.pendingDesired = desired; this.receiptUnverified = true; this.publish();
        let accepted = false;
        try {
          const response = await this.ctx.remote.settings.mutate(ENTRY, [ { op: 'set', path: ['ui'], value: desired } ], revision);
          if (this.disposed || generation !== this.generation) return false;
          if (response?.ok === true) accepted = true;
          else {
            const code = response?.error?.code;
            // SettingsController classifies pre-write refusal as settings/rejected
            // or settings/conflict (and invalid payload as gateway/bad-request).
            // ClientRemote also returns ok:false for transport failures; in
            // particular gateway/internal can mean a timeout OR a committed write
            // whose namespace vanished. Never interpret these as a no-write receipt.
            const rejected = response?.ok === false && ['settings/rejected', 'settings/conflict', 'gateway/bad-request'].includes(code);
            this.error = typeof response?.error?.message === 'string' ? response.error.message : this.t(rejected ? 'saveFailed' : 'writeUncertain');
            if (rejected) { this.conflicted = code === 'settings/conflict'; this.receiptUnverified = false; this.pendingDesired = undefined; }
          }
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

    const routeKey = route => JSON.stringify([route.provider, route.model, route.effort]);
    const routeOnly = route => ({ provider: route.provider, model: route.model, effort: route.effort });
    class DraftGenerator {
      constructor(ctx, editor, catalog, t = editor.t) {
        this.ctx = ctx; this.editor = editor; this.catalog = catalog; this.t = t;
        this.listeners = new Set(); this.disposed = false; this.epoch = 0; this.catalogRevision = 0;
        this.input = { generator: undefined, scope: [], requirements: '' };
        this.status = 'idle'; this.error = ''; this.draft = undefined; this.confirmed = false; this.warnings = [];
        this.offEditor = editor.subscribe(() => {
          if (this.status === 'applying' && editor.getSnapshot().saving) this.writeSubmitted = true;
          if (this.baseline && this.status !== 'applying' && !editor.matchesGenerated(this.baseline, this)) this.invalidate('draftConflict', 'conflict');
        });
        this.offCatalog = catalog.subscribe(() => {
          this.catalogRevision++;
          // Our own settings write emits settings/document-updated. Once that
          // write is submitted, catalog changes must not discard its receipt or
          // turn a confirmed save into a stale-draft error. The baseline is retired
          // after every apply attempt, so this draft cannot be submitted again.
          if (this.status === 'applying' && this.writeSubmitted || this.applyAttempted && !this.baseline) { this.publish(); return; }
          if (this.baseline || this.draft || this.busy()) this.invalidate('draftStale'); else this.publish();
        });
        this.publish();
      }
      subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
      getSnapshot = () => this.snapshot;
      publish() {
        if (this.disposed) return;
        this.snapshot = { input: clone(this.input), draft: clone(this.draft), before: clone(this.before), warnings: [...this.warnings],
          status: this.status, applyAttempted: !!this.applyAttempted, error: this.error, errorCode: this.errorCode, confirmed: this.confirmed, busy: this.busy(), available: this.available() };
        for (const listener of this.listeners) listener();
      }
      available() { const remote = routerRemote(this.ctx); return typeof remote?.generateDraft === 'function' && typeof remote?.validateDraft === 'function'; }
      busy() { return ['generating', 'validating', 'applying'].includes(this.status); }
      routeAllowed(route) {
        if (!route || Object.keys(route).some(key => !['provider', 'model', 'effort'].includes(key))) return false;
        const model = this.catalog.find(route.provider, route.model);
        return !!model && catalogEfforts(model, this.t).some(option => option.id === route.effort);
      }
      inputsValid() {
        const { generator, scope, requirements } = this.input;
        return this.routeAllowed(generator) && Array.isArray(scope) && scope.length > 0 && scope.length <= 128 &&
          scope.every(route => this.routeAllowed(route)) && new Set(scope.map(routeKey)).size === scope.length &&
          typeof requirements === 'string' && requirements.trim().length > 0 && requirements.length <= 8000;
      }
      startRequest(epoch) {
        const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : undefined;
        this.requestAbort = { epoch, controller }; return controller?.signal;
      }
      abortRequest() {
        const request = this.requestAbort; this.requestAbort = undefined; request?.controller?.abort();
      }
      finishRequest(epoch) { if (this.requestAbort?.epoch === epoch) this.requestAbort = undefined; }
      invalidate(key = 'draftStale', status = 'stale') {
        if (this.disposed) return;
        this.epoch++; this.baseline = undefined; this.confirmed = false; this.status = status; this.error = this.t(key);
        this.abortRequest();
        this.editor.unlockGenerated(this); this.publish();
      }
      changeInput(update) {
        if (this.disposed || this.busy()) return false;
        const next = clone(this.input); update(next);
        if (stable(next) === stable(this.input)) return true;
        this.input = next;
        if (this.draft || this.baseline) this.invalidate();
        else { this.status = 'idle'; this.error = ''; this.publish(); }
        return true;
      }
      selectGenerator(key) {
        if (this.disposed || this.busy()) return false;
        for (const group of this.catalog.getSnapshot().groups) for (const model of group.models) {
          const pair = { provider: group.id, model: model.id };
          if (modelKey(pair) !== key || !this.catalog.find(pair.provider, pair.model)) continue;
          const efforts = catalogEfforts(model, this.t);
          const effort = efforts.some(row => row.id === null) ? null : efforts.some(row => row.id === model.reasoning?.defaultEffort) ? model.reasoning.defaultEffort : '';
          return this.changeInput(next => { next.generator = { ...pair, effort }; });
        }
        return false;
      }
      setGeneratorEffort(value) {
        if (!this.input.generator) return false;
        const route = { ...this.input.generator, effort: value };
        return this.routeAllowed(route) && this.changeInput(next => { next.generator = route; });
      }
      setScope(routes) {
        if (!Array.isArray(routes) || routes.length > 128 || !routes.every(route => this.routeAllowed(route)) || new Set(routes.map(routeKey)).size !== routes.length) return false;
        return this.changeInput(next => { next.scope = clone(routes); });
      }
      toggleScope(route, selected) {
        if (!this.routeAllowed(route)) return false;
        const remaining = this.input.scope.filter(item => routeKey(item) !== routeKey(route));
        return this.setScope(selected ? [...remaining, routeOnly(route)] : remaining);
      }
      setRequirements(value) {
        if (typeof value !== 'string' || value.length > 8000) return false;
        return this.changeInput(next => { next.requirements = value; });
      }
      normalizeResult(value, scope) {
        // Only these two fields may cross into the editor. Top-level diagnostics
        // from validateDraft are allowed, but unknown persistent candidate keys are not.
        const result = { candidates: value?.candidates, defaultCandidateId: value?.defaultCandidateId };
        if (!Array.isArray(result.candidates) || !result.candidates.length || !validDraft({ ...emptyDraft(), ...result, enabled: true }) ||
            result.candidates.some(row => {
              const target = /^scope-[1-9][0-9]*$/.test(row.id) && scope[Number(row.id.slice(6)) - 1];
              return !target || routeKey(target) !== routeKey(row);
            })) throw Error(this.t('draftInvalidResult'));
        result.candidates = result.candidates.map(row => ({ ...clone(row), description: row.description ?? '' }));
        return result;
      }
      unwrap(response) {
        if (response && Object.hasOwn(response, 'ok')) {
          if (typeof response.ok !== 'boolean') throw Error(this.t('draftInvalidResult'));
          if (!response.ok) { const error = Error(response.error?.message ?? this.t('draftFailed')); error.code = response.error?.code; throw error; }
          return response.value;
        }
        return response;
      }
      current(epoch, inputKey, catalogRevision, draftKey) {
        return !this.disposed && epoch === this.epoch && inputKey === stable(this.input) && catalogRevision === this.catalogRevision &&
          this.editor.matchesGenerated(this.baseline, this) && (draftKey === undefined || draftKey === stable(this.draft));
      }
      async generate() {
        if (this.disposed || this.busy()) return false;
        if (!this.available() || !this.inputsValid()) { this.error = this.t(this.available() ? 'draftInputRequired' : 'draftUnavailable'); this.publish(); return false; }
        const baseline = this.editor.captureGenerated();
        if (!baseline) { this.error = this.t('draftProtected'); this.publish(); return false; }
        this.baseline = baseline; this.before = clone(this.editor.getSnapshot().draft);
        this.draft = undefined; this.warnings = []; this.confirmed = false; this.applyAttempted = false; this.writeSubmitted = false; this.error = ''; this.errorCode = undefined; this.status = 'generating';
        const epoch = ++this.epoch, input = clone(this.input), inputKey = stable(input), catalogRevision = this.catalogRevision;
        if (!this.editor.lockGenerated(this, baseline)) { this.invalidate('draftConflict', 'conflict'); return false; }
        this.publish();
        try {
          if (!this.current(epoch, inputKey, catalogRevision)) return false;
          const response = this.unwrap(await routerRemote(this.ctx).generateDraft(input, this.startRequest(epoch)));
          if (!this.current(epoch, inputKey, catalogRevision)) { if (epoch === this.epoch) this.invalidate('draftConflict', 'conflict'); return false; }
          const draft = this.normalizeResult(response, input.scope);
          if (!Array.isArray(response.warnings) || response.warnings.some(warning => typeof warning !== 'string')) throw Error(this.t('draftInvalidResult'));
          this.draft = draft; this.warnings = [...response.warnings]; this.status = 'ready'; this.publish(); return true;
        } catch (error) {
          if (!this.disposed && epoch === this.epoch) { this.status = 'error'; this.error = error?.message ?? String(error); this.errorCode = error?.code; this.publish(); }
          return false;
        } finally { this.finishRequest(epoch); if (epoch === this.epoch) this.editor.unlockGenerated(this); }
      }
      editableDraft() { return !this.disposed && !this.busy() && !!this.draft && !!this.baseline && this.editor.matchesGenerated(this.baseline, this); }
      editCandidate(id, patch) {
        if (!this.editableDraft() || !patch || Object.keys(patch).some(key => !['name', 'description'].includes(key)) ||
            Object.entries(patch).some(([key, value]) => typeof value !== 'string' || value.length > (key === 'name' ? 120 : 1000))) return false;
        const row = this.draft.candidates.find(candidate => candidate.id === id); if (!row) return false;
        Object.assign(row, patch); this.confirmed = false; this.status = 'ready'; this.error = ''; this.publish(); return true;
      }
      removeCandidate(id) {
        if (!this.editableDraft() || !this.draft.candidates.some(row => row.id === id)) return false;
        this.draft.candidates = this.draft.candidates.filter(row => row.id !== id);
        if (this.draft.defaultCandidateId === id) this.draft.defaultCandidateId = undefined;
        this.confirmed = false; this.status = 'ready'; this.error = ''; this.publish(); return true;
      }
      setDefault(id) {
        if (!this.editableDraft() || !this.draft.candidates.some(row => row.id === id)) return false;
        this.draft.defaultCandidateId = id; this.confirmed = false; this.status = 'ready'; this.error = ''; this.publish(); return true;
      }
      confirm(value) { if (!this.editableDraft()) return false; this.confirmed = value === true; this.publish(); return true; }
      canApply() {
        if (!this.confirmed || !this.editableDraft() || !this.inputsValid()) return false;
        try { this.normalizeResult(this.draft, this.input.scope); return true; } catch { return false; }
      }
      async validateAndApply() {
        if (!this.canApply() || !this.available()) return false;
        const epoch = ++this.epoch, inputKey = stable(this.input), catalogRevision = this.catalogRevision, draftKey = stable(this.draft);
        const request = { scope: clone(this.input.scope), ...clone(this.draft) };
        this.status = 'validating'; this.error = '';
        if (!this.editor.lockGenerated(this, this.baseline)) { this.invalidate('draftConflict', 'conflict'); return false; }
        this.publish();
        try {
          if (!this.current(epoch, inputKey, catalogRevision, draftKey)) return false;
          const response = this.unwrap(await routerRemote(this.ctx).validateDraft(request, this.startRequest(epoch)));
          this.finishRequest(epoch);
          if (!this.current(epoch, inputKey, catalogRevision, draftKey)) { if (epoch === this.epoch) this.invalidate('draftConflict', 'conflict'); return false; }
          const validated = this.normalizeResult(response, request.scope);
          if (stable(validated) !== stable(this.normalizeResult(request, request.scope))) throw Error(this.t('draftValidationChanged'));
          this.status = 'applying'; this.applyAttempted = true; this.publish();
          if (!this.current(epoch, inputKey, catalogRevision, draftKey)) { if (epoch === this.epoch) this.invalidate('draftConflict', 'conflict'); return false; }
          const applied = await this.editor.applyGenerated(validated, this.baseline, this);
          if (this.disposed || epoch !== this.epoch) return false;
          this.baseline = undefined; this.confirmed = false;
          this.status = applied ? 'applied' : 'error';
          this.error = applied ? '' : this.editor.getSnapshot().error || this.t('draftApplyFailed');
          this.publish(); return applied;
        } catch (error) {
          if (!this.disposed && epoch === this.epoch) { this.status = 'error'; this.confirmed = false; this.error = error?.message ?? String(error); this.errorCode = error?.code; this.publish(); }
          return false;
        } finally { this.finishRequest(epoch); if (epoch === this.epoch) this.editor.unlockGenerated(this); }
      }
      cancel() {
        if (this.disposed || this.status === 'applying') return false;
        this.invalidate('draftCancelled', 'cancelled'); return true;
      }
      resetConnection() { this.invalidate('draftStale'); }
      dispose() {
        if (this.disposed) return;
        this.disposed = true; this.epoch++; this.baseline = undefined; this.abortRequest();
        this.offEditor(); this.offCatalog(); this.editor.unlockGenerated(this); this.listeners.clear();
      }
    }

    // Use the Host theme and native form semantics, not an independent app shell.
    const paragraphStyle = { maxWidth: '76ch', overflowWrap: 'anywhere' };
    const fieldStyle = { display: 'grid', gap: 8, minWidth: 0 };
    const inputStyle = { width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-secondary, #777)', color: 'inherit', background: 'var(--dsw-alias-background-primary, transparent)', font: 'inherit' };
    const buttonStyle = { ...inputStyle, width: 'auto', cursor: 'pointer' };
    function CatalogPanel({ catalog, blocked, t }) {
      const state = React.useSyncExternalStore(catalog?.subscribe ?? (() => () => {}), catalog?.getSnapshot ?? (() => emptyCatalog), catalog?.getSnapshot ?? (() => emptyCatalog));
      const count = state.groups.reduce((total, group) => total + group.models.length, 0);
      return h('section', { 'data-model-catalog': true, style: { margin: '16px 0', minWidth: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
          h('button', { type: 'button', style: buttonStyle, disabled: blocked || !catalog || state.status === 'loading', onClick: () => { if (!blocked) return catalog?.load(); } }, t(state.status === 'loading' ? 'catalogLoading' : 'catalogRefresh')),
          h('span', { role: 'status', 'aria-live': 'polite' }, state.status === 'ready' ? t('catalogReady') + ' · ' + state.groups.length + ' ' + t('providers') + ' / ' + count + ' ' + t('models') + (state.loadedAt ? ' · ' + new Date(state.loadedAt).toLocaleTimeString() : '') : state.status === 'loading' ? t('catalogLoading') : '')),
        state.status === 'error' ? h('p', { role: 'alert', style: paragraphStyle }, t('catalogFailed') + ' ' + (state.errorCode === 'catalog/timeout' ? t('catalogTimeout') : state.error)) : null,
        state.failures.length ? h('div', { role: 'alert' }, h('p', { style: paragraphStyle }, t('catalogPartial')), h('ul', null, state.failures.map(failure => h('li', { key: failure.id, style: { overflowWrap: 'anywhere' } }, failure.name + ' (' + failure.id + '): ' + failure.message)))) : null,
        state.status === 'ready' && count === 0 ? h('p', { role: 'status' }, t('catalogEmpty')) : null);
    }
    function DraftWizard({ generator, editor, catalog, t }) {
      const state = React.useSyncExternalStore(generator.subscribe, generator.getSnapshot, generator.getSnapshot);
      const editorState = React.useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
      const catalogState = React.useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot);
      // Preparing generation inputs never writes Settings. Only generate/apply need a clean editor.
      const inputBlocked = state.busy;
      const blocked = state.busy || !editor.editable(generator) || editorState.dirty || editorState.autosavePaused;
      const [scopeSearch, setScopeSearch] = React.useState('');
      const route = state.input.generator;
      const model = route && catalog.find(route.provider, route.model);
      const efforts = catalogEfforts(model, t);
      const currentModelKey = route ? modelKey(route) : '';
      const viewToken = editor.viewToken();
      const guarded = action => (...args) => editor.matchesView(viewToken) && action(...args);
      const button = (key, action, disabled) => h('button', { type: 'button', style: buttonStyle, disabled, onClick: key === 'cancel' ? () => editor.matchesView(viewToken, false) && action() : guarded(action) }, t(key));
      const label = (key, child) => h('label', { style: fieldStyle }, h('span', null, t(key)), child);
      const profile = item => item.provider + ' / ' + item.model + ' / ' + (item.effort === null ? 'null' : item.effort || '—');
      const stage = (key, children) => h('fieldset', { style: { minWidth: 0, margin: '16px 0', padding: 16, borderRadius: 8, border: '1px solid var(--dsw-alias-border-secondary, #777)' } }, h('legend', null, t(key)), children);
      const textInput = (key, row, field, maxLength) => h(field === 'description' ? 'textarea' : 'input', { style: field === 'description' ? { ...inputStyle, minHeight: 104, resize: 'vertical' } : inputStyle, ...(field === 'description' ? { rows: 4 } : {}), 'aria-label': t(key) + ' · ' + row.id,
        value: row[field] ?? '', maxLength, disabled: blocked || !generator.editableDraft(), onChange: guarded(event => generator.editCandidate(row.id, { [field]: event.target.value })) });
      const statusKey = { idle: 'draftIdle', generating: 'draftGenerating', ready: 'draftReady', validating: 'draftValidating', applying: 'draftApplying', applied: 'draftApplied', error: 'draftFailed', stale: 'draftStale', conflict: 'draftConflict', cancelled: 'draftCancelled' }[state.status];
      return h('section', { 'data-draft-generator': true, style: { minWidth: 0, margin: '24px 0' } },
        h('h3', null, t('draftTitle')), h('p', { style: paragraphStyle }, t('draftIntro')),
        !state.available ? h('p', { role: 'status' }, t('draftUnavailable')) : null,

        stage('draftGenerator', [
          label('chooseModel', h('select', { style: inputStyle, 'aria-label': t('draftGenerator'), disabled: inputBlocked || catalogState.status !== 'ready', value: currentModelKey, onChange: guarded(event => generator.selectGenerator(event.target.value)) },
            h('option', { value: '', disabled: true }, t('chooseModel')),
            route && !model ? h('option', { value: currentModelKey, disabled: true }, profile(route)) : null,
            catalogState.groups.map(group => h('optgroup', { key: group.id, label: group.name + ' (' + group.id + ')', disabled: catalogState.failures.some(failure => failure.id === group.id) },
              group.models.map(item => h('option', { key: item.id, value: modelKey({ provider: group.id, model: item.id }) }, item.name === item.id ? item.id : item.name + ' — ' + item.id)))))),
          label('draftGeneratorEffort', h('select', { style: inputStyle, 'aria-label': t('draftGeneratorEffort'), disabled: inputBlocked || !model, value: route && route.effort !== '' ? effortKey(route.effort) : '',
            onChange: guarded(event => { const option = efforts.find(item => effortKey(item.id) === event.target.value); if (option) generator.setGeneratorEffort(option.id); }) },
            h('option', { value: '', disabled: true }, t('chooseEffort')),
            route && route.effort !== '' && !efforts.some(item => item.id === route.effort) ? h('option', { value: effortKey(route.effort), disabled: true }, String(route.effort) + ' — ' + t('catalogUnverified')) : null,
            efforts.map(item => h('option', { key: effortKey(item.id), value: effortKey(item.id) }, item.name + (item.id === null ? '' : ' (' + item.id + ')'))))),
          null
        ]),
        stage('draftScope', [h('p', { style: paragraphStyle }, t('draftScopeHelp')),
          h('input', { type: 'search', style: inputStyle, 'aria-label': t('scopeSearch'), placeholder: t('scopeSearch'), value: scopeSearch, disabled: inputBlocked, onChange: event => setScopeSearch(event.target.value) }),
          catalogState.status !== 'ready' ? h('p', { role: 'status' }, t('catalogUnverified')) : null,
          h('div', { role: 'region', 'aria-label': t('draftScope'), tabIndex: 0, style: { maxHeight: 360, overflowY: 'auto', marginTop: 12 } }, catalogState.groups.map(group => {
            const models = group.models.filter(item => (group.id + ' ' + group.name + ' ' + item.id + ' ' + item.name).toLowerCase().includes(scopeSearch.trim().toLowerCase()));
            if (!models.length) return null;
            return h('div', { key: group.id }, h('h4', null, group.name),
            models.map(item => h('div', { key: item.id, style: { margin: '12px 0', paddingBottom: 12, borderBottom: '1px solid var(--dsw-alias-border-secondary, #777)' } }, h('div', { style: { overflowWrap: 'anywhere', fontWeight: 600 } }, item.name === item.id ? item.id : item.name + ' — ' + item.id),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', columnGap: 24 } },
              catalogEfforts(catalog.find(group.id, item.id), t).map(effort => {
                const tuple = { provider: group.id, model: item.id, effort: effort.id };
                return h('label', { key: effortKey(effort.id), style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, overflowWrap: 'anywhere' } },
                  h('input', { type: 'checkbox', style: { minWidth: 24, minHeight: 24 }, disabled: inputBlocked || !generator.routeAllowed(tuple), checked: state.input.scope.some(value => routeKey(value) === routeKey(tuple)), onChange: guarded(event => generator.toggleScope(tuple, event.target.checked)) }), effort.name);
              })))));
          })),
          h('p', { style: paragraphStyle }, t('draftSelected') + ': ' + state.input.scope.length + ' / 128'),
          h('ul', null, state.input.scope.map(item => h('li', { key: routeKey(item), style: { overflowWrap: 'anywhere' } }, profile(item)))),
          button('draftClearScope', () => generator.setScope([]), inputBlocked || !state.input.scope.length)
        ]),
        label('draftRequirements', h('textarea', { style: { ...inputStyle, minHeight: 120, resize: 'vertical' }, 'aria-label': t('draftRequirements'), maxLength: 8000, value: state.input.requirements, disabled: inputBlocked, onChange: guarded(event => generator.setRequirements(event.target.value)) })),
        h('p', { style: paragraphStyle }, state.input.requirements.length + ' / 8000'), h('p', { style: paragraphStyle }, t('draftCost')),
        blocked && !state.busy ? h('div', { role: 'status' }, h('p', { style: paragraphStyle }, t('draftProtected')),
          editorState.dirty && !editorState.receiptUnverified && !editorState.saving ? button('cancel', () => editor.reload(), editorState.reloading) : null) : null,
        !blocked && !generator.inputsValid() ? h('p', { role: 'status', style: paragraphStyle }, t('draftInputRequired')) : null,
        h('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap' } },
          button('draftGenerate', () => generator.generate(), blocked || !state.available || !generator.inputsValid()),
          state.busy && state.status !== 'applying' ? button('draftCancel', () => generator.cancel(), false) : null),
        h('p', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, t(statusKey)),
        state.error ? h('p', { role: 'alert', style: { overflowWrap: 'anywhere' } }, state.error) : null,
        state.warnings.length ? h('div', { role: 'status' }, h('h4', null, t('draftWarnings')), h('ul', null, state.warnings.map((warning, index) => h('li', { key: index, style: { overflowWrap: 'anywhere' } }, warning)))) : null,
        state.draft ? h(React.Fragment, null,
          h('h4', null, t('draftBefore')),
          h('ul', null, state.before.candidates.map(row => h('li', { key: row.id, style: { overflowWrap: 'anywhere' } }, row.name + ' · ' + profile(row) + ' · ' + (row.description ?? '') + (row.id === state.before.defaultCandidateId ? ' · ' + t('defaultCandidate') : '')))),
          h('h4', null, t(state.status === 'applied' ? 'draftApplied' : state.applyAttempted ? 'draftSaveUnverified' : 'draftAfter')),
          h('div', { style: { overflowX: 'auto', maxWidth: '100%' }, tabIndex: 0, role: 'region', 'aria-label': t('draftAfter') },
            h('table', { style: { width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' } },
              h('thead', null, h('tr', null, ['draftName','draftProfile','draftDescription','draftRemove'].map(key => h('th', { key, scope: 'col', style: { textAlign: 'start', padding: 8 } }, t(key))))),
              h('tbody', null, state.draft.candidates.map(row => h('tr', { key: row.id },
                h('td', { style: { padding: 8, verticalAlign: 'top' } }, textInput('draftName', row, 'name', 120), h('code', { style: { overflowWrap: 'anywhere' } }, row.id)),
                h('td', { style: { padding: 8, verticalAlign: 'top', overflowWrap: 'anywhere' } }, profile(row)),
                h('td', { style: { padding: 8, verticalAlign: 'top' } }, textInput('draftDescription', row, 'description', 1000)),
                h('td', { style: { padding: 8, verticalAlign: 'top' } }, button('draftRemove', () => generator.removeCandidate(row.id), blocked || !generator.editableDraft()))))))),
          label('draftDefault', h('select', { style: inputStyle, 'aria-label': t('draftDefault'), value: state.draft.defaultCandidateId ?? '', disabled: blocked || !generator.editableDraft(), onChange: guarded(event => generator.setDefault(event.target.value)) },
            h('option', { value: '', disabled: true }, t('draftChooseDefault')), state.draft.candidates.map(row => h('option', { key: row.id, value: row.id }, row.name + ' — ' + row.id)))),
          h('label', { style: { display: 'flex', alignItems: 'start', gap: 12, margin: '16px 0' } },
            h('input', { type: 'checkbox', style: { minWidth: 24, minHeight: 24 }, 'aria-label': t(editor.configSet ? 'draftConfirmPreset' : 'draftConfirm'), checked: state.confirmed, disabled: blocked || !generator.editableDraft(), onChange: guarded(event => generator.confirm(event.target.checked)) }), t(editor.configSet ? 'draftConfirmPreset' : 'draftConfirm')),
          button('draftApply', () => generator.validateAndApply(), blocked || !state.available || !generator.canApply())) : null);
    }
    function ConfigSetsPanel({ editor, state, t, children }) {
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
    function RouterPage({ editor, catalog, generator, t, view }) {
      const state = React.useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
      const catalogState = React.useSyncExternalStore(catalog?.subscribe ?? (() => () => {}), catalog?.getSnapshot ?? (() => emptyCatalog), catalog?.getSnapshot ?? (() => emptyCatalog));
      if (view === 'summary') return h('span', null, t('summary'));
      const ui = state.draft ?? emptyDraft();
      const busy = state.generatedBusy || state.status !== 'ready' || !state.writable || state.saving || state.reloading || state.connectionReset || state.receiptUnverified || state.invalidSource;
      const disabled = busy || state.conflicted;
      const viewToken = editor.viewToken();
      const edit = update => editor.matchesView(viewToken) && editor.edit(update);
      const button = (key, action, off = false) => h('button', { type: 'button', style: buttonStyle, disabled: off, onClick: action }, t(key));
      const input = (key, value, set, type = 'text', off = disabled, maxLength) => h('label', { style: fieldStyle }, h('span', null, t(key)), h('input', { style: type === 'checkbox' ? { minWidth: 24, minHeight: 24 } : inputStyle, 'aria-label': t(key), type, disabled: off, maxLength, onCompositionStart: () => editor.matchesView(viewToken) && editor.setComposing(true), onCompositionEnd: () => editor.matchesView(viewToken) && editor.setComposing(false), ...(type === 'checkbox' ? { checked: !!value } : { value: value ?? '' }), onChange: event => set(type === 'checkbox' ? event.target.checked : type === 'number' ? Number(event.target.value) : event.target.value) }));
      const group = (title, children) => h('fieldset', { style: { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-secondary, #777)', borderRadius: 8, padding: 16, margin: '16px 0' } }, h('legend', { style: { maxWidth: '100%', overflowWrap: 'anywhere' } }, title), children);
      const grid = children => h('div', { style: { display: 'grid', minWidth: 0, gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 16, alignItems: 'end' } }, children);
      const json = value => h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' } }, JSON.stringify(value, null, 2));
      const defaultOptions = ui.candidates.filter(candidate => candidate.id && ui.candidates.filter(other => other.id === candidate.id).length === 1);
      const defaultPicker = h('label', { style: { ...fieldStyle, marginTop: 16 } }, h('span', null, t('defaultCandidate')),
        h('select', { style: inputStyle, 'aria-label': t('defaultCandidate'), value: ui.defaultCandidateId ?? '', disabled: disabled || !defaultOptions.length, onChange: event => {
          const id = event.target.value, draft = editor.getSnapshot().draft;
          if (id === (draft.defaultCandidateId ?? '')) return;
          if (id === '' && !draft.enabled) edit(next => { delete next.defaultCandidateId; });
          else if (id && draft.candidates.filter(candidate => candidate.id === id).length === 1) edit(next => { next.defaultCandidateId = id; });
        } },
          h('option', { value: '', disabled: !!ui.enabled }, t(defaultOptions.length ? 'chooseDefault' : 'defaultCandidateEmpty')),
          ui.defaultCandidateId && !defaultOptions.some(candidate => candidate.id === ui.defaultCandidateId) ? h('option', { value: ui.defaultCandidateId, disabled: true }, ui.defaultCandidateId) : null,
          defaultOptions.map(candidate => h('option', { key: candidate.id, value: candidate.id },
            (candidate.name || candidate.id) + (candidate.provider && candidate.model ? ' — ' + candidate.provider + ' / ' + candidate.model + (candidate.effort === undefined || candidate.effort === '' ? '' : ' · ' + (candidate.effort === null ? t('defaultCandidateNoEffort') : candidate.effort)) : '')))),
        defaultOptions.length ? h('span', null, t('defaultCandidateHelp')) : null);
      const poolRows = [];
      const rows = ui.candidates.map((candidate, index) => {
        const set = (key, value) => edit(next => { if (next.candidates[index]?.id === candidate.id) next.candidates[index][key] = value; });
        const current = catalog?.find(candidate.provider, candidate.model);
        const options = catalogEfforts(current, t);
        const known = options.some(option => option.id === candidate.effort);
        const failed = catalogState.failures.some(failure => failure.id === candidate.provider);
        const missing = !current && !!candidate.provider && !!candidate.model;
        const modelPicker = h('label', { style: fieldStyle }, h('span', null, t('chooseModel')),
          h('select', { style: inputStyle, 'aria-label': t('chooseModel'), disabled, value: candidate.provider && candidate.model ? modelKey(candidate) : '', onChange: event => catalog?.select(editor, index, event.target.value, candidate, viewToken) },
            !candidate.provider && !candidate.model ? h('option', { value: '', disabled: true }, t('chooseModel')) : null,
            missing ? h('option', { value: modelKey(candidate), disabled: true }, candidate.provider + ' / ' + candidate.model) : null,
            catalogState.groups.map(provider => h('optgroup', { key: provider.id, label: provider.name + ' (' + provider.id + ')', disabled: catalogState.status !== 'ready' || catalogState.failures.some(failure => failure.id === provider.id) },
              provider.models.map(item => h('option', { key: item.id, value: modelKey({ provider: provider.id, model: item.id }) }, item.name === item.id ? item.id : item.name + ' — ' + item.id))))),
          candidate.provider && candidate.model ? h('code', { style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, candidate.provider + ' / ' + candidate.model) : null,
          missing ? h('span', { role: 'status' }, t(catalogState.status === 'ready' && !failed ? 'catalogMissing' : 'catalogUnverified')) : null);
        const effortPicker = h('label', { style: fieldStyle }, h('span', null, t('effort')),
          h('select', { style: inputStyle, 'aria-label': t('effort'), value: candidate.effort === '' || candidate.effort === undefined ? '' : effortKey(candidate.effort), disabled: disabled || !current, onChange: event => catalog?.setEffort(editor, index, event.target.value, candidate, viewToken) },
            h('option', { value: '', disabled: true }, t('chooseEffort')),
            !known && candidate.effort !== '' && candidate.effort !== undefined ? h('option', { value: effortKey(candidate.effort), disabled: true }, String(candidate.effort) + ' — ' + t('unknownEffort')) : null,
            options.map(option => h('option', { key: effortKey(option.id), value: effortKey(option.id) }, option.name + (option.id === null ? '' : ' (' + option.id + ')')))),
          candidate.effort === '' || candidate.effort === undefined ? h('span', { role: 'status' }, t('effortRequired')) : null,
          options.some(option => option.id === null) ? h('span', { role: 'status' }, t('noReasoning')) : null);
        if (editor.configSet) {
          poolRows.push(h('div', { key: candidate.id, 'data-pool-candidate': candidate.id }, group(candidate.id, [grid([modelPicker, effortPicker]), h('div', { style: { marginTop: 16 } }, button('remove', () => editor.matchesView(viewToken) && editor.removeCandidate(candidate.id), disabled))])));
          return h('div', { key: candidate.id, 'data-candidate': candidate.id }, group(candidate.id, [
            input('name', candidate.name, value => set('name', value), 'text', disabled, 120),
            h('p', { style: { ...paragraphStyle, overflowWrap: 'anywhere' } }, candidate.provider + ' / ' + candidate.model + ' / ' + String(candidate.effort)),
            input('description', candidate.description, value => set('description', value), 'text', disabled, 1000)
          ]));
        }
        return h('div', { key: index, 'data-candidate': candidate.id }, group(candidate.name || t('name') + ' ' + (index + 1), [
          grid([h('div', { style: fieldStyle }, input('name', candidate.name, value => set('name', value), 'text', disabled, 120), h('code', { 'aria-label': t('id'), style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, t('id') + ': ' + candidate.id)), modelPicker, effortPicker]),
          h('div', { style: { marginTop: 16 } }, input('description', candidate.description, value => set('description', value), 'text', disabled, 1000)),
          h('div', { style: { marginTop: 16 } }, button('remove', () => edit(next => { if (next.candidates[index]?.id === candidate.id) next.candidates.splice(index, 1); }), disabled))
        ]));
      });
      return h('section', { style: { color: 'var(--dsw-alias-label-primary, inherit)', padding: '16px 0', minWidth: 0, maxWidth: '100%', lineHeight: 1.6 } },
        h('h2', null, t('title')), h('p', { style: paragraphStyle }, t('summary')),
        state.status !== 'ready' ? h('p', { role: 'status' }, t(state.status === 'loading' ? 'loading' : 'unavailable')) : null,
        state.status === 'ready' && !state.writable ? h('p', { role: 'status' }, t('readOnly')) : null,
        state.invalidSource ? group(t('invalidSourceTitle'), [h('p', { role: 'alert' }, t('invalidSource')), h('details', null, h('summary', null, t('originalConfiguration')), json(state.invalidOriginal))]) : null,
        h(ConfigSetsPanel, { editor, state, t }, defaultPicker),
        h(CatalogPanel, { catalog, blocked: state.generatedBusy, t }),
        generator && catalog ? h(DraftWizard, { generator, editor, catalog, t }) : null,
        h('div', { 'data-autosave': true, style: { padding: '12px 0', background: 'var(--dsw-alias-background-primary, #fff)', borderBottom: '1px solid var(--dsw-alias-border-secondary, #777)' } },
          h('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, t(state.saving ? 'saving' : state.savedButNotLive ? 'savedButNotLive' : state.error || state.conflicted ? 'autosaveFailed' : state.dirty ? validDraft(ui) ? 'autosavePending' : 'autosaveIncomplete' : state.saved ? 'saved' : 'autosave')),
          state.conflicted ? h('p', { role: 'alert' }, t('conflict')) : null,
          state.error ? h('p', { role: 'alert' }, state.error) : null,
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 } },
            state.error && state.dirty && !state.receiptUnverified && !state.connectionReset && !state.conflicted ? button('retry', () => editor.matchesView(viewToken) && editor.save(), disabled || !validDraft(ui)) : null,
            button(state.dirty && !state.receiptUnverified || state.connectionReset ? 'cancel' : 'refresh', () => editor.matchesView(viewToken, false) && editor.reload(), state.saving || state.reloading || state.generatedBusy))),
        h('details', { 'data-manual-editor': true, style: { marginTop: 24 } }, h('summary', { style: { minHeight: 44, cursor: 'pointer', fontWeight: 600 } }, t('manualTitle'), ' · ' + ui.candidates.length),
        editor.configSet ? null : input('enabled', ui.enabled, value => edit(next => { next.enabled = value; }), 'checkbox'),

        h('h3', null, t(editor.configSet ? 'presetRoles' : 'candidates')), rows.length ? rows : h('p', { style: paragraphStyle }, t('noCandidates')),
        editor.configSet ? h('section', { 'data-shared-pool': true, style: { marginTop: 32 } }, h('h3', null, t('sharedPool')), h('p', { style: paragraphStyle }, t('sharedPoolHelp')), input('enabled', ui.enabled, value => edit(next => { next.enabled = value; }), 'checkbox'), poolRows) : null,
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, button('addCandidate', () => editor.matchesView(viewToken) && editor.addCandidate(), disabled || ui.candidates.length >= 128)),
        h('details', { style: { margin: '24px 0' } }, h('summary', null, t('advanced')),
          group(t('limits'), grid(['maxPendingStarts','maxActivePerModel','maxCreationsPerParent','metadataTimeoutMs'].map(key => input(key, ui.limits[key], value => edit(next => { next.limits[key] = value; }), 'number')))),
          h('p', { style: paragraphStyle }, t('authority')), h('p', { style: paragraphStyle }, t('executionEvidence'))))
      );
    }

    function draftRemoteDescriptors() {
      // Browser codecs need only parse(); no bundled Zod dependency or raw RPC.
      // Server codecs perform the complete data-only/range validation again.
      const codec = name => ({ mode: 'strict', typeSymbol: 'dsh-delegation-router#' + name, create: () => ({ parse(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid configuration draft envelope');
        return value;
      } }) });
      return ['generateDraft', 'validateDraft'].map(method => ({
        id: 'dsh-delegation-router#delegationRouter/' + method, service: 'delegationRouter', namespace: 'delegationRouter', method,
        invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec(method + 'Request') }],
        cancellation: { parameter: 'signal' }, result: codec(method + 'Result')
      }));
    }
    function catalogRemoteDescriptors() {
      return [{ id: 'dsh-delegation-router#delegationRouter/modelCatalog', service: 'delegationRouter', namespace: 'delegationRouter', method: 'modelCatalog',
        invocation: { kind: 'direct' }, parameters: [], cancellation: { parameter: 'signal' },
        result: { mode: 'strict', typeSymbol: 'dsh-delegation-router#ModelCatalog', create: () => ({ parse(value) { normalizeCatalog(value); return value; } }) } }];
    }
    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'delegation-router: locale');
      const editor = new RouterEditor(ctx, t);
      const catalog = new ModelCatalog(ctx);
      const generator = new DraftGenerator(ctx, editor, catalog, t);
      if (typeof ctx.remote.$mount === 'function') ctx.effect(() => {
        let disposed = false, release;
        const pending = ctx.remote.$mount({ package: 'dsh-delegation-router', descriptors: [...draftRemoteDescriptors(), ...catalogRemoteDescriptors()] }).then(async off => {
          if (disposed) await off(); else { release = off; generator.publish(); catalog.resetConnection(); }
        }).catch(() => { if (!disposed) { generator.error = t('draftUnavailable'); generator.publish(); } });
        return async () => { disposed = true; await pending; await release?.(); };
      }, 'delegation-router: configuration draft remote');
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
      ctx.effect(() => () => generator.dispose(), 'delegation-router: draft generator');
      ctx.on('connection/reset', () => { generator.resetConnection(); editor.resetConnection(); catalog.resetConnection(); });
      if (typeof ctx.remote.$mount !== 'function') void catalog.load();
      const component = props => h(RouterPage, { ...props, editor, catalog, generator, t });
      for (const [name, key] of [['plugins.bundle.config', 'dsh-delegation-router'], ['plugins.row.config', 'dsh-delegation-router#delegation-router']]) {
        ctx.effect(() => ctx.slots.inject(name, () => ctx.slots.register({ name, key }, component)), 'delegation-router: ' + name);
      }
    }
    return { inject: ['slots', 'locale', 'configForms', 'remote', 'remote.settings', 'remote.session'], apply, draftRemoteDescriptors, catalogRemoteDescriptors, CatalogPanel, RouterEditor, RouterPage, DraftGenerator, DraftWizard, routeKey, ModelCatalog, normalizeCatalog, modelKey, catalogEfforts, effortKey, CATALOG_EVENTS, emptyDraft, projectConfigSet, validConfigSets, ConfigSetsPanel, draftFrom, normalizeAckUi, validDraft, dictionaries: { zh, en } };
  }
});
