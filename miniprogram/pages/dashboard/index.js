// pages/dashboard/index.js
const CURRENT_YEAR = new Date().getFullYear();

const STATUS_ITEMS = [
  { name: "未开始", dotClass: "dot-gray" },
  { name: "开发中", dotClass: "dot-blue" },
  { name: "开发完成", dotClass: "dot-purple" },
  { name: "现场调试中", dotClass: "dot-orange" },
  { name: "已交付运维中", dotClass: "dot-green" },
];

Page({
  data: {
    loading: true,
    hideAmount: true, // 默认隐藏金额
    statusItems: [],
    selectedYear: CURRENT_YEAR,
    selectedYearIndex: 0,
    yearOptions: [String(CURRENT_YEAR)],
    yearStats: {
      totalExpectedIncome: 0,
      totalReceivedAmount: 0,
      totalUnreceivedAmount: 0,
      projectCount: 0,
    },
    stats: {
      totalExpectedIncome: 0,
      totalReceivedAmount: 0,
      totalUnreceivedAmount: 0,
      receivedPercent: 0,
      totalProjects: 0,
      statusCount: {},
      recentIncomes: [],
      receivedProjects: [],
      unreceivedProjects: [],
      projectList: [],
    },
    showProjectPopup: false,
    popupTitle: '',
    popupType: '',
    popupProjects: [],
  },

  // 切换金额显示/隐藏
  toggleAmountVisibility() {
    this.setData({
      hideAmount: !this.data.hideAmount
    });
  },

  onLoad() {
    this.loadDashboardStats();
  },

  onShow() {
    this.loadDashboardStats();
  },

  async loadDashboardStats() {
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "getDashboardStats",
        },
      });

      if (res.result.success) {
        const data = res.result.data;
        const { yearOptions, selectedYearIndex } = this.buildYearOptions(
          data.minYear,
          data.currentYear,
          data.yearStatsByYear
        );
        const selectedYear = yearOptions[selectedYearIndex]
          ? parseInt(yearOptions[selectedYearIndex], 10)
          : CURRENT_YEAR;
        this.setData({
          stats: data,
          statusItems: this.buildStatusItems(data.statusCount),
          yearOptions,
          selectedYear,
          selectedYearIndex,
          yearStats: this.getYearStats(data.yearStatsByYear, selectedYear),
          loading: false,
        });
      } else {
        console.error("获取统计数据失败", res.result.errMsg);
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error("调用云函数失败", e);
      this.setData({ loading: false });
    }
  },

  buildStatusItems(statusCount) {
    if (!statusCount) return [];
    return STATUS_ITEMS.map((item) => ({
      ...item,
      count: statusCount[item.name] || 0,
    })).filter((item) => item.count > 0);
  },

  buildYearOptions(minYear, maxYear, yearStatsByYear) {
    const endYear = maxYear || CURRENT_YEAR;
    let startYear = minYear != null ? minYear : endYear;
    if (yearStatsByYear) {
      Object.keys(yearStatsByYear).forEach((key) => {
        const y = parseInt(key, 10);
        if (!isNaN(y) && y < startYear) startYear = y;
      });
    }
    const yearOptions = [];
    for (let y = endYear; y >= startYear; y--) {
      yearOptions.push(String(y));
    }
    const defaultYear = endYear;
    let selectedYearIndex = yearOptions.indexOf(String(defaultYear));
    if (selectedYearIndex < 0) selectedYearIndex = 0;
    return { yearOptions, selectedYearIndex };
  },

  getYearStats(yearStatsByYear, year) {
    const empty = {
      totalExpectedIncome: 0,
      totalReceivedAmount: 0,
      totalUnreceivedAmount: 0,
      projectCount: 0,
    };
    if (!yearStatsByYear) return empty;
    return yearStatsByYear[year] || yearStatsByYear[String(year)] || empty;
  },

  onYearChange(e) {
    const index = Number(e.detail.value);
    const year = parseInt(this.data.yearOptions[index], 10);
    this.setData({
      selectedYearIndex: index,
      selectedYear: year,
      yearStats: this.getYearStats(this.data.stats.yearStatsByYear, year),
    });
  },

  goToProjectList() {
    wx.navigateTo({
      url: "/pages/projects/index",
    });
  },

  goToAddProject() {
    wx.navigateTo({
      url: "/pages/add-project/index",
    });
  },

  goToProjectDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/project-detail/index?id=${id}`,
    });
  },

  onPullDownRefresh() {
    this.loadDashboardStats();
    wx.stopPullDownRefresh();
  },

  getYearFromStartDate(startDate) {
    if (!startDate) return null;
    const match = String(startDate).match(/^(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
  },

  getYearProjectsByType(type, year) {
    const list = this.data.stats.projectList || [];
    const filtered = list.filter((p) => {
      if (this.getYearFromStartDate(p.startDate) !== year) return false;
      if (type === "received") return p.receivedAmount > 0;
      if (type === "unreceived") return p.unreceivedAmount > 0;
      return true;
    });
    if (type === "received") {
      return filtered.sort((a, b) => b.receivedAmount - a.receivedAmount);
    }
    if (type === "unreceived") {
      return filtered.sort((a, b) => b.unreceivedAmount - a.unreceivedAmount);
    }
    return filtered.sort((a, b) => b.expectedIncome - a.expectedIncome);
  },

  openProjectPopup(type, projects, title) {
    this.setData({
      showProjectPopup: true,
      popupTitle: title,
      popupType: type,
      popupProjects: projects,
    });
  },

  showReceivedProjects() {
    this.openProjectPopup(
      "received",
      this.data.stats.receivedProjects || [],
      "已到账项目"
    );
  },

  showUnreceivedProjects() {
    this.openProjectPopup(
      "unreceived",
      this.data.stats.unreceivedProjects || [],
      "未到账项目"
    );
  },

  showYearProjects(e) {
    const { type } = e.currentTarget.dataset;
    const year = this.data.selectedYear;
    const titleMap = {
      expected: `${year}年 · 预计收入`,
      received: `${year}年 · 已到账`,
      unreceived: `${year}年 · 未到账`,
    };
    this.openProjectPopup(
      type,
      this.getYearProjectsByType(type, year),
      titleMap[type] || `${year}年项目`
    );
  },

  closeProjectPopup() {
    this.setData({
      showProjectPopup: false,
    });
  },
});
