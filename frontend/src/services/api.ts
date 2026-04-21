import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import useAuthStore from '../store/authStore';

// 扩展AxiosRequestConfig接口，添加metadata属性
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
      page: string;
    };
  }
}

// API请求日志类型
interface ApiRequestLog {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  requestTime: number;
  responseTime: number;
  duration: number;
  requestData?: any;
  responseData?: any;
  error?: string;
  timestamp: string;
  page: string;
}

// 存储API请求日志
class ApiLogger {
  private logs: ApiRequestLog[] = [];
  private maxLogs = 1000;

  addLog(log: ApiRequestLog) {
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  getLogs() {
    return this.logs;
  }

  getLogsByPage(page: string) {
    return this.logs.filter(log => log.page === page);
  }

  clearLogs() {
    this.logs = [];
  }
}

export const apiLogger = new ApiLogger();

// 根据环境变量设置API基础URL
const getBaseURL = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    // 默认值
    return import.meta.env.PROD ? '/api' : 'http://localhost:5003/api';
  }
  return baseUrl;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 获取当前页面路径
const getCurrentPage = () => {
  const path = window.location.pathname;
  // 移除开头的斜杠
  return path.startsWith('/') ? path.substring(1) : path;
};

api.interceptors.request.use(
  (config) => {
    // 在每个请求时获取最新的token
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // 如果没有token，移除Authorization头
      delete config.headers.Authorization;
    }
    // 添加请求开始时间
    config.metadata = {
      startTime: Date.now(),
      page: getCurrentPage()
    };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // 记录成功的响应
    const { config, status, statusText, data } = response;
    const duration = Date.now() - (config.metadata?.startTime || Date.now());

    const log: ApiRequestLog = {
      id: Date.now().toString(),
      url: config.url || '',
      method: config.method || 'GET',
      status,
      statusText,
      requestTime: config.metadata?.startTime || Date.now(),
      responseTime: Date.now(),
      duration,
      requestData: config.data,
      responseData: data,
      timestamp: new Date().toISOString(),
      page: config.metadata?.page || getCurrentPage()
    };

    apiLogger.addLog(log);
    return response;
  },
  (error) => {
    // 记录失败的响应
    const { config, response, message } = error;
    const duration = Date.now() - (config?.metadata?.startTime || Date.now());

    const log: ApiRequestLog = {
      id: Date.now().toString(),
      url: config?.url || '',
      method: config?.method || 'GET',
      status: response?.status || 0,
      statusText: response?.statusText || 'Error',
      requestTime: config?.metadata?.startTime || Date.now(),
      responseTime: Date.now(),
      duration,
      requestData: config?.data,
      responseData: response?.data,
      error: message,
      timestamp: new Date().toISOString(),
      page: config?.metadata?.page || getCurrentPage()
    };

    apiLogger.addLog(log);

    if (error.response && error.response.status === 401) {
      const { logout } = useAuthStore.getState();
      logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
