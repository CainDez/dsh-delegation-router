# 安装与迁移 · 0.8.1

插件版本：0.8.1。已记录的宿主验证基线为 DSH Desktop 0.2.2-rc.1；这不是“最低版本”或“后续版本全部兼容”的承诺。DSH 0.2.2-rc.2 的原生创建回执不兼容，**不要在 rc.2 启用路由创建**。完整范围见[兼容性说明](<COMPATIBILITY.md>)。包名 dsh-delegation-router，Cordis 行 delegation-router，服务 delegationRouter。

## 官方 CLI 安装（无需 Computer Use）

从可信发布渠道取得归档并核对对应发布收据的 SHA-256；以下命令在归档所在目录执行。先关闭创建路由，等待已有激活结清；备份配置并保留原审计。对当前 Desktop 使用同一个 desktop profile（若使用其它 profile，请替换名称）：

```powershell
dsh plugin --profile desktop add "./dsh-delegation-router-0.8.1.tgz"
```

也可通过 Desktop 插件管理安装。安装后必须确认实际运行的是新代码代际，不能仅凭磁盘版本判断完成。不要直接覆盖安装目录，也不要重启或重放不确定子任务。

## 配置三档

- 新配置内置 Low / High / Max，默认 High；模型来源均为“继承主模型”。
- 继承解析的是创建时父 Agent 当前请求的 Provider/Model，effort 则使用该预设的精确值。
- 每档可独立选择其它已配置模型及其真实档位。主模型与内置 Team 不受更改。
- 既有 v2 自定义项不自动覆盖；在设置中“添加默认预设”，再按需设默认 High。既有 v1 只读隔离并停用，不再提供界面转换；人工迁移步骤见配置说明，不能静默丢弃旧硬约束。
- 编辑停止约 0.6 秒后自动保存；确认顶部状态显示“已保存”后，可用 delegation_routes 读取清单与版本。未填完整时不提交；失败、冲突或未知回执会保留更改并暂停，按就近提示重试或刷新核对。列出不代表已预检。创建时不支持所选 effort 或越权就拒绝，不换模型/降档。

## 不可绕过的边界

保留同一 profile 的原审计文件。换路径、删日志、删锁、重装均不能用于清除未结事项；默认审计在该 profile 的 delegation-router 子目录。锁冲突、unknown/intent-only 或损坏日志失败关闭。只有已有 accepted、精确父归属、非驻留且原始 completed turn 收尾时，才可显式 router_reconcile。

本版已删除 Team 路由兼容包及创建工具。已有替换领域服务须由用户在无活动 Team 工作时手动停用，再按宿主方式使用原生 Team；不能热替换或双挂。旧 teams.enabled:true 保留原文、隔离停用，用户核对后通过原生设置明确移除；teams:{enabled:false} 仅作为旧读取兼容，规范保存不再生成。真实测试必须核对 selected → accepted → observed → settled 和父路由前后值，settled 不是任务成功。

配置细节见[配置说明](<UI_CONFIGURATION.md>)，验证范围见[验证记录](<VALIDATION.md>)。
