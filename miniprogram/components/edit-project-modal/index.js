// components/edit-project-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    project: {
      type: Object,
      value: null,
    },
  },

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
  },

  observers: {
    "project": function(project) {
      if (project) {
        this.setData({
          form: {
            name: project.name || "",
            client: project.client || "",
            expectedIncome: project.expectedIncome || "",
            description: project.description || "",
            startDate: project.startDate || "",
            firstPaymentDate: project.firstPaymentDate || "",
            devStartDate: project.devStartDate || "",
            devEndDate: project.devEndDate || "",
            finalPaymentDate: project.finalPaymentDate || "",
          },
        });
      }
    },
  },

  methods: {
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

    onClose() {
      this.triggerEvent("close");
    },

    onSubmit() {
      const { name, client, expectedIncome, description, startDate, firstPaymentDate, devStartDate, devEndDate, finalPaymentDate } = this.data.form;

      if (!name.trim()) {
        wx.showToast({
          title: "请输入项目名称",
          icon: "none",
        });
        return;
      }

      if (!client.trim()) {
        wx.showToast({
          title: "请输入客户名称",
          icon: "none",
        });
        return;
      }

      if (!expectedIncome || Number(expectedIncome) <= 0) {
        wx.showToast({
          title: "请输入有效的预计收入",
          icon: "none",
        });
        return;
      }

      this.triggerEvent("submit", {
        name: name.trim(),
        client: client.trim(),
        expectedIncome: Number(expectedIncome),
        description: description.trim(),
        startDate,
        firstPaymentDate,
        devStartDate,
        devEndDate,
        finalPaymentDate,
      });
    },
  },
});
