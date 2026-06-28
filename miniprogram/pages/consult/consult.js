const api = require('../../utils/api.js');
const util = require('../../utils/util.js');
const fixedEntrance = require('../../utils/fixed-entrance.js');

Page({
  data: {
    isGuestMode: true,
    showBottomActions: false,
    tenants: [],
    tenantIndex: -1,
    tenantLabel: '请选择咨询街道',
    currentMediator: null,
    mediatorLoading: false,
    mediatorHint: '',
    form: {
      tenantId: '',
      tenantName: '',
      phone: '',
      content: ''
    },
    submitLoading: false
  },

  onLoad() {
    const userInfo = util.getUserInfo() || {};
    this.setData({ isGuestMode: !util.isLoggedIn() });
    this.setData({
      'form.phone': userInfo.phone || '',
      'form.tenantId': userInfo.tenantId || '',
      'form.tenantName': userInfo.tenantName || ''
    });
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

  async loadTenants(userInfo) {
    try {
      const result = await api.getTenants();
      const tenants = result.tenants || [];
      let tenantIndex = -1;
      let tenantLabel = '请选择咨询街道';
      const currentTenantId = userInfo.tenantId || this.data.form.tenantId;
      if (currentTenantId) {
        tenantIndex = tenants.findIndex((item) => item.id === currentTenantId);
        if (tenantIndex >= 0) {
          tenantLabel = tenants[tenantIndex].tenantName;
          this.setData({
            'form.tenantId': tenants[tenantIndex].id,
            'form.tenantName': tenants[tenantIndex].tenantName
          });
          if (util.isLoggedIn()) {
            this.fetchCurrentMediator(tenants[tenantIndex].id);
          } else {
            this.setData({
              currentMediator: null,
              mediatorLoading: false,
              mediatorHint: '登录后可查看当前街道的值班调解员，未登录也可先浏览咨询填写流程'
            });
          }
        }
      }
      this.setData({ tenants, tenantIndex, tenantLabel });
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
      this.setData({
        currentMediator: mediator,
        mediatorHint: mediator
          ? (mediator.source === 'tenant_admin_fallback'
              ? '当前街道暂无调解员，暂由街道管理员临时接收'
              : '当前咨询将优先分派给值班调解员')
          : '当前街道暂未配置值班人员，咨询提交后需后台补充处理',
        mediatorLoading: false
      });
    } catch (_error) {
      this.setData({
        currentMediator: null,
        mediatorHint: '当前值班调解员获取失败，提交后仍可由后台补充处理',
        mediatorLoading: false
      });
    }
  },

  onTenantChange(e) {
    const tenantIndex = Number(e.detail.value);
    const tenant = this.data.tenants[tenantIndex];
    this.setData({
      tenantIndex,
      tenantLabel: tenant ? tenant.tenantName : '请选择咨询街道',
      'form.tenantId': tenant ? tenant.id : '',
      'form.tenantName': tenant ? tenant.tenantName : ''
    });
    if (util.isLoggedIn()) {
      this.fetchCurrentMediator(tenant ? tenant.id : '');
    } else {
      this.setData({
        currentMediator: null,
        mediatorLoading: false,
        mediatorHint: tenant ? '登录后可查看当前街道的值班调解员，提交时会再校验接收人' : ''
      });
    }
  },

  onInput(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value });
  },

  async submitConsultation() {
    if (!util.isLoggedIn()) {
      util.goLogin();
      return;
    }
    const { phone, content, tenantId } = this.data.form;
    if (!tenantId) return util.showError('请选择咨询街道');
    if (!util.validatePhone(phone)) return util.showError('请输入正确的手机号');
    if (!content.trim()) return util.showError('请输入咨询内容');

    this.setData({ submitLoading: true });
    util.showLoading('提交中...');
    try {
      const result = await api.createConsultation({
        tenantId,
        phone,
        content
      });
      util.hideLoading();
      wx.showModal({
        title: '提交成功',
        content: result.assignedMediator
          ? `咨询已提交，当前接收人：${result.assignedMediator.name}`
          : '咨询已提交，后台会尽快联系您',
        showCancel: false,
        success: () => {
          const caseId = (result.case && (result.case.id || result.case._id)) || (result.consultation && (result.consultation.id || result.consultation._id));
          if (caseId) {
            wx.redirectTo({ url: '/pages/case-detail/case-detail?id=' + caseId });
          } else {
            wx.navigateBack({ delta: 1 });
          }
        }
      });
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '提交失败');
    } finally {
      this.setData({ submitLoading: false });
    }
  },

  goLogin() { util.goLogin(); }
});
