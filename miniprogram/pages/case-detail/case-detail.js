// pages/case-detail/case-detail.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    caseId: '',
    caseDetail: {},
    applicantInfo: {},
    mediatorInfo: {},
    progress: [],
    messages: [],
    newMessage: '',
    statusText: '',
    statusColor: '',
    createTimeText: '',
    isConsultation: false,
    messageLoading: false
  },

  onLoad(options) { this.setData({ caseId: options.id }); this.loadDetail(); },
  onShow() { this.loadDetail(); },

  async loadDetail() {
    try {
      const detail = await api.getCaseDetail(this.data.caseId);
      const caseDetail = detail.data || detail.case || detail || {};
      caseDetail.id = caseDetail.id || caseDetail._id || this.data.caseId;
      const applicantInfo = caseDetail.applicantInfo || caseDetail.applicant || {
        name: caseDetail.applicantDisplayName || caseDetail.applicantName || '',
        phone: caseDetail.applicantPhone || ''
      };
      const mediatorInfo = caseDetail.mediatorInfo || caseDetail.mediator || {
        id: (caseDetail.mediatorInfo && caseDetail.mediatorInfo.id) ||
          (caseDetail.mediatorInfo && caseDetail.mediatorInfo._id) ||
          (caseDetail.mediatorId && caseDetail.mediatorId.id) ||
          (caseDetail.mediatorId && caseDetail.mediatorId._id) ||
          (typeof caseDetail.mediatorId === 'string' ? caseDetail.mediatorId : ''),
        name: caseDetail.mediatorName || '',
        phone: caseDetail.mediatorPhone || ''
      };
      const respondentInfo = caseDetail.respondentInfo || {
        name: caseDetail.respondentDisplayName || caseDetail.respondentName || '',
        phone: caseDetail.respondentPhone || '',
        type: caseDetail.respondentType || ''
      };

      let progress = [], messages = [];
      try {
        const progResult = await api.getCaseProgress(this.data.caseId);
        progress = progResult.data || progResult.progress || progResult.caseProgress || [];
      } catch (e) {}
      try {
        const msgResult = await api.getMessages({ caseId: this.data.caseId });
        messages = msgResult.data || msgResult.messages || [];
      } catch (e) {}

      this.setData({
        caseDetail,
        isConsultation: !!caseDetail.isConsultation,
        applicantInfo,
        respondentInfo,
        mediatorInfo,
        progress: progress.map((p, i) => ({ ...p, id: p.id || i, createTimeText: util.formatTime(p.createdAt || Date.now()) })),
        messages: messages.map((m, i) => ({ ...m, id: m.id || i, createTimeText: util.formatTime(m.createdAt || Date.now()) })),
        statusText: util.getCaseStatus(caseDetail.status),
        statusColor: util.getCaseStatusColor(caseDetail.status),
        createTimeText: util.formatTime(caseDetail.createdAt || Date.now())
      });
    } catch (e) {
      util.showError('加载失败');
    }
  },

  onMessageInput(e) { this.setData({ newMessage: e.detail.value }); },

  async submitMessage() {
    if (!this.data.newMessage.trim()) { util.showError('请输入留言内容'); return; }
    const recipientId = this.data.mediatorInfo && this.data.mediatorInfo.id;
    if (!recipientId) { util.showError('当前案件尚未分配调解员，暂时无法留言'); return; }
    this.setData({ messageLoading: true });
    try {
      await api.sendMessage(this.data.caseId, this.data.newMessage.trim(), recipientId);
      util.showSuccess('发送成功');
      this.setData({ newMessage: '' });
      this.loadDetail();
    } catch (e) {
      util.showError(e.message || '发送失败');
    } finally {
      this.setData({ messageLoading: false });
    }
  }
});
