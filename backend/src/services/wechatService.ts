/**
 * 微信服务模块
 *  - jscode2session: 小程序 code → openid
 *  - getWebLoginUrl: 生成 PC 扫码登录 URL（开放平台）
 *  - getWebUserInfo: 用 code 换取 PC 扫码用户的 openid / 昵称
 *
 * 注意：
 *   本模块仅封装 HTTP 调用，不做任何数据库读写，
 *   数据库读写由 auth/controller.ts 负责。
 */
import https from 'https';
import { URL } from 'url';
import wechatConfig from '../config/wechat';

/** 小程序 jscode2session 返回结构 */
export interface JsCode2SessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface AccessTokenResult {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

interface GetPhoneNumberResult {
  phone_info?: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
  };
  errcode?: number;
  errmsg?: string;
}

/** 网页扫码登录 access_token 返回 */
export interface WebAccessTokenResult {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/** 网页扫码登录 userinfo 返回 */
export interface WebUserInfoResult {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/** 通用 HTTP GET（返回 JSON），用于调用微信官方 API */
function httpsGet<T>(urlStr: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.get(
      {
        host: url.hostname,
        path: url.pathname + url.search,
        port: 443,
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.errcode && parsed.errcode !== 0) {
              reject(new Error(`微信 API 错误: ${parsed.errmsg || data}`));
            } else {
              resolve(parsed as T);
            }
          } catch (e) {
            reject(new Error('微信返回数据解析失败: ' + data));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('微信 API 请求超时'));
    });
  });
}

function httpsPost<T>(urlStr: string, body: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payload = JSON.stringify(body);

    const req = https.request(
      {
        host: url.hostname,
        path: url.pathname + url.search,
        port: 443,
        method: 'POST',
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.errcode && parsed.errcode !== 0) {
              reject(new Error(`微信 API 错误: ${parsed.errmsg || data}`));
            } else {
              resolve(parsed as T);
            }
          } catch (e) {
            reject(new Error('微信返回数据解析失败: ' + data));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('微信 API 请求超时'));
    });
    req.write(payload);
    req.end();
  });
}

let cachedMiniProgramAccessToken: { token: string; expireAt: number } | null = null;

/**
 * 【小程序端】用 wx.login 返回的 code 换取 openid
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
 */
export async function jscode2session(code: string): Promise<JsCode2SessionResult> {
  if (!wechatConfig.miniprogram.appid || !wechatConfig.miniprogram.secret) {
    throw new Error('未配置 WECHAT_MP_APPID / WECHAT_MP_SECRET');
  }
  const url = `${wechatConfig.jscode2sessionUrl}` +
    `?appid=${wechatConfig.miniprogram.appid}` +
    `&secret=${wechatConfig.miniprogram.secret}` +
    `&js_code=${code}&grant_type=authorization_code`;
  return httpsGet<JsCode2SessionResult>(url);
}

export async function getMiniProgramAccessToken(): Promise<string> {
  if (cachedMiniProgramAccessToken && cachedMiniProgramAccessToken.expireAt > Date.now()) {
    return cachedMiniProgramAccessToken.token;
  }

  if (!wechatConfig.miniprogram.appid || !wechatConfig.miniprogram.secret) {
    throw new Error('未配置 WECHAT_MP_APPID / WECHAT_MP_SECRET');
  }

  const url =
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
    `&appid=${wechatConfig.miniprogram.appid}` +
    `&secret=${wechatConfig.miniprogram.secret}`;

  const result = await httpsGet<AccessTokenResult>(url);
  cachedMiniProgramAccessToken = {
    token: result.access_token,
    expireAt: Date.now() + Math.max((result.expires_in - 300), 60) * 1000,
  };
  return result.access_token;
}

export async function getUserPhoneNumber(code: string): Promise<string> {
  const accessToken = await getMiniProgramAccessToken();
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
  const result = await httpsPost<GetPhoneNumberResult>(url, { code });
  const phoneNumber = result.phone_info?.purePhoneNumber || result.phone_info?.phoneNumber;

  if (!phoneNumber) {
    throw new Error('微信未返回手机号');
  }

  return phoneNumber;
}

/**
 * 【PC 管理端】生成扫码登录的 URL
 * 用户在浏览器打开该 URL，显示二维码；扫码后微信带 code 跳转到 redirectUri
 * 文档：https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login_Authorization_Detail.html
 */
export function generateWebLoginUrl(state?: string): string {
  if (!wechatConfig.web.appid) {
    throw new Error('未配置 WECHAT_WEB_APPID');
  }
  const redirect = encodeURIComponent(wechatConfig.web.redirectUri);
  return `${wechatConfig.qrConnectUrl}?appid=${wechatConfig.web.appid}` +
    `&redirect_uri=${redirect}&response_type=code&scope=snsapi_login` +
    (state ? `&state=${encodeURIComponent(state)}` : '') +
    '#wechat_redirect';
}

/**
 * 【PC 管理端】用扫码回调带回的 code 换取 access_token
 */
export async function getWebAccessToken(code: string): Promise<WebAccessTokenResult> {
  if (!wechatConfig.web.appid || !wechatConfig.web.secret) {
    throw new Error('未配置 WECHAT_WEB_APPID / WECHAT_WEB_SECRET');
  }
  const url = `${wechatConfig.oauthAccessTokenUrl}` +
    `?appid=${wechatConfig.web.appid}` +
    `&secret=${wechatConfig.web.secret}` +
    `&code=${code}&grant_type=authorization_code`;
  return httpsGet<WebAccessTokenResult>(url);
}

/**
 * 【PC 管理端】用 access_token + openid 拉取用户基本信息
 */
export async function getWebUserInfo(accessToken: string, openid: string): Promise<WebUserInfoResult> {
  const url = `${wechatConfig.userInfoUrl}?access_token=${accessToken}&openid=${openid}`;
  return httpsGet<WebUserInfoResult>(url);
}

/**
 * 便捷方法：PC 扫码登录 code → { openid, nickname, avatar }
 */
export async function webCodeToUser(code: string): Promise<{
  openid: string;
  unionid?: string;
  nickname?: string;
  avatar?: string;
}> {
  const tokenRes = await getWebAccessToken(code);
  const userRes = await getWebUserInfo(tokenRes.access_token, tokenRes.openid);
  return {
    openid: userRes.openid,
    unionid: tokenRes.unionid || userRes.unionid,
    nickname: userRes.nickname,
    avatar: userRes.headimgurl,
  };
}

export default {
  jscode2session,
  getMiniProgramAccessToken,
  getUserPhoneNumber,
  generateWebLoginUrl,
  getWebAccessToken,
  getWebUserInfo,
  webCodeToUser,
};
