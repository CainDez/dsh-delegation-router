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
  "workspaceIntro": "选择预设后，可手动编辑委派模型，或用 AI 生成草稿。",
  "workspaceNav": "配置工作区",
  "presetDetails": "预设详情",
  "presetDetailsHelp": "从 DSH 模型目录选择任意可用模型和思考档位。修改只影响当前预设。",
  "availableModels": "草稿可用模型",
  "sharedScope": "仅用于草稿",
  "presetScope": "仅当前预设",
  "managePresetOps": "预设操作",
  "poolName": "档案名称",
  "poolProfiles": "草稿模型档案",
  "addPoolCandidate": "添加草稿模型",
  "draftRemovedRoutes": "应用时移除的委派模型",
  "presetDefaultBadge": "默认",
  "removeDefaultHelp": "移除默认档案后，请选择新的默认项；如已关闭创建路由，也可清空默认项。",
  "switchNeedsDefault": "该预设未设置默认委派模型。请先关闭创建路由，再切换并设置默认项。",
  "poolEmpty": "还没有草稿可用模型。添加后即可在生成草稿时使用。",
  "draftTab": "生成草稿",
  "draftPresetIntro": "先选生成模型，再从「草稿可用模型」里选出可写入当前预设的档案。",
  "draftPoolScope": "从草稿可用模型中勾选本次允许写入预设的模型和档位。",
  "draftPoolEmpty": "没有可用于草稿的档案。请在「草稿可用模型」中添加目录可用且不重复的模型与档位。",
  "draftScopeChanged": "部分已选档案已不可用。取消勾选或清空后重新选择。",
  "draftNoMatches": "未找到匹配的模型。",
  "draftDuplicateScope": "相同 Provider、模型和档位配置了多个候选，无法用于草稿；请到「可选模型」调整。",
  "draftInputSettings": "调整生成输入",
  "draftReview": "审阅草稿",
  "draftNoChanges": "应用会替换当前预设的委派模型和默认项，不会修改草稿可用模型或其他预设。",
  "draftBeforeDefault": "当前默认",
  "draftNewDefault": "草稿默认",
  "draftNewRole": "现有配置没有此候选",
  "draftNoDescription": "未填写分工说明",
  "draftGeneratorHelp": "仅用于写草稿，可以不是委派模型。",
  "draftTarget": "应用目标",
  "workspaceStatus": "保存状态",
  "draftPendingBadge": "待审阅",
  "draftConfirmPreset": "我已核对新增、保留和移除的模型，确认替换当前预设的委派模型和默认项。",
  "sharedPool": "全局可用模型池",
  "sharedPoolHelp": "所有预设生成草稿时共用这份列表。这里的改动不会影响手动选模或已保存的预设。",
  "presetRoles": "当前预设的模型分工",
  "draftPoolMismatch": "草稿中的模型或档位不在草稿池内，或对应多个档案。尚未应用，请调整草稿池后重新生成。",
  "configSets": "多模型预设",
  "configSetsHelp": "预设由你自由命名，只保存模型分工、名称和默认项。所有预设共用可选模型、启用开关和配额。",
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
  "configNotConfirmed": "当前更改尚未确认生效，实际委派仍以宿主已保存的有效配置为准。请核对顶部保存状态。",
  "scopeSearch": "搜索模型或 Provider",
  "catalogReady": "模型已更新",
  "catalogTimeout": "读取超过 20 秒，请重试；现有配置未改变。",
  "providers": "个 Provider",
  "models": "个模型",
  "draftTitle": "生成候选草稿",
  "draftGenerator": "1 · 生成模型",
  "draftGeneratorEffort": "思考档位",
  "draftScope": "2 · 允许的委派执行档案",
  "draftClearScope": "清空委派范围",
  "draftRequirements": "3 · 生成要求（最多 8000 字符）",
  "draftCost": "生成可能产生费用；失败不重试、不换模型。取消会请求中止，但已发生的费用仍可能计入。",
  "draftGenerate": "生成草稿",
  "draftGenerating": "正在生成；现有配置未改变…",
  "draftValidating": "正在服务端校验草稿…",
  "draftApplying": "正在应用并核对单次保存…",
  "draftReady": "草稿未应用 · 请核对后确认",
  "draftIdle": "尚未生成草稿",
  "draftApplied": "草稿已应用并确认保存。",
  "draftFailed": "草稿操作失败；没有自动重试。",
  "draftUnavailable": "草稿服务不可用；仍可手动编辑，修改会自动保存。",
  "draftInputRequired": "请选择生成模型及档位、至少一个委派档位，并填写要求。",
  "draftProtected": "可继续选择模型和填写要求。生成前请先保存或放弃手动更改，并处理顶部保存异常。",
  "draftStale": "目录、输入或连接已改变。此草稿已失效，必须重新生成。",
  "draftConflict": "现有配置已编辑、保存或刷新，与生成时快照冲突。请核对后重新生成，不会覆盖手动更改。",
  "draftInvalidResult": "草稿格式、默认项或执行档案不合法，或超出所选委派范围；已拒绝。",
  "draftValidationChanged": "服务端校验改变了已确认的草稿内容；未应用，请重新生成并检查。",
  "draftApplyFailed": "未确认草稿保存。请核对顶部保存状态；不会重复写入。",
  "draftSaveUnverified": "已提交应用 · 请核对顶部保存状态",
  "draftCancelled": "请求已在本地取消；迟到结果将忽略，不自动重试。",
  "draftCancel": "取消并忽略结果",
  "draftBefore": "现有配置 →",
  "draftAfter": "草稿（未应用）",
  "draftProfile": "执行档案 · provider / model / effort",
  "draftName": "草稿候选名称",
  "draftDescription": "草稿适用说明",
  "draftDefault": "草稿默认候选",
  "draftChooseDefault": "请选择草稿默认候选",
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
  "candidates": "委派模型",
  "addCandidate": "添加候选",
  "name": "候选名称",
  "description": "适用说明（一句话）",
  "effort": "思考档位",
  "defaultCandidate": "默认委派模型",
  "defaultCandidateHelp": "从已配置的模型中选择。更改会自动保存，仅用于当前预设下未指定候选的后续委派。",
  "defaultCandidateEmpty": "请先添加委派模型",
  "defaultCandidateNoEffort": "无档位",
  "chooseDefault": "未指定默认候选（仅关闭时允许）",
  "noCandidates": "还没有委派模型。添加后，可从 DSH 模型目录选择模型和思考档位。",
  "catalogHelp": "候选模型从 DSH 原生目录选择，档位为目录公示的真实值单选；明确无可选档位时保存 null，不补造 default。目录可见不代表授权或通过后端预检。",
  "noReasoning": "目录确认此模型没有可选思考档位；本候选使用 null，不发送思考档位。",
  "noEffort": "无可选档位（null）",
  "effortRequired": "请选择一个真实档位；default 哨兵不会自动迁移。",
  "invalidDraft": "请补全每个候选的名称、唯一 ID、模型和单个档位；启用前必须明确选择有效默认候选。",
  "authority": "候选说明仅为选型资料，不授予能力、权限或安排任务。非法提案将被拒绝，不自动换模型。当前创建仅传文本，不转发图片。",
  "advanced": "高级与安全设置",
  "auditFile": "审计路径（由原生设置管理）",
  "auditHelp": "此表单保留既有 auditFile，不清除日志或锁。需要修改时请使用原生设置。",
  "invalidSource": "配置结构无效（支持 v3、v4 和 v5）。为避免覆盖原始配置，请在原生设置中核对修复。",
  "invalidSourceTitle": "无效配置",
  "originalConfiguration": "原始配置（只读）"
};
    const en = {
  "workspaceIntro": "Select a preset, then edit its delegation models manually or generate a draft with AI.",
  "workspaceNav": "Configuration workspace",
  "presetDetails": "Preset details",
  "presetDetailsHelp": "Choose any available model and effort from the DSH catalog. Changes affect only this preset.",
  "availableModels": "Draft model pool",
  "sharedScope": "Drafts only",
  "presetScope": "Current preset only",
  "managePresetOps": "Preset actions",
  "poolName": "Profile name",
  "poolProfiles": "Draft profiles",
  "addPoolCandidate": "Add draft model",
  "draftRemovedRoutes": "Delegation models removed by applying",
  "presetDefaultBadge": "Default",
  "removeDefaultHelp": "After removing the default, select a new one. If creation routing is off, you can clear the default instead.",
  "switchNeedsDefault": "This preset has no default. Turn off creation routing before switching to it and setting a default.",
  "poolEmpty": "No models in the draft pool. Add models here to use them when generating drafts.",
  "draftTab": "Generate draft",
  "draftPresetIntro": "Choose a model to write the draft, then select which profiles the draft may assign to the current preset.",
  "draftPoolScope": "Select the models and efforts this draft may include from the draft model pool.",
  "draftPoolEmpty": "No eligible draft profiles. Add distinct model and effort combinations from the catalog to the draft model pool.",
  "draftScopeChanged": "Some selected profiles are no longer available. Deselect them or clear the selection and start again.",
  "draftNoMatches": "No matching models.",
  "draftDuplicateScope": "Multiple candidates have this provider, model, and effort. Adjust them under Available models before using them in a draft.",
  "draftInputSettings": "Adjust generation inputs",
  "draftReview": "Review draft",
  "draftNoChanges": "Applying replaces this preset’s delegation models and default without changing the draft model pool or other presets.",
  "draftBeforeDefault": "Current default",
  "draftNewDefault": "Draft default",
  "draftNewRole": "No matching candidate in the current configuration",
  "draftNoDescription": "No role description",
  "draftGeneratorHelp": "This model writes the draft. It does not need to be a delegation model.",
  "draftTarget": "Applies to",
  "workspaceStatus": "Save status",
  "draftPendingBadge": "Review pending",
  "draftConfirmPreset": "I reviewed the additions, retained models and removals, and confirm replacing this preset’s delegation models and default.",
  "sharedPool": "Global available model pool",
  "sharedPoolHelp": "All presets share this list when generating drafts. Changes here do not affect manual model selection or saved presets.",
  "presetRoles": "Current preset model roles",
  "draftPoolMismatch": "A draft model and effort is missing from the pool or matches more than one profile. Nothing was applied. Adjust the pool and generate again.",
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
  "configNotConfirmed": "These changes are not confirmed effective. Delegation still follows the host’s saved effective configuration. Check the save status at the top.",
  "scopeSearch": "Search models or providers",
  "catalogReady": "Models updated",
  "catalogTimeout": "Loading exceeded 20 seconds. Retry; existing settings are unchanged.",
  "providers": "providers",
  "models": "models",
  "draftTitle": "Generate candidate draft",
  "draftGenerator": "1 · Generator model",
  "draftGeneratorEffort": "Reasoning effort",
  "draftScope": "2 · Allowed delegation profiles",
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
  "draftUnavailable": "Draft service is unavailable; manual editing and autosave are still available.",
  "draftInputRequired": "Choose a generator and effort, select at least one delegation effort, and enter requirements.",
  "draftProtected": "You can prepare inputs. Before generating, save or discard manual edits and resolve any save issues shown at the top.",
  "draftStale": "The catalog, inputs or connection changed. This draft is stale and must be regenerated.",
  "draftConflict": "Existing configuration was edited, saved or refreshed after generation started. Review it and generate again; manual changes will not be overwritten.",
  "draftInvalidResult": "Rejected: draft format, default or execution profiles are invalid or outside the selected delegation scope.",
  "draftValidationChanged": "Server validation changed the confirmed draft; nothing was applied. Generate again and review.",
  "draftApplyFailed": "Draft save was not verified. Check the save status at the top; no duplicate write will occur.",
  "draftSaveUnverified": "Application submitted · Check save status at the top",
  "draftCancelled": "Request cancelled locally; late results will be ignored without automatic retry.",
  "draftCancel": "Cancel and ignore result",
  "draftBefore": "Existing configuration →",
  "draftAfter": "Draft (not applied)",
  "draftProfile": "Execution profile · provider / model / effort",
  "draftName": "Draft candidate name",
  "draftDescription": "Draft usage description",
  "draftDefault": "Draft default candidate",
  "draftChooseDefault": "Choose a draft default",
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
  "candidates": "Delegation models",
  "addCandidate": "Add candidate",
  "name": "Candidate name",
  "description": "Usage description (one sentence)",
  "effort": "Reasoning effort",
  "defaultCandidate": "Default delegation model",
  "defaultCandidateHelp": "Choose from configured models. Changes are saved automatically and apply only to future delegations that do not specify a candidate under this preset.",
  "defaultCandidateEmpty": "Add a delegation model first",
  "defaultCandidateNoEffort": "No effort",
  "chooseDefault": "No default candidate (disabled routing only)",
  "noCandidates": "No delegation models yet. Add one and pick a model and effort from the DSH catalog.",
  "catalogHelp": "Candidate models use the native DSH catalog and one real advertised effort. Confirmed effort-less entries use null, never an invented default. Catalog visibility is not authorization or backend preflight approval.",
  "noReasoning": "The catalog confirms no selectable reasoning efforts for this model. This candidate uses null and sends no reasoning effort.",
  "noEffort": "No selectable effort (null)",
  "effortRequired": "Choose a real effort. The default sentinel is never migrated automatically.",
  "invalidDraft": "Complete each candidate name, unique ID, model and single effort; explicitly choose a valid default candidate before enabling.",
  "authority": "Candidate descriptions are selection data, not capability, authorization or task assignments. Invalid proposals are rejected without switching models. Creation is text-only and does not forward images.",
  "advanced": "Advanced and safety settings",
  "auditFile": "Audit path (managed in native settings)",
  "auditHelp": "This form preserves auditFile and never clears journals or locks. Change the path through native settings.",
  "invalidSource": "Invalid configuration structure (supported: v3, v4 and v5). Review and repair it in native settings; this form will not overwrite the original.",
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
    // Unsupported structures and unrecognized persistent keys are read-only;
    // opening the UI never repairs or migrates the stored document.
    function invalidSource(value) {
      if (value && typeof value === 'object' && !Array.isArray(value) &&
          (Object.hasOwn(value, 'policy') || Object.keys(value).some(key => !PLUGIN_KEYS.includes(key)) ||
           value.auditFile !== undefined && typeof value.auditFile !== 'string')) return true;
      const source = value?.ui;
      if (source === undefined) return false;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return true;
      const object = item => item && typeof item === 'object' && !Array.isArray(item);
      if (isConfigSet(source)) return !validConfigSets(source);
      if (source.schemaVersion !== 3) return true;
      for (const key of Object.keys(source)) if (!UI_KEYS.includes(key)) return true;
      if (source.enabled !== undefined && typeof source.enabled !== 'boolean') return true;
      if (source.candidates !== undefined && (!Array.isArray(source.candidates) || source.candidates.some(item =>
        !object(item) || Object.keys(item).some(key => !CANDIDATE_KEYS.includes(key))))) return true;
      if (source.limits !== undefined && (!object(source.limits) || Object.keys(source.limits).some(key => !LIMIT_KEYS.includes(key)))) return true;
      return false;
    }
    function normalizeAckUi(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || invalidSource({ ui: value })) return value;
      const rows = candidates => (candidates ?? []).map(row => ({ description: '', ...row }));
      if (value.schemaVersion === 5) return {
        ...clone(value), enabled: value.enabled ?? false, candidates: rows(value.candidates), limits: { ...emptyDraft().limits, ...value.limits },
        configs: value.configs.map(row => ({ ...row, name: configName(row.name), candidates: rows(row.candidates) }))
      };
      return value;
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
    const CONFIG_SET_KEYS = ['schemaVersion', 'enabled', 'candidates', 'limits', 'activeConfigId', 'configs'];
    const CONFIG_ROW_KEYS = ['id', 'name', 'defaultCandidateId'];
    const OVERRIDE_KEYS = ['id', 'name', 'description'];
    const isConfigSet = value => value?.schemaVersion === 4 || value?.schemaVersion === 5;
    const configName = value => typeof value === 'string' ? value.trim() : '';
    const validConfigName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120 && !/[\x00-\x1f\x7f]/.test(value);
    function presetCandidates(value, preset) {
      if (value.schemaVersion === 5) return preset.candidates;
      const overrides = new Map((preset.overrides ?? []).map(row => [row.id, row]));
      return (value.candidates ?? []).map(row => ({ ...row, ...overrides.get(row.id) }));
    }
    function projectConfigSet(value, preset = value.configs.find(row => row.id === value.activeConfigId)) {
      return withDefaults({ schemaVersion: 3, enabled: (value.schemaVersion === 4 || preset.id === value.activeConfigId) && !!value.enabled, candidates: presetCandidates(value, preset), limits: value.limits,
        ...(preset.defaultCandidateId === undefined ? {} : { defaultCandidateId: preset.defaultCandidateId }) });
    }
    function validConfigSets(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !isConfigSet(value) ||
          Object.keys(value).some(key => !CONFIG_SET_KEYS.includes(key)) || !Array.isArray(value.configs) || value.configs.length < 1 || value.configs.length > 32 ||
          value.enabled !== undefined && typeof value.enabled !== 'boolean' ||
          invalidSource({ ui: { schemaVersion: 3, enabled: false, candidates: value.candidates, limits: value.limits } }) ||
          !validDraft(withDefaults({ schemaVersion: 3, enabled: false, candidates: value.candidates, limits: value.limits }))) return false;
      const independent = value.schemaVersion === 5;
      const ids = new Set(), names = new Set(), poolIds = new Set((value.candidates ?? []).map(row => row.id));
      const keys = [...CONFIG_ROW_KEYS, independent ? 'candidates' : 'overrides'];
      for (const row of value.configs) {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !keys.includes(key)) ||
            typeof row.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(row.id) || ids.has(row.id) || !validConfigName(row.name)) return false;
        if (independent) {
          if (!Array.isArray(row.candidates)) return false;
        } else {
          if (row.overrides !== undefined && !Array.isArray(row.overrides)) return false;
          const refs = new Set();
          for (const item of row.overrides ?? []) {
            if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !OVERRIDE_KEYS.includes(key)) ||
                !poolIds.has(item.id) || refs.has(item.id) || typeof item.name !== 'string') return false;
            refs.add(item.id);
          }
        }
        const name = configName(row.name).toLowerCase();
        if (names.has(name) || !validDraft(projectConfigSet(value, row))) return false;
        ids.add(row.id); names.add(name);
      }
      return ids.has(value.activeConfigId);
    }
    function configSetFrom(value, initialName) {
      const raw = value?.ui;
      const source = invalidSource(value) ? undefined : raw;
      if (source?.schemaVersion === 5) return { ...clone(source), enabled: source.enabled ?? false, candidates: clone(source.candidates ?? []), limits: { ...emptyDraft().limits, ...source.limits } };
      if (source?.schemaVersion === 4) return {
        schemaVersion: 5, enabled: source.enabled ?? false, candidates: clone(source.candidates ?? []), limits: { ...emptyDraft().limits, ...source.limits },
        activeConfigId: source.activeConfigId,
        configs: source.configs.map(({ id, name, defaultCandidateId, overrides }) => ({ id, name: configName(name), candidates: presetCandidates(source, { overrides }),
          ...(defaultCandidateId === undefined ? {} : { defaultCandidateId }) }))
      };
      const { enabled, candidates, limits, defaultCandidateId } = withDefaults(source);
      return { schemaVersion: 5, enabled, candidates: clone(candidates), limits, activeConfigId: 'config-1',
        configs: [{ id: 'config-1', name: initialName, candidates, ...(defaultCandidateId === undefined ? {} : { defaultCandidateId }) }] };
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
      select(editor, index, key, expected, viewToken, target = 'preset') {
        if (viewToken !== undefined && !editor.matchesView(viewToken)) return false;
        if (this.disposed || this.snapshot.status !== 'ready') return false;
        const candidate = editor.candidateRows(target)[index];
        if (!candidate || expected && stable(candidate) !== stable(expected)) return false;
        for (const group of this.snapshot.groups) for (const model of group.models) {
          if (key !== modelKey({ provider: group.id, model: model.id }) || !this.find(group.id, model.id)) continue;
          const options = catalogEfforts(model, editor.t);
          // Only a verified effort-less record yields null; no catalog is not null.
          const effort = options.some(option => option.id === null) ? null : options.some(option => option.id === model.reasoning?.defaultEffort) ? model.reasoning.defaultEffort : '';
          return editor.edit(next => { Object.assign(next.candidates[index], { provider: group.id, model: model.id, effort }); }, target);
        }
        return false;
      }
      setEffort(editor, index, value, expected, viewToken, target = 'preset') {
        if (viewToken !== undefined && !editor.matchesView(viewToken)) return false;
        const candidate = editor.candidateRows(target)[index];
        if (this.disposed || !candidate || expected && (candidate.id !== expected.id || modelKey(candidate) !== modelKey(expected))) return false;
        const option = catalogEfforts(this.find(candidate.provider, candidate.model), editor.t).find(option => effortKey(option.id) === value);
        if (!option) return false;
        return editor.edit(next => { next.candidates[index].effort = option.id; }, target);
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
          this.configSet = configSetFrom(this.host.value, this.t('initialConfig'));
          this.draft = projectConfigSet(this.configSet);
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
        if (!this.dirty || !this.editable() || this.conflicted || this.autosavePaused || this.composing || !this.draftComplete()) return;
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
      edit(update, target = 'preset') {
        if (!this.editable()) return false;
        if (target === 'pool') {
          const next = clone(this.configSet); update(next); this.configSet = next;
        } else {
          const next = clone(this.draft); update(next); this.draft = next;
        }
        this.editRevision++; this.dirty = true; this.saved = false;
        if (!this.autosavePaused) { this.savedButNotLive = false; this.error = ''; }
        this.scheduleAutosave(); this.publish(); return true;
      }
      editPool(update) { return this.edit(next => update(next.candidates), 'pool'); }
      viewToken() { return stable([this.generation, this.baseRevision, this.configSet.activeConfigId]); }
      matchesView(token, requireWritable = true) {
        const current = this.form.getSnapshot();
        const activeId = value => isConfigSet(value?.ui) ? value.ui.activeConfigId : 'config-1';
        if (this.disposed || token !== this.viewToken()) return false;
        if (!requireWritable) return true;
        return current.revision === this.baseRevision && activeId(current.value) === activeId(this.host.value) &&
          current.status === 'ready' && current.writable && !invalidSource(current.value) && !invalidSource(current.user);
      }
      configurationSet() { return this.storedDraft(); }
      storedDraft() {
        const next = clone(this.configSet);
        next.enabled = this.draft.enabled; next.limits = clone(this.draft.limits);
        const current = next.configs.find(item => item.id === next.activeConfigId);
        current.candidates = clone(this.draft.candidates);
        if (this.draft.defaultCandidateId === undefined) delete current.defaultCandidateId; else current.defaultCandidateId = this.draft.defaultCandidateId;
        return next;
      }
      draftComplete() {
        return validDraft(this.draft) && validDraft({ ...emptyDraft(), candidates: this.configSet.candidates });
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
          const candidates = clone(source.candidates);
          if (!copyCurrent) for (const candidate of candidates) candidate.description = '';
          next.configs.push({ id, name: configName(name), ...(source.defaultCandidateId === undefined ? {} : { defaultCandidateId: source.defaultCandidateId }), candidates });
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
          const target = next.configs.find(row => row.id === id);
          if (!target || id === next.activeConfigId) return false;
          if (next.enabled && !target.defaultCandidateId) { this.error = this.t('switchNeedsDefault'); this.publish(); return false; }
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
        const targets = uniquePoolRoutes(this.configSet.candidates);
        const mappedIds = new Map();
        const candidates = [];
        for (const generated of result.candidates) {
          const target = targets.get(routeKey(generated));
          if (!target) { this.error = this.t('draftPoolMismatch'); this.publish(); return false; }
          mappedIds.set(generated.id, target.id);
          candidates.push({ ...clone(generated), id: target.id });
        }
        const next = { ...clone(this.draft), candidates, defaultCandidateId: mappedIds.get(result.defaultCandidateId) };
        if (!validDraft(next) || !next.candidates.length || !next.candidates.some(row => row.id === next.defaultCandidateId)) return false;
        this.cancelAutosave(); this.generatedLock = undefined;
        this.editRevision++; this.draft = next; this.dirty = true; this.saved = false;
        return await this.save();
      }
      candidateRows(target = 'preset') { return target === 'pool' ? this.configSet.candidates : this.draft.candidates; }
      addCandidate(target = 'preset') {
        const rows = this.candidateRows(target);
        if (rows.length >= 128) return false;
        const persisted = configSetFrom(this.host.value, this.t('initialConfig'));
        const original = target === 'pool' ? persisted.candidates : persisted.configs.find(config => config.id === this.configSet.activeConfigId)?.candidates ?? [];
        const reserved = new Set([...rows, ...original].map(candidate => candidate.id));
        let index = 1; while (reserved.has('candidate-' + index)) index++;
        // Empty model/effort deliberately block autosave until explicitly selected.
        return this.edit(next => next.candidates.push({ id: 'candidate-' + index, name: '', provider: '', model: '', effort: '', description: '' }), target);
      }
      removeCandidate(id, target = 'preset') {
        if (!this.candidateRows(target).some(row => row.id === id)) return false;
        return this.edit(next => { next.candidates = next.candidates.filter(row => row.id !== id); }, target);
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
        // also be legitimate sources; outer illegal keys keep the save not-live.
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
        if (!this.editable() || !this.draftComplete() || !validConfigSets(this.storedDraft())) { this.error = this.t('invalidDraft'); this.publish(); return false; }
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
    function uniquePoolRoutes(rows) {
      const routes = new Map();
      for (const row of rows) {
        const key = routeKey(row);
        routes.set(key, routes.has(key) ? null : row);
      }
      return routes;
    }
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
        this.snapshot = { input: clone(this.input), draft: clone(this.draft), before: clone(this.before), target: this.target, warnings: [...this.warnings],
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
      scopeCounts() {
        const counts = new Map();
        for (const row of this.editor.candidateRows('pool')) counts.set(routeKey(row), (counts.get(routeKey(row)) ?? 0) + 1);
        return counts;
      }
      scopeAllowed(route, counts = this.scopeCounts()) { return counts.get(routeKey(route)) === 1 && this.routeAllowed(route); }
      inputsValid() {
        const { generator, scope, requirements } = this.input;
        const counts = this.scopeCounts();
        return this.routeAllowed(generator) && Array.isArray(scope) && scope.length > 0 && scope.length <= 128 &&
          scope.every(route => this.scopeAllowed(route, counts)) && new Set(scope.map(routeKey)).size === scope.length &&
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
        const counts = this.scopeCounts();
        if (!Array.isArray(routes) || routes.length > 128 || !routes.every(route => this.scopeAllowed(route, counts)) || new Set(routes.map(routeKey)).size !== routes.length) return false;
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
        const editorState = this.editor.getSnapshot();
        this.target = { id: editorState.configSet.activeConfigId };
        this.baseline = baseline; this.before = clone(editorState.draft);
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

    // Inherit DSH colors and typography inside the settings slot.
    const BORDER = '1px solid var(--dsw-alias-border-secondary, #777)';
    const SURFACE = 'color-mix(in srgb, currentColor 4%, transparent)';
    const ACTIVE = 'color-mix(in srgb, currentColor 10%, transparent)';
    const mutedStyle = { margin: 0, fontSize: 13, lineHeight: 1.6, color: 'color-mix(in srgb, currentColor 75%, var(--dsw-alias-background-primary, transparent))', overflowWrap: 'anywhere' };
    const paragraphStyle = { ...mutedStyle, margin: '8px 0' };
    const fieldStyle = { display: 'grid', gap: 4, minWidth: 0 };
    const inputStyle = { width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: BORDER, color: 'inherit', background: 'var(--dsw-alias-background-primary, transparent)', font: 'inherit', lineHeight: 1.4 };
    const buttonStyle = { ...inputStyle, width: 'auto', cursor: 'pointer', fontWeight: 500 };
    const primaryStyle = { ...buttonStyle, background: 'var(--dsw-alias-label-primary, #17212d)', color: 'var(--dsw-alias-background-primary, #fff)' };
    const badgeStyle = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: ACTIVE, fontSize: 12, lineHeight: 1.6, fontWeight: 600 };
    const cardStyle = { minWidth: 0, border: BORDER, borderRadius: 12, padding: 16 };
    const rowStyle = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 };
    const stackStyle = { display: 'grid', alignContent: 'start', gap: 12, minWidth: 0 };
    const headingStyle = { margin: 0, fontSize: 16, lineHeight: 1.3, fontWeight: 650 };
    const summaryStyle = { minHeight: 44, boxSizing: 'border-box', padding: '10px 12px', cursor: 'pointer', fontWeight: 600, overflowWrap: 'anywhere' };
    const autoGrid = min => ({ display: 'grid', minWidth: 0, gridTemplateColumns: 'repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr))', gap: 12, alignItems: 'start' });
    const disclosure = (title, body, props = {}) => h('details', { style: { border: BORDER, borderRadius: 8, minWidth: 0 }, ...props },
      h('summary', { style: summaryStyle }, title), h('div', { style: { ...stackStyle, padding: '0 12px 12px' } }, ...(Array.isArray(body) ? body : [body])));
    const profileLabel = (row, t) => [row.provider, row.model, row.effort === null ? t('defaultCandidateNoEffort') : row.effort].filter(Boolean).join(' / ');
    const note = (text, props) => h('p', { style: mutedStyle, ...props }, text);
    const checkStyle = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, cursor: 'pointer' };
    const checkboxStyle = { width: 24, height: 24, flex: '0 0 auto', margin: 0 };
    const panelHeading = (title, scope, help, focusRef) => h('header', { style: { ...stackStyle, gap: 4 } },
      h('div', { style: rowStyle }, h('h3', { style: headingStyle, ref: focusRef, tabIndex: focusRef ? -1 : undefined }, title), scope ? h('span', { style: badgeStyle }, scope) : null), note(help));
    // Open a newly added row on mount; leave the native disclosure state alone
    // when selecting its model or when autosave refreshes the settings mirror.
    const openNewProfile = node => { if (node) node.open = true; };
    function CatalogPanel({ catalog, blocked, t }) {
      const state = React.useSyncExternalStore(catalog?.subscribe ?? (() => () => {}), catalog?.getSnapshot ?? (() => emptyCatalog), catalog?.getSnapshot ?? (() => emptyCatalog));
      const count = state.groups.reduce((total, group) => total + group.models.length, 0);
      return h('section', { 'data-model-catalog': true, style: { minWidth: 0 } },
        h('div', { style: { ...rowStyle, justifyContent: 'space-between' } },
          h('span', { role: 'status', 'aria-live': 'polite', style: { ...mutedStyle, flex: '1 1 240px' } }, state.status === 'ready' ? t('catalogReady') + ' · ' + state.groups.length + ' ' + t('providers') + ' / ' + count + ' ' + t('models') + (state.loadedAt ? ' · ' + new Date(state.loadedAt).toLocaleTimeString() : '') : state.status === 'loading' ? t('catalogLoading') : ''),
          h('button', { type: 'button', style: buttonStyle, disabled: blocked || !catalog || state.status === 'loading', onClick: () => { if (!blocked) return catalog?.load(); } }, t(state.status === 'loading' ? 'catalogLoading' : 'catalogRefresh'))),
        state.status === 'error' ? h('p', { role: 'alert', style: paragraphStyle }, t('catalogFailed') + ' ' + (state.errorCode === 'catalog/timeout' ? t('catalogTimeout') : state.error)) : null,
        state.failures.length ? h('div', { role: 'alert' }, h('p', { style: paragraphStyle }, t('catalogPartial')), h('ul', null, state.failures.map(failure => h('li', { key: failure.id, style: { overflowWrap: 'anywhere' } }, failure.name + ' (' + failure.id + '): ' + failure.message)))) : null,
        state.status === 'ready' && count === 0 ? h('p', { role: 'status' }, t('catalogEmpty')) : null);
    }
    function DraftWizard({ generator, editor, catalog, t, goToPool }) {
      const state = React.useSyncExternalStore(generator.subscribe, generator.getSnapshot, generator.getSnapshot);
      const editorState = React.useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
      const catalogState = React.useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot);
      const [scopeSearch, setScopeSearch] = React.useState('');
      const active = editorState.configSet.configs.find(row => row.id === editorState.configSet.activeConfigId);
      const sameTarget = state.target?.id === active.id;
      const review = !!state.draft && sameTarget;
      const reviewHeading = React.useRef(null);
      const [reviewRequested, setReviewRequested] = React.useState(false);
      React.useEffect(() => {
        if (!reviewRequested) return;
        setReviewRequested(false);
        const heading = reviewHeading.current;
        // The request can finish after the user changes tabs or closes settings.
        // Do not steal focus from a different view.
        if (review && state.status === 'ready' && heading && !heading.closest('[hidden]')) {
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ block: 'nearest' });
        }
      }, [reviewRequested, review, state.status]);
      const blocked = state.busy || !editor.editable(generator) || editorState.dirty || editorState.autosavePaused || editorState.savedButNotLive;
      const viewToken = editor.viewToken();
      const guarded = action => (...args) => editor.matchesView(viewToken) && action(...args);
      const button = (key, action, disabled = false, primary = false) => h('button', { type: 'button', style: primary ? primaryStyle : buttonStyle, disabled, onClick: guarded(action) }, t(key));
      const label = (key, child) => h('label', { style: fieldStyle }, h('span', null, t(key)), child);
      const route = state.input.generator;
      const model = route && catalog.find(route.provider, route.model);
      const efforts = catalogEfforts(model, t);
      const currentModelKey = route ? modelKey(route) : '';
      const scope = new Set(state.input.scope.map(routeKey));
      const counts = generator.scopeCounts();
      const scopeAllowed = tuple => generator.scopeAllowed(tuple, counts);
      const missingScope = state.input.scope.some(tuple => !scopeAllowed(tuple));
      const query = scopeSearch.trim().toLowerCase();
      const matches = text => text.toLowerCase().includes(query);
      const scopeOption = (title, tuple) => h('label', { key: routeKey(tuple), style: { ...checkStyle, overflowWrap: 'anywhere' } },
        h('input', { type: 'checkbox', style: checkboxStyle, disabled: state.busy || !scopeAllowed(tuple) || scope.size >= 128 && !scope.has(routeKey(tuple)),
          checked: scope.has(routeKey(tuple)), onChange: guarded(event => generator.toggleScope(tuple, event.target.checked)) }), h('span', null, title));
      const poolScope = editorState.configSet.candidates.filter(row => scopeAllowed(routeOnly(row)));
      const options = poolScope.filter(row => matches((row.name || row.id) + ' ' + profileLabel(row, t)))
        .map(row => scopeOption((row.name || row.id) + ' · ' + profileLabel(row, t), routeOnly(row)));
      const invalidInputs = missingScope || !generator.inputsValid();
      const inputs = h('div', { style: stackStyle },
        h('div', { style: { ...stackStyle, gap: 8 } }, h('h4', { style: headingStyle }, t('draftGenerator')), note(t('draftGeneratorHelp')),
          h('div', { style: autoGrid(180) },
            label('chooseModel', h('select', { style: inputStyle, 'aria-label': t('draftGenerator'), disabled: state.busy || catalogState.status !== 'ready', value: currentModelKey, onChange: guarded(event => generator.selectGenerator(event.target.value)) },
              h('option', { value: '', disabled: true }, t('chooseModel')),
              route && !model ? h('option', { value: currentModelKey, disabled: true }, profileLabel(route, t)) : null,
              catalogState.groups.map(group => h('optgroup', { key: group.id, label: group.name + ' (' + group.id + ')', disabled: catalogState.failures.some(failure => failure.id === group.id) },
                group.models.map(item => h('option', { key: item.id, value: modelKey({ provider: group.id, model: item.id }), title: group.id + ' / ' + item.id }, item.name || item.id)))))),
            label('draftGeneratorEffort', h('select', { style: inputStyle, 'aria-label': t('draftGeneratorEffort'), disabled: state.busy || !model, value: route && route.effort !== '' ? effortKey(route.effort) : '',
              onChange: guarded(event => { const option = efforts.find(item => effortKey(item.id) === event.target.value); if (option) generator.setGeneratorEffort(option.id); }) },
              h('option', { value: '', disabled: true }, t('chooseEffort')),
              route && route.effort !== '' && !efforts.some(item => item.id === route.effort) ? h('option', { value: effortKey(route.effort), disabled: true }, String(route.effort) + ' — ' + t('catalogUnverified')) : null,
              efforts.map(item => h('option', { key: effortKey(item.id), value: effortKey(item.id) }, item.name + (item.id === null ? '' : ' (' + item.id + ')')))))),
          h(CatalogPanel, { catalog, blocked: state.busy, t })),
        disclosure(t('draftScope') + ' · ' + scope.size + '/128', [
          note(t('draftPoolScope')),
          [...counts.values()].some(count => count > 1) ? note(t('draftDuplicateScope')) : null,
          h('input', { type: 'search', style: inputStyle, 'aria-label': t('scopeSearch'), placeholder: t('scopeSearch'), value: scopeSearch, disabled: state.busy, onChange: event => setScopeSearch(event.target.value) }),
          options.length ? h('div', { role: 'region', 'aria-label': t('draftScope'), tabIndex: 0, style: { maxHeight: 260, overflowY: 'auto' } }, options) : note(t('draftNoMatches')),
          scope.size && !missingScope ? h('div', null, button('draftClearScope', () => generator.setScope([]), state.busy)) : null
        ]),
        catalogState.status === 'ready' && !poolScope.length ? h('div', { style: stackStyle }, note(t('draftPoolEmpty')), goToPool ? h('div', null, button('availableModels', goToPool)) : null) : null,
        missingScope ? h('div', { style: stackStyle, role: 'status' }, note(t('draftScopeChanged')), h('div', null, button('draftClearScope', () => generator.setScope([]), state.busy))) : null,
        label('draftRequirements', h('textarea', { style: { ...inputStyle, minHeight: 96, resize: 'vertical' }, 'aria-label': t('draftRequirements'), maxLength: 8000, value: state.input.requirements, disabled: state.busy, onChange: guarded(event => generator.setRequirements(event.target.value)) })),
        note(t('draftCost')),
        h('div', { style: rowStyle }, button('draftGenerate', async () => {
          if (blocked || !state.available || invalidInputs) return false;
          const completed = await generator.generate();
          if (completed) setReviewRequested(true);
          return completed;
        }, blocked || !state.available || invalidInputs, !review)),
        !blocked && invalidInputs ? note(t('draftInputRequired'), { role: 'status' }) : null);
      const statusKey = { idle: 'draftIdle', generating: 'draftGenerating', ready: 'draftReady', validating: 'draftValidating', applying: 'draftApplying', applied: 'draftApplied', error: 'draftFailed', stale: 'draftStale', conflict: 'draftConflict', cancelled: 'draftCancelled' }[state.status];
      const canEdit = !blocked && generator.editableDraft();
      const targets = uniquePoolRoutes(editorState.configSet.candidates);
      const previous = state.before?.candidates ?? [];
      const beforeById = new Map(previous.map(row => [row.id, row]));
      const retainedByDraftId = new Map();
      for (const row of state.draft?.candidates ?? []) {
        const route = routeKey(row), old = beforeById.get(targets.get(route)?.id);
        if (old && routeKey(old) === route) retainedByDraftId.set(row.id, old);
      }
      const draftField = (key, row, field, maxLength) => label(key, h(field === 'description' ? 'textarea' : 'input', {
        style: field === 'description' ? { ...inputStyle, resize: 'vertical' } : inputStyle,
        ...(field === 'description' ? { rows: 4 } : {}), 'aria-label': t(key) + ' · ' + row.id, value: row[field] ?? '', maxLength, disabled: !canEdit,
        onChange: guarded(event => generator.editCandidate(row.id, { [field]: event.target.value })) }));
      const beforeDefault = state.before?.candidates.find(row => row.id === state.before.defaultCandidateId);
      const retainedIds = new Set([...retainedByDraftId.values()].map(row => row.id));
      const removedRoutes = previous.filter(row => !retainedIds.has(row.id));
      const reviewBody = review ? h('div', { 'data-draft-review': true, style: stackStyle },
        note(t('draftBeforeDefault') + '：' + (beforeDefault?.name ?? '—')),
        h('div', { style: stackStyle }, state.draft.candidates.map(row => {
          const previous = retainedByDraftId.get(row.id);
          return h('article', { key: row.id, style: { ...cardStyle, ...stackStyle, overflowWrap: 'anywhere' } },
            h('div', { style: rowStyle }, h('strong', null, profileLabel(row, t)), row.id === state.draft.defaultCandidateId ? h('span', { style: badgeStyle }, t('draftNewDefault')) : null),
            h('div', { style: autoGrid(210) },
              h('div', { style: { ...stackStyle, gap: 4, background: SURFACE, borderRadius: 8, padding: 12 } },
                note(t('draftBefore')), previous ? h(React.Fragment, null, h('strong', null, previous.name), note(previous.description || t('draftNoDescription'))) : note(t('draftNewRole'))),
              h('div', { style: stackStyle }, note(t(state.status === 'applied' ? 'draftApplied' : state.applyAttempted ? 'draftSaveUnverified' : 'draftAfter')),
                draftField('draftName', row, 'name', 120), draftField('draftDescription', row, 'description', 1000))),
            canEdit ? h('div', null, button('draftRemove', () => generator.removeCandidate(row.id))) : null);
        })),
        note(t('draftNoChanges')),
        removedRoutes.length ? disclosure(t('draftRemovedRoutes') + ' · ' + removedRoutes.length, h('ul', { style: { margin: 0, overflowWrap: 'anywhere' } },
          removedRoutes.map(row => h('li', { key: row.id }, row.name + ' · ' + profileLabel(row, t)))), { open: true }) : null,
        label('draftDefault', h('select', { style: inputStyle, 'aria-label': t('draftDefault'), value: state.draft.defaultCandidateId ?? '', disabled: !canEdit, onChange: guarded(event => generator.setDefault(event.target.value)) },
          h('option', { value: '', disabled: true }, t('draftChooseDefault')), state.draft.candidates.map(row => h('option', { key: row.id, value: row.id }, row.name + ' — ' + profileLabel(row, t))))),
        h('label', { style: { ...checkStyle, alignItems: 'start', padding: '8px 0', boxSizing: 'border-box' } },
          h('input', { type: 'checkbox', style: checkboxStyle, 'aria-label': t('draftConfirmPreset'), checked: state.confirmed, disabled: !canEdit, onChange: guarded(event => generator.confirm(event.target.checked)) }), t('draftConfirmPreset')),
        h('div', null, button('draftApply', () => generator.validateAndApply(), !canEdit || !state.available || missingScope || !generator.canApply(), true))) : null;
      return h('section', { 'data-draft-generator': true, style: stackStyle },
        panelHeading(t(review ? 'draftReview' : 'draftTab'), t('presetScope'), t('draftPresetIntro'), review ? reviewHeading : undefined),
        h('div', { style: { ...rowStyle, overflowWrap: 'anywhere' } }, note(t('draftTarget')), h('strong', null, active.name)),
        !state.available ? note(t('draftUnavailable'), { role: 'status' }) : null,
        blocked && !state.busy ? note(t('draftProtected'), { role: 'status' }) : null,
        state.status !== 'idle' && (sameTarget || state.status !== 'applied') ? h('div', { style: { ...rowStyle, background: SURFACE, borderRadius: 8, padding: '8px 12px' } }, h('strong', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, t(statusKey)),
          state.busy && state.status !== 'applying' ? button('draftCancel', () => generator.cancel()) : null) : null,
        state.error && state.error !== t(statusKey) ? note(state.error, { role: 'alert' }) : null,
        review && state.warnings.length ? disclosure(t('draftWarnings') + ' · ' + state.warnings.length, h('ul', { style: { margin: 0, overflowWrap: 'anywhere' } }, state.warnings.map((warning, index) => h('li', { key: index }, warning)))) : null,
        review ? disclosure(t('draftInputSettings'), inputs) : inputs,
        reviewBody);
    }

    function ConfigSetsPanel({ editor, state, t }) {
      const [name, setName] = React.useState('');
      const [deleteId, setDeleteId] = React.useState(undefined);
      const viewToken = editor.viewToken();
      const sets = state.configSet, blocked = !state.canManageConfigs;
      const active = sets.configs.find(row => row.id === sets.activeConfigId);
      const validNew = editor.availableConfigName(name), validRename = editor.availableConfigName(name, sets.activeConfigId);
      const button = (key, action, off = blocked) => h('button', { type: 'button', style: buttonStyle, disabled: off, onClick: () => editor.matchesView(viewToken) && action() }, t(key));
      const act = async operation => { if (!editor.matchesView(viewToken)) return; if (await operation()) { setName(''); setDeleteId(undefined); } };
      return h('section', { 'data-config-sets': true, style: { ...cardStyle, background: SURFACE }, 'aria-label': t('configSets') },
        h('label', { style: fieldStyle }, h('span', null, t('activeConfig')),
          h('select', { style: inputStyle, 'aria-label': t('activeConfig'), value: sets.activeConfigId, disabled: blocked, onChange: event => { setDeleteId(undefined); if (editor.matchesView(viewToken)) void editor.switchConfig(event.target.value); } },
            sets.configs.map(row => h('option', { key: row.id, value: row.id }, row.name)))),
        disclosure(t('managePresetOps') + ' · ' + sets.configs.length + '/32', [
          note(t('configSwitchHelp')),
          blocked ? note(t('configSetProtected'), { role: 'status' }) : null,
          h('label', { style: fieldStyle }, h('span', null, t('configName')),
            h('input', { style: inputStyle, 'aria-label': t('configName'), maxLength: 120, value: name, disabled: blocked, placeholder: t('configNameHint'), onChange: event => setName(event.target.value) })),
          name && !validRename ? h('p', { role: 'alert' }, t('invalidConfigName')) : null,
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 } },
            button('newConfig', () => act(() => editor.createConfig(name)), blocked || !validNew || sets.configs.length >= 32),
            button('copyConfig', () => act(() => editor.createConfig(name, true)), blocked || !validNew || sets.configs.length >= 32),
            button('renameConfig', () => act(() => editor.renameConfig(name)), blocked || !validRename || configName(name) === active?.name)),
          h('p', { style: paragraphStyle }, t('configSetLimit')),
          h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, sets.configs.map(row => h('li', { key: row.id, style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-secondary, #777)' } },
            h('span', { style: { flex: '1 1 200px', minWidth: 0, overflowWrap: 'anywhere' } }, row.name),
            row.id === sets.activeConfigId ? h('span', { 'data-active-preset': true }, t('configActiveBadge')) : h('button', { type: 'button', style: buttonStyle, disabled: blocked, 'aria-label': t('deleteConfig') + ' ' + row.name, onClick: () => { if (editor.matchesView(viewToken)) setDeleteId(row.id); } }, t('deleteConfig'))))),
          deleteId && sets.configs.some(row => row.id === deleteId && row.id !== sets.activeConfigId) ? h('div', { role: 'group', 'aria-label': t('confirmDeleteConfig'), style: { marginTop: 16 } },
            h('p', { role: 'alert', style: paragraphStyle }, t('deleteConfigWarning') + ' ' + sets.configs.find(row => row.id === deleteId).name),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, button('confirmDeleteConfig', () => act(() => editor.deleteConfig(deleteId, true))), button('cancelDeleteConfig', () => setDeleteId(undefined), false))) : null]));
    }

    const noopSubscribe = () => () => {};
    const noDraftSnapshot = () => null;
    const noCatalogSnapshot = () => emptyCatalog;
    function RouterPage({ editor, catalog, generator, t, view }) {
      const state = React.useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
      const catalogState = React.useSyncExternalStore(catalog?.subscribe ?? noopSubscribe, catalog?.getSnapshot ?? noCatalogSnapshot, catalog?.getSnapshot ?? noCatalogSnapshot);
      const generation = React.useSyncExternalStore(generator?.subscribe ?? noopSubscribe, generator?.getSnapshot ?? noDraftSnapshot, generator?.getSnapshot ?? noDraftSnapshot);
      const [panel, setPanel] = React.useState('details');
      if (view === 'summary') return h('span', null, t('summary'));
      const ui = state.draft ?? emptyDraft();
      const busy = state.generatedBusy || state.status !== 'ready' || !state.writable || state.saving || state.reloading || state.connectionReset || state.receiptUnverified || state.invalidSource;
      const disabled = busy || state.conflicted;
      const viewToken = editor.viewToken();
      const edit = update => editor.matchesView(viewToken) && editor.edit(update);
      const button = (key, action, off = false, primary = false) => h('button', { type: 'button', style: primary ? primaryStyle : buttonStyle, disabled: off, onClick: action }, t(key));
      const input = (key, value, set, type = 'text', off = disabled, maxLength) => h('label', { style: type === 'checkbox' ? { ...checkStyle, flexDirection: 'row-reverse', justifyContent: 'start' } : fieldStyle }, h('span', null, t(key)), h('input', { style: type === 'checkbox' ? checkboxStyle : inputStyle, 'aria-label': t(key), type, disabled: off, maxLength, onCompositionStart: () => editor.matchesView(viewToken) && editor.setComposing(true), onCompositionEnd: () => editor.matchesView(viewToken) && editor.setComposing(false), ...(type === 'checkbox' ? { checked: !!value } : { value: value ?? '' }), onChange: event => set(type === 'checkbox' ? event.target.checked : type === 'number' ? Number(event.target.value) : event.target.value) }));
      const group = (title, children) => h('fieldset', { style: { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-secondary, #777)', borderRadius: 8, padding: 16, margin: '16px 0' } }, h('legend', { style: { maxWidth: '100%', overflowWrap: 'anywhere' } }, title), ...children);
      const grid = children => h('div', { style: autoGrid(200) }, ...children);
      const json = value => h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' } }, JSON.stringify(value, null, 2));
      const defaultOptions = ui.candidates.filter(candidate => candidate.id && ui.candidates.filter(other => other.id === candidate.id).length === 1);
      const defaultPicker = h('label', { style: fieldStyle }, h('span', null, t('defaultCandidate')),
        h('select', { style: inputStyle, 'aria-label': t('defaultCandidate'), value: ui.defaultCandidateId ?? '', disabled: disabled || !defaultOptions.length && (ui.enabled || !ui.defaultCandidateId), onChange: event => {
          const id = event.target.value, draft = editor.getSnapshot().draft;
          if (id === (draft.defaultCandidateId ?? '')) return;
          if (id === '' && !draft.enabled) edit(next => { delete next.defaultCandidateId; });
          else if (id && draft.candidates.filter(candidate => candidate.id === id).length === 1) edit(next => { next.defaultCandidateId = id; });
        } },
          h('option', { value: '', disabled: !!ui.enabled }, t(defaultOptions.length ? 'chooseDefault' : 'defaultCandidateEmpty')),
          ui.defaultCandidateId && !defaultOptions.some(candidate => candidate.id === ui.defaultCandidateId) ? h('option', { value: ui.defaultCandidateId, disabled: true }, ui.defaultCandidateId) : null,
          defaultOptions.map(candidate => h('option', { key: candidate.id, value: candidate.id },
            (candidate.name || candidate.id) + (candidate.provider && candidate.model ? ' — ' + candidate.provider + ' / ' + candidate.model + (candidate.effort === undefined || candidate.effort === '' ? '' : ' · ' + (candidate.effort === null ? t('defaultCandidateNoEffort') : candidate.effort)) : '')))),
        defaultOptions.length ? h('span', { style: mutedStyle }, t('defaultCandidateHelp')) : null);
      const activeId = state.configSet.activeConfigId;
      const modelOptions = catalogState.groups.map(provider => h('optgroup', {
        key: provider.id, label: provider.name + ' (' + provider.id + ')', disabled: catalogState.failures.some(failure => failure.id === provider.id)
      }, provider.models.map(item => h('option', { key: item.id, value: modelKey({ provider: provider.id, model: item.id }) }, item.name === item.id ? item.id : item.name + ' — ' + item.id))));
      const profileRows = (rows, target) => rows.map((candidate, index) => {
        const inPool = target === 'pool';
        const set = (key, value) => editor.matchesView(viewToken) && editor.candidateRows(target)[index]?.id === candidate.id &&
          editor.edit(next => { next.candidates[index][key] = value; }, target);
        const current = catalog?.find(candidate.provider, candidate.model);
        const options = catalogEfforts(current, t);
        const known = options.some(option => option.id === candidate.effort);
        const failed = catalogState.failures.some(failure => failure.id === candidate.provider);
        const missing = !current && !!candidate.provider && !!candidate.model;
        const modelPicker = h('label', { style: fieldStyle }, h('span', null, t('chooseModel')),
          h('select', { style: inputStyle, 'aria-label': t('chooseModel'), disabled: disabled || catalogState.status !== 'ready', value: candidate.provider && candidate.model ? modelKey(candidate) : '', onChange: event => catalog?.select(editor, index, event.target.value, candidate, viewToken, target) },
            !candidate.provider && !candidate.model ? h('option', { value: '', disabled: true }, t('chooseModel')) : null,
            missing ? h('option', { value: modelKey(candidate), disabled: true }, candidate.provider + ' / ' + candidate.model) : null,
            modelOptions),
          candidate.provider && candidate.model ? h('code', { style: { overflowWrap: 'anywhere', whiteSpace: 'normal' } }, candidate.provider + ' / ' + candidate.model) : null,
          missing ? h('span', { role: 'status' }, t(catalogState.status === 'ready' && !failed ? 'catalogMissing' : 'catalogUnverified')) : null);
        const effortPicker = h('label', { style: fieldStyle }, h('span', null, t('effort')),
          h('select', { style: inputStyle, 'aria-label': t('effort'), value: candidate.effort === '' || candidate.effort === undefined ? '' : effortKey(candidate.effort), disabled: disabled || !current, onChange: event => catalog?.setEffort(editor, index, event.target.value, candidate, viewToken, target) },
            h('option', { value: '', disabled: true }, t('chooseEffort')),
            !known && candidate.effort !== '' && candidate.effort !== undefined ? h('option', { value: effortKey(candidate.effort), disabled: true }, String(candidate.effort) + ' — ' + t('unknownEffort')) : null,
            options.map(option => h('option', { key: effortKey(option.id), value: effortKey(option.id) }, option.name + (option.id === null ? '' : ' (' + option.id + ')')))),
          candidate.effort === '' || candidate.effort === undefined ? h('span', { role: 'status' }, t('effortRequired')) : null,
          options.some(option => option.id === null) ? h('span', { role: 'status' }, t('noReasoning')) : null);
        const isDefault = !inPool && candidate.id === ui.defaultCandidateId;
        const title = candidate.name || t(inPool ? 'addPoolCandidate' : 'addCandidate');
        const label = h('span', { style: { overflowWrap: 'anywhere' } }, h('strong', null, title), ' · ', profileLabel(candidate, t) || t('chooseModel'),
          isDefault ? h('span', { style: { ...badgeStyle, marginInlineStart: 8 } }, t('presetDefaultBadge')) : null);
        const remove = () => editor.matchesView(viewToken) && editor.removeCandidate(candidate.id, target);
        return disclosure(label, [
          grid([modelPicker, effortPicker]),
          input(inPool ? 'poolName' : 'name', candidate.name, value => set('name', value), 'text', disabled, 120),
          !inPool ? input('description', candidate.description, value => set('description', value), 'text', disabled, 1000) : null,
          h('code', { 'aria-label': t('id'), style: { ...mutedStyle, whiteSpace: 'normal' } }, t('id') + ': ' + candidate.id),
          h('div', null, button('remove', remove, disabled)), isDefault ? note(t('removeDefaultHelp')) : null
        ], { key: (inPool ? 'pool:' : activeId + ':') + candidate.id, ref: candidate.model ? undefined : openNewProfile,
          [inPool ? 'data-pool-candidate' : 'data-candidate']: candidate.id });
      });
      const pool = state.configSet.candidates;
      const poolRows = profileRows(pool, 'pool'), presetRows = profileRows(ui.candidates, 'preset');
      const panelProps = key => ({ 'data-workspace-panel': key, hidden: panel !== key, style: { ...cardStyle, display: panel === key ? undefined : 'none' } });
      const queuedDraft = generation?.status === 'ready' && generation.target?.id === activeId;
      const availablePanels = [['details', 'presetDetails'], ['pool', 'availableModels'], ...(generator && catalog ? [['draft', 'draftTab']] : [])];
      const needsReload = state.dirty && !state.receiptUnverified || state.connectionReset;
      const saveStatus = state.saving ? 'saving' : state.savedButNotLive ? 'savedButNotLive' : state.error || state.conflicted ? 'autosaveFailed' : state.dirty ? editor.draftComplete() ? 'autosavePending' : 'autosaveIncomplete' : state.saved ? 'saved' : 'autosave';
      return h('section', { 'data-router-workspace': true, style: { ...stackStyle, gap: 12, color: 'var(--dsw-alias-label-primary, inherit)', padding: '12px 0', maxWidth: '100%', lineHeight: 1.55, fontSize: 14 } },
        h('style', null, `
          [data-router-workspace] details:not([open]) > div { display: none; }
          [data-router-workspace] [data-config-sets] { display: flex; gap: 8px; flex-wrap: wrap; align-items: end; }
          [data-router-workspace] [data-config-sets] > label { flex: 1 1 200px; }
          [data-router-workspace] [data-config-sets] > details[open] { flex: 1 1 100%; }
          [data-router-workspace] [data-config-sets] :is(button,[data-active-preset]) { white-space: nowrap; }
          [data-router-workspace] :is(button,a,input,textarea,select,summary):focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
          [data-router-workspace] :is(button,input,textarea,select):disabled { opacity: .56; cursor: not-allowed; }
          [data-router-workspace] :is(button:not(:disabled),a):hover { box-shadow: inset 0 0 0 1px currentColor; }
          [data-router-workspace] summary:hover { background: color-mix(in srgb,currentColor 4%,transparent); }
          [data-router-workspace] [data-workspace-nav] { flex: 1 1 140px; }
        `),
        h('header', null, h('h2', { style: { ...headingStyle, fontSize: 20, marginBottom: 4 } }, t('title')), note(t('workspaceIntro'))),
        state.status !== 'ready' ? note(t(state.status === 'loading' ? 'loading' : 'unavailable'), { role: 'status' }) : null,
        state.status === 'ready' && !state.writable ? note(t('readOnly'), { role: 'status' }) : null,
        state.invalidSource ? group(t('invalidSourceTitle'), [note(t('invalidSource'), { role: 'alert' }), disclosure(t('originalConfiguration'), json(state.invalidOriginal))]) : null,
        h(ConfigSetsPanel, { editor, state, t }),
        h('div', { 'data-autosave': true, style: { ...stackStyle, gap: 4, borderBottom: BORDER, paddingBottom: 8 } },
          h('div', { style: { ...rowStyle, justifyContent: 'space-between' } },
            note(t(saveStatus), { role: 'status', 'aria-label': t('workspaceStatus'), 'aria-live': 'polite', 'aria-atomic': true }),
            h('div', { style: rowStyle },
              state.error && state.dirty && !state.receiptUnverified && !state.connectionReset && !state.conflicted ? button('retry', () => editor.matchesView(viewToken) && editor.save(), disabled || !editor.draftComplete()) : null,
              button(needsReload ? 'cancel' : 'refresh', () => editor.matchesView(viewToken, false) && editor.reload(), state.saving || state.reloading || state.generatedBusy))),
          (state.receiptUnverified || state.savedButNotLive || state.error && state.dirty) ? note(t('configNotConfirmed'), { role: 'status' }) : null,
          state.conflicted ? note(t('conflict'), { role: 'alert' }) : null,
          state.error ? note(state.error, { role: 'alert' }) : null),
        h('nav', { 'aria-label': t('workspaceNav'), style: { ...rowStyle, alignItems: 'stretch' } }, availablePanels.map(([key, label]) =>
          h('button', { key, type: 'button', 'data-workspace-nav': key, 'aria-pressed': panel === key, style: {
            ...buttonStyle, background: panel === key ? ACTIVE : 'transparent', borderColor: panel === key ? 'currentColor' : 'transparent', fontWeight: panel === key ? 650 : 500
          }, onClick: () => setPanel(key) }, t(label), key === 'pool' && pool.length ? ' · ' + pool.length : null,
            key === 'draft' && queuedDraft ? h('span', { style: { ...badgeStyle, marginInlineStart: 8 } }, t('draftPendingBadge')) : null))),
        h('section', { ...panelProps('details'), 'aria-label': t('presetDetails') },
          h('div', { style: stackStyle, 'data-manual-editor': true }, panelHeading(t('presetDetails'), t('presetScope'), t('presetDetailsHelp')), defaultPicker,
            h(CatalogPanel, { catalog, blocked: state.generatedBusy, t }),
            h('div', { style: { ...rowStyle, justifyContent: 'space-between' } }, h('h4', { style: headingStyle }, t('candidates'), ' · ' + presetRows.length),
              button('addCandidate', () => editor.matchesView(viewToken) && editor.addCandidate(), disabled || presetRows.length >= 128, true)),
            presetRows.length ? presetRows : note(t('noCandidates')),
            disclosure(t('advanced'), [input('enabled', ui.enabled, value => edit(next => { next.enabled = value; }), 'checkbox'),
              group(t('limits'), [grid(['maxPendingStarts','maxActivePerModel','maxCreationsPerParent','metadataTimeoutMs'].map(key => input(key, ui.limits[key], value => edit(next => { next.limits[key] = value; }), 'number')))]),
              note(t('authority')), note(t('executionEvidence'))]))),
        h('section', { ...panelProps('pool'), 'data-shared-pool': true, 'aria-label': t('availableModels') },
          h('div', { style: stackStyle }, panelHeading(t('availableModels'), t('sharedScope'), t('sharedPoolHelp')),
            h(CatalogPanel, { catalog, blocked: state.generatedBusy, t }),
            h('div', { style: { ...rowStyle, justifyContent: 'space-between' } }, h('h4', { style: headingStyle }, t('poolProfiles'), ' · ' + poolRows.length),
              button('addPoolCandidate', () => editor.matchesView(viewToken) && editor.addCandidate('pool'), disabled || poolRows.length >= 128, true)),
            poolRows.length ? poolRows : note(t('poolEmpty')))),
        generator && catalog ? h('section', { ...panelProps('draft'), 'aria-label': t('draftTab') }, h(DraftWizard, { generator, editor, catalog, t, goToPool: () => setPanel('pool') })) : null);
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
    return { inject: ['slots', 'locale', 'configForms', 'remote', 'remote.settings', 'remote.session'], apply, draftRemoteDescriptors, catalogRemoteDescriptors, CatalogPanel, RouterEditor, RouterPage, DraftGenerator, DraftWizard, routeKey, ModelCatalog, normalizeCatalog, modelKey, catalogEfforts, effortKey, CATALOG_EVENTS, emptyDraft, projectConfigSet, validConfigSets, ConfigSetsPanel, configSetFrom, normalizeAckUi, validDraft, dictionaries: { zh, en } };
  }
});
