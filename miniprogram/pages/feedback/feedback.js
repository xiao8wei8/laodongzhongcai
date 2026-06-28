const api = require('../../utils/api');
const util = require('../../utils/util');

const typeTextMap = {
  bug: 'Bug 问题',
  suggestion: '功能建议',
  complaint: '投诉建议',
  other: '其他'
};

const statusTextMap = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭'
};

Page({
  data: {
    isGuestMode: true,
    form: {
      title: '',
      type: 'suggestion',
      content: '',
      contactName: '',
      contactPhone: ''
    },
    currentTypeIndex: 1,
    currentTypeLabel: '功能建议',
    typeOptions: [
      { label: 'Bug 问题', value: 'bug' },
      { label: '功能建议', value: 'suggestion' },
      { label: '投诉建议', value: 'complaint' },
      { label: '其他', value: 'other' }
    ],
    myFeedbacks: [],
    loading: false
  },

  onShow() {
    if (!util.isLoggedIn()) {
      this.setData({ isGuestMode: true, myFeedbacks: [], loading: false });
      return;
    }
    this.setData({ isGuestMode: false });
    this.loadMyFeedbacks();
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value
    });
  },

  onTypeChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      'form.type': this.data.typeOptions[index].value,
      currentTypeIndex: index,
      currentTypeLabel: this.data.typeOptions[index].label
    });
  },

  async submitFeedback() {
    if (!util.isLoggedIn()) {
      return util.goLogin();
    }
    const { title, type, content, contactName, contactPhone } = this.data.form;
    if (!title.trim()) return util.showToast('请输入反馈标题');
    if (!content.trim()) return util.showToast('请输入反馈内容');

    this.setData({ loading: true });
    try {
      await api.createFeedback({
        title: title.trim(),
        type,
        content: content.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        source: 'miniapp'
      });
      util.showSuccess('反馈已提交');
      this.setData({
        form: {
          title: '',
          type: 'suggestion',
          content: '',
          contactName: '',
          contactPhone: ''
        },
        currentTypeIndex: 1,
        currentTypeLabel: '功能建议'
      });
      this.loadMyFeedbacks();
    } catch (error) {
      util.showToast(error.message || '反馈提交失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMyFeedbacks() {
    try {
      const result = await api.getMyFeedbacks();
      const feedbacks = result.feedbacks || [];
      this.setData({
        myFeedbacks: feedbacks.map(item => ({
          ...item,
          typeText: typeTextMap[item.type] || item.type,
          statusText: statusTextMap[item.status] || item.status,
          createTimeText: util.formatTime(item.createdAt || Date.now())
        }))
      });
    } catch (error) {
      util.showToast('获取反馈记录失败');
    }
  },

  goLogin() { util.goLogin(); }
});
