# 微信小程序部署说明

## 目录

小程序骨架位于：

```text
miniprogram/
```

## 当前能力

- 员工签到
- 今日签到状态查看
- 管理员登录
- 员工 JSON 导入
- 清空测试数据

## 接口配置

先修改：

```text
miniprogram/app.js
```

把：

```js
apiBaseUrl: "https://your-domain.example.com"
```

替换成你的线上 HTTPS 域名，例如：

```js
apiBaseUrl: "https://phde-checkin-system.vercel.app"
```

## 微信后台配置

需要把后端域名加入微信小程序后台的“服务器域名”：

- 必须是 `https`
- 必须是已备案域名
- 请求域名要和 `apiBaseUrl` 一致

## 本地调试

1. 打开微信开发者工具
2. 选择“导入项目”
3. 项目目录选择：

```text
phde-checkin-system/miniprogram
```

4. 填入你自己的小程序 `AppID`
5. 在开发者工具里预览、调试、上传

## 后端改动

为了兼容小程序，服务端已支持两种管理员鉴权：

- Web 端 `Cookie`
- 小程序端 `Authorization: Bearer <token>`

管理员登录成功后，`/api/admin/login` 会返回 `token`，小程序会自动保存并用于导入、清空等管理接口。

## 下一步建议

如果要正式上线，建议继续补这几项：

- 员工导入改为上传 Excel/CSV，而不是粘贴 JSON
- 管理端补“按日期查询签到记录”
- 接入微信登录或企业微信身份体系
- 把 `America/Mexico_City` 时区配置和小程序展示时区统一起来
