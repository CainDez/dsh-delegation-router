# 版本与兼容性 · 0.8.2

更新日期：2026-11-16。版本号相同不保证宿主内部 API 不变；离线检查不等于在线任务验收。

## 验证矩阵

| 组件 / 环境 | 范围 | 证据与限制 |
| --- | --- | --- |
| 插件 0.8.2 | 当前维护版本 | 修复新版 name-only 原生创建回执，保留 600ms 自动保存及既有安全边界 |
| DSH Desktop 0.2.2-rc.3 | 当前适配目标 | 基于实际安装包接口检查和隔离回归；不把合成派发当真实模型调用验收 |
| DSH Desktop 0.2.2-rc.1 | 历史兼容目标 | 保留旧 ID 型回执解析；未重新执行本版完整安装/在线验收 |
| DSH Desktop 0.2.2-rc.2 | 本版未重新完整验收 | 0.8.1 不兼容其 name-only 回执；不能用 rc.3 的检查替代 rc.2 认证 |
| 其它 DSH 版本 | 未验证 | 不声明最低兼容版本，不承诺未来版本自动兼容 |
| Node.js | 运行声明 >=22.15 | 测试使用 registerHooks，23.x 需 >=23.5；完整回归见[验证范围](<VALIDATION.md>) |
| 操作系统 | Windows | macOS / Linux 未做宿主安装及 GUI 验收 |

## 宿主依赖

peerDependencies 由 DSH 运行环境提供，并非独立应用依赖；optional 防止源码工具安装时自动拉取另一套宿主，不代表运行时可缺少。当前精确宿主代际以[包清单](<package.json>)为准，不放宽为任意未来版本。

| 包 | rc.3 安装包实值 |
| --- | --- |
| @deepseek-ai/cosmokit | 1.9.0 |
| @deepseek-ai/cordis | 4.1.0 |
| @deepseek-ai/schemastery | 3.19.0 |
| @deepseek-ai/dsh-tools | 0.2.2-rc.3 |
| @deepseek-ai/dsh-subagent | 0.2.2-rc.3 |
| zod | 4.6.6 |

## 0.8.2 回执适配

新版原生 subagent 输出为 kind:activation 与 name，不再公开 durable subagentId。插件不使用 resolveName 的单段 fallback，也不把 name 当 Session ID：

1. 派发前读取父会话 subagentCatalog，并生成本次专用 router- 随机名称交给原生工具。
2. 要求原生回执精确返回该名称；派发后目录必须唯一匹配一个此前不存在的真实子 ID。
3. 读取子会话 header，验证 id、origin:subagent 与精确 parentSession，验证完成才记录 accepted。
4. 对外返回 kind/name/childId；subagentId 保留为同一个经验证真实 ID 的兼容别名，绝不由 name 合成。
5. 缺失能力或输出契约不支持时在派发前拒绝；派发后身份缺失、歧义、目录失败等均 unknown，不重放任务。

创建仍走 ToolExecutionPipeline.prepare / dispatch / complete；prepare 后重检同一原生工具定义与输出契约，不直接 execute、不绕过 guard/审批、不改变父模型。生命周期 QA 使用实际 emitter 与手工 detached 负载，不依赖已移除的私有 createActivationObserver。

## 必要能力与拒绝边界

- 后端需要 Cordis 服务、volatile 配置、internal/config 保存前校验、LLM 真实目录/预检、sessionProjections / sessionQuery 及 subagent 生命周期事件。
- 原生 subagent 必须在父作用域准入，并公开 provider / model / reasoning_effort；name-only 宿主还须公开 name 参数与父 subagentCatalog。
- 前端需要宿主模块加载器、原生 modelCatalog、settings.mutate 的 revision CAS、原始/有效配置快照及设置 slots/locale 服务。
- Low / High / Max 是模板，创建时逐项核实真实 effort，不支持则拒绝，绝不降档或换模型。
- 继承同路由时若宿主会把父 effort 带入原本应为 null 的子请求，插件拒绝创建，不伪造“无 effort”。

## 配置与公共接口

- schemaVersion:2；ui 是唯一规范写入入口，policy 只是旧版读取别名，双来源拒绝。
- v1 models/rules/lanes/review/guidance、旧 teams.enabled:true 只读隔离并停用，不自动迁移。Team 路由兼容已退役，原生 Team 不受修改。
- delegation_routes 自 0.8 起只做无参数发现；routed_subagent 创建文本 fresh 子会话，不提供 fork/Team 编排。
- selection_reason 仅有界接收旧调用，不参与授权或审计；policy_revision 用于拒绝陈旧选择。
- 内部 core / policy / config / ui-config 子路径不公开，不是稳定 API。

## 升级检查

先禁用新建路由、等待已有激活结清、备份配置并保留原审计/锁。按[安装说明](<INSTALLATION.md>)更新后核对实际加载代际；只有源码或 detached 宿主库检查，不能宣称 GUI 自动保存、真实在线派发或任务成功已验收。

```powershell
# 将占位路径替换为匹配的安装；ASAR 需 Electron 的 Node 模式
$env:ELECTRON_RUN_AS_NODE = "1"
& "<desktop-electron-executable>" scripts/verify-host-api.js "<dsh-runtime-package.json>"
& "<desktop-electron-executable>" scripts/verify-host-model-catalog.js "<dsh-runtime-package.json>"
& "<desktop-electron-executable>" scripts/verify-host-lifecycle.js "<dsh-runtime-package.json>"
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

这些检查不读取真实凭据或发付费请求。必须同时核对输出断言与错误，不能只看 Electron 包装器退出码。
