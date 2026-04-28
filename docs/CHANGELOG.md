# PHDE签到系统变更日志

本文件用于记录每次版本更新。每次完成代码或功能变化后，都应同步更新本文档，并根据影响范围更新 `PRD.md`、`TECHNICAL_PLAN.md` 和 `WEB_TEST_DEPLOY.md`。

## 版本记录

### 0.1.18 - 2026-04-27

- 修改：压缩首页今日签到状态卡的信息密度，将工号、手机号、时间、地点和自动定位合并为一条紧凑信息行，并对过长定位文本使用省略号，减少状态卡占用行数。
- 修改：更新前端资源缓存标记到 `status-compact1`，确保 Render 和浏览器能加载新的状态卡布局。
- 文档：同步更新 PRD、技术方案和 Web 测试部署说明，补充紧凑状态卡的显示和测试要求。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.17 - 2026-04-27

- 修改：完成 Spatial UI 收尾微调，保留 VisionOS 风格的半透明面板、强背景模糊和深层阴影，同时压缩首页标题区、表单间距和字体层级，让员工签到首屏更紧凑。
- 修改：替换并处理 Morimatsu 横版 LOGO，去除图片残留浅色背景和矩形阴影，改用透明 PNG 与 `drop-shadow` 融入玻璃标题栏。
- 修改：移除首页标题上方的 `PHDE` 眼标，保留顶部系统名称与页面主标题，降低视觉重复。
- 修改：将当前页面生成到 Figma 可编辑稿，便于后续继续从 Figma 调整 UI 后同步回 Web 原型。
- 修复：统一前端和 Render 服务端的业务日期到 `America/Mexico_City`，避免 UTC 跨日导致线上已签到记录在网页端显示为未签到。
- 文档：同步更新 PRD、技术方案和 Web 测试部署说明，记录 0.1.17 的紧凑首页、LOGO 融合、缓存刷新和 Render/GitHub 部署检查点。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.16 - 2026-04-27

- 修改：完成阶段性版本收尾，保留 Leaflet 浅色开源地图自由缩放、后台文档入口和首页签到动态等能力。
- 修改：隐藏员工签到表单中的地点快捷按钮横条和“当前状态 / 修改机会 / 数据模式”横向状态卡，避免界面出现任务栏式组件；手动地点仍通过原生下拉框选择。
- 文档：同步更新 PRD、技术方案、Web 测试说明和文档更新规则，明确后续只在版本收尾时统一升版本，小改不单独升版本。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.15 - 2026-04-27

- 修改：Leaflet 地图开启自由缩放，支持缩放按钮、滚轮缩放、双击缩放和触摸双指缩放。
- 文档：更新 Web 测试说明，补充地图缩放测试点。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.14 - 2026-04-27

- 修改：定位成功后优先使用 Leaflet 开源地图库显示真实可拖拽地图，并采用 OpenStreetMap 数据与 CARTO 浅色底图，形成白底灰线风格。
- 修改：保留本地高科技示意地图作为外部地图库加载失败时的兜底显示。
- 文档：更新技术方案和 Web 测试说明，记录 Leaflet、OpenStreetMap 和浅色底图方案。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.13 - 2026-04-27

- 修改：实时定位地图从外部默认地图 iframe 改为本地白底灰线高科技地图面板，包含灰线道路、浅蓝网格、扫描光效和脉冲定位点。
- 修改：保留定位授权、地址解析和中文大概地址展示逻辑，不再依赖外部地图瓦片视觉风格。
- 文档：更新技术方案和 Web 测试说明，补充科技地图测试点。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.12 - 2026-04-27

- 修复：手动地点不再只依赖浏览器原生下拉框，新增地点快捷按钮，避免部分浏览器或样式场景下无法点开地点选择。
- 修改：地点快捷按钮与原下拉框保持同步，点击地点后会即时刷新签到预览和定位提示。
- 文档：更新 Web 测试说明，补充手动地点快捷选择测试点。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.11 - 2026-04-27

