// utils/api.js - 统一封装 API 请求（复用现有后端接口）

const app = () => getApp();

const DEV_API_BASE_URL = 'http://192.168.64.17:5003/laodongzhongcai/api';
const PROD_API_BASE_URL = 'https://www.saifchat.com/laodongzhongcai/api';

function dedupeUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}

function normalizeApiBaseUrl(apiBaseUrl) {
  if (!apiBaseUrl) return '';
  return String(apiBaseUrl)
    .replace('http://192.168.64.149:5003/laodongzhongcai/api', DEV_API_BASE_URL)
    .replace('http://127.0.0.1:5003/laodongzhongcai/api', DEV_API_BASE_URL)
    .replace('http://localhost:5003/laodongzhongcai/api', DEV_API_BASE_URL);
}

// 获取 API 基础地址候选列表
function getBaseUrlCandidates() {
  const appInstance = app();
  const manualApiBaseUrl = normalizeApiBaseUrl(wx.getStorageSync('apiBaseUrlOverride') || '');
  const currentApiBaseUrl = appInstance && appInstance.globalData && appInstance.globalData.apiBaseUrl
    ? normalizeApiBaseUrl(appInstance.globalData.apiBaseUrl)
    : '';

  return dedupeUrls([
    manualApiBaseUrl,
    currentApiBaseUrl,
    DEV_API_BASE_URL,
    PROD_API_BASE_URL
  ]);
}

function persistBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  const appInstance = app();
  if (appInstance && typeof appInstance.setApiBaseUrl === 'function') {
    appInstance.setApiBaseUrl(normalizedBaseUrl);
    return;
  }
  wx.setStorageSync('apiBaseUrl', normalizedBaseUrl);
}

// 获取 token
function getToken() {
  return wx.getStorageSync('token') || '';
}

// 通用请求方法
function request(options) {
  return new Promise((resolve, reject) => {
    const { url, method = 'GET', data = {}, header = {}, skipAuthRedirect = false } = options;
    const token = getToken();
    const baseUrlCandidates = getBaseUrlCandidates();

    const tryRequest = (candidateIndex) => {
      const baseUrl = baseUrlCandidates[candidateIndex];
      if (!baseUrl) {
        reject({ message: '未配置可用的接口地址' });
        return;
      }

      wx.request({
        url: baseUrl + url,
        method: method,
        data: data,
        header: {
          'content-type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
          ...header
        },
        success: (res) => {
          if (res.statusCode === 401) {
            if (!skipAuthRedirect) {
              // Token 过期，清除登录信息并跳转登录
              wx.removeStorageSync('token');
              wx.removeStorageSync('userInfo');
              wx.reLaunch({ url: '/pages/login/login' });
            }
            reject({
              message: skipAuthRedirect ? '当前内容暂不可匿名访问' : '登录已过期，请重新登录',
              statusCode: res.statusCode,
              baseUrl
            });
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            persistBaseUrl(baseUrl);
            const result = res.data;
            // 返回格式兼容：后端直接返回数据 或 { success, message, data }
            if (result && typeof result === 'object') {
              if (result.success === false) {
                reject(result);
              } else {
                resolve(result);
              }
            } else {
              resolve(result);
            }
          } else {
            reject({
              message: (res.data && res.data.message) || '请求失败',
              statusCode: res.statusCode,
              baseUrl
            });
          }
        },
        fail: (err) => {
          if (candidateIndex < baseUrlCandidates.length - 1) {
            tryRequest(candidateIndex + 1);
            return;
          }

          reject({
            message: `网络连接失败，请检查服务是否已启动：${baseUrl}`,
            baseUrl,
            details: err && err.errMsg ? err.errMsg : ''
          });
        }
      });
    };

    tryRequest(0);
  });
}

// ============ 认证相关 ============

// 账号密码登录（原有后端支持）
function login(username, password, role, tenantId) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: { username, password, role, tenantId }
  });
}

// 注册（原有后端支持）
function register(userData) {
  return request({
    url: '/auth/register',
    method: 'POST',
    data: userData
  });
}

// 微信登录
function wechatLogin(code, tenantId) {
  return request({
    url: '/auth/wechat-login',
    method: 'POST',
    data: { code, tenantId }
  });
}

function bindWechatPhone(code) {
  return request({
    url: '/auth/wechat-phone',
    method: 'POST',
    data: { code }
  });
}

function sendSmsCode(phone) {
  return request({
    url: '/auth/sms/send-code',
    method: 'POST',
    data: { phone }
  });
}

