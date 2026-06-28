// 用户行为统计服务
import useAuthStore from '../store/authStore';

// 获取API基础URL
const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    return import.meta.env.PROD ? '/laodongzhongcai/api' : 'http://localhost:5003/api';
  }
  return baseUrl;
};

const ANALYTICS_DISABLED_KEY = 'analytics_disabled';

const isAnalyticsDisabled = () => localStorage.getItem(ANALYTICS_DISABLED_KEY) === 'true';
const disableAnalytics = () => localStorage.setItem(ANALYTICS_DISABLED_KEY, 'true');
const isIgnoredPath = (pathname: string) => ['/login'].includes(pathname);

// 埋点数据类型
interface TrackEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  userId?: string;
  username?: string;
  role?: string;
  tenantId?: string;
  clientType?: string;
  sessionId: string;
  page: string;
  referrer: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  performance?: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
  error?: {
    message: string;
    stack: string;
    url: string;
    line: number;
    column: number;
  };
}

// 会话ID管理
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substr(2, 10) + Date.now().toString(36);
    localStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

const getAuthSnapshot = () => {
  const state = useAuthStore.getState();
  const currentUser = state?.userInfo;
  return {
    userId: currentUser?.id,
    username: currentUser?.username || currentUser?.name,
    role: currentUser?.role,
    tenantId: currentUser?.tenantId,
    clientType: 'pc_admin' as const
  };
};

// 发送埋点数据
const sendEvent = (event: TrackEvent) => {
  if (isAnalyticsDisabled() || isIgnoredPath(window.location.pathname)) {
    return;
  }
  // 批量发送，减少请求次数
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  events.push({
    ...event,
    ...getAuthSnapshot()
  });
  localStorage.setItem('analytics_events', JSON.stringify(events));
  
  // 当事件数量达到10个或超过5秒时发送
  if (events.length >= 10) {
    flushEvents();
  } else {
    // 延迟发送，合并事件
    clearTimeout((window as any).analyticsTimeout);
    (window as any).analyticsTimeout = setTimeout(flushEvents, 5000);
  }
};

// 发送所有待处理的事件
const flushEvents = async () => {
  if (isAnalyticsDisabled() || isIgnoredPath(window.location.pathname)) {
    localStorage.setItem('analytics_events', '[]');
    return;
  }
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  if (events.length === 0) return;
  
  try {
    const response = await fetch(`${getApiBaseUrl()}/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ events })
    });
    if (!response.ok) {
      disableAnalytics();
      localStorage.setItem('analytics_events', '[]');
      return;
    }
    // 发送成功后清空事件
    localStorage.setItem('analytics_events', '[]');
  } catch (error) {
    disableAnalytics();
    localStorage.setItem('analytics_events', '[]');
  }
};

// 页面访问统计
export const trackPageView = (page: string) => {
  if (isIgnoredPath(page)) return;
  const event: TrackEvent = {
    event: 'page_view',
    category: 'page',
    action: 'view',
    label: page,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    page,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
  sendEvent(event);
};

export const trackHeartbeat = (page: string = window.location.pathname) => {
  if (isIgnoredPath(page)) return;
  const event: TrackEvent = {
    event: 'heartbeat',
    category: 'engagement',
    action: 'heartbeat',
    timestamp: Date.now(),
    sessionId: getSessionId(),
    page,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
  sendEvent(event);
};

// 点击事件统计
export const trackClick = (category: string, action: string, label?: string, value?: number) => {
  if (isIgnoredPath(window.location.pathname)) return;
  const event: TrackEvent = {
    event: 'click',
    category,
    action,
    label,
    value,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    page: window.location.pathname,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
  sendEvent(event);
};

// 性能统计
export const trackPerformance = () => {
  if (isIgnoredPath(window.location.pathname)) return;
  if (performance && performance.timing) {
    const timing = performance.timing;
    const event: TrackEvent = {
      event: 'performance',
      category: 'performance',
      action: 'load',
      timestamp: Date.now(),
      sessionId: getSessionId(),
      page: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      performance: {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0
      }
    };
    sendEvent(event);
  }
};

// 错误统计
export const trackError = (error: Error, url?: string, line?: number, column?: number) => {
  if (isIgnoredPath(window.location.pathname)) return;
  const event: TrackEvent = {
    event: 'error',
    category: 'error',
    action: 'occur',
    label: error.name,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    page: window.location.pathname,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    error: {
      message: error.message,
      stack: error.stack || '',
      url: url || window.location.href,
      line: line || 0,
      column: column || 0
    }
  };
  sendEvent(event);
};

// 初始化分析服务
export const initAnalytics = () => {
  // 监听页面加载完成
  window.addEventListener('load', () => {
    trackPageView(window.location.pathname);
    trackPerformance();
  });
  
  // 监听页面跳转
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    trackPageView(window.location.pathname);
    return result;
  };

  window.setInterval(() => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    trackHeartbeat(window.location.pathname);
  }, 5 * 60 * 1000);
  
  // 监听错误
  window.addEventListener('error', (event) => {
    trackError(
      new Error(event.message),
      event.filename,
      event.lineno,
      event.colno
    );
  });
  
  // 监听未捕获的Promise错误
  window.addEventListener('unhandledrejection', (event) => {
    trackError(
      new Error(event.reason?.message || 'Unhandled Promise rejection'),
      window.location.href
    );
  });
};
