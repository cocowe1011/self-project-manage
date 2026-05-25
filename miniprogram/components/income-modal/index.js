// components/income-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    amount: "",
    receivedAt: new Date().getTime(),
    remark: "",
    paymentMethod: "wechat",
    showDatePicker: false,
    minDate: new Date(2020, 0, 1).getTime(),
    maxDate: new Date().getTime(),
  },

  methods: {
    onAmountInput(e) {
      this.setData({ amount: e.detail.value });
    },

    onRemarkInput(e) {
      this.setData({ remark: e.detail.value });
    },

    onShowDatePicker() {
      this.setData({ showDatePicker: true });
    },

    onCloseDatePicker() {
      this.setData({ showDatePicker: false });
    },

    onConfirmDate(e) {
      this.setData({
        receivedAt: e.detail,
        showDatePicker: false,
      });
    },

    onSelectPayment(e) {
      const method = e.currentTarget.dataset.method;
      this.setData({ paymentMethod: method });
    },

    formatDate(timestamp) {
      const d = new Date(timestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },

    onClose() {
      this.triggerEvent("close");
    },

    onSubmit() {
      const { amount, receivedAt, remark, paymentMethod } = this.data;

      if (!amount || Number(amount) <= 0) {
        wx.showToast({
          title: "请输入有效金额",
          icon: "none",
        });
        return;
      }

      this.triggerEvent("submit", {
        amount: Number(amount),
        receivedAt: this.formatDate(receivedAt),
        paymentMethod,
        remark: remark.trim(),
      });

      // 重置表单
      this.setData({
        amount: "",
        receivedAt: new Date().getTime(),
        remark: "",
        paymentMethod: "wechat",
      });
    },

    onOverlayClick() {
      this.onClose();
    },
  },
});
