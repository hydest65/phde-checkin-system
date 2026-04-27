# PHDE签到系统 Web 测试版部署说明

## 当前版本

这是一个最小外网测试版：

- 版本：`0.1.7`
- 前端：`index.html`、`styles.css`、`app.js`
- 后端：`server.js`
- 数据：运行后自动生成 `data/phde-state.json`
- 后台密码：`PHDE2026`

## 本地启动

推荐双击：

```text
start.bat
```

如果 3000 端口被占用，可双击：

```text
start-3001.bat
```

也可以在项目目录执行：

```bash
npm start
```

浏览器访问：

```text
http://localhost:3000
```

或：

```text
http://localhost:3001
```

## 外网测试建议

可以部署到支持 Node.js 的平台，例如 Render、Railway 或普通云服务器。

启动命令：

```bash
npm start
```

平台需要提供可写文件系统，否则 `data/phde-state.json` 可能在服务重启后丢失。测试阶段可以接受；正式使用建议换成 PostgreSQL、MySQL 或 SQLite 持久化数据库。

## GitHub 同步

当前云端仓库：

```text
https://github.com/hydest65/phde-checkin-system
```

本地推荐使用 GitHub Desktop 完成本地与 GitHub 的双向同步。每次同步前确认：

- 不上传 `data/phde-state.json`。
- 不上传 `.env`、`node_modules` 或临时 zip 包。
- 已运行 `npm run docs:check`。
- 如果修改了 JavaScript，已运行 `npm run check`。
- 先点击 `Fetch origin`，确认 GitHub 是否有更新。
- 如果 GitHub 有更新，先 `Pull origin` 到本地。
- 如果本地有更新，再 `Commit to main` 并 `Push origin`。
- 如果本地和 GitHub 两边都有更新，先确认合并方向后再同步。

## 测试方式

员工首次签到时填写姓名、工号、手机号，选择办公地点后点击“上班签到”。工号不存在时，系统会自动创建员工档案；工号已存在时，会校验姓名是否匹配。

填写姓名和工号后，页面会显示当前状态、修改机会和数据模式。测试时可重点观察：

- 首次登记显示“首次登记”。
- 当天未签到员工显示“今日未签到”。
- 当天已签到且可修改时显示“今日已签到”和剩余修改机会。
- 姓名和工号不匹配时显示“信息不匹配”。

如果刚同步过 Figma 或 CSS 样式，浏览器可能缓存旧文件。请按 `Ctrl + F5` 强制刷新，确认页面引用的是最新样式版本。

后台密码：

- `PHDE2026`

产品文档和技术方案访问：

- 先进入“管理后台”并输入后台密码。
- 登录成功后再点击顶部“产品文档”或“技术方案”。
- 未登录时直接访问 `docs/PRD.md` 或 `docs/TECHNICAL_PLAN.md` 会提示需要管理密码。

## 发给测试人员的话术

请打开测试链接，填写姓名、工号和手机号，选择办公地点后确认页面显示的状态摘要，再点击“上班签到”。每人每天首次签到后还有一次修改机会。测试阶段请不要填写真实隐私信息。如页面样式看起来没有更新，请先按 `Ctrl + F5` 强制刷新。
