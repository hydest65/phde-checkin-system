# PHDE签到系统技术方案

## 1. 原型说明

当前交付的是可运行 Web 原型：

- 前端：`index.html`、`styles.css`、`app.js`
- 后端：轻量 Node.js `server.js`
- 数据：`data/phde-state.json`
- 启动脚本：`start.bat`、`start-3001.bat`

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
- 自动定位地址保存。
- 实时地图展示和中文化定位地址保存。

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
- 前端不根据姓名自动填入工号或手机号。
- 姓名已存在但工号不同时拒绝，避免同一员工被创建为新档案。
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

校验管理密码。密码正确时写入服务端登录凭证 Cookie，用于管理后台和受保护文档访问。前端不再自行比对管理密码。

### `POST /api/admin/logout`

清除服务端登录凭证 Cookie。

### `GET /api/admin/session`

返回当前浏览器是否已有有效管理登录状态。

### 受保护文档

以下文档由服务端静态文件层保护，未登录时返回“需要管理密码”页面：

- `/docs/PRD.md`
- `/docs/TECHNICAL_PLAN.md`

## 6. 自动定位方案

Web 端使用浏览器 Geolocation API 获取定位授权。

- 成功：保存中文化大概地址。
- 拒绝：允许签到，显示“未授权”。
- 失败：允许签到，显示“自动定位异常”。

页面可以用经纬度展示地图，但页面文字、后台表格和导出文件不展示经纬度。

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
- 签到接口保留每日唯一校验。
- 导出接口仅管理员可访问。
- 经纬度不在页面文字和导出中展示。
- 手机号和邮箱属于个人信息，正式版需要限制后台访问权限。
- 数据库应定期备份。

## 10. 版本管理与文档自动化

当前项目已同步到 GitHub：

```text
https://github.com/hydest65/phde-checkin-system
```

版本号记录在 `package.json` 的 `version` 字段中，产品级变更记录在 `docs/CHANGELOG.md` 中。

每次完成一组功能修改后，应执行一次版本收尾：

- 更新 `docs/CHANGELOG.md`。
- 根据影响范围更新 `docs/PRD.md`、`docs/TECHNICAL_PLAN.md` 和 `docs/WEB_TEST_DEPLOY.md`。
- 运行 `npm run docs:check` 检查文档完整性、UTF-8 编码、旧乱码标记和中文文件名。
- 如果修改了 JavaScript，运行 `npm run check`。
- 通过 GitHub Desktop 提交并推送到 `main` 分支。
