const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), "phde-checkin-system-data") : path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "phde-state.json");
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "PHDE2026";
const ADMIN_COOKIE = "phde_admin_auth";
const ADMIN_TOKEN = process.env.ADMIN_SESSION_SECRET || `session-${ADMIN_PASSWORD}`;
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "America/Mexico_City";
const adminDocs = {
  prd: { title: "产品文档", file: path.join(ROOT, "docs", "PRD.md") },
  technical: { title: "技术方案", file: path.join(ROOT, "docs", "TECHNICAL_PLAN.md") },
};

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

let dbPool = null;
let dbReadyPromise = null;

function emptyState() {
  return { employees: [], checkins: [] };
}

function hasDatabase() {
  return Boolean(DATABASE_URL);
}

function businessDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function todayKey(date = new Date()) {
  const parts = businessDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function monthKey(date = new Date()) {
  const parts = businessDateParts(date);
  return `${parts.year}-${parts.month}`;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) writeFileState(emptyState());
}

function readFileState() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (Array.isArray(parsed.employees) && Array.isArray(parsed.checkins)) {
      return migrateLegacyState(parsed);
    }
  } catch {
    // If the prototype file is damaged, repair it to a clean state.
  }
  const repaired = emptyState();
  writeFileState(repaired);
  return repaired;
}

function migrateLegacyState(state) {
  let changed = false;
  state.checkins.forEach((record) => {
    if (record.editCount === undefined) {
      record.editCount = 0;
      changed = true;
    }
    if (record.time) {
      const recordDate = new Date(record.time);
      if (!Number.isNaN(recordDate.getTime())) {
        const date = todayKey(recordDate);
        const month = monthKey(recordDate);
        if (record.date !== date) {
          record.date = date;
          changed = true;
        }
        if (record.month !== month) {
          record.month = month;
          changed = true;
        }
      }
    }
  });
  if (changed) writeFileState(state);
  return state;
}

