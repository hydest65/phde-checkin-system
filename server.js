const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "phde-state.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function emptyState() {
  return { employees: [], checkins: [] };
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) writeState(emptyState());
}

function readState() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (Array.isArray(parsed.employees) && Array.isArray(parsed.checkins)) {
      return migrateState(parsed);
    }
  } catch {
    // If the prototype file is damaged, repair it to a clean state.
  }
  const repaired = emptyState();
  writeState(repaired);
  return repaired;
}

function migrateState(state) {
  let changed = false;
  state.checkins.forEach((record) => {
    if (record.editCount === undefined) {
      record.editCount = 0;
      changed = true;
    }
  });
  if (changed) writeState(state);
  return state;
}

function writeState(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmployee(row, defaultRemark = "") {
  return {
    name: normalizeText(row.name),
    employeeId: normalizeText(row.employeeId),
    phone: normalizeText(row.phone),
    email: normalizeText(row.email),
    remark: normalizeText(row.remark) || defaultRemark,
  };
}

function validateEmployee(employee) {
  if (!employee.name) return "请输入姓名。";
  if (!employee.employeeId) return "请输入工号。";
  if (!employee.phone) return "请输入手机号。";
  return "";
}

function canModifyCheckin(record) {
  return Number(record.editCount || 0) < 1;
}

function checkinLocationText(record) {
  return `签到地点：${record.manualLocation || "未填写"}，自动定位：${record.autoAddress || "未授权"}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error("请求内容过大"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("请求格式不是有效 JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, readState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/checkins") {
      const body = await parseBody(req);
      const state = readState();
      const formEmployee = normalizeEmployee(body, "员工自助登记");
      const validationMessage = validateEmployee(formEmployee);
      if (validationMessage) return sendError(res, 400, validationMessage);

      const employeeByName = state.employees.find((item) => item.name === formEmployee.name);
      if (employeeByName && employeeByName.employeeId !== formEmployee.employeeId) {
        return sendError(res, 400, "工号与姓名不匹配。");
      }

      const employeeIndex = state.employees.findIndex((item) => item.employeeId === formEmployee.employeeId);
      const existingEmployee = employeeIndex >= 0 ? state.employees[employeeIndex] : null;
      if (existingEmployee && existingEmployee.name !== formEmployee.name) {
        return sendError(res, 400, "工号与姓名不匹配。");
      }

      const date = todayKey();
      const existingCheckin = state.checkins.find((item) => item.employeeId === formEmployee.employeeId && item.date === date);

      if (existingEmployee) {
        state.employees[employeeIndex] = {
          ...existingEmployee,
          phone: formEmployee.phone,
          email: formEmployee.email || existingEmployee.email,
        };
      } else {
        state.employees.push(formEmployee);
      }

      if (existingCheckin) {
        if (!canModifyCheckin(existingCheckin)) {
          return sendError(res, 409, `今日签到已修改过，不能再次修改。当前签到时间：${existingCheckin.time}，${checkinLocationText(existingCheckin)}`);
        }

        existingCheckin.originalTime = existingCheckin.originalTime || existingCheckin.time;
        existingCheckin.time = new Date().toISOString();
        existingCheckin.manualLocation = normalizeText(body.manualLocation);
        existingCheckin.autoAddress = normalizeText(body.autoAddress) || "未授权";
        existingCheckin.locationStatus = normalizeText(body.locationStatus) || "denied";
        existingCheckin.editCount = Number(existingCheckin.editCount || 0) + 1;
        existingCheckin.updatedAt = existingCheckin.time;
        writeState(state);
        sendJson(res, 200, { record: existingCheckin, state, action: "updated" });
        return;
      }

      const record = {
        id: `${formEmployee.employeeId}-${Date.now()}`,
        employeeId: formEmployee.employeeId,
        name: formEmployee.name,
        date,
        month: monthKey(),
        time: new Date().toISOString(),
        manualLocation: normalizeText(body.manualLocation),
        autoAddress: normalizeText(body.autoAddress) || "未授权",
        locationStatus: normalizeText(body.locationStatus) || "denied",
        editCount: 0,
      };
      state.checkins.push(record);
      writeState(state);
      sendJson(res, 200, { record, state, action: "created" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/employees/import") {
      const body = await parseBody(req);
      const rows = Array.isArray(body.employees) ? body.employees : [];
      const state = readState();
      let imported = 0;

      rows.forEach((row) => {
        const employee = normalizeEmployee(row);
        if (!employee.name || !employee.employeeId) return;
        const index = state.employees.findIndex((item) => item.employeeId === employee.employeeId);
        if (index >= 0) state.employees[index] = employee;
        else state.employees.push(employee);
        imported += 1;
      });

      writeState(state);
      sendJson(res, 200, { imported, state });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reset-empty") {
      const state = emptyState();
      writeState(state);
      sendJson(res, 200, { state });
      return;
    }

    sendError(res, 404, "接口不存在。");
  } catch (error) {
    sendError(res, 500, error.message || "服务器异常。");
  }
}

function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    res.end(content);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  })
  .listen(PORT, () => {
    console.log(`PHDE签到系统已启动：http://localhost:${PORT}`);
  });
