// pages/home/home.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

const guestHomeBanner = {
  enabled: true,
  title: '劳动仲裁调解系统',
  subtitle: '便捷·高效·专业',
  image: '',
  link: '',
  buttonText: '',
  bgStart: '#1890ff',
  bgEnd: '#096dd9'
};

const guestBroadcasts = [];

Page({
  data: {
    userInfo: {},
    roleText: '',
    broadcasts: [],
    recentCases: [],
    homeBanner: null,
    isGuestMode: true
  },

  onLoad() { this.loadUserInfo(); },
  onShow() {
    this.loadUserInfo();
    if (util.isLoggedIn()) {
      this.loadHomeBanner();
      this.loadBroadcasts();
      this.loadMyCases();
    } else {
      this.setData({
        homeBanner: guestHomeBanner,
        broadcasts: guestBroadcasts,
        recentCases: []
      });
    }
  },
  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },

  loadUserInfo() {
    const userInfo = util.getUserInfo();
    if (userInfo) {
      this.setData({ userInfo, roleText: util.getRoleText(userInfo.role), isGuestMode: false });
    } else {
      this.setData({ userInfo: {}, roleText: '游客浏览中', isGuestMode: true });
    }
  },

  async loadHomeBanner() {
    try {
      const result = await api.getSystemSettings();
      const basic = result.basic || {};
      this.setData({
        homeBanner: {
          enabled: basic.homeBannerEnabled !== false,
          title: basic.homeBannerTitle || '劳动仲裁调解系统',
          subtitle: basic.homeBannerSubtitle || '便捷·高效·专业',
          image: basic.homeBannerImage || '',
          link: basic.homeBannerLink || '',
          buttonText: basic.homeBannerButtonText || '',
          bgStart: basic.homeBannerBgStart || '#1890ff',
          bgEnd: basic.homeBannerBgEnd || '#096dd9'
        }
      });
    } catch (e) {
      this.setData({ homeBanner: null });
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
  goConsult() { wx.navigateTo({ url: '/pages/consult/consult' }); },
  goMyCases() { wx.switchTab({ url: '/pages/my-cases/my-cases' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  goProfile() { wx.switchTab({ url: '/pages/profile/profile' }); },
  goCaseDetail(e) { wx.navigateTo({ url: '/pages/case-detail/case-detail?id=' + e.currentTarget.dataset.id }); },
  goLogin() { util.goLogin(); },

  onBannerTap() {
    const banner = this.data.homeBanner;
    if (!banner || !banner.link) return;

    const tabPages = [
      '/pages/home/home',
      '/pages/my-cases/my-cases',
      '/pages/messages/messages',
      '/pages/profile/profile'
    ];

    if (tabPages.includes(banner.link)) {
      wx.switchTab({ url: banner.link });
      return;
    }

    wx.navigateTo({ url: banner.link });
  }
});
