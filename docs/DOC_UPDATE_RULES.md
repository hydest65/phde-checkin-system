# 文档自动更新规则

这个项目每次完成一个版本或一组功能修改后，都要做一次“版本收尾”。目标是让产品文档、技术方案、部署说明和变更日志始终跟代码保持一致，并比较本地与 GitHub 哪一端更新，再把较新的版本同步到另一端。

## 触发口令

你可以直接对 Codex 说：

```text
使用 phde-checkin-system skill 做一次版本收尾。
请检查代码变化，更新 CHANGELOG、PRD、TECHNICAL_PLAN 和 WEB_TEST_DEPLOY，并运行文档检查。
完成后比较本地与 GitHub 哪一端更新，并把较新的版本同步到另一端。
```

## 必读文件

版本收尾前先读取：

- `docs/CHANGELOG.md`
- `docs/DOC_UPDATE_RULES.md`
- `docs/PRD.md`
- `docs/TECHNICAL_PLAN.md`
- `docs/WEB_TEST_DEPLOY.md`
- `index.html`
- `app.js`
- `server.js`
- `styles.css`
- `package.json`

## 更新范围

### `docs/CHANGELOG.md`

每次版本收尾必须更新。记录：

- 新增功能
- 行为变化
- 修复内容
- 文档变化
- 验证结果

### `docs/PRD.md`

当用户流程、产品规则、页面展示、角色权限或导入导出能力变化时更新。

### `docs/TECHNICAL_PLAN.md`

当数据结构、接口、存储方式、启动方式、脚本、技术约束或后续架构建议变化时更新。

### `docs/WEB_TEST_DEPLOY.md`

当启动方式、端口、测试步骤、部署方式、测试话术或环境要求变化时更新。

## 编码和命名规则

- 项目目录、文件名、脚本名保持英文。
- 文档内容可以使用中文，但必须保存为 UTF-8。
- 不新增中文文件名或中文目录名。
- 不恢复旧项目路径 `PHDE签到系统`。
- 不引入旧乱码标记；具体检查项由 `scripts/check-docs.js` 自动扫描。

## 收尾检查

文档更新后运行：

```bash
npm run docs:check
```

如果同时修改了 JavaScript，再运行：

```bash
npm run check
```

## GitHub 双向同步

版本收尾必须包含一次本地与 GitHub 的版本比较和同步确认：

- 检查本地 Git 状态，确认有哪些文件尚未提交。
- 尽可能获取 GitHub 远端状态，并比较本地 `main` 与 `origin/main`。
- 如果本地版本更新，先提交本地改动，再推送到 GitHub。
- 如果 GitHub 版本更新，先拉取云端更新到本地，再继续收尾。
- 如果本地和 GitHub 两边都有新改动，先停止自动同步，说明冲突风险，并让用户确认合并方向或使用 GitHub Desktop 处理。
- 如果命令行 Git 在本机受权限限制，则明确告诉用户 GitHub Desktop 中要执行的动作，例如 `Fetch origin`、`Pull origin`、`Commit to main` 或 `Push origin`。
- 同步完成后，检查本地 `main` 与 `origin/main` 是否一致。
- 如果仍有未同步内容，要明确说明还差哪一步。

最后告诉用户：

- 更新了哪些文档
- 哪些章节发生变化
- 检查是否通过
- 本地和 GitHub 哪一端更新、同步方向是什么、是否已经同步
- 如果没有运行某项检查，说明原因
