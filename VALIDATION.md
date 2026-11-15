# 验证范围 · 0.8.2

本文件描述当前公共源码的可复现 QA 与证据边界。原始本机验收记录、旧发布收据和内部执行计划不随公共仓库分发；移出这些材料不意味着把旧失败或未验收结果改写为成功。

## 源码回归

```sh
node --test test/*.test.js
node scripts/check.js
```

2026-11-16：0.8.2 在 Node 24.12.0 上全量 294/294 通过，0 失败/取消/跳过；静态检查通过。另以安装中的 Electron Node 24.21.0 对 DSH 0.2.2-rc.3 执行三项宿主隔离检查通过。每次修改仍须重新执行，不能仅引用旧数字。语法、导出、locale、规范示例和生产文档相对链接均纳入检查。

主要覆盖：

- Low / High / Max、父请求模型继承与固定模型、真实 effort/null、默认项和授权范围。
- 身份/策略/取消漂移 fence、原生 prepare/dispatch/complete、callId 幂等、unknown 不重放。
- 跨策略配额、审计与锁、冷/热会话归属、completed 持久完成证据及合成 interrupted 拒绝。
- ui 规范写入、旧 policy 读取、旧 v1/Team 配置只读隔离、CAS 和 raw/effective 回读。
- 600ms 自动保存、IME 保护、无效草稿零写入、冲突/拒绝/未知回执、连接代际与计时器清理。
- 原生 kind/name 与旧 kind/subagentId 两种明确契约；新名称须映射到父目录唯一新增 ID，并通过真实 header 归属验证；模糊契约、prepare 后工具定义/契约变更均拒绝。

## 宿主库隔离检查

源码仓库提供三项 detached 检查，运行方式见[兼容性说明](<COMPATIBILITY.md>)：

- Schema、工具注册、保存前校验、清单零模型调用与创建 planner 的精确父请求继承。
- 模型目录四场景，部分/全失败不当作无 effort，不读取真实凭据或调用模型。
- 真实 Session / SessionQuery / emitter 与手工官方形状的生命周期负载；冷端 completed 读取、跨父拒绝和合成 interrupted 拒绝。

针对 rc.3 的实际工具定义检查 kind/name 契约、真实投影及 staged 派发适配；合成目录、回执与子会话负载不是实际 manager 激活，不能把 name 当作 Session ID。创建后验证失败必须 unknown 且不重试。

这些检查不构造真实 Agent，不更改 profile，不发送付费请求；手工负载也不是实际 manager 激活。rc.1 仅保留历史兼容目标，本公共基线不宣称重新完成其在线验收。GUI 自动保存与真实派发仍需独立验收。

## 生产包边界

安装包采用[包清单](<package.json>)白名单，只含运行源码、客户端、规范示例、locale/icon、宿主 patch、许可证和用户说明。测试、脚本、旧兼容生成物、本机收据与私有备份不入包。

独立解包 QA 先核对未经修改的生产成员和源码字节，再临时注入外部测试，使相对导入指向解包后的实际代码；不是把开发文件打入安装包。打包及验证命令见[公开清单](<PUBLIC_RELEASE_CHECKLIST.md>)。

离线源码、归档和宿主库检查均不等于实际安装、GUI 加载或在线任务成功。验收不得通过删除审计/锁、换路径重置状态或重放 unknown 取得通过。正式发行须独立版本与新的归档校验值，不复用旧同版本收据。