function writeFileState(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function ensureDatabase() {
  if (!hasDatabase()) return false;
  if (dbReadyPromise) {
    await dbReadyPromise;
    return true;
  }

  dbPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: IS_VERCEL ? { rejectUnauthorized: false } : undefined,
  });

  dbReadyPromise = (async () => {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        employee_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        remark TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        time TIMESTAMPTZ NOT NULL,
        manual_location TEXT NOT NULL DEFAULT '',
        auto_address TEXT NOT NULL DEFAULT '',
        location_status TEXT NOT NULL DEFAULT 'denied',
        edit_count INTEGER NOT NULL DEFAULT 0,
        original_time TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT checkins_employee_date_unique UNIQUE (employee_id, date)
      );
    `);
  })();

  try {
    await dbReadyPromise;
    return true;
  } catch (error) {
    dbReadyPromise = null;
    dbPool = null;
    throw error;
  }
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

function mapEmployeeRow(row) {
  return {
    name: row.name,
    employeeId: row.employee_id,
    phone: row.phone,
    email: row.email,
    remark: row.remark,
  };
}

function mapCheckinRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    date: row.date,
    month: row.month,
    time: new Date(row.time).toISOString(),
    manualLocation: row.manual_location,
    autoAddress: row.auto_address,
    locationStatus: row.location_status,
    editCount: Number(row.edit_count || 0),
    originalTime: row.original_time ? new Date(row.original_time).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

async function readDatabaseState() {
  await ensureDatabase();
  const [employeesResult, checkinsResult] = await Promise.all([
    dbPool.query(`
      SELECT employee_id, name, phone, email, remark
      FROM employees
      ORDER BY employee_id ASC
    `),
    dbPool.query(`
      SELECT id, employee_id, name, date, month, time, manual_location, auto_address, location_status, edit_count, original_time, updated_at
      FROM checkins
      ORDER BY time DESC
    `),
  ]);

  return {
    employees: employeesResult.rows.map(mapEmployeeRow),
    checkins: checkinsResult.rows.map(mapCheckinRow),
  };
}

async function readState() {
  if (hasDatabase()) return readDatabaseState();
  return readFileState();
}

async function upsertEmployee(employee, client = dbPool) {
  await client.query(
    `
      INSERT INTO employees (employee_id, name, phone, email, remark, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (employee_id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        remark = EXCLUDED.remark,
        updated_at = NOW()
    `,
    [employee.employeeId, employee.name, employee.phone, employee.email, employee.remark],
  );
}

async function importEmployees(rows) {
  if (!hasDatabase()) {
    const state = readFileState();
    let imported = 0;

    rows.forEach((row) => {
      const employee = normalizeEmployee(row);
      if (!employee.name || !employee.employeeId) return;
      const index = state.employees.findIndex((item) => item.employeeId === employee.employeeId);
      if (index >= 0) state.employees[index] = employee;
      else state.employees.push(employee);
      imported += 1;
    });

    writeFileState(state);
    return { imported, state };
  }

  await ensureDatabase();
  let imported = 0;

  for (const row of rows) {
    const employee = normalizeEmployee(row);
    if (!employee.name || !employee.employeeId) continue;
    await upsertEmployee(employee);
    imported += 1;
  }

  return { imported, state: await readDatabaseState() };
}

async function resetState() {
  if (!hasDatabase()) {
    const state = emptyState();
    writeFileState(state);
    return state;
  }

  await ensureDatabase();
  await dbPool.query("DELETE FROM checkins");
  await dbPool.query("DELETE FROM employees");
  return emptyState();
}

async function saveCheckin(body) {
  if (!hasDatabase()) {
    const state = readFileState();
    const formEmployee = normalizeEmployee(body, "员工自助登记");
    const validationMessage = validateEmployee(formEmployee);
    if (validationMessage) throw { statusCode: 400, message: validationMessage };

    const employeeIndex = state.employees.findIndex((item) => item.employeeId === formEmployee.employeeId);
    const existingEmployee = employeeIndex >= 0 ? state.employees[employeeIndex] : null;
    if (existingEmployee && existingEmployee.name !== formEmployee.name) {
      throw { statusCode: 400, message: "工号与姓名不匹配。" };
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
        throw {
          statusCode: 409,
          message: `今日签到已修改过，不能再次修改。当前签到时间：${existingCheckin.time}，${checkinLocationText(existingCheckin)}`,
        };
      }

      existingCheckin.originalTime = existingCheckin.originalTime || existingCheckin.time;
      existingCheckin.time = new Date().toISOString();
      existingCheckin.manualLocation = normalizeText(body.manualLocation);
      existingCheckin.autoAddress = normalizeText(body.autoAddress) || "未授权";
      existingCheckin.locationStatus = normalizeText(body.locationStatus) || "denied";
      existingCheckin.editCount = Number(existingCheckin.editCount || 0) + 1;
      existingCheckin.updatedAt = existingCheckin.time;
      writeFileState(state);
      return { record: existingCheckin, state, action: "updated" };
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
    writeFileState(state);
    return { record, state, action: "created" };
  }

  await ensureDatabase();
  const formEmployee = normalizeEmployee(body, "员工自助登记");
  const validationMessage = validateEmployee(formEmployee);
  if (validationMessage) throw { statusCode: 400, message: validationMessage };

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      "SELECT employee_id, name, phone, email, remark FROM employees WHERE employee_id = $1",
      [formEmployee.employeeId],
    );
    const existingEmployee = employeeResult.rows[0] ? mapEmployeeRow(employeeResult.rows[0]) : null;

    if (existingEmployee && existingEmployee.name !== formEmployee.name) {
      throw { statusCode: 400, message: "工号与姓名不匹配。" };
    }

    if (existingEmployee) {
      await upsertEmployee(
        {
          ...existingEmployee,
          phone: formEmployee.phone,
          email: formEmployee.email || existingEmployee.email,
        },
        client,
      );
    } else {
      await upsertEmployee(formEmployee, client);
    }

    const date = todayKey();
    const checkinResult = await client.query(
      `
        SELECT id, employee_id, name, date, month, time, manual_location, auto_address, location_status, edit_count, original_time, updated_at
        FROM checkins
        WHERE employee_id = $1 AND date = $2
        FOR UPDATE
      `,
      [formEmployee.employeeId, date],
    );

    if (checkinResult.rows[0]) {
      const existingCheckin = mapCheckinRow(checkinResult.rows[0]);

      if (!canModifyCheckin(existingCheckin)) {
        throw {
          statusCode: 409,
          message: `今日签到已修改过，不能再次修改。当前签到时间：${existingCheckin.time}，${checkinLocationText(existingCheckin)}`,
        };
      }

      const updatedTime = new Date().toISOString();
      const updatedRecord = {
        ...existingCheckin,
        name: formEmployee.name,
        month: monthKey(),
        time: updatedTime,
        manualLocation: normalizeText(body.manualLocation),
        autoAddress: normalizeText(body.autoAddress) || "未授权",
        locationStatus: normalizeText(body.locationStatus) || "denied",
        editCount: Number(existingCheckin.editCount || 0) + 1,
        originalTime: existingCheckin.originalTime || existingCheckin.time,
        updatedAt: updatedTime,
      };

      await client.query(
        `
          UPDATE checkins
          SET
            name = $3,
            month = $4,
            time = $5,
            manual_location = $6,
            auto_address = $7,
            location_status = $8,
            edit_count = $9,
            original_time = $10,
            updated_at = $11
          WHERE employee_id = $1 AND date = $2
        `,
        [
          formEmployee.employeeId,
          date,
          updatedRecord.name,
          updatedRecord.month,
          updatedRecord.time,
          updatedRecord.manualLocation,
          updatedRecord.autoAddress,
          updatedRecord.locationStatus,
          updatedRecord.editCount,
          updatedRecord.originalTime,
          updatedRecord.updatedAt,
        ],
      );

      await client.query("COMMIT");
      return { record: updatedRecord, state: await readDatabaseState(), action: "updated" };
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

    await client.query(
      `
        INSERT INTO checkins (
          id, employee_id, name, date, month, time, manual_location, auto_address, location_status, edit_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        record.id,
        record.employeeId,
        record.name,
        record.date,
        record.month,
        record.time,
        record.manualLocation,
        record.autoAddress,
        record.locationStatus,
        record.editCount,
      ],
    );

    await client.query("COMMIT");
    return { record, state: await readDatabaseState(), action: "created" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendJsonWithHeaders(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { message });
}

function getEffectiveUrl(req) {
  const incomingUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rewrittenPath = incomingUrl.searchParams.get("__pathname");

  if (!rewrittenPath) return incomingUrl;

  incomingUrl.pathname = rewrittenPath.startsWith("/") ? rewrittenPath : `/${rewrittenPath}`;
  incomingUrl.searchParams.delete("__pathname");
  return incomingUrl;
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

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        if (index < 0) return [item, ""];
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function isAdminRequest(req) {
  return parseCookies(req)[ADMIN_COOKIE] === ADMIN_TOKEN;
}

function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;
  sendError(res, 401, "请先登录管理后台。");
  return false;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const body = await parseBody(req);
      if (normalizeText(body.password) !== ADMIN_PASSWORD) {
        sendError(res, 401, "管理员密码不正确。");
        return;
      }
      sendJsonWithHeaders(res, 200, { authenticated: true }, {
        "Set-Cookie": `${ADMIN_COOKIE}=${encodeURIComponent(ADMIN_TOKEN)}; Path=/; HttpOnly; SameSite=Lax`,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      sendJsonWithHeaders(res, 200, { authenticated: false }, {
        "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/session") {
      sendJson(res, 200, { authenticated: isAdminRequest(req) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/docs") {
      if (!requireAdmin(req, res)) return;
      const doc = adminDocs[url.searchParams.get("name")];
      if (!doc) return sendError(res, 404, "文档不存在。");
      sendJson(res, 200, {
        title: doc.title,
        content: fs.readFileSync(doc.file, "utf8"),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, await readState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/checkins") {
      const body = await parseBody(req);
      sendJson(res, 200, await saveCheckin(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/employees/import") {
      const body = await parseBody(req);
      const rows = Array.isArray(body.employees) ? body.employees : [];
      sendJson(res, 200, await importEmployees(rows));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reset-empty") {
      sendJson(res, 200, { state: await resetState() });
      return;
    }

    sendError(res, 404, "接口不存在。");
  } catch (error) {
    sendError(res, error.statusCode || 500, error.message || "服务器异常。");
  }
}

function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Docs are not public in the check-in prototype.");
    return;
  }
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
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function requestListener(req, res) {
  const url = getEffectiveUrl(req);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
}

if (require.main === module) {
  http.createServer(requestListener).listen(PORT, () => {
    console.log(`PHDE签到系统已启动：http://localhost:${PORT}`);
  });
}

module.exports = requestListener;
