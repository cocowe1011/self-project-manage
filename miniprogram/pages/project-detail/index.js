// pages/project-detail/index.js

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
    projectId: "",
    project: null,
    logs: [],
    statusList: ["未开始", "开发中", "开发完成", "现场调试中", "已交付运维中"],
    statusListWithClass: [],
    showStatusSheet: false,
    showIncomeModal: false,
    showEditModal: false
  },

  onLoad(options) {
    // 初始化带类名的状态列表
    this.setData({
      statusListWithClass: this.data.statusList.map(status => ({
        name: status,
        class: STATUS_CLASS_MAP[status]
      }))
    });

    if (options.id) {
      this.setData({ projectId: options.id });
      this.loadProjectDetail();
      this.loadProjectLogs();
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.loadProjectDetail();
      this.loadProjectLogs();
    }
  },

  async loadProjectDetail() {
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "getProjectDetail",
          projectId: this.data.projectId,
        },
      });

      if (res.result.success) {
        const project = res.result.data;
        project.statusClass = STATUS_CLASS_MAP[project.status] || "not-started";
        this.setData({
          project,
          loading: false,
        });
      } else {
        console.error("获取项目详情失败", res.result.errMsg);
        this.setData({ loading: false });
        wx.showToast({
          title: "加载失败",
          icon: "error",
        });
      }
    } catch (e) {
      console.error("调用云函数失败", e);
      this.setData({ loading: false });
    }
  },

  async loadProjectLogs() {
    try {
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "getProjectLogs",
          projectId: this.data.projectId,
        },
      });

      if (res.result.success) {
        this.setData({ logs: res.result.data });
      }
    } catch (e) {
      console.error("获取项目日志失败", e);
    }
  },

  showStatusActionSheet() {
    this.setData({ showStatusSheet: true });
  },

  onCloseStatusSheet() {
    this.setData({ showStatusSheet: false });
  },

  async onSelectStatus(e) {
    const status = e.currentTarget.dataset.status;
    if (!status || status === this.data.project.status) {
      this.setData({ showStatusSheet: false });
      return;
    }

    this.setData({ showStatusSheet: false });

    try {
      wx.showLoading({ title: "更新中..." });
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "updateProjectStatus",
          data: {
            projectId: this.data.projectId,
            status: status,
          },
        },
      });

      wx.hideLoading();

      if (res.result.success) {
        wx.showToast({
          title: "状态已更新",
          icon: "success",
        });
        this.loadProjectDetail();
        this.loadProjectLogs();
      } else {
        wx.showToast({
          title: "更新失败",
          icon: "error",
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error("更新状态失败", e);
    }
  },

  showIncomeModal() {
    this.setData({ showIncomeModal: true });
  },

  onCloseIncomeModal() {
    this.setData({ showIncomeModal: false });
  },

  async onSubmitIncome(e) {
    const { amount, receivedAt, remark } = e.detail;

    try {
      wx.showLoading({ title: "提交中..." });
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "addIncomeRecord",
          data: {
            projectId: this.data.projectId,
            amount,
            receivedAt,
            remark,
          },
        },
      });

      wx.hideLoading();

      if (res.result.success) {
        wx.showToast({
          title: "添加成功",
          icon: "success",
        });
        this.setData({ showIncomeModal: false });
        this.loadProjectDetail();
        this.loadProjectLogs();
      } else {
        wx.showToast({
          title: "添加失败",
          icon: "error",
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error("添加收入记录失败", e);
    }
  },

  formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    const second = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  // 编辑项目相关
  showEditModal() {
    this.setData({ showEditModal: true });
  },

  onCloseEditModal() {
    this.setData({ showEditModal: false });
  },

  async onSubmitEdit(e) {
    const { name, client, expectedIncome, description, startDate, firstPaymentDate, devStartDate, devEndDate, finalPaymentDate } = e.detail;

    try {
      wx.showLoading({ title: "保存中..." });
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "updateProject",
          data: {
            projectId: this.data.projectId,
            name,
            client,
            expectedIncome,
            description,
            startDate,
            firstPaymentDate,
            devStartDate,
            devEndDate,
            finalPaymentDate,
          },
        },
      });

      wx.hideLoading();

      if (res.result.success) {
        wx.showToast({
          title: "修改成功",
          icon: "success",
        });
        this.setData({ showEditModal: false });
        this.loadProjectDetail();
        this.loadProjectLogs();
      } else {
        wx.showToast({
          title: "修改失败",
          icon: "error",
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error("修改项目失败", e);
    }
  },

  // 删除收入记录
  async onDeleteIncome(e) {
    const { id, amount } = e.currentTarget.dataset;

    const res = await wx.showModal({
      title: "确认删除",
      content: `确定要删除这笔 ¥${amount} 的回款记录吗？`,
      confirmText: "删除",
      confirmColor: "#FF4D4F",
    });

    if (!res.confirm) return;

    try {
      wx.showLoading({ title: "删除中..." });
      const result = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "deleteIncomeRecord",
          data: {
            recordId: id,
          },
        },
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({
          title: "删除成功",
          icon: "success",
        });
        this.loadProjectDetail();
        this.loadProjectLogs();
      } else {
        wx.showToast({
          title: "删除失败",
          icon: "error",
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error("删除收入记录失败", e);
    }
  },

  // 作废项目
  async onCancelProject() {
    const res = await wx.showModal({
      title: "确认作废",
      content: "作废后项目将标记为「已作废」，可随时重新启用，确定要继续吗？",
      confirmText: "确认作废",
      confirmColor: "#FF4D4F",
    });

    if (!res.confirm) return;

    try {
      wx.showLoading({ title: "作废中..." });
      const result = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "cancelProject",
          data: {
            projectId: this.data.projectId,
          },
        },
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({ title: "项目已作废", icon: "success" });
        this.loadProjectDetail();
        this.loadProjectLogs();
      } else {
        wx.showToast({ title: "操作失败", icon: "error" });
      }
    } catch (e) {
      wx.hideLoading();
      console.error("作废项目失败", e);
    }
  },

  // 重新启用项目
  async onReopenProject() {
    const res = await wx.showModal({
      title: "确认重新启用",
      content: "将项目恢复为「未开始」状态，确定要继续吗？",
      confirmText: "重新启用",
      confirmColor: "#1677FF",
    });

    if (!res.confirm) return;

    try {
      wx.showLoading({ title: "启用中..." });
      const result = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "reopenProject",
          data: {
            projectId: this.data.projectId,
          },
        },
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({ title: "项目已重新启用", icon: "success" });
        this.loadProjectDetail();
        this.loadProjectLogs();
      } else {
        wx.showToast({ title: "操作失败", icon: "error" });
      }
    } catch (e) {
      wx.hideLoading();
      console.error("重新启用项目失败", e);
    }
  },

  onPullDownRefresh() {
    Promise.all([this.loadProjectDetail(), this.loadProjectLogs()]).then(() => {
      wx.stopPullDownRefresh();
    });
  },
});
