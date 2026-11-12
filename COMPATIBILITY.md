# 版本与兼容性 · 0.8.1

更新日期：2026-11-12。版本号相同不保证宿主内部 API 不变；下表区分历史证据、本轮离线检查和未做的在线验收。

## 验证矩阵

| 组件 / 环境 | 范围 | 证据与限制 |
| --- | --- | --- |
| 插件 0.8.1 | 当前维护版本 | 在 0.8.0 预设核心上增加 600ms 自动保存、IME 保护及保存状态 |
| DSH Desktop 0.2.2-rc.1 | 历史兼容目标，本公共基线未重新在线验收 | 原始本机验收不随公共仓库分发；当前可复现 QA 与证据限制见[验证范围](<VALIDATION.md>) |
| DSH Desktop 0.2.2-rc.2 | **不支持 routed_subagent 创建** | 原生工具改为 kind/name 回执，不返回本插件所需的 subagentId；宿主库部分检查通过不等于创建兼容 |
| 其它 DSH 版本 | 未验证 | 不声明最低兼容版本，不承诺未来版本自动兼容 |
| Node.js | 运行声明 >=22.15 | [包清单](<package.json>)中的 engine 是声明，不是每一版本均实测 |
| 开发 / QA Node | 推荐已实测的 24.x | 测试及部分检查使用 registerHooks；在 22.x 需 >=22.15，在 23.x 需 >=23.5。未验证 Node 22/23 整套回归 |
| 操作系统 | Windows 已记录验证 | macOS / Linux 未做宿主安装及 GUI 验收；源码跨平台 API 不等于跨平台认证 |

## 宿主依赖

peerDependencies 由 DSH 运行环境提供，并非独立应用依赖；optional 标记是为了避免打包/源码工具安装时自动拉取另一套宿主，不代表运行时可缺少。当前明确列举的版本以[包清单](<package.json>)为准，不能混装不同宿主代际。

| 包 | rc.1 历史基线 | rc.2 安装包实值 |
| --- | --- | --- |
| @deepseek-ai/cosmokit | 1.9.x | 1.9.0 |
| @deepseek-ai/cordis | 4.1.x | 4.1.0 |
| @deepseek-ai/schemastery | 3.19.x | 3.19.0 |
| @deepseek-ai/dsh-tools | 0.2.2-rc.1 | 0.2.2-rc.2 |
| @deepseek-ai/dsh-subagent | 0.2.2-rc.1 | 0.2.2-rc.2 |
| zod | 4.4.3 | 4.6.6 |

依赖版本表不是全功能认证。rc.2 有两类变化：

1. 原生 subagent 成功输出变为 kind/name，不再提供 subagentId。本插件用真实会话 ID 建立审计、归属和恢复证据，不能把显示名称 name 当作会话 ID，也不能在创建后盲目重试。**不要在 rc.2 启用本版路由创建**；peerDependencies 仍精确限制在 rc.1，不放宽为 >=0.2.2。
本工作树新增派发前保护：原生输出必须声明必需的 kind:activation 与字符串 subagentId，否则在 prepare 之前拒绝 NATIVE_OUTPUT_CONTRACT_UNSUPPORTED；异步 prepare 后、dispatch 前重检同一工具定义与输出契约，变更则安全完成拒绝。该保护不为 rc.2 增加适配，不创建任务；宿主若违反已声明契约，创建后的 unknown 仍不可重放。历史 0.8.1 归档不包含这项新保护。

2. 私有 createActivationObserver helper 被删除。这是旧 QA 脚本的另一处不兼容，插件运行源码并未依赖该 helper。脚本改用真实 emitter 加手工 detached 官方负载，只验证相应库契约，不掩盖第 1 项的创建不兼容。

## 必要能力与拒绝边界

- 后端需要 Cordis 服务、volatile 配置、internal/config 保存前校验、LLM 真实目录/预检、sessionProjections / sessionQuery 及 subagent 生命周期事件。
- 原生 subagent 必须在父作用域准入，并公开 provider / model / reasoning_effort；创建须走 ToolExecutionPipeline 的 prepare / dispatch / complete，不能直接 execute 绕过审批。
- 前端需要宿主模块加载器、原生 modelCatalog、settings.mutate 的 revision CAS、原始/有效配置快照及设置 slots/locale 服务。仅 Web 客户端声明，不是独立网页或 VS Code 插件。
- Low / High / Max 是模板，不保证所有提供方模型都支持；创建时逐项核实真实 effort，不支持则拒绝，绝不降档或换模型。
- 继承同路由时若宿主会把父 effort 带入原本应为 null 的子请求，插件拒绝创建，不伪造“无 effort”。

## 配置与公共接口

- schemaVersion:2；ui 是唯一规范写入入口，policy 只是旧版读取别名，双来源拒绝。
- v1 models/rules/lanes/review/guidance、旧 teams.enabled:true 只读隔离并停用，不自动迁移。Team 路由兼容已退役，原生 Team 不受修改。
- delegation_routes 自 0.8 起只做无参数发现；不返回选型预览。routed_subagent 创建文本 fresh 子会话，不提供 fork/Team 编排。
- selection_reason 仅有界接收旧调用，不参与授权或审计；policy_revision 仍用于拒绝陈旧选择。
- 内部 core / policy / config / ui-config 子路径不再公开；旧外部库消费者需自行适配，不能把内部源码路径视为稳定 API。

## 升级检查

先禁用新建路由、等待已有激活结清、备份配置并保留原审计/锁。按[安装说明](<INSTALLATION.md>)更新后核对实际加载代际；只有源码测试或 detached 宿主库测试，不能宣称 GUI 自动保存、真实在线派发或任务成功已验收。

源码仓库内提供以下离线检查，参数必须指向匹配的 DSH 运行包清单：

```powershell
# 将占位路径替换为你自己的匹配安装；ASAR 安装需要匹配 Electron 的 Node 模式
$env:ELECTRON_RUN_AS_NODE = "1"
& "<desktop-electron-executable>" scripts/verify-host-api.js "<dsh-runtime-package.json>"
& "<desktop-electron-executable>" scripts/verify-host-model-catalog.js "<dsh-runtime-package.json>"
& "<desktop-electron-executable>" scripts/verify-host-lifecycle.js "<dsh-runtime-package.json>"
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

检查仅构造 detached 服务、Session/查询与合成生命周期负载，不创建真实子 Agent，不读取真实账号或发付费请求。必须同时核对输出断言与错误，不能只看进程包装器的退出码。