- 新增：首页今日状态下方新增可折叠“签到动态”，显示最近 30 条往日员工签到记录。
- 新增：管理后台新增“产品文档”和“技术方案”查看入口，管理员登录后可直接在后台查看 Markdown 内容。
- 修改：后台登录改为服务端会话校验，文档内容通过 `/api/admin/docs` 受保护接口读取，`docs/` 仍不作为公开静态目录暴露。
- 文档：更新 PRD、技术方案和 Web 测试部署说明，补充签到动态、后台文档入口和服务端管理会话说明。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.10 - 2026-04-27

- 新增：生成并接入洁净室实验人员高清背景图，作为签到系统页面背景。
- 修改：在背景照片上保留浅蓝白柔和遮罩，兼顾洁净室氛围和前景表单可读性。
- 修改：顶部任务栏透明度进一步提高约 40%，浅色模式从约 0.68 降至约 0.41，深色模式同步降至约 0.35。
- 文档：更新 Web 测试说明，补充背景图和任务栏透明度测试点。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.9 - 2026-04-27

- 新增：顶部新增深色/浅色模式切换，用户选择会保存在本机浏览器。
- 修改：根据新的配色系统将 UI 调整为浅蓝灰、白色、浅灰与深灰文字组合，整体更清新、现代，并带有轻度度假感。
- 修改：统一卡片、输入框和按钮圆角到 14-16px 区间，放大标题和数字强调，补充卡片悬浮与入场动画。
- 文档：更新 PRD、技术方案和 Web 测试部署说明，补充交互动画与深色模式测试点。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.8 - 2026-04-27

- 修改：将签到页、状态页和管理后台统一调整为低饱和蓝白渐变与半透明毛玻璃视觉，面板、输入框、按钮和表格使用一致圆角、细边框和轻投影。
- 修改：顶部导航改为浮动玻璃栏，背景加入柔和蓝白渐变和浅米色高光，让页面更贴近参考截图的轻拟物 SaaS 风格。
- 修复：将 `start.bat` 和 `start-3001.bat` 改为 ASCII + Windows CRLF 的简化启动脚本，避免 PowerShell 调用批处理时被错误拆行解析。
- 文档：更新 PRD、技术方案和 Web 测试部署说明，记录玻璃拟态 UI 方向和 0.1.8 测试版本。
- 验证：使用 Codex bundled Node runtime 运行 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.7 - 2026-04-27

- 新增：员工签到表单新增实时状态摘要，显示当前状态、修改机会和数据模式。
- 修改：根据 Figma 可编辑稿同步签到页视觉，顶部导航改为紧凑胶囊样式，状态摘要改为纵向卡片，整体更贴近移动端测试稿。
- 修复：定位成功后备用“等待定位授权”卡片仍显示的问题，确保地图成功显示时隐藏备用提示。
- 文档：更新 PRD、技术方案和 Web 测试部署说明，补充 Figma 同步、状态摘要和刷新测试说明。
- 验证：由于当前环境没有可用 `npm` 命令，使用 bundled Node 直接运行等价检查；通过 `scripts/check-docs.js`、`node --check app.js` 和 `node --check server.js`。

### 0.1.0 - 初始 Web 原型

- 建立员工上班签到页面。
- 支持员工首次自助登记并签到。
- 支持同一员工当天一次签到修改机会。
- 支持今日签到状态展示。
- 支持管理员登录、单日记录、月度统计、员工名单导入和 Excel 兼容导出。
- 使用轻量 Node.js 服务保存数据到 `data/phde-state.json`。
- 项目目录和脚本名改为英文，降低 Windows 中文路径和终端编码风险。

## 每次更新要填写

复制下面模板追加到“版本记录”最上方：

```md
### x.y.z - YYYY-MM-DD

- 新增：
- 修改：
- 修复：
- 文档：
- 验证：
```
