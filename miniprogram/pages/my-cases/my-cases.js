// pages/my-cases/my-cases.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: { cases: [], filteredCases: [], keyword: '', filter: 'all', loading: false },

  onShow() { this.loadCases(); },
  onPullDownRefresh() { this.loadCases(); wx.stopPullDownRefresh(); },

  async loadCases() {
    this.setData({ loading: true });
    try {
      const result = await api.getMyCases(this.data.keyword);
      const list = result.data || result.cases || [];
      const cases = list.map(item => ({
        ...item,
        id: item.id || item._id,
        statusText: util.getCaseStatus(item.status),
        statusColor: util.getCaseStatusColor(item.status),
        createTimeText: util.formatDate(item.createdAt || Date.now())
      }));
      this.setData({ cases });
      this.applyFilter();
    } catch (e) {
      util.showError('加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  applyFilter() {
    const { cases, filter } = this.data;
    this.setData({
      filteredCases: filter === 'all' ? cases : cases.filter(c => c.status === filter)
    });
  },

  onSearchInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearch() { this.loadCases(); },
  onFilter(e) { this.setData({ filter: e.currentTarget.dataset.filter }); this.applyFilter(); },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/case-detail/case-detail?id=' + e.currentTarget.dataset.id });
  },

  sendMessage(e) {
    wx.navigateTo({ url: '/pages/case-detail/case-detail?id=' + e.currentTarget.dataset.id + '&tab=message' });
  },

  goApply() { wx.navigateTo({ url: '/pages/case-apply/case-apply' }); }
});
