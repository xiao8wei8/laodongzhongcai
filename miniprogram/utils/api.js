// utils/api.js - 统一封装 API 请求（复用现有后端接口）

const app = () => getApp();

// 获取 API 基础地址
function getBaseUrl() {
  const appInstance = getApp();
  return appInstance && appInstance.globalData.apiBaseUrl
    ? appInstance.globalData.apiBaseUrl
    : 'https://www.saifchat.com/laodongzhongcai/api';
}

// 获取 token
function getToken() {
  return wx.getStorageSync('token') || '';
}

// 通用请求方法
function request(options) {
  return new Promise((resolve, reject) => {
    const { url, method = 'GET', data = {}, header = {} } = options;
    const token = getToken();

    wx.request({
      url: getBaseUrl() + url,
      method: method,
      data: data,
      header: {
        'content-type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...header
      },
      success: (res) => {
        if (res.statusCode === 401) {
          // Token 过期，清除登录信息并跳转登录
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.reLaunch({ url: '/pages/login/login' });
          reject({ message: '登录已过期，请重新登录' });
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
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
          reject({ message: (res.data && res.data.message) || '请求失败', statusCode: res.statusCode });
        }
      },
      fail: (err) => {
        reject({ message: '网络连接失败，请检查网络设置' });
      }
    });
  });
}

// ============ 认证相关 ============

// 账号密码登录（原有后端支持）
function login(username, password, role) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: { username, password, role }
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

// 微信快捷登录（后端需要新增接口）
function wechatLogin(code, encryptedData, iv) {
  return request({
    url: '/auth/wechat-login',
    method: 'POST',
    data: { code, encryptedData, iv }
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

// 提交案件申请
function submitCase(caseData) {
  return request({
    url: '/case',
    method: 'POST',
    data: caseData
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

function sendMessage(caseId, content) {
  return request({
    url: '/message',
    method: 'POST',
    data: { caseId, content }
  });
}

// ============ 广播/公告 ============

function getBroadcasts() {
  return request({
    url: '/broadcast',
    method: 'GET'
  });
}

// ============ 证据/文件上传 ============

function uploadEvidence(filePath, caseId) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.uploadFile({
      url: getBaseUrl() + '/evidence/upload',
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
    url: '/evidence',
    method: 'GET',
    data: { caseId }
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
  getCurrentUser,
  getMyCases,
  getCases,
  getCaseDetail,
  submitCase,
  updateCase,
  getCaseProgress,
  getMessages,
  sendMessage,
  getBroadcasts,
  uploadEvidence,
  getEvidences,
  updateProfile,
  changePassword,
  checkHealth
};
