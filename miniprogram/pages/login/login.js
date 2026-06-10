// pages/login/login.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    username: '',
    password: '',
    role: 'personal',
    loading: false
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onRoleChange(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  // 账号密码登录
  async onLogin() {
    const { username, password, role } = this.data;
    if (!username.trim()) {
      util.showError('请输入账号');
      return;
    }
    if (!password.trim()) {
      util.showError('请输入密码');
      return;
    }

    this.setData({ loading: true });
    util.showLoading('登录中...');

    try {
      const result = await api.login(username.trim(), password.trim(), role);

      if (result.token) {
        // 保存登录信息
        const app = getApp();
        app.setLoginInfo(result.token, result.userInfo);
        util.hideLoading();
        util.showSuccess('登录成功');

        setTimeout(() => {
          wx.switchTab({
            url: '/pages/home/home'
          });
        }, 800);
      } else {
        util.showError(result.message || '登录失败');
      }
    } catch (err) {
      util.hideLoading();
      util.showError(err.message || '登录失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 微信快捷登录
  onWechatLogin() {
    util.showLoading('正在获取微信信息...');
    wx.login({
      success: async (loginRes) => {
        if (loginRes.code) {
          try {
            const result = await api.wechatLogin(loginRes.code);
            if (result && result.token) {
              const app = getApp();
              app.setLoginInfo(result.token, result.userInfo);
              util.hideLoading();
              util.showSuccess('登录成功');
              setTimeout(() => {
                wx.switchTab({
                  url: '/pages/home/home'
                });
              }, 800);
            } else {
              util.hideLoading();
              util.showError(result.message || '微信登录失败');
            }
          } catch (err) {
            util.hideLoading();
            util.showError('微信登录失败，请使用账号密码登录');
          }
        } else {
          util.hideLoading();
          util.showError('获取微信信息失败');
        }
      },
      fail: () => {
        util.hideLoading();
        util.showError('微信登录失败');
      }
    });
  },

  goRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  }
});