function bindPhoneBySms(phone, code) {
  return request({
    url: '/auth/sms/bind-phone',
    method: 'POST',
    data: { phone, code }
  });
}

// 获取当前用户信息
function getCurrentUser() {
  return request({
    url: '/auth/me',
    method: 'GET'
  });
}

// ============ 案件相关 ============

// 获取我的案件列表（新增接口）
function getMyCases(keyword = '') {
  return request({
    url: '/case/mine',
    method: 'GET',
    data: { keyword }
  });
}

// 获取案件列表
function getCases(params = {}) {
  return request({
    url: '/case',
    method: 'GET',
    data: params
  });
}

// 获取案件详情
function getCaseDetail(caseId) {
  return request({
    url: '/case/' + caseId,
    method: 'GET'
  });
}

// 提交调解申请
function submitCase(caseData) {
  return request({
    // 当前后端“申请调解”走 /application，而不是 /case
    url: '/application',
    method: 'POST',
    data: caseData
  });
}

function getCurrentDutyMediator(tenantId) {
  return request({
    url: '/application/duty-mediator',
    method: 'GET',
    data: { tenantId },
    skipAuthRedirect: true
  });
}

function createConsultation(data) {
  return request({
    url: '/application/consultation',
    method: 'POST',
    data
  });
}

// 更新案件信息
function updateCase(caseId, data) {
  return request({
    url: '/case/' + caseId,
    method: 'PUT',
    data: data
  });
}

// ============ 案件进度 ============

function getCaseProgress(caseId) {
  return request({
    url: '/case/' + caseId + '/progress',
    method: 'GET'
  });
}

// ============ 留言/消息 ============

function getMessages(params = {}) {
  return request({
    url: '/message',
    method: 'GET',
    data: params
  });
}

function sendMessage(caseId, content, recipientId) {
  return request({
    url: '/message',
    method: 'POST',
    data: { caseId, content, recipientId }
  });
}

// ============ 广播/公告 ============

function getBroadcasts() {
  return request({
    url: '/broadcast',
    method: 'GET',
    skipAuthRedirect: true
  });
}

function getSystemSettings() {
  return request({
    url: '/system/settings',
    method: 'GET',
    skipAuthRedirect: true
  });
}

function getTenants() {
  return request({
    url: '/tenant',
    method: 'GET'
  });
}

function createFeedback(data) {
  return request({
    url: '/feedback',
    method: 'POST',
    data
  });
}

function getMyFeedbacks() {
  return request({
    url: '/feedback/mine',
    method: 'GET'
  });
}

// ============ 证据/文件上传 ============

function uploadEvidence(filePath, caseId) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.uploadFile({
      // 后端上传接口为 POST /evidence
      url: getBaseUrl() + '/evidence',
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': 'Bearer ' + token
      },
      formData: {
        caseId: caseId || ''
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          resolve(data);
        } catch (e) {
          reject({ message: '上传失败' });
        }
      },
      fail: reject
    });
  });
}

function getEvidences(caseId) {
  return request({
    // 后端查询案件证据接口为 GET /evidence/case/:caseId
    url: '/evidence/case/' + caseId,
    method: 'GET',
    data: {}
  });
}

// ============ 个人信息 ============

function updateProfile(data) {
  return request({
    url: '/auth/profile',
    method: 'PUT',
    data: data
  });
}

function uploadAvatar(filePath) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.uploadFile({
      url: getBaseUrl() + '/auth/avatar',
      filePath,
      name: 'avatar',
      header: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(data);
          }
        } catch (e) {
          reject({ message: '头像上传失败' });
        }
      },
      fail: () => reject({ message: '网络连接失败，请检查网络设置' })
    });
  });
}

function changePassword(oldPassword, newPassword) {
  return request({
    url: '/auth/password',
    method: 'PUT',
    data: { oldPassword, newPassword }
  });
}

// ============ 服务状态检查 ============

function checkHealth() {
  return request({
    url: '/health',
    method: 'GET'
  });
}

module.exports = {
  request,
  login,
  register,
  wechatLogin,
  bindWechatPhone,
  sendSmsCode,
  bindPhoneBySms,
  getCurrentUser,
  getMyCases,
  getCases,
  getCaseDetail,
  submitCase,
  getCurrentDutyMediator,
  createConsultation,
  updateCase,
  getCaseProgress,
  getMessages,
  sendMessage,
  getBroadcasts,
  getSystemSettings,
  getTenants,
  createFeedback,
  getMyFeedbacks,
  uploadEvidence,
  getEvidences,
  updateProfile,
  uploadAvatar,
  changePassword,
  checkHealth
};
