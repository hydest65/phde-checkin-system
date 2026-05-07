const { request } = require("../../utils/api");
const { todayKey, formatDateTime } = require("../../utils/format");

const LOCATIONS = [
  "光启园办公室",
  "惠南办公室",
  "祝祥苑办公室",
  "常熟工厂",
  "海外出差",
  "国内出差",
  "居家办公",
  "其他",
];

Page({
  data: {
    form: {
      name: "",
      employeeId: "",
      phone: "",
      email: "",
      manualLocation: LOCATIONS[0],
    },
    locations: LOCATIONS,
    selectedLocationIndex: 0,
    customLocation: "",
    autoAddress: "未获取",
    locationStatus: "denied",
    feedback: "",
    feedbackType: "success",
    loading: false,
    refreshing: false,
    employeeCount: 0,
    checkedInCount: 0,
    pendingCount: 0,
    lastCheckinTime: "",
    statusRows: [],
    recentHistory: [],
  },

  onLoad() {
    this.loadState();
  },

  onPullDownRefresh() {
    this.loadState().finally(() => wx.stopPullDownRefresh());
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  handleLocationChange(event) {
    const index = Number(event.detail.value || 0);
    const selected = LOCATIONS[index] || LOCATIONS[0];
    this.setData({
      selectedLocationIndex: index,
      "form.manualLocation": selected === "其他" ? this.data.customLocation : selected,
    });
  },

  handleCustomLocationInput(event) {
    const value = event.detail.value;
    this.setData({
      customLocation: value,
      "form.manualLocation": value,
    });
  },

  chooseLocation() {
    wx.getLocation({
      type: "gcj02",
      success: (result) => {
        const address = `纬度 ${Number(result.latitude).toFixed(6)}, 经度 ${Number(result.longitude).toFixed(6)}`;
        this.setData({
          autoAddress: address,
          locationStatus: "granted",
          feedback: "定位已更新。",
          feedbackType: "success",
        });
      },
      fail: (error) => {
        const errMsg = String(error?.errMsg || "");
        const denied = errMsg.includes("auth deny") || errMsg.includes("system permission denied");
        this.setData({
          autoAddress: denied ? "定位未授权" : "定位获取失败",
          locationStatus: "denied",
          feedbackType: "error",
          feedback: denied
            ? "定位权限未开启。请先允许小程序获取位置，或在开发者工具中设置模拟定位后再试。"
            : "定位获取失败，请确认开发者工具已开启定位模拟，或稍后重试。",
        });
      },
    });
  },

  async submitCheckin() {
    if (this.data.loading) return;

    const manualLocation = String(this.data.form.manualLocation || "").trim();
    if (!manualLocation) {
      this.setData({
        feedbackType: "error",
        feedback: "请先选择或填写签到地点。",
      });
      return;
    }

    this.setData({ loading: true, feedback: "" });

    try {
      const payload = await request("/api/checkins", {
        method: "POST",
        data: {
          ...this.data.form,
          manualLocation,
          autoAddress: this.data.autoAddress,
          locationStatus: this.data.locationStatus,
        },
      });

      const resetLocationIndex = this.data.selectedLocationIndex === LOCATIONS.indexOf("其他") ? LOCATIONS.indexOf("其他") : 0;
      this.setData({
        feedbackType: "success",
        feedback: `${payload.action === "updated" ? "签到已更新" : "签到成功"}，时间 ${formatDateTime(payload.record.time)}`,
        form: {
          ...this.data.form,
          manualLocation: resetLocationIndex === LOCATIONS.indexOf("其他") ? "" : LOCATIONS[resetLocationIndex],
        },
        selectedLocationIndex: resetLocationIndex,
        customLocation: "",
      });

      await this.loadState();
    } catch (error) {
      this.setData({
        feedbackType: "error",
        feedback: error.message || "签到失败，请稍后重试。",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadState() {
    this.setData({ refreshing: true });

    try {
      const state = await request("/api/state");
      const today = todayKey();
      const checkinMap = new Map(
        (state.checkins || [])
          .filter((item) => item.date === today)
          .map((item) => [item.employeeId, item]),
      );

      const statusRows = (state.employees || [])
        .map((employee) => {
          const checkin = checkinMap.get(employee.employeeId);
          return {
            employeeId: employee.employeeId,
            name: employee.name,
            phone: employee.phone,
            checkedIn: Boolean(checkin),
            checkinTime: checkin ? formatDateTime(checkin.time) : "",
            manualLocation: checkin?.manualLocation || "",
          };
        })
        .sort((left, right) => {
          if (left.checkedIn !== right.checkedIn) return left.checkedIn ? -1 : 1;
          return String(left.employeeId).localeCompare(String(right.employeeId), "zh-CN");
        });

      const todayCheckins = (state.checkins || [])
        .filter((item) => item.date === today)
        .sort((left, right) => new Date(right.time) - new Date(left.time));

      this.setData({
        employeeCount: (state.employees || []).length,
        checkedInCount: todayCheckins.length,
        pendingCount: Math.max((state.employees || []).length - todayCheckins.length, 0),
        lastCheckinTime: todayCheckins[0] ? formatDateTime(todayCheckins[0].time) : "暂无",
        statusRows,
        recentHistory: todayCheckins.slice(0, 5).map((item) => ({
          id: item.id,
          name: item.name,
          time: formatDateTime(item.time),
          location: item.manualLocation || "未填写",
          autoAddress: item.autoAddress || "未授权",
        })),
      });
    } catch (error) {
      this.setData({
        feedbackType: "error",
        feedback: error.message || "状态加载失败。",
      });
    } finally {
      this.setData({ refreshing: false });
    }
  },
});
