# DSH Delegation Router

主 Agent 已决定委派后，从用户维护的固定候选模型池中选择模型，通过 DSH 原生 subagent 创建文本子会话。插件不决定是否委派、不切换主模型、不编排 Agent Teams，也不增加分类模型调用或评分系统。

## 配置

在插件设置中添加候选：名称、固定 provider/model、真实思考档位和一句适用说明。完整有效的修改在停止输入约 600ms 后自动保存；冲突或写入结果不确定时停止自动重试。

配置入口只有 `ui` 和可选的绝对路径 `auditFile`。`ui.schemaVersion` 为 3，默认关闭且候选池为空。启用时必须显式指定清单内的 `defaultCandidateId`。

- `candidates`：每项包含 `id / name / provider / model / effort`，可选 `description`。
- `effort`：宿主模型目录公布的真实值；明确无可配置档位时填 `null`。目录不可用不等于没有档位。
- `limits`：可设置 `maxPendingStarts`、`maxActivePerModel`、`maxCreationsPerParent`、`metadataTimeoutMs`。

参见默认关闭的[候选配置示例](<examples/candidates.json>)。模型目录可见不代表获得创建授权；适用说明不授予权限或证明模型能力。

## 工具

| 工具 | 职责 |
| --- | --- |
| `delegation_routes` | 列出授权范围内的候选、默认项及配置代际，不进行模型预检 |
| `routed_subagent` | 按 `candidate_id` 创建子会话；省略时使用默认项，携带 `policy_revision` 防止过期选择 |
| `router_status` | 只读当前父作用域的配置状态、创建回执及真实请求证据 |
| `router_reconcile` | 用宿主持久证据结清已接受的子会话，不创建或恢复 Agent |

明确的用户选择优先；否则主 Agent 按任务和适用说明选择，没有明确理由时使用默认项。插件只校验被选中的候选，不自动换模型、降档或绕过宿主 guard/审批。

## 安全边界

- 创建前、异步预检后和原生派发前均检查身份、授权、配置代际与取消状态；原生准备阶段不能改写选中的模型、档位或绑定的子名称。
- 同一宿主 callId 幂等，相同 provider/model 共享并发配额；配置修改不会抹掉未结工作。
- `unknown` 和仅有 intent 的创建不能自动重试。结清需精确父子归属及宿主终态证据；不得通过换审计路径或删除锁绕过未结状态。
- selected 是意图，accepted 是创建回执，observed 是实际请求，settled 只是生命周期结束，不代表任务成功。
- 审计仅记录决策身份、候选、路由、状态和结清证据，不记录任务正文、适用说明或凭据。

## 安装与开发

运行环境：Node.js ≥22.15，DSH 0.2.2-rc.3；使用宿主已有模型目录与账号。此插件为第三方独立插件，模型调用费用由所选提供方决定。

```sh
npm test
npm run check
npm pack --ignore-scripts
node scripts/verify-pack.js ./dsh-delegation-router-0.9.1.tgz
dsh plugin --profile desktop add https://github.com/CainDez/dsh-delegation-router/releases/download/v0.9.1/dsh-delegation-router-0.9.1.tgz
```

安装前检查未结委派并备份配置。配置验收优先通过文件和宿主接口核对，无需 Computer Use。宿主库隔离检查可运行 `scripts/verify-host-api.js`、`scripts/verify-host-model-catalog.js`、`scripts/verify-host-lifecycle.js`，参数为对应宿主的 package.json 路径；它们不连接运行 Profile、不创建 Agent、不发起推理。

采用 [MIT 许可证](<LICENSE>)。[包清单](<package.json>)的 `private: true` 防止误发 npm，不影响归档安装。
