const STORAGE_KEY = "phde_checkin_state_v5";
const ADMIN_SESSION_KEY = "phde_admin";
const THEME_KEY = "phde_theme";
const BUSINESS_TIME_ZONE = "Asia/Shanghai";

const locations = [
  "光启园办公室",
  "惠南办公室",
  "祝祥苑办公室",
  "常熟工厂",
  "海外出差",
  "国内出差",
  "居家办公",
];

const locationAddressMap = {
  光启园办公室: "城市：上海，大概位置：光启园办公区附近",
  惠南办公室: "城市：上海，大概位置：惠南办公区附近",
  祝祥苑办公室: "城市：上海，大概位置：祝祥苑办公区附近",
  常熟工厂: "城市：苏州，大概位置：常熟工厂附近",
  海外出差: "城市：当前城市，大概位置：海外出差地点附近",
  国内出差: "城市：当前城市，大概位置：国内出差地点附近",
  居家办公: "城市：当前城市，大概位置：居家办公地点附近",
};

function emptyState() {
  return { employees: [], checkins: [] };
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

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let state = emptyState();
let isAdmin = false;
let apiAvailable = false;
let liveLocation = {
  address: "定位获取中",
  status: "pending",
  latitude: null,
  longitude: null,
  updatedAt: "",
  message: "",
};
let locationWatchId = null;
let leafletMap = null;
let leafletMarker = null;

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

async function init() {
  initTheme();
  qs("#adminDate").value = todayKey();
  qs("#adminMonth").value = monthKey();
  renderLocationOptions();
  bindEvents();
  route();
  await loadState();
  await syncAdminSession();
  startRealtimeLocation();
  renderAll();
}

function bindEvents() {
  window.addEventListener("hashchange", route);
  qs("#checkinForm").addEventListener("submit", handleCheckin);
  qs("#employeeNameInput").addEventListener("input", autofillEmployeeProfile);
  qs("#employeeNameInput").addEventListener("blur", autofillEmployeeProfile);
  qs("#employeeIdInput").addEventListener("input", renderCheckinPreview);
  qs("#employeeIdInput").addEventListener("blur", syncEmployeeProfileFromId);
  qs("#employeePhoneInput").addEventListener("input", renderCheckinPreview);
  qs("#locationSelect").addEventListener("change", renderCheckinPreview);
  qs("#locationSelect").addEventListener("change", () => {
    syncLocationChoices();
    renderLiveLocationMap();
  });
  qs("#locationChoiceList").addEventListener("click", handleLocationChoice);
  qs("#retryLocation").addEventListener("click", startRealtimeLocation);
  qs("#employeeFilter").addEventListener("input", renderStatusList);
  qs("#adminLoginForm").addEventListener("submit", handleAdminLogin);
  qs("#logoutAdmin").addEventListener("click", logoutAdmin);
  qs("#adminDate").addEventListener("change", renderAdmin);
  qs("#adminMonth").addEventListener("change", renderAdmin);
  qs("#exportDay").addEventListener("click", () => exportDayDetail(qs("#adminDate").value));
  qs("#exportMonthDetail").addEventListener("click", () => exportMonthDetail(qs("#adminMonth").value));
  qs("#exportMonthSummary").addEventListener("click", () => exportMonthSummary(qs("#adminMonth").value));
  qs("#exportEmployees").addEventListener("click", exportEmployees);
  qs("#importEmployees").addEventListener("click", importEmployees);
  qs("#resetEmpty").addEventListener("click", resetEmptyData);
  qs("#themeToggle").addEventListener("click", toggleTheme);
  qs("#loadPrdDoc").addEventListener("click", () => loadAdminDoc("prd"));
  qs("#loadTechDoc").addEventListener("click", () => loadAdminDoc("technical"));
}

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(storedTheme || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalizedTheme;
  const toggle = qs("#themeToggle");
  if (!toggle) return;
  const isDark = normalizedTheme === "dark";
  toggle.textContent = isDark ? "浅色" : "深色";
  toggle.setAttribute("aria-pressed", String(isDark));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "请求失败。");
  return payload;
}

