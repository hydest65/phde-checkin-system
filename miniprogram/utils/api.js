const ADMIN_TOKEN_KEY = "phde_admin_token";

function getBaseUrl() {
  const app = getApp();
  return String(app?.globalData?.apiBaseUrl || "").replace(/\/$/, "");
}

function getAdminToken() {
  return wx.getStorageSync(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  if (token) wx.setStorageSync(ADMIN_TOKEN_KEY, token);
  else wx.removeStorageSync(ADMIN_TOKEN_KEY);
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      reject(new Error("请先在 miniprogram/app.js 中配置 apiBaseUrl。"));
      return;
    }

    wx.request({
      url: `${baseUrl}${path}`,
      method: options.method || "GET",
      data: options.data,
      timeout: options.timeout || 15000,
      header: {
        "content-type": "application/json",
        ...(options.withAuth && getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}),
        ...(options.header || {}),
      },
      success(response) {
        const payload = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(payload);
          return;
        }
        reject(new Error(payload.message || "请求失败。"));
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络异常，请稍后重试。"));
      },
    });
  });
}

function loginAdmin(password) {
  return request("/api/admin/login", {
    method: "POST",
    data: { password },
  }).then((payload) => {
    setAdminToken(payload.token || "");
    return payload;
  });
}

function logoutAdmin() {
  const token = getAdminToken();
  setAdminToken("");
  return request("/api/admin/logout", {
    method: "POST",
    header: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

module.exports = {
  request,
  getAdminToken,
  setAdminToken,
  loginAdmin,
  logoutAdmin,
};
