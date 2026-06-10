-- ============================================================
-- 微信登录相关字段迁移脚本
-- 执行：在数据库中运行，或在 backend 目录下 npm run db:init（内部已自动处理）
-- ============================================================

-- 为 users 表添加小程序 openid 字段
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wechat_mp_openid VARCHAR(255) DEFAULT NULL COMMENT '微信小程序 openid';

-- 为 users 表添加 PC 扫码登录 openid 字段
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wechat_web_openid VARCHAR(255) DEFAULT NULL COMMENT '微信网站应用 openid';

-- 索引：提升 openid 查找速度
CREATE INDEX IF NOT EXISTS idx_users_wechat_mp_openid ON users (wechat_mp_openid);
CREATE INDEX IF NOT EXISTS idx_users_wechat_web_openid ON users (wechat_web_openid);