async function loadState() {
  try {
    state = migrateState(await apiRequest("/api/state"));
    apiAvailable = true;
    return;
  } catch {
    apiAvailable = false;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.employees) && Array.isArray(parsed.checkins)) {
        state = migrateState(parsed);
        return;
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  state = emptyState();
  saveLocalState();
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function migrateState(nextState) {
  nextState.checkins.forEach((record) => {
    if (record.editCount === undefined) record.editCount = 0;
    if (record.time) {
      const recordDate = new Date(record.time);
      if (!Number.isNaN(recordDate.getTime())) {
        record.date = todayKey(recordDate);
        record.month = monthKey(recordDate);
      }
    }
  });
  return nextState;
}

function route() {
  const routeName = location.hash === "#admin" ? "admin" : "employee";
  qs("#employeePage").classList.toggle("hidden", routeName !== "employee");
  qs("#adminPage").classList.toggle("hidden", routeName !== "admin");
  qsa("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === routeName));
  renderAdminAuth();
}

function renderLocationOptions() {
  qs("#locationSelect").innerHTML = locations.map((loc) => `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`).join("");
  qs("#locationChoiceList").innerHTML = locations
    .map((loc) => `<button class="location-choice" type="button" data-location="${escapeHtml(loc)}">${escapeHtml(loc)}</button>`)
    .join("");
  syncLocationChoices();
}

function handleLocationChoice(event) {
  const button = event.target.closest("[data-location]");
  if (!button) return;
  qs("#locationSelect").value = button.dataset.location;
  syncLocationChoices();
  renderCheckinPreview();
  renderLiveLocationMap();
}

function syncLocationChoices() {
  const selectedLocation = qs("#locationSelect").value;
  qsa(".location-choice").forEach((button) => {
    const selected = button.dataset.location === selectedLocation;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderAll() {
  renderEmployeeNameOptions();
  renderStatusList();
  renderCheckinHistory();
  renderCheckinPreview();
  renderAdmin();
}

function renderEmployeeNameOptions() {
  qs("#employeeNameOptions").innerHTML = state.employees
    .map((employee) => `<option value="${escapeHtml(employee.name)}"></option>`)
    .join("");
}

function readEmployeeForm() {
  const employeeId = qs("#employeeIdInput").value.trim();
  const existingEmployee = state.employees.find((item) => item.employeeId === employeeId);
  return {
    name: qs("#employeeNameInput").value.trim(),
    employeeId,
    phone: qs("#employeePhoneInput").value.trim(),
    email: existingEmployee?.email || `${employeeId || "employee"}@phde.local`,
    remark: "员工自助登记",
  };
}

function autofillEmployeeProfile() {
  const name = qs("#employeeNameInput").value.trim();
  if (!name) {
    renderCheckinPreview();
    return;
  }

  const employee = state.employees.find((item) => item.name === name);
  if (!employee) {
    renderCheckinPreview();
    return;
  }

  qs("#employeeIdInput").value = employee.employeeId || "";
  qs("#employeePhoneInput").value = employee.phone || "";
  renderCheckinPreview();
}

function syncEmployeeProfileFromId() {
  const employeeId = qs("#employeeIdInput").value.trim();
  const employee = state.employees.find((item) => item.employeeId === employeeId);
  if (employee) {
    if (!qs("#employeeNameInput").value.trim()) qs("#employeeNameInput").value = employee.name || "";
    if (!qs("#employeePhoneInput").value.trim()) qs("#employeePhoneInput").value = employee.phone || "";
  }
  renderCheckinPreview();
}

function renderCheckinPreview() {
  const hint = qs("#employeeCheckinHint");
  const submitButton = qs("#checkinSubmitButton");
  if (!hint || !submitButton) return;

  const name = qs("#employeeNameInput").value.trim();
  const employeeId = qs("#employeeIdInput").value.trim();
  const manualLocation = qs("#locationSelect").value;
  const employee = state.employees.find((item) => item.employeeId === employeeId);
  const todayRecord = state.checkins.find((item) => item.employeeId === employeeId && item.date === todayKey());

  hint.className = "checkin-hint";
  submitButton.textContent = "上班签到";
  renderCheckinStatusStrip(employee, todayRecord, name, employeeId);

  if (!name && !employeeId) {
    hint.innerHTML = "<strong>签到前确认</strong><p>输入姓名和工号后，系统会提示今日签到或修改状态。</p>";
    return;
  }

  if (!name || !employeeId) {
    hint.classList.add("warning");
    hint.innerHTML = "<strong>信息待补全</strong><p>请同时填写姓名和工号，系统会据此确认员工档案和今日签到状态。</p>";
    return;
  }

  if (employee && employee.name !== name) {
    hint.classList.add("error");
    hint.innerHTML = `<strong>工号与姓名不匹配</strong><p>工号 ${escapeHtml(employeeId)} 已登记为 ${escapeHtml(employee.name)}，请核对后再提交。</p>`;
    return;
  }

  if (!employee) {
    hint.classList.add("success");
    hint.innerHTML = `<strong>首次登记并签到</strong><p>提交后会自动建立员工档案，并记录今日地点：${escapeHtml(manualLocation)}。</p>`;
    return;
  }

  if (!todayRecord) {
    hint.classList.add("success");
    hint.innerHTML = `<strong>今日尚未签到</strong><p>${escapeHtml(employee.name)} 可提交今日上班签到，提交后仍有一次修改机会。</p>`;
    return;
  }

  submitButton.textContent = canModifyCheckin(todayRecord) ? "修改今日签到" : "今日已完成";

  if (canModifyCheckin(todayRecord)) {
    hint.classList.add("warning");
    hint.innerHTML = `<strong>今日已签到，可修改一次</strong><p>当前记录：${escapeHtml(formatTime(todayRecord.time))}，${escapeHtml(todayRecord.manualLocation)}。再次提交会用掉最后一次修改机会。</p>`;
    return;
  }

  hint.classList.add("error");
  hint.innerHTML = `<strong>今日修改机会已用完</strong><p>当前记录：${escapeHtml(formatTime(todayRecord.time))}，${escapeHtml(todayRecord.manualLocation)}。如需调整，请联系管理员。</p>`;
}

function renderCheckinStatusStrip(employee, todayRecord, name, employeeId) {
  const strip = qs("#checkinStatusStrip");
  if (!strip) return;

  let status = { tone: "", value: "待填写" };
  let edit = { tone: "", value: "填写后判断" };

  if (name && employeeId) {
    if (employee && employee.name !== name) {
      status = { tone: "error", value: "信息不匹配" };
      edit = { tone: "error", value: "不可提交" };
    } else if (!employee) {
      status = { tone: "success", value: "首次登记" };
      edit = { tone: "success", value: "签到后可改 1 次" };
    } else if (!todayRecord) {
      status = { tone: "success", value: "今日未签到" };
      edit = { tone: "success", value: "提交后可改 1 次" };
    } else if (canModifyCheckin(todayRecord)) {
      status = { tone: "warning", value: "今日已签到" };
      edit = { tone: "warning", value: "剩余最后 1 次" };
    } else {
      status = { tone: "error", value: "今日已完成" };
      edit = { tone: "error", value: "修改机会已用完" };
    }
  } else if (name || employeeId) {
    status = { tone: "warning", value: "信息待补全" };
  }

  const dataMode = apiAvailable ? "共享服务器" : "本机临时保存";
  strip.innerHTML = [
    statusPill("当前状态", status.value, status.tone),
    statusPill("修改机会", edit.value, edit.tone),
    statusPill("数据模式", dataMode, apiAvailable ? "success" : "warning"),
  ].join("");
}

function statusPill(label, value, tone = "") {
  return `<section class="status-pill ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></section>`;
}

function validateEmployeeForm(employee) {
  if (!employee.name) return "请输入姓名。";
  if (!employee.employeeId) return "请输入工号。";
  if (!employee.phone) return "请输入手机号。";
  return "";
}

function getEditCount(record) {
  return Number(record?.editCount || 0);
}

function canModifyCheckin(record) {
  return getEditCount(record) < 1;
}

function checkinLocationText(record) {
  return `签到地点：${record.manualLocation || "未填写"}，自动定位：${displayAutoAddress(record.autoAddress)}`;
}

function displayAutoAddress(value) {
  const address = String(value || "").trim();
  if (!address) return "未授权";
  if (address.includes("城市：") && address.includes("大概位置：")) return address;
  if (address === "未授权" || address === "自动定位异常" || address === "当前位置附近") return address;
  if (/纬度|经度|latitude|longitude/i.test(address)) return "城市：当前城市，大概位置：当前位置附近";
  return localizeFreeformAddress(address);
}

function localizeFreeformAddress(value) {
  const text = String(value || "").trim();
  const city = localizeCity(text);
  const road = localizeRoad(text);
  if (city && city !== "当前城市" && road && road !== "当地道路") return `城市：${city}，大概位置：${road}附近`;
  if (text.includes("Querétaro") || text.includes("Queretaro")) {
    return `城市：克雷塔罗，大概位置：${road || "当前位置"}附近`;
  }
  if (road && road !== "当地道路") return `城市：当前城市，大概位置：${road}附近`;
  return "城市：当前城市，大概位置：当地道路附近";
}

function compactAddressFromResult(result) {
  const address = result?.address || {};
  const city = localizeCity(address.city || address.town || address.village || address.county || address.state || "");
  const road = localizeRoad(address.road || address.pedestrian || address.residential || address.neighbourhood || address.suburb || address.city_district || "");

  if (city && road) return `城市：${city}，大概位置：${road}附近`;
  if (city) return `城市：${city}，大概位置：当前位置附近`;
  if (road) return `城市：未知，大概位置：${road}附近`;
  if (result?.display_name) return `城市：未知，大概位置：${localizeRoad(result.display_name.split(",")[0])}附近`;
  return "当前位置附近";
}

function localizeCity(value) {
  const city = String(value || "")
    .replace(/^Municipio de\s+/i, "")
    .replace(/^Municipality of\s+/i, "")
    .trim();

  const cityNames = {
    "Querétaro": "克雷塔罗",
    Queretaro: "克雷塔罗",
    "Santiago de Querétaro": "克雷塔罗",
    "Santiago de Queretaro": "克雷塔罗",
    "Mexico City": "墨西哥城",
    "Ciudad de México": "墨西哥城",
    CDMX: "墨西哥城",
    Shanghai: "上海",
    上海市: "上海",
    Suzhou: "苏州",
    苏州市: "苏州",
  };
  return cityNames[city] || (hasLatinText(city) ? "当前城市" : city);
}

function localizeRoad(value) {
  const road = String(value || "")
    .replace(/^Calle\s+/i, "")
    .replace(/^Avenida\s+/i, "")
    .replace(/^Av\.\s*/i, "")
    .replace(/^Boulevard\s+/i, "")
    .replace(/^Blvd\.\s*/i, "")
    .replace(/^Road\s+/i, "")
    .replace(/\s*,.*$/, "")
    .trim();

  const roadNames = {
    "Anillo Vial Fray Junípero Serra": "弗赖胡尼佩罗塞拉环路",
    "Anillo Vial Fray Junipero Serra": "弗赖胡尼佩罗塞拉环路",
    "Fray Junípero Serra": "弗赖胡尼佩罗塞拉路",
    "Fray Junipero Serra": "弗赖胡尼佩罗塞拉路",
  };

  if (roadNames[road]) return roadNames[road];
  if (!road) return "";
  if (hasLatinText(road)) return "当地道路";
  return road.endsWith("路") ? road : `${road}路`;
}

function hasLatinText(value) {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(String(value || ""));
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=zh-CN&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url);
    if (!response.ok) return "当前位置附近";
    return compactAddressFromResult(await response.json());
  } catch {
    return "当前位置附近";
  }
}

async function setLiveLocation(position) {
  const { latitude, longitude } = position.coords;
  liveLocation = {
    address: "正在解析当前位置...",
    status: "success",
    latitude,
    longitude,
    updatedAt: new Date().toISOString(),
  };
  renderLiveLocationMap();

  const address = await reverseGeocode(latitude, longitude);
  if (liveLocation.latitude === latitude && liveLocation.longitude === longitude) {
    liveLocation = { ...liveLocation, address };
    renderLiveLocationMap();
  }
}

function setLiveLocationError(error) {
  const denied = error?.code === 1;
  const insecureLan = window.location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(window.location.hostname);
  liveLocation = {
    address: denied ? "未授权" : "自动定位异常",
    status: denied ? "denied" : "error",
    latitude: null,
    longitude: null,
    updatedAt: new Date().toISOString(),
    message: denied
      ? "当前浏览器没有开放定位权限，系统将使用手动地点继续签到测试。"
      : insecureLan
        ? "手机通过局域网 HTTP 访问时，浏览器可能会禁止实时定位。"
        : "定位超时或设备暂时没有返回位置。",
  };
  renderLiveLocationMap();
}

function startRealtimeLocation() {
  if (!navigator.geolocation) {
    liveLocation = {
      ...liveLocation,
      address: "自动定位异常",
      status: "error",
      message: "当前浏览器不支持实时定位。",
    };
    renderLiveLocationMap();
    return;
  }

  if (locationWatchId !== null) navigator.geolocation.clearWatch(locationWatchId);
  liveLocation = { ...liveLocation, address: "定位获取中", status: "pending", message: "" };
  renderLiveLocationMap();
  locationWatchId = navigator.geolocation.watchPosition(setLiveLocation, setLiveLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 30000,
  });
}

function renderLiveLocationMap() {
  const status = qs("#liveLocationStatus");
  const text = qs("#liveLocationText");
  const techMap = qs("#liveLocationMap");
  const leafletMapEl = qs("#leafletLocationMap");
  const fallback = qs("#locationMapFallback");
  if (!status || !text || !techMap || !leafletMapEl || !fallback) return;

  if (liveLocation.status === "success") {
    const lat = liveLocation.latitude;
    const lon = liveLocation.longitude;
    const dotX = 42 + (((Math.abs(lon) * 1000) % 20) - 10);
    const dotY = 52 + (((Math.abs(lat) * 1000) % 16) - 8);
    const leafletReady = renderLeafletMap(lat, lon);
    status.textContent = "定位已更新";
    text.textContent = `${liveLocation.address}，更新时间：${formatTime(liveLocation.updatedAt)}`;
    fallback.hidden = true;
    leafletMapEl.hidden = !leafletReady;
    techMap.hidden = leafletReady;
    techMap.style.setProperty("--dot-x", `${dotX}%`);
    techMap.style.setProperty("--dot-y", `${dotY}%`);
    return;
  }

  status.textContent = liveLocation.status === "pending" ? "正在获取定位" : liveLocation.address;
  const manualLocation = qs("#locationSelect")?.value || "未选择";
  fallback.hidden = false;
  fallback.className = `location-map-fallback ${liveLocation.status}`;
  fallback.querySelector("strong").textContent =
    liveLocation.status === "pending" ? "等待定位授权" : liveLocation.status === "denied" ? "手动地点测试模式" : liveLocation.address;
  fallback.querySelector("span").textContent =
    liveLocation.status === "pending"
      ? `当前手动地点：${manualLocation}。允许定位后会切换为实时地图。`
      : `${liveLocation.message || "实时定位暂不可用。"} 当前手动地点：${manualLocation}。`;
  text.textContent =
    liveLocation.status === "pending"
      ? "请允许浏览器定位后查看实时位置。"
      : `自动定位：${liveLocation.address}。当前使用手动地点：${manualLocation}，签到可继续提交。`;
  techMap.hidden = true;
  leafletMapEl.hidden = true;
}

function renderLeafletMap(latitude, longitude) {
  const mapEl = qs("#leafletLocationMap");
  if (!mapEl || !window.L) return false;

  const center = [latitude, longitude];
  if (!leafletMap) {
    leafletMap = window.L.map(mapEl, {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    }).setView(center, 16);

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(leafletMap);

    leafletMarker = window.L.marker(center, {
      icon: window.L.divIcon({
        className: "leaflet-location-marker",
        html: "<span></span>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(leafletMap);
  } else {
    leafletMap.setView(center, 16);
    leafletMarker.setLatLng(center);
  }

  setTimeout(() => leafletMap.invalidateSize(), 0);
  return true;
}

async function handleCheckin(event) {
  event.preventDefault();
  const formEmployee = readEmployeeForm();
  const validationMessage = validateEmployeeForm(formEmployee);
  if (validationMessage) return showFeedback("error", validationMessage);

  const manualLocation = qs("#locationSelect").value;
  const existingEmployee = state.employees.find((item) => item.employeeId === formEmployee.employeeId);
  if (existingEmployee && existingEmployee.name !== formEmployee.name) {
    return showFeedback("error", "工号与姓名不匹配。");
  }

  const date = todayKey();
  const existingCheckin = state.checkins.find((item) => item.employeeId === formEmployee.employeeId && item.date === date);
  if (existingCheckin) {
    if (!canModifyCheckin(existingCheckin)) {
      showFeedback("error", `今日签到已修改过，不能再次修改。当前签到时间：${formatTime(existingCheckin.time)}，${checkinLocationText(existingCheckin)}`);
      return;
    }
    showFeedback("warning", `今日已签到，正在使用最后一次修改签到机会。当前签到时间：${formatTime(existingCheckin.time)}，${checkinLocationText(existingCheckin)}`);
  } else {
    showFeedback("warning", "正在获取定位并提交签到...");
  }

  const locationResult = await getAutoAddress(manualLocation);

  try {
    if (apiAvailable) {
      const payload = await apiRequest("/api/checkins", {
        method: "POST",
        body: JSON.stringify({
          ...formEmployee,
          manualLocation,
          autoAddress: locationResult.address,
          locationStatus: locationResult.status,
        }),
      });
      state = migrateState(payload.state);
      renderAll();
      qs("#checkinForm").reset();
      renderCheckinPreview();
      showCheckinSuccess(payload.record, payload.action);
      return;
    }

    const record = saveCheckinLocally(formEmployee, manualLocation, locationResult, existingCheckin);
    renderAll();
    qs("#checkinForm").reset();
    renderCheckinPreview();
    showCheckinSuccess(record, existingCheckin ? "updated" : "created");
  } catch (error) {
    showFeedback("error", error.message || "签到失败，请稍后再试。");
  }
}

function saveCheckinLocally(formEmployee, manualLocation, locationResult, existingCheckin) {
  const existingEmployee = state.employees.find((item) => item.employeeId === formEmployee.employeeId);
  if (existingEmployee) {
    existingEmployee.phone = formEmployee.phone;
    existingEmployee.email = formEmployee.email || existingEmployee.email;
  } else {
    state.employees.push(formEmployee);
  }

  if (existingCheckin) {
    existingCheckin.originalTime = existingCheckin.originalTime || existingCheckin.time;
    existingCheckin.time = new Date().toISOString();
    existingCheckin.manualLocation = manualLocation;
    existingCheckin.autoAddress = locationResult.address;
    existingCheckin.locationStatus = locationResult.status;
    existingCheckin.editCount = getEditCount(existingCheckin) + 1;
    existingCheckin.updatedAt = existingCheckin.time;
    saveLocalState();
    return existingCheckin;
  }

  const record = {
    id: `${formEmployee.employeeId}-${Date.now()}`,
    employeeId: formEmployee.employeeId,
    name: formEmployee.name,
    date: todayKey(),
    month: monthKey(),
    time: new Date().toISOString(),
    manualLocation,
    autoAddress: locationResult.address,
    locationStatus: locationResult.status,
    editCount: 0,
  };

  state.checkins.push(record);
  saveLocalState();
  return record;
}

function getAutoAddress(manualLocation) {
  if (liveLocation.status === "success" || liveLocation.status === "denied" || liveLocation.status === "error") {
    const address = liveLocation.address === "正在解析当前位置..." ? "当前位置附近" : liveLocation.address;
    return Promise.resolve({ address, status: liveLocation.status });
  }

  if (!navigator.geolocation) return Promise.resolve({ address: "自动定位异常", status: "error" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLiveLocation(position);
        resolve({ address: locationAddressMap[manualLocation] || "设备当前位置附近", status: "success" });
      },
      (error) => {
        setLiveLocationError(error);
        resolve({ address: liveLocation.address, status: liveLocation.status });
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });
}

function showCheckinSuccess(record, action) {
  const prefix = action === "updated" ? "签到修改成功" : "签到成功";
  const opportunity = canModifyCheckin(record) ? "还有一次修改签到机会" : "这是最后一次修改签到机会";
  showFeedback("success", `${prefix}。${record.name}，签到时间：${formatTime(record.time)}，签到地点：${record.manualLocation}，自动定位：${displayAutoAddress(record.autoAddress)}。${opportunity}。`);
}

function showFeedback(type, message) {
  const feedback = qs("#feedback");
  feedback.className = `feedback show ${type}`;
  feedback.textContent = message;
}

function todaysRows() {
  const date = todayKey();
  return state.employees
    .map((employee) => {
      const checkin = state.checkins.find((item) => item.employeeId === employee.employeeId && item.date === date);
      return { employee, checkin };
    })
    .sort((a, b) => {
      if (a.checkin && b.checkin) return new Date(b.checkin.time) - new Date(a.checkin.time);
      if (a.checkin) return -1;
      if (b.checkin) return 1;
      return a.employee.employeeId.localeCompare(b.employee.employeeId, "zh-CN");
    });
}

function renderStatusList() {
  const keyword = qs("#employeeFilter").value.trim().toLowerCase();
  const rows = todaysRows().filter(({ employee }) => {
    return (
      !keyword ||
      employee.name.toLowerCase().includes(keyword) ||
      employee.employeeId.toLowerCase().includes(keyword) ||
      employee.phone.toLowerCase().includes(keyword)
    );
  });
  const signed = state.checkins.filter((item) => item.date === todayKey()).length;
  qs("#todaySigned").textContent = signed;
  qs("#todayTotal").textContent = state.employees.length;

  if (!rows.length) {
    qs("#statusList").innerHTML = `<article class="person-row"><div><strong>暂无员工信息</strong><div class="person-meta"><span>员工首次签到后会自动出现在这里。</span></div></div><span class="badge pending">待登记</span></article>`;
    return;
  }

  qs("#statusList").innerHTML = rows
    .map(({ employee, checkin }) => {
      const signedHtml = checkin
        ? `<span>时间：${escapeHtml(formatTime(checkin.time))}</span><span>地点：${escapeHtml(checkin.manualLocation)}</span><span>自动定位：${escapeHtml(displayAutoAddress(checkin.autoAddress))}</span>`
        : '<span>自动定位：待签到</span><span>今日暂无签到记录</span>';
      const editBadgeHtml = checkin
        ? `<span class="edit-chip ${canModifyCheckin(checkin) ? "available" : "used"}">${canModifyCheckin(checkin) ? "可修改 1 次" : "修改已用完"}</span>`
        : "";
      return `
        <article class="person-row">
          <div>
            <div class="person-title">
              <strong>${escapeHtml(employee.name)}</strong>
              ${editBadgeHtml}
            </div>
            <div class="person-meta">
              <span>工号：${escapeHtml(employee.employeeId)}</span>
              ${signedHtml}
            </div>
          </div>
          <span class="badge ${checkin ? "signed" : "pending"}">${checkin ? "已签到" : "未签到"}</span>
        </article>
      `;
    })
    .join("");
}

function renderCheckinHistory() {
  const historyList = qs("#historyList");
  const historyCount = qs("#historyCount");
  if (!historyList || !historyCount) return;

  const today = todayKey();
  const rows = state.checkins
    .filter((record) => record.date !== today)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 30);

  historyCount.textContent = `${rows.length} 条往日记录`;
  historyList.innerHTML = rows.length
    ? rows
        .map(
          (record) => `
        <article class="history-row">
          <div>
            <strong>${escapeHtml(record.name)}</strong>
            <span>${escapeHtml(record.date)} ${escapeHtml(formatTime(record.time).split(" ").pop() || "")}</span>
          </div>
          <p>${escapeHtml(record.manualLocation || "未填写地点")} · ${escapeHtml(displayAutoAddress(record.autoAddress))}</p>
        </article>
      `,
        )
        .join("")
    : '<article class="history-row empty"><strong>暂无往日签到动态</strong><p>员工完成跨日期签到后，这里会显示最近 30 条历史记录。</p></article>';
}

async function handleAdminLogin(event) {
  event.preventDefault();
  try {
    await apiRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: qs("#adminPassword").value }),
    });
    isAdmin = true;
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    qs("#adminPassword").value = "";
    renderAdminAuth();
    renderAdmin();
  } catch (error) {
    if (String(error.message || "").includes("接口不存在")) {
      alert("当前运行的本地服务还是旧版本，请先关闭旧的启动窗口，再重新运行 start.bat 或 start-3001.bat。");
      return;
    }
    alert(error.message || "管理密码不正确。");
  }
}

async function logoutAdmin() {
  isAdmin = false;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  if (apiAvailable) {
    try {
      await apiRequest("/api/admin/logout", { method: "POST", body: "{}" });
    } catch {
      // The local UI can still clear its session if the server is unavailable.
    }
  }
  renderAdminAuth();
}

async function syncAdminSession() {
  try {
    const payload = await apiRequest("/api/admin/session");
    isAdmin = Boolean(payload.authenticated);
  } catch {
    isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1" && !apiAvailable;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, isAdmin ? "1" : "0");
  renderAdminAuth();
}

function renderAdminAuth() {
  qs("#adminLogin").classList.toggle("hidden", isAdmin);
  qs("#adminDashboard").classList.toggle("hidden", !isAdmin);
}

function renderAdmin() {
  if (!isAdmin) return;
  const selectedDate = qs("#adminDate").value || todayKey();
  const selectedMonth = qs("#adminMonth").value || monthKey();
  const dayRecords = state.checkins.filter((item) => item.date === selectedDate).sort((a, b) => new Date(b.time) - new Date(a.time));
  const monthRecords = state.checkins.filter((item) => item.month === selectedMonth);

  qs("#adminTodaySigned").textContent = state.checkins.filter((item) => item.date === todayKey()).length;
  qs("#adminTotalEmployees").textContent = state.employees.length;
  qs("#adminMonthCount").textContent = monthRecords.length;

  qs("#dayRecords").innerHTML = dayRecords.length
    ? dayRecords
        .map(
          (record) => `
        <tr>
          <td>${escapeHtml(record.name)}</td>
          <td>${escapeHtml(record.employeeId)}</td>
          <td>${escapeHtml(formatTime(record.time))}</td>
          <td>${escapeHtml(record.manualLocation)}</td>
          <td>${escapeHtml(displayAutoAddress(record.autoAddress))}</td>
          <td>${canModifyCheckin(record) ? "剩余 1 次" : "已用完"}</td>
        </tr>
      `,
        )
        .join("")
    : '<tr><td colspan="6">当前日期暂无签到记录</td></tr>';

  const summary = state.employees.map((employee) => {
    const records = monthRecords.filter((record) => record.employeeId === employee.employeeId);
    records.sort((a, b) => new Date(b.time) - new Date(a.time));
    return { employee, count: new Set(records.map((record) => record.date)).size, latest: records[0] };
  });

  qs("#monthSummary").innerHTML = summary.length
    ? summary
        .map(
          ({ employee, count, latest }) => `
      <tr>
        <td>${escapeHtml(employee.name)}</td>
        <td>${escapeHtml(employee.employeeId)}</td>
        <td>${count}</td>
        <td>${latest ? escapeHtml(formatTime(latest.time)) : "暂无"}</td>
      </tr>
    `,
        )
        .join("")
    : '<tr><td colspan="4">暂无员工信息</td></tr>';
}

async function loadAdminDoc(docName) {
  const title = qs("#adminDocTitle");
  const content = qs("#adminDocContent");
  title.textContent = docName === "prd" ? "产品文档" : "技术方案";
  content.textContent = "正在读取文档...";

  try {
    const payload = await apiRequest(`/api/admin/docs?name=${encodeURIComponent(docName)}`);
    title.textContent = payload.title || title.textContent;
    content.textContent = payload.content || "文档暂无内容。";
  } catch (error) {
    content.textContent = error.message || "读取文档失败，请重新登录后台后再试。";
  }
}

function parseImportText(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitImportLine(lines[0]).map((item) => item.trim());
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitImportLine(line).map((item) => item.trim());
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
      return {
        name: row["姓名"],
        employeeId: row["工号"],
        phone: row["手机号"],
        email: row["邮箱"],
        remark: row["备注"],
      };
    })
    .filter((item) => item.name && item.employeeId);
}

