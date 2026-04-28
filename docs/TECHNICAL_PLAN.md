# PHDE签到系统技术方案

## 1. 原型说明

当前交付的是可运行 Web 原型：

- 前端：`index.html`、`styles.css`、`app.js`
- 后端：轻量 Node.js `server.js`
- 数据：`data/phde-state.json`
- 启动脚本：`start.bat`、`start-3001.bat`
- UI 来源：`styles.css` 维护当前 Web 样式，可根据 Figma 可编辑稿或参考截图同步视觉调整；当前样式使用洁净室背景图、浅蓝灰配色、低饱和蓝白渐变、半透明毛玻璃、轻投影、统一圆角、交互动画和深色模式变量。

前端在服务不可用时保留浏览器 localStorage 兜底，但正式测试以 Node.js 服务端数据为准。

默认后台密码：

- `PHDE2026`

## 2. 当前本地结构

```text
phde-checkin-system
├─ assets
├─ data
├─ docs
│  ├─ PRD.md
│  ├─ TECHNICAL_PLAN.md
│  └─ WEB_TEST_DEPLOY.md
├─ logo_standard_media
├─ app.js
├─ index.html
├─ package.json
├─ server.js
├─ start.bat
├─ start-3001.bat
└─ styles.css
```

目录名、文件名和脚本名使用英文，文件内容统一 UTF-8，避免 Windows 终端、压缩包、编辑器和运行时之间出现中文路径编码问题。

## 3. 核心能力

- 员工自助登记。
- 工号唯一校验。
- 员工姓名与工号匹配校验。
- 员工手机号更新。
- 签到记录写入。
- 每日首次签到和一次修改机会校验。
- 日期/月度查询。
- 表格文本导入员工名单。
- Excel 兼容导出。
- 管理密码校验。
- 服务端管理会话校验。
- 自动定位地址保存。
- Leaflet 开源定位地图展示和中文化定位地址保存；地图使用 OpenStreetMap 数据与 CARTO 浅色底图。
- 签到前确认提示展示，包括当前签到/修改状态和修改机会说明；横向状态卡片已在界面中隐藏。
- 玻璃拟态 UI 样式，包括浮动顶部栏、半透明业务面板、留白充足的输入框、轻投影按钮、后台表格和浅色开源地图。
- 洁净室实验人员背景图 `assets/cleanroom-hero-bg.png`，通过 CSS 遮罩保证前景可读性。
- 深色/浅色主题切换，主题偏好保存在浏览器 localStorage 中，并通过 `data-theme` 切换 CSS 变量。
- 首页签到动态折叠模块，基于 `checkins` 历史记录渲染最近 30 条往日签到。
- 后台文档查看模块，通过受保护 API 读取 `docs/PRD.md` 和 `docs/TECHNICAL_PLAN.md`。

## 4. 数据结构

### employees 员工表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 姓名 |
| employeeId | string | 工号，唯一 |
| phone | string | 手机号 |
| email | string | 邮箱，可选 |
| remark | string | 备注 |

### checkins 签到记录表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 记录 ID |
| employeeId | string | 工号 |
| name | string | 员工姓名 |
| date | string | 签到日期，如 2026-04-26 |
| month | string | 签到月份，如 2026-04 |
| time | string | 签到时间 ISO 字符串 |
| manualLocation | string | 手动地点 |
| autoAddress | string | 自动定位中文大概地址 |
| locationStatus | string | success / denied / error |
| editCount | number | 当天签到修改次数，第一版最大为 1 |
| originalTime | string | 首次签到时间，修改后用于追溯 |
| updatedAt | string | 最近修改时间 |

## 5. API 设计

### `GET /api/state`

返回当前员工和签到状态。

### `POST /api/checkins`

请求：

```json
{
  "employeeId": "PHDE001",
  "name": "张三",
  "phone": "13800000000",
  "manualLocation": "光启园办公室",
  "autoAddress": "城市：上海，大概位置：光启园附近",
  "locationStatus": "success"
}
```

校验：

- 工号为空时拒绝。
- 姓名为空时拒绝。
- 手机号为空时拒绝。
- 工号不存在时创建员工档案。
- 工号存在时校验姓名是否匹配。
- 当日没有签到记录时创建签到。
- 当日已有签到记录且 `editCount < 1` 时更新签到记录，并将 `editCount` 加 1。
- 当日已有签到记录且 `editCount >= 1` 时拒绝再次修改。

### `POST /api/employees/import`

导入员工名单。前端负责处理重复工号的覆盖确认，后端按传入结果写入。

### `POST /api/reset-empty`

清空原型数据，恢复为空员工和空签到记录。

### `POST /api/admin/login`

管理员登录。密码正确时服务端写入 `phde_admin_auth` HttpOnly Cookie。

### `POST /api/admin/logout`

管理员退出。服务端清除 `phde_admin_auth` Cookie。

### `GET /api/admin/session`

返回当前浏览器是否已通过管理登录。

### `GET /api/admin/docs?name=prd|technical`

管理员受保护文档接口。只有已登录管理员可读取：

- `name=prd`：返回产品文档。
- `name=technical`：返回技术方案。

## 6. 自动定位方案

Web 端使用浏览器 Geolocation API 获取定位授权。

- 成功：保存中文化大概地址。
- 拒绝：允许签到，显示“未授权”。
- 失败：允许签到，显示“自动定位异常”。
- 成功显示实时地图时，备用授权提示需要隐藏，避免“定位已更新”和“等待定位授权”同时出现。

定位成功后，页面优先使用 Leaflet 渲染真实地图，地图数据来自 OpenStreetMap，视觉底图使用 CARTO `light_all` 浅色瓦片；如果外部地图库加载失败，则退回本地 CSS 白底灰线高科技地图面板。页面文字、后台表格和导出文件不展示经纬度。

## 7. Excel 导入导出

导入：

- 当前原型使用粘贴表格文本方式。
- 表头为：姓名、工号、手机号、邮箱、备注。
- 工号为空时跳过该行。
- 重复工号由管理员选择覆盖或跳过。

导出：

- 当前原型生成 Excel 可打开的 `.xls` HTML 表格文件。
- 后续正式版可改为后端生成 `.xlsx`。

## 8. 正式版建议

### 前端

- Vue 3 或 React。
- 移动端优先响应式布局。
- Figma 可编辑稿和参考截图用于确认视觉方向，当前原型仍使用原生 HTML、CSS 和 JavaScript 实现；玻璃拟态效果主要由 CSS 渐变、`backdrop-filter`、半透明边框和轻投影实现，动画由 CSS transition/keyframes 实现。
- 后台表格支持筛选、分页、导入、导出。

### 后端

- Node.js + Express/NestJS，或 Python + FastAPI。
- 管理密码放入服务器环境变量。
- 导出接口只允许管理员访问。

### 数据库

50 人以内可用 SQLite；后续若要与微信小程序共用数据，建议使用 PostgreSQL 或 MySQL。

### 部署

- 内网轻量部署：Nginx + Node.js + SQLite/MySQL。
- 云服务器部署：HTTPS + Node.js 服务 + 数据库。
- 小程序上线时必须使用 HTTPS 域名。

## 9. 安全与隐私

- 后台密码不要写死在正式版前端。
- 当前原型后台密码已由服务端接口校验，正式版仍建议通过环境变量配置并更换为账号体系。
- 签到接口保留每日唯一校验。
- 导出接口仅管理员可访问。
- 经纬度不在页面文字和导出中展示。
- 手机号和邮箱属于个人信息，正式版需要限制后台访问权限。
- 数据库应定期备份。
