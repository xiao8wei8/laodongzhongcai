// utils/util.js - 通用工具函数

// 格式化时间
function formatTime(date) {
  if (!date) return '';
  const d = typeof date === 'object' ? date : new Date(date);
  const year = d.getFullYear();
  const month = formatNumber(d.getMonth() + 1);
  const day = formatNumber(d.getDate());
  const hour = formatNumber(d.getHours());
  const minute = formatNumber(d.getMinutes());
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
}

function formatDate(date) {
  if (!date) return '';
  const d = typeof date === 'object' ? date : new Date(date);
  const year = d.getFullYear();
  const month = formatNumber(d.getMonth() + 1);
  const day = formatNumber(d.getDate());
  return year + '-' + month + '-' + day;
}

function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

// Toast 封装
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({ title, icon, duration });
}

function showSuccess(title) {
  wx.showToast({ title, icon: 'success' });
}

function showError(title) {
  wx.showToast({ title, icon: 'none' });
}

// Loading 封装
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

// 确认弹窗
function showConfirm(title, content = '') {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm);
      }
    });
  });
}

// 判断是否登录
function isLoggedIn() {
  return !!wx.getStorageSync('token');
}

// 获取用户信息
function getUserInfo() {
  return wx.getStorageSync('userInfo');
}

// 角色映射
function getRoleText(role) {
  const map = {
    personal: '个人用户',
    company: '企业用户',
    mediator: '调解员',
    admin: '管理员'
  };
  return map[role] || role;
}

// 案件状态映射
function getCaseStatus(status) {
  const map = {
    pending: '待处理',
    in_progress: '调解中',
    completed: '已完成',
    cancelled: '已取消',
    reviewing: '审核中'
  };
  return map[status] || status || '未知';
}

// 案件状态颜色
function getCaseStatusColor(status) {
  const map = {
    pending: '#f5a623',
    in_progress: '#1890ff',
    completed: '#52c41a',
    cancelled: '#999999',
    reviewing: '#722ed1'
  };
  return map[status] || '#666666';
}

// 手机号验证
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// 身份证验证（简化）
function validateIdCard(idCard) {
  return /^\d{17}[\dXx]$/.test(idCard);
}

// 邮箱验证
function validateEmail(email) {
  return /^[\w.-]+@[\w.-]+\.\w+$/.test(email);
}

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  showToast,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  showConfirm,
  isLoggedIn,
  getUserInfo,
  getRoleText,
  getCaseStatus,
  getCaseStatusColor,
  validatePhone,
  validateIdCard,
  validateEmail
};
