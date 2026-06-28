const DEV_API_BASE_URL = 'http://192.168.64.78:5003/laodongzhongcai/api';
const PROD_API_BASE_URL = 'https://www.saifchat.com/laodongzhongcai/api';
const API_ENV_MODE_AUTO = 'auto';
const API_ENV_MODE_DEV = 'dev';
const API_ENV_MODE_PROD = 'prod';

function normalizeApiBaseUrl(apiBaseUrl) {
  if (!apiBaseUrl) return '';
  return String(apiBaseUrl)
    .replace('http://192.168.64.17:5003/laodongzhongcai/api', DEV_API_BASE_URL)
    .replace('http://192.168.64.78:5003/laodongzhongcai/api', DEV_API_BASE_URL)
    .replace('http://192.168.64.149:5003/laodongzhongcai/api', DEV_API_BASE_URL)
    .replace('http://127.0.0.1:5003/laodongzhongcai/api', DEV_API_BASE_URL)
    .replace('http://localhost:5003/laodongzhongcai/api', DEV_API_BASE_URL);
}

function getMiniProgramEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    return accountInfo && accountInfo.miniProgram
      ? accountInfo.miniProgram.envVersion
      : 'develop';
  } catch (_error) {
    return 'develop';
  }
}

function getDefaultApiBaseUrl() {
  const envVersion = getMiniProgramEnvVersion();
  return envVersion === 'release' || envVersion === 'trial'
    ? PROD_API_BASE_URL
    : DEV_API_BASE_URL;
}

function getApiEnvModeLabel(mode) {
  if (mode === API_ENV_MODE_DEV) return '本地环境';
  if (mode === API_ENV_MODE_PROD) return '生产环境';
  return '自动判断';
}

function detectApiEnvMode(apiBaseUrl) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl || '');
  if (!normalizedApiBaseUrl) return API_ENV_MODE_AUTO;
  if (normalizedApiBaseUrl === PROD_API_BASE_URL) return API_ENV_MODE_PROD;
  if (normalizedApiBaseUrl === DEV_API_BASE_URL) return API_ENV_MODE_DEV;
  return API_ENV_MODE_AUTO;
}

function resolveApiBaseUrl() {
  try {
    const overrideApiBaseUrl = normalizeApiBaseUrl(wx.getStorageSync('apiBaseUrlOverride') || '');
    if (overrideApiBaseUrl) {
      return overrideApiBaseUrl;
    }

    return getDefaultApiBaseUrl();
  } catch (_error) {
    return DEV_API_BASE_URL;
  }
}

function dedupeUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}

function getBaseUrlCandidates(currentApiBaseUrl) {
  const normalizedCurrentApiBaseUrl = normalizeApiBaseUrl(currentApiBaseUrl || '');
  const defaultApiBaseUrl = getDefaultApiBaseUrl();

  return dedupeUrls([
    resolveApiBaseUrl(),
    normalizedCurrentApiBaseUrl,
    defaultApiBaseUrl,
    defaultApiBaseUrl === PROD_API_BASE_URL ? DEV_API_BASE_URL : PROD_API_BASE_URL
  ]);
}

module.exports = {
  DEV_API_BASE_URL,
  PROD_API_BASE_URL,
  API_ENV_MODE_AUTO,
  API_ENV_MODE_DEV,
  API_ENV_MODE_PROD,
  normalizeApiBaseUrl,
  getMiniProgramEnvVersion,
  getDefaultApiBaseUrl,
  getApiEnvModeLabel,
  detectApiEnvMode,
  resolveApiBaseUrl,
  getBaseUrlCandidates
};
