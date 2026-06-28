// pages/login/login.js
const api = require('../../utils/api.js');
const util = require('../../utils/util.js');
const envService = require('../../utils/env.js');

const {
  DEV_API_BASE_URL,
  PROD_API_BASE_URL,
  API_ENV_MODE_AUTO,
  API_ENV_MODE_DEV,
  API_ENV_MODE_PROD,
  getApiEnvModeLabel,
  detectApiEnvMode,
  getDefaultApiBaseUrl,
  getMiniProgramEnvVersion,
  resolveApiBaseUrl
} = envService;

Page({
  data: {
    username: '',
    password: '',
    role: 'personal',
    tenants: [],
    filteredTenants: [],
    tenantIndex: -1,
    tenantLabel: '请选择所属街道',
    tenantId: '',
    tenantKeyword: '',
    showTenantPanel: false,
    agreeProtocol: false,
    loading: false,
    apiEnvMode: API_ENV_MODE_AUTO,
    apiEnvLabel: getApiEnvModeLabel(API_ENV_MODE_AUTO),
    currentApiBaseUrl: resolveApiBaseUrl(),
    miniProgramEnvVersion: getMiniProgramEnvVersion()
  },

  onLoad() {
    this.syncApiEnvState();
    this.loadTenants();
  },

  syncApiEnvState() {
    const overrideApiBaseUrl = wx.getStorageSync('apiBaseUrlOverride') || '';
    const apiEnvMode = detectApiEnvMode(overrideApiBaseUrl);
    const currentApiBaseUrl = resolveApiBaseUrl();
    const miniProgramEnvVersion = getMiniProgramEnvVersion();
    this.setData({
      apiEnvMode,
      apiEnvLabel: getApiEnvModeLabel(apiEnvMode),
      currentApiBaseUrl,
      miniProgramEnvVersion
    });
  },

  openApiEnvSwitcher() {
    const itemList = [
      `${this.data.apiEnvMode === API_ENV_MODE_AUTO ? '✓ ' : ''}自动判断`,
      `${this.data.apiEnvMode === API_ENV_MODE_DEV ? '✓ ' : ''}本地环境`,
      `${this.data.apiEnvMode === API_ENV_MODE_PROD ? '✓ ' : ''}生产环境`
    ];

    wx.showActionSheet({
      alertText: `当前模式：${this.data.apiEnvLabel}\n当前环境：${this.data.miniProgramEnvVersion}\n当前地址：${this.data.currentApiBaseUrl}`,
      itemList,
      success: ({ tapIndex }) => {
        if (tapIndex === 0) {
          this.applyApiEnvMode(API_ENV_MODE_AUTO);
          return;
        }
        if (tapIndex === 1) {
          this.applyApiEnvMode(API_ENV_MODE_DEV);
          return;
        }
        if (tapIndex === 2) {
          this.applyApiEnvMode(API_ENV_MODE_PROD);
        }
      }
    });
  },

  applyApiEnvMode(mode) {
    const app = getApp();
    let targetApiBaseUrl = getDefaultApiBaseUrl();

    if (mode === API_ENV_MODE_AUTO) {
      wx.removeStorageSync('apiBaseUrlOverride');
    } else {
      targetApiBaseUrl = mode === API_ENV_MODE_PROD ? PROD_API_BASE_URL : DEV_API_BASE_URL;
      wx.setStorageSync('apiBaseUrlOverride', targetApiBaseUrl);
    }

    app.setApiBaseUrl(mode === API_ENV_MODE_AUTO ? getDefaultApiBaseUrl() : targetApiBaseUrl);
    this.syncApiEnvState();
    this.loadTenants();

    wx.showToast({
      title: `已切换为${getApiEnvModeLabel(mode)}`,
      icon: 'none',
      duration: 1800
    });
  },

  finishLogin() {
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/home/home'
      });
    }, 300);
  },

  handleLoginSuccess(token, userInfo) {
    const app = getApp();
    app.setLoginInfo(token, userInfo);

    util.hideLoading();
    util.showSuccess('登录成功');
    this.finishLogin();
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onRoleChange(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  async loadTenants() {
    try {
      const result = await api.getTenants();
      const tenants = result.tenants || [];
      const selectedTenantId = this.data.tenantId;
      const tenantIndex = selectedTenantId ? tenants.findIndex(item => item.id === selectedTenantId) : -1;
      this.setData({
        tenants,
        filteredTenants: tenants,
        tenantIndex,
        tenantLabel: tenantIndex >= 0 ? tenants[tenantIndex].tenantName : '请选择所属街道'
      });
    } catch (error) {
      util.showError(error.message || '获取街道列表失败');
    }
  },

  selectTenantById(tenantId) {
    const tenantIndex = this.data.tenants.findIndex(item => item.id === tenantId);
    const tenant = tenantIndex >= 0 ? this.data.tenants[tenantIndex] : null;
    this.setData({
      tenantIndex,
      tenantLabel: tenant ? tenant.tenantName : '请选择所属街道',
      tenantId: tenant ? tenant.id : '',
      tenantKeyword: '',
      filteredTenants: this.data.tenants,
      showTenantPanel: false
    });
  },

  openTenantPanel() {
    this.setData({
      showTenantPanel: true,
      tenantKeyword: '',
      filteredTenants: this.data.tenants
    });
  },

  closeTenantPanel() {
    this.setData({
      showTenantPanel: false,
      tenantKeyword: '',
      filteredTenants: this.data.tenants
    });
  },

  onTenantKeywordInput(e) {
    const tenantKeyword = (e.detail.value || '').trim();
    const keyword = tenantKeyword.toLowerCase();
    const filteredTenants = !keyword
      ? this.data.tenants
      : this.data.tenants.filter((item) => {
          const source = [
            item.tenantName,
            item.districtName,
            item.streetName,
            item.tenantCode
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return source.includes(keyword);
        });

    this.setData({ tenantKeyword, filteredTenants });
  },

  onTenantItemTap(e) {
    const tenantId = e.currentTarget.dataset.id;
    this.selectTenantById(tenantId);
  },

  noop() {},

  onAgreementChange(e) {
    this.setData({ agreeProtocol: (e.detail.value || []).includes('agree') });
  },

  viewAgreement(e) {
    const type = e.currentTarget.dataset.type || 'service';
    wx.navigateTo({
      url: `/pages/agreement/agreement?type=${type}`
    });
  },

  browseFirst() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  // 账号密码登录
  async onLogin() {
    const { username, password, role, tenantId, agreeProtocol } = this.data;
    if (!agreeProtocol) {
      util.showError('请先阅读并自主勾选同意相关协议');
      return;
    }
    if (!username.trim()) {
      util.showError('请输入账号');
      return;
    }
    if (!password.trim()) {
      util.showError('请输入密码');
      return;
    }
    if (!tenantId) {
      util.showError('请选择所属街道');
      return;
    }

    this.setData({ loading: true });
    util.showLoading('登录中...');

    try {
      const result = await api.login(username.trim(), password.trim(), role, tenantId);

      if (result.token) {
        this.handleLoginSuccess(result.token, result.userInfo);
      } else {
        util.showError(result.message || '登录失败');
      }
    } catch (err) {
      util.hideLoading();
      util.showError(err.message || '登录失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 微信登录
  onWechatLogin() {
    if (!this.data.agreeProtocol) {
      return util.showError('请先勾选并同意用户协议和隐私政策');
    }
    if (!this.data.tenantId) {
      return util.showError('请选择所属街道');
    }
    util.showLoading('正在登录中...');
    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) {
          util.hideLoading();
          return util.showError('获取微信登录态失败');
        }

        try {
          const result = await api.wechatLogin(loginRes.code, this.data.tenantId);
          if (result && result.token) {
            this.handleLoginSuccess(result.token, result.userInfo);
          } else {
            util.hideLoading();
            util.showError(result.message || '微信登录失败');
          }
        } catch (err) {
          util.hideLoading();
          util.showError((err && err.message) || '微信一键登录失败');
        }
      },
      fail: () => {
        util.hideLoading();
        util.showError('微信登录失败');
      }
    });
  }
});
