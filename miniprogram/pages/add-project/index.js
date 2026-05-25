// pages/add-project/index.js
Page({
  data: {
    form: {
      name: "",
      client: "",
      expectedIncome: "",
      description: "",
      startDate: "",
      firstPaymentDate: "",
      devStartDate: "",
      devEndDate: "",
      finalPaymentDate: "",
    },
    submitting: false,
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: e.detail.value,
    });
  },

  onDateChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: e.detail.value,
    });
  },

  validateForm() {
    const { name, client, expectedIncome } = this.data.form;

    if (!name.trim()) {
      wx.showToast({
        title: "请输入项目名称",
        icon: "none",
      });
      return false;
    }

    if (!client.trim()) {
      wx.showToast({
        title: "请输入客户名称",
        icon: "none",
      });
      return false;
    }

    if (!expectedIncome || Number(expectedIncome) <= 0) {
      wx.showToast({
        title: "请输入有效的预计收入",
        icon: "none",
      });
      return false;
    }

    return true;
  },

  async onSubmit() {
    if (!this.validateForm()) return;
    if (this.data.submitting) return;

    this.setData({ submitting: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "manageProject",
        data: {
          type: "createProject",
          data: {
            name: this.data.form.name.trim(),
            client: this.data.form.client.trim(),
            expectedIncome: Number(this.data.form.expectedIncome),
            description: this.data.form.description.trim(),
            startDate: this.data.form.startDate,
            firstPaymentDate: this.data.form.firstPaymentDate,
            devStartDate: this.data.form.devStartDate,
            devEndDate: this.data.form.devEndDate,
            finalPaymentDate: this.data.form.finalPaymentDate,
          },
        },
      });

      this.setData({ submitting: false });

      if (res.result.success) {
        wx.showToast({
          title: "创建成功",
          icon: "success",
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: "创建失败",
          icon: "error",
        });
      }
    } catch (e) {
      this.setData({ submitting: false });
      console.error("创建项目失败", e);
      wx.showToast({
        title: "创建失败",
        icon: "error",
      });
    }
  },
});
