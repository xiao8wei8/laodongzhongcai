// pages/messages/messages.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: { activeTab: 'broadcast', broadcasts: [], messages: [] },

  onShow() { this.loadBroadcasts(); this.loadMessages(); },
  onPullDownRefresh() { this.loadBroadcasts(); this.loadMessages(); wx.stopPullDownRefresh(); },
  switchTab(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }); },

  async loadBroadcasts() {
    try {
      const result = await api.getBroadcasts();
      const list = result.data || result.broadcasts || [];
      this.setData({
        broadcasts: list.map((item, i) => ({
          ...item,
          id: item.id || item._id || i,
          title: item.title || item.content || '系统公告',
          content: item.content || item.summary || '',
          createTimeText: util.formatTime(item.createdAt || item.createTime || Date.now())
        }))
      });
    } catch (e) {}
  },

  async loadMessages() {
    try {
      const result = await api.getMessages();
      const list = result.data || result.messages || [];
      this.setData({
        messages: list.map((item, i) => ({
          ...item,
          id: item.id || item._id || i,
          createTimeText: util.formatTime(item.createdAt || Date.now())
        }))
      });
    } catch (e) {}
  },

  goCaseDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/case-detail/case-detail?id=' + id });
  }
});
