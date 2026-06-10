// pages/home/home.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: { userInfo: {}, roleText: '', broadcasts: [], recentCases: [] },

  onLoad() { this.loadUserInfo(); },
  onShow() { this.loadBroadcasts(); this.loadMyCases(); },
  onPullDownRefresh() { this.loadBroadcasts(); this.loadMyCases(); wx.stopPullDownRefresh(); },

  loadUserInfo() {
    const userInfo = util.getUserInfo();
    if (userInfo) {
      this.setData({ userInfo, roleText: util.getRoleText(userInfo.role) });
    }
  },

  async loadBroadcasts() {
    try {
      const result = await api.getBroadcasts();
      const list = (result.data || result.broadcasts || []).slice(0, 3);
      this.setData({
        broadcasts: list.map(item => ({
          ...item,
          id: item.id || item._id,
          title: item.title || item.content,
          summary: (item.content || item.summary || '').substring(0, 60),
          createTimeText: util.formatDate(item.createdAt || item.createTime || Date.now())
        }))
      });
    } catch (e) {}
  },

  async loadMyCases() {
    try {
      const result = await api.getMyCases();
      const list = (result.data || result.cases || []).slice(0, 3);
      this.setData({
        recentCases: list.map(item => ({
          ...item,
          id: item.id || item._id,
          statusText: util.getCaseStatus(item.status),
          statusColor: '#f5f7fa',
          statusColorText: util.getCaseStatusColor(item.status),
          createTimeText: util.formatDate(item.createdAt || Date.now())
        }))
      });
    } catch (e) {}
  },

  goApply() { wx.navigateTo({ url: '/pages/case-apply/case-apply' }); },
  goMyCases() { wx.switchTab({ url: '/pages/my-cases/my-cases' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  goProfile() { wx.switchTab({ url: '/pages/profile/profile' }); },
  goCaseDetail(e) { wx.navigateTo({ url: '/pages/case-detail/case-detail?id=' + e.currentTarget.dataset.id }); }
});
