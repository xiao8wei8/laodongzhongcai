// pages/register/register.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    form: {
      role: 'personal',
      username: '',
      name: '',
      phone: '',
      idCard: '',
      tenantId: '',
      password: '',
      confirmPassword: ''
    },
    tenants: [],
    tenantIndex: -1,
    tenantLabel: '请选择所属街道',
    loading: false
  },

  onLoad() {
    this.loadTenants();
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onRoleChange(e) {
    this.setData({ 'form.role': e.currentTarget.dataset.role });
  },

  async loadTenants() {
    try {
      const result = await api.getTenants();
      const tenants = result.tenants || [];
      this.setData({ tenants });
    } catch (error) {
      util.showError(error.message || '获取街道列表失败');
    }
  },

  onTenantChange(e) {
    const tenantIndex = Number(e.detail.value);
    const tenant = this.data.tenants[tenantIndex];
    this.setData({
      tenantIndex,
      tenantLabel: tenant ? tenant.tenantName : '请选择所属街道',
      'form.tenantId': tenant ? tenant.id : ''
    });
  },

  async onSubmit() {
    const f = this.data.form;
    if (!f.username || f.username.length < 3) { util.showError('用户名至少3位'); return; }
    if (!f.name) { util.showError('请输入姓名/企业名称'); return; }
    if (!util.validatePhone(f.phone)) { util.showError('请输入正确的手机号'); return; }
    if (!f.tenantId) { util.showError('请选择所属街道'); return; }
    if (f.role === 'personal' && !util.validateIdCard(f.idCard)) { util.showError('请输入正确的身份证号'); return; }
    if (!f.password || f.password.length < 6) { util.showError('密码至少6位'); return; }
    if (f.password !== f.confirmPassword) { util.showError('两次密码输入不一致'); return; }

    this.setData({ loading: true });
    util.showLoading('注册中...');

    try {
      await api.register({
        username: f.username, name: f.name, phone: f.phone,
        idCard: f.idCard, password: f.password, role: f.role, tenantId: f.tenantId
      });
      util.hideLoading();
      util.showSuccess('注册成功');
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      util.hideLoading();
      util.showError(err.message || '注册失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  goLogin() { wx.navigateBack(); }
});
