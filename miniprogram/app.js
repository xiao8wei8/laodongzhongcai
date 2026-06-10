// app.js - 小程序入口
const apiService = require('./utils/api.js');

App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 初始化全局数据
    this.globalData = {
      userInfo: wx.getStorageSync('userInfo') || null,
      token: wx.getStorageSync('token') || '',
      apiBaseUrl: 'https://www.saifchat.com/laodongzhongcai/api',
      // 开发环境请改成：'http://localhost:5003/api'
    };

    // 检查登录状态
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (!token) {
      // 未登录，跳转登录页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 100);
    }
  },

  // 保存登录信息
  setLoginInfo(token, userInfo) {
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);
    this.globalData.token = token;
    this.globalData.userInfo = userInfo;
  },

  // 退出登录
  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.reLaunch({
      url: '/pages/login/login'
    });
  },

  globalData: {
    userInfo: null,
    token: '',
    apiBaseUrl: 'https://www.saifchat.com/laodongzhongcai/api'
  }
});
