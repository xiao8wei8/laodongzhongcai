/**
 * 微信配置
 * 用于小程序登录（wechat-login）和网页扫码登录（wechat-web-login）
 * 
 * 使用方式：
 *   1. 在微信公众平台/开放平台申请相应的 AppID 和 AppSecret
 *   2. 在 backend/.env 或 backend/.env.production 中填入
 *   3. 小程序端使用 WECHAT_MP_*，网页端使用 WECHAT_WEB_*
 */
export const wechatConfig = {
  // 小程序（微信小程序端用户登录）
  miniprogram: {
    appid: process.env.WECHAT_MP_APPID || '',
    secret: process.env.WECHAT_MP_SECRET || '',
  },
  // 网站应用（PC 管理端扫码登录）
  // 需要到 https://open.weixin.qq.com 申请「网站应用」
  web: {
    appid: process.env.WECHAT_WEB_APPID || '',
    secret: process.env.WECHAT_WEB_SECRET || '',
    // 扫码后微信回调的地址，由 Nginx 代理到本服务的 /api/auth/wechat-web-callback
    redirectUri: process.env.WECHAT_WEB_REDIRECT_URI
      || 'https://www.saifchat.com/laodongzhongcai/api/auth/wechat-web-callback',
  },
  // 用于生成二维码的跳转前缀（开放平台）
  qrConnectUrl: 'https://open.weixin.qq.com/connect/qrconnect',
  // 用于校验/换取 openid 的 API
  jscode2sessionUrl: 'https://api.weixin.qq.com/sns/jscode2session',
  oauthAccessTokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
  userInfoUrl: 'https://api.weixin.qq.com/sns/userinfo',
};

export default wechatConfig;
