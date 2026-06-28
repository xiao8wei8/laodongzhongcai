const SESSION_KEY = 'mini_analytics_session_id';
const envService = require('./env.js');

function getAnalyticsBaseUrlCandidates() {
  const app = getApp ? getApp() : null;
  const currentApiBaseUrl = app && app.globalData && app.globalData.apiBaseUrl
    ? app.globalData.apiBaseUrl
    : '';
  return envService.getBaseUrlCandidates(currentApiBaseUrl);
}

function getSessionId() {
  let sessionId = wx.getStorageSync(SESSION_KEY);
  if (!sessionId) {
    sessionId = `mini_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    wx.setStorageSync(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getUserSnapshot() {
  const app = getApp ? getApp() : null;
  const userInfo = (app && app.globalData && app.globalData.userInfo) || wx.getStorageSync('userInfo') || null;
  const token = (app && app.globalData && app.globalData.token) || wx.getStorageSync('token') || '';
  return {
    token,
    userInfo
  };
}

function getSystemMeta() {
  try {
    const info = wx.getSystemInfoSync();
    return {
      userAgent: `${info.brand || ''} ${info.model || ''} / ${info.system || ''} / ${info.version || ''}`.trim(),
      screenWidth: info.screenWidth || 0,
      screenHeight: info.screenHeight || 0
    };
  } catch (_error) {
    return {
      userAgent: 'mini-program',
      screenWidth: 0,
      screenHeight: 0
    };
  }
}

function postEvents(events) {
  const baseUrlCandidates = getAnalyticsBaseUrlCandidates();
  const tryPost = (candidateIndex) => new Promise((resolve, reject) => {
    const baseUrl = baseUrlCandidates[candidateIndex];
    if (!baseUrl) {
      reject(new Error('未配置可用的接口地址'));
      return;
    }

    wx.request({
      url: `${baseUrl}/analytics/track`,
      method: 'POST',
      data: { events },
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (candidateIndex < baseUrlCandidates.length - 1) {
          resolve(tryPost(candidateIndex + 1));
          return;
        }
        reject(new Error((res.data && res.data.message) || '埋点上报失败'));
      },
      fail: () => {
        if (candidateIndex < baseUrlCandidates.length - 1) {
          resolve(tryPost(candidateIndex + 1));
          return;
        }
        reject(new Error('埋点上报失败'));
      }
    });
  });

  return tryPost(0).catch(() => null);
}

function buildEvent(event, extra = {}) {
  const { token, userInfo } = getUserSnapshot();
  const route = extra.page || '';
  const systemMeta = getSystemMeta();

  if (!token && event !== 'login_success' && event !== 'logout') {
    return null;
  }

  return {
    event,
    category: extra.category || 'mini_program',
    action: extra.action || event,
    label: extra.label || route,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    page: route,
    referrer: '',
    userAgent: systemMeta.userAgent,
    screenWidth: systemMeta.screenWidth,
    screenHeight: systemMeta.screenHeight,
    userId: extra.userId || (userInfo && userInfo.id) || undefined,
    username: extra.username || (userInfo && (userInfo.username || userInfo.name || userInfo.nickname)) || undefined,
    role: extra.role || (userInfo && userInfo.role) || undefined,
    tenantId: extra.tenantId || (userInfo && userInfo.tenantId) || undefined,
    clientType: 'mini_program'
  };
}

function track(event, extra = {}) {
  const payload = buildEvent(event, extra);
  if (!payload) {
    return Promise.resolve(null);
  }
  return postEvents([payload]);
}

function trackPageView(route) {
  return track('page_view', {
    action: 'view',
    page: route
  });
}

function trackHeartbeat(route) {
  return track('heartbeat', {
    action: 'heartbeat',
    page: route
  });
}

function trackLoginSuccess(userInfo) {
  return track('login_success', {
    action: 'login',
    page: '/pages/login/login',
    userId: userInfo && userInfo.id,
    username: userInfo && (userInfo.username || userInfo.name || userInfo.nickname),
    role: userInfo && userInfo.role,
    tenantId: userInfo && userInfo.tenantId
  });
}

function trackLogout() {
  const currentPages = getCurrentPages ? getCurrentPages() : [];
  const currentRoute = currentPages.length > 0 && currentPages[currentPages.length - 1]
    ? `/${currentPages[currentPages.length - 1].route}`
    : '/pages/profile/profile';
  return track('logout', {
    action: 'logout',
    page: currentRoute
  });
}

module.exports = {
  track,
  trackPageView,
  trackHeartbeat,
  trackLoginSuccess,
  trackLogout
};
