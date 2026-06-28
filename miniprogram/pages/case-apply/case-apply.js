// pages/case-apply/case-apply.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');
const fixedEntrance = require('../../utils/fixed-entrance.js');

function isDevLikeEnv() {
  try {
    const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const envVersion = accountInfo && accountInfo.miniProgram
      ? accountInfo.miniProgram.envVersion
      : 'develop';
    return envVersion !== 'release';
  } catch (e) {
    return true;
  }
}

function buildMockPayload() {
  const now = new Date();
  const stamp = `${now.getMonth() + 1}${now.getDate()}${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
  const unique = String(Date.now()).slice(-6);
  const day = String((Number(unique.slice(-2)) % 27) + 1).padStart(2, '0');
  const birthYear = 1980 + (Number(unique.slice(0, 2)) % 20);
  const birthMonth = String((Number(unique.slice(2, 4)) % 12) + 1).padStart(2, '0');
  const birthDay = String((Number(unique.slice(4, 6)) % 28) + 1).padStart(2, '0');
  const sequence = String((Number(unique.slice(3, 6)) % 999) + 1).padStart(3, '0');
  const applicantIdCard = `320101${birthYear}${birthMonth}${birthDay}${sequence}X`;
  const amount = String(1000 + Number(unique.slice(-3)));
  const respondentPhone = `139${String(Number(unique) % 100000000).padStart(8, '0')}`;
  const happenDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
  const disputeTypes = ['工资纠纷', '加班纠纷', '社保纠纷', '工伤纠纷', '解除劳动合同', '其他纠纷'];
  const disputeTypeIndex = Number(unique.slice(-1)) % disputeTypes.length;

  return {
    disputeTypeIndex,
    form: {
      applicantName: `申请人${stamp}`,
      applicantPhone: `138${String((Number(unique) + 12345678) % 100000000).padStart(8, '0')}`,
      applicantIdCard,
      tenantId: '',
      tenantName: '',
      respondentType: Number(unique.slice(-1)) % 2 === 0 ? 'company' : 'personal',
      respondentName: `测试对象${stamp}`,
      respondentPhone,
      amount,
      happenDate,
      facts: `测试争议事实${stamp}：因工资结算与加班费认定产生分歧，现申请调解处理。`,
      requests: `测试请求事项${stamp}：请求支付争议金额${amount}元，并协调双方尽快完成调解。`,
      evidenceFiles: []
    }
  };
}

Page({
  data: {
    isGuestMode: true,
    showBottomActions: false,
    currentStep: 0,
    steps: ['身份信息', '案件信息', '争议描述', '证据上传', '确认提交'],
    disputeTypes: ['工资纠纷', '加班纠纷', '社保纠纷', '工伤纠纷', '解除劳动合同', '其他纠纷'],
    disputeTypeIndex: 0,
    tenants: [],
    tenantIndex: -1,
    tenantLabel: '请选择受理街道',
    currentMediator: null,
    mediatorLoading: false,
    mediatorHint: '',
    form: {
      applicantName: '', applicantPhone: '', applicantIdCard: '',
      tenantId: '', tenantName: '',
      respondentType: 'company', respondentName: '', respondentPhone: '',
      amount: '', happenDate: '', facts: '', requests: '', evidenceFiles: []
    },
    submitLoading: false
  },

  onLoad() {
    const userInfo = util.getUserInfo();
    this.setData({ isGuestMode: !util.isLoggedIn() });
    this.prefillForm(userInfo);
    this.loadTenants(userInfo);
  },

  onShow() {
    this.setData({ isGuestMode: !util.isLoggedIn() });
    fixedEntrance.scheduleVisible(this, { flagName: 'showBottomActions', timerKey: '_bottomActionsTimer' });
  },

  onHide() {
    fixedEntrance.hideVisible(this, { flagName: 'showBottomActions', timerKey: '_bottomActionsTimer' });
  },

  onUnload() {
    fixedEntrance.hideVisible(this, { flagName: 'showBottomActions', timerKey: '_bottomActionsTimer' });
  },

  prefillForm(userInfo) {
    const mock = buildMockPayload();
    const patch = {
      disputeTypeIndex: mock.disputeTypeIndex,
      'form.respondentType': mock.form.respondentType,
      'form.respondentName': mock.form.respondentName,
      'form.respondentPhone': mock.form.respondentPhone,
      'form.amount': mock.form.amount,
      'form.happenDate': mock.form.happenDate,
      'form.facts': mock.form.facts,
      'form.requests': mock.form.requests,
      'form.evidenceFiles': []
    };

    if (isDevLikeEnv()) {
      patch['form.applicantName'] = (userInfo && (userInfo.name || userInfo.nickname || userInfo.username)) || mock.form.applicantName;
      patch['form.applicantPhone'] = (userInfo && userInfo.phone) || mock.form.applicantPhone;
      patch['form.applicantIdCard'] = (userInfo && userInfo.idCard) || mock.form.applicantIdCard;
      patch['form.tenantId'] = (userInfo && userInfo.tenantId) || '';
      patch['form.tenantName'] = (userInfo && userInfo.tenantName) || '';
    } else if (userInfo) {
      patch['form.applicantName'] = userInfo.name || userInfo.nickname || userInfo.username || '';
      patch['form.applicantPhone'] = userInfo.phone || '';
      patch['form.applicantIdCard'] = userInfo.idCard || '';
      patch['form.tenantId'] = userInfo.tenantId || '';
      patch['form.tenantName'] = userInfo.tenantName || '';
    }

    this.setData(patch);
  },

  regenerateMockData() {
    this.prefillForm(util.getUserInfo());
    util.showSuccess('已生成新的测试数据');
  },

  async loadTenants(userInfo) {
    try {
      const result = await api.getTenants();
      const tenants = result.tenants || [];
      let tenantIndex = -1;
      let tenantLabel = '请选择受理街道';
      const currentTenantId = (userInfo && userInfo.tenantId) || this.data.form.tenantId;
      if (currentTenantId) {
        tenantIndex = tenants.findIndex(item => item.id === currentTenantId);
        if (tenantIndex >= 0) {
          tenantLabel = tenants[tenantIndex].tenantName;
          this.setData({
            'form.tenantId': tenants[tenantIndex].id,
            'form.tenantName': tenants[tenantIndex].tenantName
          });
        }
      }
      this.setData({ tenants, tenantIndex, tenantLabel });
      if (util.isLoggedIn() && tenantIndex >= 0 && tenants[tenantIndex]) {
        this.fetchCurrentMediator(tenants[tenantIndex].id);
      } else if (!util.isLoggedIn()) {
        this.setData({
          currentMediator: null,
          mediatorLoading: false,
          mediatorHint: '登录后可查看当前街道的值班调解员，未登录也可先填写并浏览申请信息'
        });
      }
    } catch (error) {
      util.showError(error.message || '获取街道列表失败');
    }
  },

  async fetchCurrentMediator(tenantId) {
    if (!tenantId) {
      this.setData({ currentMediator: null, mediatorHint: '' });
      return;
    }
    this.setData({ mediatorLoading: true });
    try {
      const result = await api.getCurrentDutyMediator(tenantId);
      const mediator = result.mediator || null;
      const mediatorHint = mediator
        ? (mediator.source === 'tenant_admin_fallback'
            ? '当前街道暂无调解员，暂由街道管理员临时接收'
            : '当前将由值班调解员优先接收')
        : '当前街道暂未配置值班人员，提交后需后台补充处理';
      this.setData({ currentMediator: mediator, mediatorHint, mediatorLoading: false });
    } catch (_error) {
      this.setData({
        currentMediator: null,
        mediatorHint: '当前值班调解员获取失败，提交后仍可由后台补充处理',
        mediatorLoading: false
      });
    }
  },

  validateIdentityStep() {
    const f = this.data.form;
    if (!f.applicantName.trim()) {
      util.showError('请输入申请人姓名');
      return false;
    }
    if (!util.validatePhone(f.applicantPhone)) {
      util.showError('请输入正确的申请人手机号');
      return false;
    }
    if (!f.applicantIdCard.trim()) {
      util.showError('请输入申请人身份证号');
      return false;
    }
    if (!util.validateIdCard(f.applicantIdCard.trim())) {
      util.showError('请输入正确的申请人身份证号');
      return false;
    }
    if (!f.tenantId) {
      util.showError('请选择受理街道');
      return false;
    }
    if (!f.respondentName.trim()) {
      util.showError(`请输入${f.respondentType === 'company' ? '被申请企业名称' : '被申请人姓名'}`);
      return false;
    }
    if (!util.validatePhone(f.respondentPhone)) {
      util.showError('请输入正确的被申请人联系电话');
      return false;
    }
    return true;
  },

  onInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }); },
  onRespondentType(e) { this.setData({ 'form.respondentType': e.currentTarget.dataset.val }); },
  onDisputeTypeChange(e) { this.setData({ disputeTypeIndex: e.detail.value }); },
  onDateChange(e) { this.setData({ 'form.happenDate': e.detail.value }); },
  onTenantChange(e) {
    const tenantIndex = Number(e.detail.value);
    const tenant = this.data.tenants[tenantIndex];
    this.setData({
      tenantIndex,
      tenantLabel: tenant ? tenant.tenantName : '请选择受理街道',
      'form.tenantId': tenant ? tenant.id : '',
      'form.tenantName': tenant ? tenant.tenantName : ''
    });
    if (util.isLoggedIn()) {
      this.fetchCurrentMediator(tenant ? tenant.id : '');
    } else {
      this.setData({
        currentMediator: null,
        mediatorLoading: false,
        mediatorHint: tenant ? '登录后可查看当前街道的值班调解员，提交时会再校验受理人' : ''
      });
    }
  },

  nextStep() {
    const f = this.data.form;
    if (this.data.currentStep === 0) {
      if (!this.validateIdentityStep()) return;
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
    if (!util.isLoggedIn()) {
      util.goLogin();
      return;
    }
    this.setData({ submitLoading: true });
    util.showLoading('提交中...');
    const f = this.data.form;
    try {
      if (!this.validateIdentityStep()) {
        throw { message: '身份信息未填写完整' };
      }
      if (!f.happenDate) {
        throw { message: '请选择发生时间' };
      }
      if (!f.requests.trim()) {
        throw { message: '请填写请求事项' };
      }

      const submitResult = await api.submitCase({
        applicantInfo: {
          name: f.applicantName,
          phone: f.applicantPhone,
          idCard: f.applicantIdCard
        },
        respondentInfo: {
          type: f.respondentType,
          name: f.respondentName,
          phone: f.respondentPhone
        },
        tenantId: f.tenantId,
        disputeType: this.data.disputeTypes[this.data.disputeTypeIndex],
        caseAmount: f.amount,
        factsReasons: f.facts,
        requestItems: f.requests
      });
      const caseId =
        (submitResult.case && submitResult.case.id) ||
        (submitResult.data && submitResult.data.id) ||
        submitResult.caseId ||
        submitResult.id;
      if (caseId && f.evidenceFiles.length > 0) {
        for (let i = 0; i < f.evidenceFiles.length; i++) {
          try { await api.uploadEvidence(f.evidenceFiles[i], caseId); } catch (e) {}
        }
      }
      util.hideLoading();
      const assignedMediator = submitResult.assignedMediator;
      util.showSuccess(assignedMediator ? `提交成功，当前受理人：${assignedMediator.name}` : '提交成功');
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/case-detail/case-detail?id=' + (caseId || '') });
      }, 1200);
    } catch (err) {
      util.hideLoading();
      util.showError(err.message || '提交失败');
    } finally {
      this.setData({ submitLoading: false });
    }
  },

  goLogin() { util.goLogin(); }
});
