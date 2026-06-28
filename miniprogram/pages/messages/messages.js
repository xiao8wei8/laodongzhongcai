// pages/messages/messages.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

function normalizeAssetUrl(rawUrl) {
  if (!rawUrl) return '';
  const app = getApp();
  const apiBaseUrl = app && app.globalData ? app.globalData.apiBaseUrl || '' : '';
  const assetBaseUrl = String(apiBaseUrl).replace(/\/api$/, '');
  const origin = assetBaseUrl.replace('/laodongzhongcai', '');
  return String(rawUrl).trim()
    .replace(/^\/laodongzhongcai\//, `${assetBaseUrl}/`)
    .replace(/^\/uploads\//, `${origin}/uploads/`)
    .replace('http://192.168.64.149:5003', origin)
    .replace('http://127.0.0.1:5003', origin)
    .replace('http://localhost:5003', origin);
}

function parseAttachments(attachments) {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments === 'string') {
    try {
      const parsed = JSON.parse(attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return attachments ? [attachments] : [];
    }
  }
  return [];
}

function getImageAttachments(attachments) {
  return parseAttachments(attachments)
    .map(normalizeAssetUrl)
    .filter((item) => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(item));
}

Page({
  data: { activeTab: 'broadcast', broadcasts: [], messages: [], isGuestMode: true },

  onShow() {
    this.loadBroadcasts();
    if (!util.isLoggedIn()) {
      this.setData({ isGuestMode: true, messages: [], activeTab: 'broadcast' });
      return;
    }
    this.setData({ isGuestMode: false });
    this.loadMessages();
  },
  onPullDownRefresh() { this.onShow(); wx.stopPullDownRefresh(); },
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
          createTimeText: util.formatTime(item.createdAt || item.createTime || Date.now()),
          imageAttachments: getImageAttachments(item.attachments),
          firstImage: getImageAttachments(item.attachments)[0] || '',
          attachmentCount: parseAttachments(item.attachments).length
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
  },

  previewBroadcastImage(e) {
    const current = e.currentTarget.dataset.url;
    const id = e.currentTarget.dataset.id;
    const target = (this.data.broadcasts || []).find((item) => String(item.id) === String(id));
    const urls = target && Array.isArray(target.imageAttachments) && target.imageAttachments.length > 0
      ? target.imageAttachments
      : [current];
    if (!current) return;
    wx.previewImage({
      current,
      urls
    });
  },

  goLogin() { util.goLogin(); }
});