function splitImportLine(line) {
  return line.includes("\t") ? line.split("\t") : line.split(",");
}

async function importEmployees() {
  const rows = parseImportText(qs("#employeeImport").value);
  if (!rows.length) {
    alert("没有识别到员工数据，请确认表头为：姓名、工号、手机号、邮箱、备注。");
    return;
  }

  const acceptedRows = [];
  rows.forEach((row) => {
    const index = state.employees.findIndex((employee) => employee.employeeId === row.employeeId);
    if (index >= 0) {
      const overwrite = confirm(`工号 ${row.employeeId} 已存在，是否覆盖原员工信息？选择“取消”则跳过。`);
      if (!overwrite) return;
    }
    acceptedRows.push(row);
  });

  if (!acceptedRows.length) {
    alert("没有导入新的员工信息。");
    return;
  }

  try {
    if (apiAvailable) {
      const payload = await apiRequest("/api/employees/import", {
        method: "POST",
        body: JSON.stringify({ employees: acceptedRows }),
      });
      state = migrateState(payload.state);
    } else {
      acceptedRows.forEach((row) => {
        const index = state.employees.findIndex((employee) => employee.employeeId === row.employeeId);
        if (index >= 0) state.employees[index] = row;
        else state.employees.push(row);
      });
      saveLocalState();
    }
    renderAll();
    alert(`导入完成，共处理 ${acceptedRows.length} 条员工信息。`);
  } catch (error) {
    alert(error.message || "导入失败，请稍后再试。");
  }
}

