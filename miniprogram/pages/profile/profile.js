// pages/profile/profile.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    isGuestMode: true,
    userInfo: {}, firstChar: '', roleText: '', displayName: '',
    stats: { total: 0, inProgress: 0, completed: 0 },
    showPhoneBindPanel: false,
    showNicknamePanel: false,
    showTenantPanel: false,
    nicknameInput: '',
    bindPhone: '',
    smsCode: '',
    smsCountdown: 0,
    tenants: [],
    tenantIndex: -1,
    tenantLabel: '请选择所属街道'
  },

  onShow() {
    if (!util.isLoggedIn()) {
      this.setData({
        isGuestMode: true,
        userInfo: {},
        firstChar: '访',
        roleText: '游客模式',
        displayName: '访客',
        stats: { total: 0, inProgress: 0, completed: 0 }
      });
      return;
    }

    this.setData({ isGuestMode: false });
    this.loadUserInfo();
    this.loadStats();
    this.loadTenants();
  },

  syncUserInfo(userInfo) {
    const app = getApp();
    const normalizedUserInfo = app && typeof app.normalizeUserInfo === 'function'
      ? app.normalizeUserInfo(userInfo)
      : userInfo;
    const name = normalizedUserInfo.nickname || normalizedUserInfo.name || normalizedUserInfo.username || '用户';
    wx.setStorageSync('userInfo', normalizedUserInfo);
    if (app && app.globalData) {
      app.globalData.userInfo = normalizedUserInfo;
    }
    this.setData({
      userInfo: normalizedUserInfo,
      displayName: normalizedUserInfo.nickname || normalizedUserInfo.name || normalizedUserInfo.username || '用户',
      firstChar: name.charAt(0) || '用',
      roleText: util.getRoleText(normalizedUserInfo.role),
      tenantLabel: normalizedUserInfo.tenantName || '请选择所属街道'
    });
  },

  async loadTenants() {
    try {
      const result = await api.getTenants();
      const tenants = result.tenants || [];
      const currentTenantId = this.data.userInfo.tenantId;
      const tenantIndex = currentTenantId ? tenants.findIndex(item => item.id === currentTenantId) : -1;
      this.setData({
        tenants,
        tenantIndex,
        tenantLabel: tenantIndex >= 0 ? tenants[tenantIndex].tenantName : (this.data.userInfo.tenantName || '请选择所属街道')
      });
    } catch (error) {
      util.showToast((error && error.message) || '获取街道列表失败');
    }
  },

  async loadUserInfo() {
    const localUser = util.getUserInfo() || {};
    this.syncUserInfo(localUser);
    await this.loadTenants();

    try {
      const result = await api.getCurrentUser();
      const userInfo = result.userInfo || localUser;
      this.syncUserInfo(userInfo);
      await this.loadTenants();
    } catch (e) {}
  },

  async loadStats() {
    try {
      const result = await api.getMyCases();
      const cases = result.data || result.cases || [];
      this.setData({
        stats: {
          total: cases.length,
          inProgress: cases.filter(c => c.status === 'in_progress' || c.status === 'pending').length,
          completed: cases.filter(c => c.status === 'completed').length
        }
      });
    } catch (e) {}
  },

  goMyCases() { wx.switchTab({ url: '/pages/my-cases/my-cases' }); },
  goApply() { wx.navigateTo({ url: '/pages/case-apply/case-apply' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }); },
  goLogin() { util.goLogin(); },

  closeNicknamePanel() {
    this.setData({ showNicknamePanel: false });
  },

  openPhoneBindPanel() {
    this.setData({
      showPhoneBindPanel: true,
      bindPhone: this.data.userInfo.phone || '',
      smsCode: ''
    });
  },

  closePhoneBindPanel() {
    this.setData({ showPhoneBindPanel: false });
  },

  openTenantPanel() {
    const currentTenantId = this.data.userInfo.tenantId;
    const tenantIndex = currentTenantId ? this.data.tenants.findIndex(item => item.id === currentTenantId) : -1;
    this.setData({
      showTenantPanel: true,
      tenantIndex,
      tenantLabel: tenantIndex >= 0 ? this.data.tenants[tenantIndex].tenantName : (this.data.userInfo.tenantName || '请选择所属街道')
    });
  },

  closeTenantPanel() {
    this.setData({ showTenantPanel: false });
  },

  onTenantChange(e) {
    const tenantIndex = Number(e.detail.value);
    const tenant = this.data.tenants[tenantIndex];
    this.setData({
      tenantIndex,
      tenantLabel: tenant ? tenant.tenantName : '请选择所属街道'
    });
  },

  async saveTenant() {
    const tenant = this.data.tenants[this.data.tenantIndex];
    if (!tenant) {
      return util.showToast('请选择所属街道');
    }

    util.showLoading('保存街道中...');
    try {
      const result = await api.updateProfile({ tenantId: tenant.id });
      const userInfo = result.userInfo || { ...this.data.userInfo, tenantId: tenant.id, tenantName: tenant.tenantName, street: tenant.tenantName };
      this.syncUserInfo(userInfo);
      this.setData({ showTenantPanel: false, tenantLabel: tenant.tenantName });
      util.showSuccess('所属街道已更新');
    } catch (error) {
      util.hideLoading();
      util.showToast((error && error.message) || '更新所属街道失败');
      return;
    }
    util.hideLoading();
  },

  async onChooseAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      return util.showToast('请选择头像');
    }

    util.showLoading('上传头像中...');
    try {
      const result = await api.uploadAvatar(avatarUrl);
      const userInfo = result.userInfo || { ...this.data.userInfo, avatarUrl: result.avatarUrl };
      this.syncUserInfo(userInfo);
      util.showSuccess('头像已更新');
    } catch (error) {
      util.showToast((error && error.message) || '头像上传失败');
    } finally {
      util.hideLoading();
    }
  },

  onNicknameInput(e) {
    this.setData({ nicknameInput: e.detail.value });
  },

  async saveNickname() {
    const nickname = (this.data.nicknameInput || '').trim();
    if (!nickname) {
      return util.showToast('请输入昵称');
    }

    util.showLoading('保存昵称中...');
    try {
      const result = await api.updateProfile({ nickname });
      const userInfo = result.userInfo || { ...this.data.userInfo, nickname };
      this.syncUserInfo(userInfo);
      this.setData({ showNicknamePanel: false });
      util.showSuccess('昵称已保存');
    } catch (error) {
      util.hideLoading();
      util.showToast((error && error.message) || '昵称保存失败');
      return;
    }
    util.hideLoading();
  },

  onBindPhoneInput(e) {
    this.setData({ bindPhone: e.detail.value });
  },

  onSmsCodeInput(e) {
    this.setData({ smsCode: e.detail.value });
  },

  startSmsCountdown() {
    if (this.smsTimer) clearInterval(this.smsTimer);
    this.setData({ smsCountdown: 60 });
    this.smsTimer = setInterval(() => {
      const next = this.data.smsCountdown - 1;
      if (next <= 0) {
        clearInterval(this.smsTimer);
        this.smsTimer = null;
        this.setData({ smsCountdown: 0 });
      } else {
        this.setData({ smsCountdown: next });
      }
    }, 1000);
  },

  async sendSmsCode() {
    const phone = (this.data.bindPhone || '').trim();
    if (!util.validatePhone(phone)) {
      return util.showToast('请输入正确的手机号');
    }
    if (this.data.smsCountdown > 0) return;

    util.showLoading('发送验证码中...');
    try {
      const result = await api.sendSmsCode(phone);
      util.hideLoading();
      this.startSmsCountdown();
      if (result.debugCode) {
        wx.showModal({
          title: '开发环境验证码',
          content: `当前验证码：${result.debugCode}`,
          showCancel: false
        });
      } else {
        util.showSuccess(result.message || '验证码已发送');
      }
    } catch (error) {
      util.hideLoading();
      util.showToast((error && error.message) || '发送验证码失败');
    }
  },

  async bindPhoneBySms() {
    const phone = (this.data.bindPhone || '').trim();
    const smsCode = (this.data.smsCode || '').trim();
    if (!util.validatePhone(phone)) {
      return util.showToast('请输入正确的手机号');
    }
    if (!/^\d{6}$/.test(smsCode)) {
      return util.showToast('请输入6位验证码');
    }

    util.showLoading('绑定手机号中...');
    try {
      const result = await api.bindPhoneBySms(phone, smsCode);
      const userInfo = result.userInfo || { ...this.data.userInfo, phone };
      this.syncUserInfo(userInfo);
      this.setData({ showPhoneBindPanel: false, smsCode: '' });
      util.showSuccess('手机号已绑定');
    } catch (error) {
      util.hideLoading();
      util.showToast((error && error.message) || '绑定手机号失败');
      return;
    }
    util.hideLoading();
  },

  showAbout() {
    wx.showModal({ title: '关于我们', content: '劳动仲裁调解系统\n为劳动者提供便捷的调解服务\n\n版本 v1.0.0', showCancel: false });
  },

  logout() {
    wx.showModal({
      title: '确认退出', content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          getApp().logout();
        }
      }
    });
  },

  onUnload() {
    if (this.smsTimer) {
      clearInterval(this.smsTimer);
      this.smsTimer = null;
    }
  }
});
