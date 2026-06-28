// app.js - 小程序入口
const apiService = require('./utils/api.js');
const analyticsService = require('./utils/analytics.js');
const envService = require('./utils/env.js');

const { normalizeApiBaseUrl, resolveApiBaseUrl } = envService;

function getAssetBaseUrl(apiBaseUrl) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  return normalizedApiBaseUrl.replace(/\/api$/, '');
}

function normalizeAvatarUrl(avatarUrl, apiBaseUrl) {
  if (!avatarUrl) return '';
  const raw = String(avatarUrl).trim();
  const assetBaseUrl = getAssetBaseUrl(apiBaseUrl || resolveApiBaseUrl());
  const match = raw.match(/(\/laodongzhongcai\/uploads\/avatars\/[^?#]+)/);

  if (match) {
    return `${assetBaseUrl}${match[1]}`;
  }

  return raw
    .replace('http://192.168.64.149:5003', assetBaseUrl.replace('/laodongzhongcai', ''))
    .replace('http://127.0.0.1:5003', assetBaseUrl.replace('/laodongzhongcai', ''))
    .replace('http://localhost:5003', assetBaseUrl.replace('/laodongzhongcai', ''));
}

function normalizeUserInfo(userInfo, apiBaseUrl) {
  if (!userInfo || typeof userInfo !== 'object') return userInfo || null;
  return {
    ...userInfo,
    avatarUrl: normalizeAvatarUrl(userInfo.avatarUrl, apiBaseUrl)
  };
}

let heartbeatTimer = null;

function getCurrentRoute() {
  const pages = getCurrentPages ? getCurrentPages() : [];
  if (!pages || pages.length === 0) return '/pages/home/home';
  const currentPage = pages[pages.length - 1];
  return currentPage && currentPage.route ? `/${currentPage.route}` : '/pages/home/home';
}

function startHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  heartbeatTimer = setInterval(() => {
    const app = getApp();
    if (!app || !app.globalData || !app.globalData.token) return;
    analyticsService.trackHeartbeat(getCurrentRoute());
  }, 5 * 60 * 1000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function setupPageAnalyticsHooks() {
  if (global.__miniProgramAnalyticsWrapped) return;
  global.__miniProgramAnalyticsWrapped = true;

  const originalPage = Page;
  Page = function(pageOptions) {
    const originalOnShow = pageOptions.onShow;
    return originalPage({
      ...pageOptions,
      onShow(...args) {
        if (typeof originalOnShow === 'function') {
          originalOnShow.apply(this, args);
        }
        const app = getApp();
        if (app && app.globalData && app.globalData.token) {
          analyticsService.trackPageView(`/${this.route || ''}`);
        }
      }
    });
  };
}

setupPageAnalyticsHooks();

App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 初始化全局数据
    this.globalData = {
      userInfo: normalizeUserInfo(wx.getStorageSync('userInfo') || null, resolveApiBaseUrl()),
      token: wx.getStorageSync('token') || '',
      apiBaseUrl: resolveApiBaseUrl()
    };
  },

  onShow() {
    if (this.globalData.token) {
      analyticsService.trackHeartbeat(getCurrentRoute());
      startHeartbeat();
    }
  },

  onHide() {
    stopHeartbeat();
  },

  // 保存登录信息
  setLoginInfo(token, userInfo) {
    const normalizedUserInfo = normalizeUserInfo(userInfo, this.globalData.apiBaseUrl);
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', normalizedUserInfo);
    this.globalData.token = token;
    this.globalData.userInfo = normalizedUserInfo;
    analyticsService.trackLoginSuccess(normalizedUserInfo);
    startHeartbeat();
  },

  setApiBaseUrl(apiBaseUrl, persist = true) {
    const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    this.globalData.apiBaseUrl = normalizedApiBaseUrl;
    if (persist) {
      wx.setStorageSync('apiBaseUrl', normalizedApiBaseUrl);
    }
  },

  // 退出登录
  logout() {
    analyticsService.trackLogout();
    stopHeartbeat();
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.reLaunch({
      url: '/pages/home/home'
    });
  },

  globalData: {
    userInfo: null,
    token: '',
    apiBaseUrl: resolveApiBaseUrl()
  },

  normalizeUserInfo(userInfo) {
    return normalizeUserInfo(userInfo, this.globalData.apiBaseUrl);
  },

  normalizeAvatarUrl(avatarUrl) {
    return normalizeAvatarUrl(avatarUrl, this.globalData.apiBaseUrl);
  }
});
