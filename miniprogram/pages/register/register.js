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
      email: '',
      password: '',
      confirmPassword: ''
    },
    loading: false
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onRoleChange(e) {
    this.setData({ 'form.role': e.currentTarget.dataset.role });
  },

  async onSubmit() {
    const f = this.data.form;
    if (!f.username || f.username.length < 3) { util.showError('用户名至少3位'); return; }
    if (!f.name) { util.showError('请输入姓名/企业名称'); return; }
    if (!util.validatePhone(f.phone)) { util.showError('请输入正确的手机号'); return; }
    if (f.role === 'personal' && !util.validateIdCard(f.idCard)) { util.showError('请输入正确的身份证号'); return; }
    if (!f.password || f.password.length < 6) { util.showError('密码至少6位'); return; }
    if (f.password !== f.confirmPassword) { util.showError('两次密码输入不一致'); return; }

    this.setData({ loading: true });
    util.showLoading('注册中...');

    try {
      await api.register({
        username: f.username, name: f.name, phone: f.phone,
        idCard: f.idCard, email: f.email, password: f.password, role: f.role
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