async function resetEmptyData() {
  if (!confirm("确认清空原型数据？当前员工信息和签到记录会被清空。")) return;
  try {
    if (apiAvailable) {
      const payload = await apiRequest("/api/reset-empty", { method: "POST", body: "{}" });
      state = migrateState(payload.state);
    } else {
      state = emptyState();
      saveLocalState();
    }
    renderAll();
    showFeedback("success", "原型数据已清空。");
  } catch (error) {
    alert(error.message || "清空失败，请稍后再试。");
  }
}

function exportDayDetail(date) {
  const rows = state.checkins
    .filter((item) => item.date === date)
    .map((item) => ({
      姓名: item.name,
      工号: item.employeeId,
      签到日期: item.date,
      签到时间: formatTime(item.time),
      手动地点: item.manualLocation,
      自动定位: displayAutoAddress(item.autoAddress),
      修改机会: canModifyCheckin(item) ? "剩余 1 次" : "已用完",
    }));
  downloadExcel(`PHDE签到系统-签到记录-${date}.xls`, rows);
}

function exportMonthDetail(month) {
  const rows = state.checkins
    .filter((item) => item.month === month)
    .map((item) => ({
      姓名: item.name,
      工号: item.employeeId,
      签到日期: item.date,
      签到时间: formatTime(item.time),
      手动地点: item.manualLocation,
      自动定位: displayAutoAddress(item.autoAddress),
      修改机会: canModifyCheckin(item) ? "剩余 1 次" : "已用完",
    }));
  downloadExcel(`PHDE签到系统-月度签到记录-${month}.xls`, rows);
}

function exportMonthSummary(month) {
  const rows = state.employees.map((employee) => {
    const records = state.checkins.filter((item) => item.employeeId === employee.employeeId && item.month === month);
    records.sort((a, b) => new Date(b.time) - new Date(a.time));
    return {
      姓名: employee.name,
      工号: employee.employeeId,
      本月签到天数: new Set(records.map((record) => record.date)).size,
      最近签到: records[0] ? formatTime(records[0].time) : "",
    };
  });
  downloadExcel(`PHDE签到系统-月度签到统计-${month}.xls`, rows);
}

function exportEmployees() {
  const rows = state.employees.map((employee) => ({
    姓名: employee.name,
    工号: employee.employeeId,
    手机号: employee.phone,
    邮箱: employee.email,
    备注: employee.remark,
  }));
  downloadExcel("PHDE签到系统-员工名单.xls", rows);
}

function downloadExcel(filename, rows) {
  const body = rows.length ? rows : [{ 暂无数据: "暂无数据" }];
  const headers = Object.keys(body[0]);
  const html = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <table border="1">
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
          <tbody>
            ${body.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

init();
