// pages/case-apply/case-apply.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    currentStep: 0,
    steps: ['身份信息', '案件信息', '争议描述', '证据上传', '确认提交'],
    disputeTypes: ['工资纠纷', '加班纠纷', '社保纠纷', '工伤纠纷', '解除劳动合同', '其他纠纷'],
    disputeTypeIndex: 0,
    form: {
      applicantName: '', applicantPhone: '', applicantIdCard: '',
      respondentType: 'company', respondentName: '', respondentPhone: '',
      amount: '', happenDate: '', facts: '', requests: '', evidenceFiles: []
    },
    submitLoading: false
  },

  onLoad() {
    const userInfo = util.getUserInfo();
    if (userInfo) {
      this.setData({
        'form.applicantName': userInfo.name || userInfo.username || '',
        'form.applicantPhone': userInfo.phone || '',
        'form.applicantIdCard': userInfo.idCard || ''
      });
    }
  },

  onInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }); },
  onRespondentType(e) { this.setData({ 'form.respondentType': e.currentTarget.dataset.val }); },
  onDisputeTypeChange(e) { this.setData({ disputeTypeIndex: e.detail.value }); },
  onDateChange(e) { this.setData({ 'form.happenDate': e.detail.value }); },

  nextStep() {
    const f = this.data.form;
    if (this.data.currentStep === 0) {
      if (!f.applicantName.trim()) { util.showError('请输入申请人姓名'); return; }
      if (!util.validatePhone(f.applicantPhone)) { util.showError('请输入正确的手机号'); return; }
      if (!f.respondentName.trim()) { util.showError('请输入被申请人名称'); return; }
    }
    if (this.data.currentStep === 1 && !f.happenDate) { util.showError('请选择发生时间'); return; }
    if (this.data.currentStep === 2 && !f.requests.trim()) { util.showError('请填写请求事项'); return; }
    this.setData({ currentStep: this.data.currentStep + 1 });
  },

  prevStep() { if (this.data.currentStep > 0) this.setData({ currentStep: this.data.currentStep - 1 }); },

  chooseImage() {
    wx.chooseImage({
      count: 9 - this.data.form.evidenceFiles.length,
      success: (res) => {
        this.setData({ 'form.evidenceFiles': this.data.form.evidenceFiles.concat(res.tempFilePaths) });
      }
    });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const files = this.data.form.evidenceFiles.slice();
    files.splice(idx, 1);
    this.setData({ 'form.evidenceFiles': files });
  },

  async submitCase() {
    this.setData({ submitLoading: true });
    util.showLoading('提交中...');
    const f = this.data.form;
    try {
      const submitResult = await api.submitCase({
        applicantName: f.applicantName, applicantPhone: f.applicantPhone,
        applicantIdCard: f.applicantIdCard, respondentType: f.respondentType,
        respondentName: f.respondentName, respondentPhone: f.respondentPhone,
        disputeType: this.data.disputeTypes[this.data.disputeTypeIndex],
        amount: f.amount, happenDate: f.happenDate, facts: f.facts, requests: f.requests
      });
      const caseId = (submitResult.data && submitResult.data.id) || submitResult.caseId || submitResult.id;
      if (caseId && f.evidenceFiles.length > 0) {
        for (let i = 0; i < f.evidenceFiles.length; i++) {
          try { await api.uploadEvidence(f.evidenceFiles[i], caseId); } catch (e) {}
        }
      }
      util.hideLoading();
      util.showSuccess('提交成功');
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/case-detail/case-detail?id=' + (caseId || '') });
      }, 1200);
    } catch (err) {
      util.hideLoading();
      util.showError(err.message || '提交失败');
    } finally {
      this.setData({ submitLoading: false });
    }
  }
});
