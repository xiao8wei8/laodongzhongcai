// pages/profile/profile.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    userInfo: {}, firstChar: '', roleText: '',
    stats: { total: 0, inProgress: 0, completed: 0 }
  },

  onShow() { this.loadUserInfo(); this.loadStats(); },

  loadUserInfo() {
    const userInfo = util.getUserInfo() || {};
    const name = userInfo.name || userInfo.username || '用户';
    this.setData({
      userInfo,
      firstChar: name.charAt(0) || '用',
      roleText: util.getRoleText(userInfo.role)
    });
  },

  async loadStats() {
    try {
      const result = await api.getMyCases();
      const cases = result.data || result.cases || [];
      this.setData({
        stats: {
          total: cases.length,
          inProgress: cases.filter(c => c.status === 'in_progress' || c.status === 'pending').length,
          completed: cases.filter(c => c.status === 'completed').length
        }
      });
    } catch (e) {}
  },

  goMyCases() { wx.switchTab({ url: '/pages/my-cases/my-cases' }); },
  goApply() { wx.navigateTo({ url: '/pages/case-apply/case-apply' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  editProfile() { util.showToast('功能开发中'); },

  changePassword() {
    wx.showModal({ title: '修改密码', content: '请在Web端修改密码', showCancel: false });
  },

  showAbout() {
    wx.showModal({ title: '关于我们', content: '劳动仲裁调解系统\n为劳动者提供便捷的调解服务\n\n版本 v1.0.0', showCancel: false });
  },

  logout() {
    wx.showModal({
      title: '确认退出', content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          getApp().logout();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});
