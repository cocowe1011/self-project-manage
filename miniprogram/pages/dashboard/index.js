// pages/dashboard/index.js
Page({
  data: {
    loading: true,
    hideAmount: true, // 默认隐藏金额
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
        this.setData({
          stats: res.result.data,
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

  formatAmount(amount) {
    return amount.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  showReceivedProjects() {
    this.setData({
      showProjectPopup: true,
      popupTitle: '已到账项目',
      popupType: 'received',
      popupProjects: this.data.stats.receivedProjects || [],
    });
  },

  showUnreceivedProjects() {
    this.setData({
      showProjectPopup: true,
      popupTitle: '未到账项目',
      popupType: 'unreceived',
      popupProjects: this.data.stats.unreceivedProjects || [],
    });
  },

  closeProjectPopup() {
    this.setData({
      showProjectPopup: false,
    });
  },
});
