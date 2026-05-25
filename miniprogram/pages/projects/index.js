// pages/projects/index.js

// 状态到英文类名的映射
const STATUS_CLASS_MAP = {
  "未开始": "not-started",
  "开发中": "in-development",
  "开发完成": "development-complete",
  "现场调试中": "on-site-debugging",
  "已交付运维中": "delivered",
  "已作废": "cancelled",
};

Page({
  data: {
    loading: true,
    projects: [],
    filteredProjects: [],
    searchKeyword: "",
    selectedStatus: 0,
    statusList: ["全部", "未开始", "开发中", "开发完成", "现场调试中", "已交付运维中", "已作废"],
  },

  onLoad() {
    this.loadProjects();
  },

  onShow() {
    this.loadProjects();
  },

  async loadProjects() {
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "getProjectList",
        },
      });

      if (res.result.success) {
        const projects = res.result.data.map(p => ({
          ...p,
          statusClass: STATUS_CLASS_MAP[p.status] || 'not-started'
        }));
        this.setData({
          projects,
          filteredProjects: projects,
          loading: false,
        });
        this.filterProjects();
      } else {
        console.error("获取项目列表失败", res.result.errMsg);
        this.setData({ loading: false });
      }
    } catch (e) {
      console.error("调用云函数失败", e);
      this.setData({ loading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.filterProjects();
  },

  onStatusChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      selectedStatus: index,
    });
    this.filterProjects();
  },

  filterProjects() {
    const { projects, searchKeyword, selectedStatus, statusList } = this.data;
    let filtered = projects;

    // 按关键词筛选
    if (searchKeyword) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          p.client.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    // 按状态筛选（selectedStatus > 0 表示不是"全部"）
    if (selectedStatus > 0) {
      const statusText = statusList[selectedStatus];
      filtered = filtered.filter((p) => p.status === statusText);
    }

    this.setData({ filteredProjects: filtered });
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/project-detail/index?id=${id}`,
    });
  },

  goToAddProject() {
    wx.navigateTo({
      url: "/pages/add-project/index",
    });
  },

  onPullDownRefresh() {
    this.loadProjects();
    wx.stopPullDownRefresh();
  },
});
