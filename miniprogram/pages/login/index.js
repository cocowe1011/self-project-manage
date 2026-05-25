// pages/login/index.js
const VALID_PASSWORDS = ['17862971264', '15963135153'];

Page({
  data: {
    password: ''
  },

  onLoad() {
    // 检查是否已登录
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const loginTime = wx.getStorageSync('loginTime');
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    
    if (isLoggedIn && loginTime && (now - loginTime < SEVEN_DAYS)) {
      // 已登录且未过期，直接跳转首页
      wx.redirectTo({
        url: '/pages/dashboard/index'
      });
    }
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  onLogin() {
    const { password } = this.data;
    
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    if (VALID_PASSWORDS.includes(password)) {
      // 登录成功，保存登录状态
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('loginTime', Date.now());
      
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
      
      // 跳转到首页
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/dashboard/index'
        });
      }, 1000);
    } else {
      wx.showToast({
        title: '密码错误',
        icon: 'error'
      });
    }
  }
});
