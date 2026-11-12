# 公开前检查清单

当前公共基线采用全新本地历史；旧本机材料与原始 Git 数据仅在仓库外私有备份中保留。仓库公开仍会暴露可达 Git 历史，只修改当前文件或添加忽略规则并不足够。以下步骤应在最终提交及发布资产确定后再执行一次。不要把私有备份放回仓库，不要 fetch/pull 尚未清理的旧远端。

## 本地范围

- [ ] 检查工作树、暂存区、全部本地分支/标签与可达历史中的密钥、token、密码、认证 URL、私有端点和个人信息；不要把扫描命中原文贴到公开日志。
- [ ] 使用专门的 secret scanner 复扫历史，并人工区分测试占位符与真实凭据。未检出不等于保证不存在。
- [ ] 核对提交作者姓名/邮箱是否可以公开；保留必要版权归属，不擅自改写作者。
- [ ] 排除真实配置、profile、审计/锁、验收日志、临时解包目录及旧归档。忽略规则不能清除已经提交的历史。
- [ ] 发现真实凭据先吊销/轮换；历史清理、强推和远端缓存处理须另行确认，不通过清空审计“修复”。

只读核对命令（不会抓取远端）：

```sh
git status --short
git diff --check
git diff --cached --stat
git for-each-ref --format="%(refname)"
git log --all --format="%h %an <%ae>"
git ls-files
```

输出可能含个人身份信息，只在私密环境查看。另用可信 secret scanner 扫描完整历史；上述命令本身不是密钥检测器。

## 兼容与安装包

- [ ] 按[兼容性说明](<COMPATIBILITY.md>)区分源码回归、真实宿主离线检查、安装与 GUI/在线验收，不能混写。
- [ ] 运行测试和静态检查，保持示例默认关闭、真实 effort 校验与宿主授权边界。
- [ ] 对候选包先审阅 dry-run 成员，再在单独目录打包；不要覆盖历史同版本归档。
- [ ] 用独立解包 QA 验证包内实际代码，确认只有白名单文件，无日志/配置/开发产物。
- [ ] 正式发版分配新版本，记录新归档 SHA-256 与验证结果，不复用旧收据。

```sh
node --test test/*.test.js
node scripts/check.js
npm pack --dry-run --ignore-scripts
# candidate-dir 须已创建；仅产生本地候选包，不发布或安装
npm pack --ignore-scripts --pack-destination ./candidate-dir
node scripts/verify-pack.js ./candidate-dir/dsh-delegation-router-0.8.1.tgz
```

以上针对当前工作版本；版本变化后替换归档名。源码仓库提供测试与脚本，生产包不携带这些 QA 文件。

## GitHub 远端范围（需仓库所有者确认）

- [ ] 复核远端独有分支/标签、PR refs、Git LFS 对象，以及 forks/镜像。
- [ ] 复核 Releases 的所有附件、Actions 日志/工件/缓存、Issues/PR 评论、Wiki 和截图；本地 Git 扫描不能覆盖这些内容。
- [ ] 启用可用的 secret scanning / push protection 与私密漏洞报告，确认发布权限及自动化使用最小权限。
- [ ] 确认[安全报告流程](<SECURITY.md>)可用，许可证与第三方归属完整。
- [ ] 所有者阅读本轮审计报告、处理残留隐私后，再自行确认切换 public。不得因本地测试通过直接自动公开。

GitHub 可见性与 npm 分发独立：保留 private:true 防误发布；本清单不授权修改可见性、发布、推送或重写历史。
