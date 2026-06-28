-- 劳动仲裁调解系统 MySQL 数据库表结构
-- 创建时间：2026-06-02

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY COMMENT '用户ID (UUID)',
  username VARCHAR(100) NOT NULL UNIQUE COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '密码',
  name VARCHAR(100) NOT NULL COMMENT '姓名',
  position VARCHAR(100) COMMENT '职位',
  officePhone VARCHAR(50) COMMENT '办公电话',
  phone VARCHAR(50) COMMENT '手机号',
  email VARCHAR(255) COMMENT '邮箱',
  address TEXT COMMENT '地址',
  street VARCHAR(255) COMMENT '街道',
  department VARCHAR(255) COMMENT '部门',
  role ENUM('mediator', 'admin', 'personal', 'company') NOT NULL COMMENT '角色',
  identity ENUM('applicant', 'respondent') COMMENT '身份',
  caseAmount DECIMAL(15, 2) COMMENT '案件金额',
  idCard VARCHAR(50) COMMENT '身份证号',
  wechat_mp_openid VARCHAR(255) DEFAULT NULL COMMENT '微信小程序 openid',
  wechat_web_openid VARCHAR(255) DEFAULT NULL COMMENT '微信网站应用 openid',
  nickname VARCHAR(100) DEFAULT NULL COMMENT '微信昵称/展示昵称',
  avatarUrl VARCHAR(500) DEFAULT NULL COMMENT '头像地址',
  isSuperAdmin BOOLEAN DEFAULT FALSE COMMENT '是否超级管理员',
  isOnDuty BOOLEAN DEFAULT FALSE COMMENT '是否值班',
  lastOnDutyDate DATETIME COMMENT '最后值班日期',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_on_duty (role, isOnDuty),
  INDEX idx_users_wechat_mp_openid (wechat_mp_openid),
  INDEX idx_users_wechat_web_openid (wechat_web_openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 用户反馈表
CREATE TABLE IF NOT EXISTS feedbacks (
  id CHAR(36) PRIMARY KEY COMMENT '反馈ID (UUID)',
  userId CHAR(36) NOT NULL COMMENT '提交用户ID',
  source ENUM('miniapp', 'admin_web') NOT NULL DEFAULT 'miniapp' COMMENT '反馈来源',
  type ENUM('bug', 'suggestion', 'complaint', 'other') NOT NULL DEFAULT 'other' COMMENT '反馈类型',
  title VARCHAR(255) NOT NULL COMMENT '反馈标题',
  content TEXT NOT NULL COMMENT '反馈内容',
  contactName VARCHAR(100) DEFAULT NULL COMMENT '联系人姓名',
  contactPhone VARCHAR(50) DEFAULT NULL COMMENT '联系人手机号',
  screenshots JSON DEFAULT NULL COMMENT '截图列表',
  status ENUM('pending', 'processing', 'resolved', 'closed') NOT NULL DEFAULT 'pending' COMMENT '处理状态',
  replyContent TEXT DEFAULT NULL COMMENT '处理回复',
  handledBy CHAR(36) DEFAULT NULL COMMENT '处理人ID',
  handledAt DATETIME DEFAULT NULL COMMENT '处理时间',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_feedback_user (userId),
  INDEX idx_feedback_status (status),
  INDEX idx_feedback_source (source),
  INDEX idx_feedback_created_at (createdAt DESC),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (handledBy) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户反馈表';

-- 2. 案件表
CREATE TABLE IF NOT EXISTS cases (
  id CHAR(36) PRIMARY KEY COMMENT '案件ID (UUID)',
  caseNumber VARCHAR(100) NOT NULL UNIQUE COMMENT '案件编号',
  applicantId CHAR(36) NOT NULL COMMENT '申请人ID',
  respondentId CHAR(36) NOT NULL COMMENT '被申请人ID',
  applicantDisplayName VARCHAR(100) DEFAULT NULL COMMENT '申请人姓名快照',
  respondentDisplayName VARCHAR(100) DEFAULT NULL COMMENT '被申请人姓名快照',
  applicantPhone VARCHAR(50) DEFAULT NULL COMMENT '申请人联系电话快照',
  respondentPhone VARCHAR(50) DEFAULT NULL COMMENT '被申请人联系电话快照',
  disputeType VARCHAR(100) NOT NULL COMMENT '争议类型',
  caseAmount DECIMAL(15, 2) COMMENT '案件金额',
  requestItems TEXT NOT NULL COMMENT '请求事项',
  factsReasons TEXT NOT NULL COMMENT '事实与理由',
  status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending' COMMENT '状态',
  mediatorId CHAR(36) COMMENT '调解员ID',
  closeTime DATETIME COMMENT '结案时间',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_case_number (caseNumber),
  INDEX idx_applicant (applicantId),
  INDEX idx_respondent (respondentId),
  INDEX idx_mediator (mediatorId),
  INDEX idx_status (status),
  INDEX idx_created_at (createdAt DESC),
  FOREIGN KEY (applicantId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (respondentId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mediatorId) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案件表';

-- 3. 到访登记表
CREATE TABLE IF NOT EXISTS visitor_records (
  id CHAR(36) PRIMARY KEY COMMENT '记录ID (UUID)',
  registerNumber VARCHAR(100) NOT NULL UNIQUE COMMENT '登记编号',
  visitorName VARCHAR(100) NOT NULL COMMENT '访客姓名',
  phone VARCHAR(50) NOT NULL COMMENT '电话',
  visitType ENUM('visit', 'phone') NOT NULL COMMENT '来访类型',
  disputeType VARCHAR(100) COMMENT '争议类型',
  reason TEXT NOT NULL COMMENT '来访原因',
  mediatorId CHAR(36) COMMENT '调解员ID',
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '状态',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_register_number (registerNumber),
  INDEX idx_phone (phone),
  INDEX idx_visitor_name (visitorName),
  INDEX idx_mediator (mediatorId),
  INDEX idx_created_at (createdAt DESC),
  FOREIGN KEY (mediatorId) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='到访登记表';

-- 4. 案件进度表
CREATE TABLE IF NOT EXISTS case_progress (
  id CHAR(36) PRIMARY KEY COMMENT '进度ID (UUID)',
  caseId CHAR(36) NOT NULL COMMENT '案件ID',
  content TEXT NOT NULL COMMENT '内容',
  type ENUM('register', 'accept', 'mediate', 'close') NOT NULL COMMENT '类型',
  creatorId CHAR(36) NOT NULL COMMENT '创建人ID',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_case_id (caseId),
  INDEX idx_creator (creatorId),
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案件进度表';

-- 5. 证据表
CREATE TABLE IF NOT EXISTS evidences (
  id CHAR(36) PRIMARY KEY COMMENT '证据ID (UUID)',
  caseId CHAR(36) NOT NULL COMMENT '案件ID',
  name VARCHAR(255) NOT NULL COMMENT '证据名称',
  type VARCHAR(100) NOT NULL COMMENT '类型',
  path TEXT NOT NULL COMMENT '文件路径',
  size BIGINT COMMENT '文件大小(字节)',
  uploaderId CHAR(36) NOT NULL COMMENT '上传人ID',
  recognitionStatus ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '识别状态',
  recognizedContent TEXT COMMENT '识别内容',
  recognizedKeyInfo JSON COMMENT '关键信息',
  recognitionTime DATETIME COMMENT '识别时间',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  INDEX idx_case_id (caseId),
  INDEX idx_uploader (uploaderId),
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaderId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='证据表';

-- 6. 广播通知表
CREATE TABLE IF NOT EXISTS broadcasts (
  id CHAR(36) PRIMARY KEY COMMENT '广播ID (UUID)',
  title VARCHAR(255) NOT NULL COMMENT '标题',
  content TEXT NOT NULL COMMENT '内容',
  type VARCHAR(100) NOT NULL COMMENT '类型',
  urgency VARCHAR(50) NOT NULL COMMENT '紧急程度',
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' COMMENT '审核状态',
  creatorId CHAR(36) NOT NULL COMMENT '创建人ID',
  approverId CHAR(36) COMMENT '审核人ID',
  approvalTime DATETIME COMMENT '审核时间',
  rejectionReason TEXT COMMENT '驳回原因',
  attachments JSON COMMENT '附件信息',
  readBy JSON COMMENT '已读用户列表',
  expireAt DATETIME COMMENT '过期时间',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_creator (creatorId),
  INDEX idx_approver (approverId),
  INDEX idx_status (status),
  INDEX idx_created_at (createdAt DESC),
  FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approverId) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='广播通知表';

-- 7. 消息表
CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) PRIMARY KEY COMMENT '消息ID (UUID)',
  senderId CHAR(36) NOT NULL COMMENT '发送人ID',
  receiverId CHAR(36) NOT NULL COMMENT '接收人ID',
  content TEXT NOT NULL COMMENT '消息内容',
  type VARCHAR(100) COMMENT '消息类型',
  caseId CHAR(36) COMMENT '案件ID',
  isRead BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  readAt DATETIME COMMENT '阅读时间',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_sender (senderId),
  INDEX idx_receiver (receiverId),
  INDEX idx_is_read (isRead),
  INDEX idx_type (type),
  INDEX idx_case_id (caseId),
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表';

-- 8. 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY COMMENT '通知ID (UUID)',
  userId CHAR(36) NOT NULL COMMENT '用户ID',
  title VARCHAR(255) NOT NULL COMMENT '标题',
  content TEXT NOT NULL COMMENT '内容',
  type VARCHAR(100) NOT NULL COMMENT '类型',
  isRead BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  readAt DATETIME COMMENT '阅读时间',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (userId),
  INDEX idx_is_read (isRead),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';

-- 9. 日程表
CREATE TABLE IF NOT EXISTS schedules (
  id CHAR(36) PRIMARY KEY COMMENT '日程ID (UUID)',
  caseId CHAR(36) COMMENT '案件ID',
  title VARCHAR(255) NOT NULL COMMENT '标题',
  description TEXT COMMENT '描述',
  category VARCHAR(100) COMMENT '分类',
  date DATETIME NOT NULL COMMENT '日期时间',
  creatorId CHAR(36) NOT NULL COMMENT '创建人ID',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_case_id (caseId),
  INDEX idx_creator (creatorId),
  INDEX idx_date (date),
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日程表';

-- 10. 提醒设置表
CREATE TABLE IF NOT EXISTS reminder_settings (
  id CHAR(36) PRIMARY KEY COMMENT '设置ID (UUID)',
  userId CHAR(36) NOT NULL COMMENT '用户ID',
  type VARCHAR(100) NOT NULL COMMENT '提醒类型',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  advanceTime INT DEFAULT 30 COMMENT '提前时间（分钟）',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_user_type (userId, type),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提醒设置表';

-- 11. 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id CHAR(36) PRIMARY KEY COMMENT '设置ID (UUID)',
  settingKey VARCHAR(100) NOT NULL UNIQUE COMMENT '设置键',
  settingValue TEXT COMMENT '设置值',
  description TEXT COMMENT '描述',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_setting_key (settingKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表';

-- 12. 分析事件表
CREATE TABLE IF NOT EXISTS analytics_events (
  id CHAR(36) PRIMARY KEY COMMENT '事件ID (UUID)',
  eventType VARCHAR(100) NOT NULL COMMENT '事件类型',
  eventData JSON COMMENT '事件数据',
  userId CHAR(36) COMMENT '用户ID',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_event_type (eventType),
  INDEX idx_user_id (userId),
  INDEX idx_created_at (createdAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析事件表';

-- 13. AI使用记录表
CREATE TABLE IF NOT EXISTS ai_usages (
  id CHAR(36) PRIMARY KEY COMMENT '记录ID (UUID)',
  userId CHAR(36) COMMENT '用户ID',
  caseId CHAR(36) COMMENT '案件ID',
  serviceType VARCHAR(100) NOT NULL COMMENT '服务类型',
  requestData JSON COMMENT '请求数据',
  responseData JSON COMMENT '响应数据',
  tokensUsed INT COMMENT '使用的token数',
  cost DECIMAL(10, 4) COMMENT '费用',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (userId),
  INDEX idx_case_id (caseId),
  INDEX idx_created_at (createdAt DESC),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI使用记录表';

SET FOREIGN_KEY_CHECKS = 1;

-- 完成提示
SELECT '✅ 所有表创建成功！' AS message;
