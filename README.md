# PHDE Check-In System

PHDE签到系统是一个轻量 Web 原型，用于员工上班签到、今日签到状态查看、管理员记录查询、员工名单导入和 Excel 兼容导出。

## Local Start

Double-click:

```text
start.bat
```

If port 3000 is already in use, double-click:

```text
start-3001.bat
```

Or run:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Admin

Prototype admin password:

```text
PHDE2026
```

## Data

Runtime data is stored in:

```text
data/phde-state.json
```

This file is ignored by Git because it may contain test employee information.

## Documentation

- `docs/PRD.md`
- `docs/TECHNICAL_PLAN.md`
- `docs/WEB_TEST_DEPLOY.md`
- `docs/CHANGELOG.md`
- `docs/DOC_UPDATE_RULES.md`

Run document checks with:

```bash
npm run docs:check
```
