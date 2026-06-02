import mongoose from 'mongoose';
import pool from '../config/mysql';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB 连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/laodong';

// 定义 MongoDB 模型（简化版本）
const UserSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  username: String,
  password: String,
  name: String,
  position: String,
  officePhone: String,
  phone: String,
  email: String,
  address: String,
  street: String,
  department: String,
  role: String,
  identity: String,
  caseAmount: Number,
  idCard: String,
  isOnDuty: Boolean,
  lastOnDutyDate: Date,
  createdAt: Date,
  updatedAt: Date
});

const CaseSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  caseNumber: String,
  applicantId: mongoose.Schema.Types.ObjectId,
  respondentId: mongoose.Schema.Types.ObjectId,
  disputeType: String,
  caseAmount: Number,
  requestItems: String,
  factsReasons: String,
  status: String,
  mediatorId: mongoose.Schema.Types.ObjectId,
  closeTime: Date,
  createdAt: Date,
  updatedAt: Date
});

const VisitorRecordSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  registerNumber: String,
  visitorName: String,
  phone: String,
  visitType: String,
  disputeType: String,
  reason: String,
  mediatorId: mongoose.Schema.Types.ObjectId,
  sendSmsVerification: Boolean,
  sendEmailVerification: Boolean,
  email: String,
  status: String,
  createdAt: Date,
  updatedAt: Date
});

const CaseProgressSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  caseId: mongoose.Schema.Types.ObjectId,
  content: String,
  type: String,
  creatorId: mongoose.Schema.Types.ObjectId,
  createdAt: Date
});

const EvidenceSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  caseId: mongoose.Schema.Types.ObjectId,
  name: String,
  type: String,
  path: String,
  uploaderId: mongoose.Schema.Types.ObjectId,
  createdAt: Date
});

const BroadcastSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  title: String,
  content: String,
  type: String,
  urgency: String,
  creatorId: mongoose.Schema.Types.ObjectId,
  expireAt: Date,
  createdAt: Date
});

const MessageSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  senderId: mongoose.Schema.Types.ObjectId,
  receiverId: mongoose.Schema.Types.ObjectId,
  content: String,
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
});

const NotificationSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  content: String,
  type: String,
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
});

const ScheduleSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  caseId: mongoose.Schema.Types.ObjectId,
  title: String,
  description: String,
  category: String,
  date: Date,
  creatorId: mongoose.Schema.Types.ObjectId,
  createdAt: Date,
  updatedAt: Date
});

const ReminderSettingSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  enabled: Boolean,
  advanceTime: Number,
  createdAt: Date,
  updatedAt: Date
});

const SystemSettingsSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  settingKey: String,
  settingValue: String,
  description: String,
  createdAt: Date,
  updatedAt: Date
});

const AnalyticsEventSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  eventType: String,
  eventData: mongoose.Schema.Types.Mixed,
  userId: mongoose.Schema.Types.ObjectId,
  createdAt: Date
});

const AiUsageSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  caseId: mongoose.Schema.Types.ObjectId,
  serviceType: String,
  requestData: mongoose.Schema.Types.Mixed,
  responseData: mongoose.Schema.Types.Mixed,
  tokensUsed: Number,
  cost: Number,
  createdAt: Date
});

async function migrateData() {
  console.log('🚀 开始从 MongoDB 迁移数据到 MySQL...');

  try {
    // 1. 连接 MongoDB
    console.log('连接 MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 连接成功');

    // 2. 获取连接
    const connection = await pool.getConnection();

    try {
      // 3. 清空 MySQL 现有数据（可选）
      console.log('清空 MySQL 现有数据...');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      const tables = ['ai_usages', 'analytics_events', 'system_settings', 'reminder_settings', 
                      'schedules', 'notifications', 'messages', 'broadcasts', 'evidences', 
                      'case_progress', 'visitor_records', 'cases', 'users'];
      for (const table of tables) {
        await connection.query(`DELETE FROM ${table}`);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');

      // 4. 迁移数据
      await migrateUsers(connection);
      await migrateCases(connection);
      await migrateVisitorRecords(connection);
      await migrateCaseProgress(connection);
      await migrateEvidences(connection);
      await migrateBroadcasts(connection);
      await migrateMessages(connection);
      await migrateNotifications(connection);
      await migrateSchedules(connection);
      await migrateReminderSettings(connection);
      await migrateSystemSettings(connection);
      await migrateAnalyticsEvents(connection);
      await migrateAiUsages(connection);

      console.log('🎉 数据迁移完成！');
    } finally {
      connection.release();
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    process.exit(1);
  }
}

async function migrateUsers(connection: any) {
  console.log('迁移用户数据...');
  const UserModel = mongoose.model('User', UserSchema);
  const users = await UserModel.find().lean();
  
  for (const user of users) {
    await connection.query(
      `INSERT INTO users (
        id, username, password, name, position, officePhone, phone, email, 
        address, street, department, role, identity, caseAmount, idCard, 
        isOnDuty, lastOnDutyDate, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user._id.toString(),
        user.username,
        user.password,
        user.name,
        user.position || null,
        user.officePhone || null,
        user.phone || null,
        user.email || null,
        user.address || null,
        user.street || null,
        user.department || null,
        user.role,
        user.identity || null,
        user.caseAmount || null,
        user.idCard || null,
        user.isOnDuty || false,
        user.lastOnDutyDate || null,
        user.createdAt || new Date(),
        user.updatedAt || new Date()
      ]
    );
  }
  console.log(`✅ 用户数据迁移完成: ${users.length} 条`);
}

async function migrateCases(connection: any) {
  console.log('迁移案件数据...');
  const CaseModel = mongoose.model('Case', CaseSchema);
  const cases = await CaseModel.find().lean();
  
  for (const caseData of cases) {
    await connection.query(
      `INSERT INTO cases (
        id, caseNumber, applicantId, respondentId, disputeType, caseAmount, 
        requestItems, factsReasons, status, mediatorId, closeTime, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseData._id.toString(),
        caseData.caseNumber,
        caseData.applicantId?.toString(),
        caseData.respondentId?.toString(),
        caseData.disputeType,
        caseData.caseAmount || null,
        caseData.requestItems,
        caseData.factsReasons,
        caseData.status,
        caseData.mediatorId?.toString() || null,
        caseData.closeTime || null,
        caseData.createdAt || new Date(),
        caseData.updatedAt || new Date()
      ]
    );
  }
  console.log(`✅ 案件数据迁移完成: ${cases.length} 条`);
}

async function migrateVisitorRecords(connection: any) {
  console.log('移到访登记数据...');
  const VisitorRecordModel = mongoose.model('VisitorRecord', VisitorRecordSchema);
  const records = await VisitorRecordModel.find().lean();
  
  for (const record of records) {
    await connection.query(
      `INSERT INTO visitor_records (
        id, registerNumber, visitorName, phone, visitType, disputeType, reason, 
        mediatorId, sendSmsVerification, sendEmailVerification, email, status, 
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record._id.toString(),
        record.registerNumber,
        record.visitorName,
        record.phone,
        record.visitType,
        record.disputeType || null,
        record.reason,
        record.mediatorId?.toString() || null,
        record.sendSmsVerification || false,
        record.sendEmailVerification || false,
        record.email || null,
        record.status || 'pending',
        record.createdAt || new Date(),
        record.updatedAt || new Date()
      ]
    );
  }
  console.log(`✅ 到访登记数据迁移完成: ${records.length} 条`);
}

async function migrateCaseProgress(connection: any) {
  console.log('迁移案件进度数据...');
  const CaseProgressModel = mongoose.model('CaseProgress', CaseProgressSchema);
  const progresses = await CaseProgressModel.find().lean();
  
  for (const progress of progresses) {
    await connection.query(
      `INSERT INTO case_progress (id, caseId, content, type, creatorId, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        progress._id.toString(),
        progress.caseId?.toString(),
        progress.content,
        progress.type,
        progress.creatorId?.toString(),
        progress.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ 案件进度数据迁移完成: ${progresses.length} 条`);
}

async function migrateEvidences(connection: any) {
  console.log('迁移证据数据...');
  const EvidenceModel = mongoose.model('Evidence', EvidenceSchema);
  const evidences = await EvidenceModel.find().lean();
  
  for (const evidence of evidences) {
    await connection.query(
      `INSERT INTO evidences (id, caseId, name, type, path, uploaderId, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        evidence._id.toString(),
        evidence.caseId?.toString(),
        evidence.name,
        evidence.type,
        evidence.path,
        evidence.uploaderId?.toString(),
        evidence.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ 证据数据迁移完成: ${evidences.length} 条`);
}

async function migrateBroadcasts(connection: any) {
  console.log('迁移广播数据...');
  const BroadcastModel = mongoose.model('Broadcast', BroadcastSchema);
  const broadcasts = await BroadcastModel.find().lean();
  
  for (const broadcast of broadcasts) {
    await connection.query(
      `INSERT INTO broadcasts (id, title, content, type, urgency, creatorId, expireAt, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        broadcast._id.toString(),
        broadcast.title,
        broadcast.content,
        broadcast.type,
        broadcast.urgency,
        broadcast.creatorId?.toString(),
        broadcast.expireAt || null,
        broadcast.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ 广播数据迁移完成: ${broadcasts.length} 条`);
}

async function migrateMessages(connection: any) {
  console.log('迁移消息数据...');
  const MessageModel = mongoose.model('Message', MessageSchema);
  const messages = await MessageModel.find().lean();
  
  for (const message of messages) {
    await connection.query(
      `INSERT INTO messages (id, senderId, receiverId, content, isRead, readAt, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        message._id.toString(),
        message.senderId?.toString(),
        message.receiverId?.toString(),
        message.content,
        message.isRead || false,
        message.readAt || null,
        message.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ 消息数据迁移完成: ${messages.length} 条`);
}

async function migrateNotifications(connection: any) {
  console.log('迁移通知数据...');
  const NotificationModel = mongoose.model('Notification', NotificationSchema);
  const notifications = await NotificationModel.find().lean();
  
  for (const notification of notifications) {
    await connection.query(
      `INSERT INTO notifications (id, userId, title, content, type, isRead, readAt, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notification._id.toString(),
        notification.userId?.toString(),
        notification.title,
        notification.content,
        notification.type,
        notification.isRead || false,
        notification.readAt || null,
        notification.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ 通知数据迁移完成: ${notifications.length} 条`);
}

async function migrateSchedules(connection: any) {
  console.log('迁移日程数据...');
  const ScheduleModel = mongoose.model('Schedule', ScheduleSchema);
  const schedules = await ScheduleModel.find().lean();
  
  for (const schedule of schedules) {
    await connection.query(
      `INSERT INTO schedules (id, caseId, title, description, category, date, creatorId, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule._id.toString(),
        schedule.caseId?.toString() || null,
        schedule.title,
        schedule.description || null,
        schedule.category || null,
        schedule.date,
        schedule.creatorId?.toString(),
        schedule.createdAt || new Date(),
        schedule.updatedAt || new Date()
      ]
    );
  }
  console.log(`✅ 日程数据迁移完成: ${schedules.length} 条`);
}

async function migrateReminderSettings(connection: any) {
  console.log('迁移提醒设置数据...');
  const ReminderSettingModel = mongoose.model('ReminderSetting', ReminderSettingSchema);
  const settings = await ReminderSettingModel.find().lean();
  
  for (const setting of settings) {
    await connection.query(
      `INSERT INTO reminder_settings (id, userId, type, enabled, advanceTime, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        setting._id.toString(),
        setting.userId?.toString(),
        setting.type,
        setting.enabled !== false,
        setting.advanceTime || 30,
        setting.createdAt || new Date(),
        setting.updatedAt || new Date()
      ]
    );
  }
  console.log(`✅ 提醒设置数据迁移完成: ${settings.length} 条`);
}

async function migrateSystemSettings(connection: any) {
  console.log('迁移系统设置数据...');
  const SystemSettingsModel = mongoose.model('SystemSettings', SystemSettingsSchema);
  const settings = await SystemSettingsModel.find().lean();
  
  for (const setting of settings) {
    await connection.query(
      `INSERT INTO system_settings (id, settingKey, settingValue, description, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        setting._id.toString(),
        setting.settingKey,
        setting.settingValue || null,
        setting.description || null,
        setting.createdAt || new Date(),
        setting.updatedAt || new Date()
      ]
    );
  }
  console.log(`✅ 系统设置数据迁移完成: ${settings.length} 条`);
}

async function migrateAnalyticsEvents(connection: any) {
  console.log('迁移分析事件数据...');
  const AnalyticsEventModel = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
  const events = await AnalyticsEventModel.find().lean();
  
  for (const event of events) {
    await connection.query(
      `INSERT INTO analytics_events (id, eventType, eventData, userId, createdAt) 
      VALUES (?, ?, ?, ?, ?)`,
      [
        event._id.toString(),
        event.eventType,
        event.eventData ? JSON.stringify(event.eventData) : null,
        event.userId?.toString() || null,
        event.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ 分析事件数据迁移完成: ${events.length} 条`);
}

async function migrateAiUsages(connection: any) {
  console.log('迁移AI使用数据...');
  const AiUsageModel = mongoose.model('AiUsage', AiUsageSchema);
  const usages = await AiUsageModel.find().lean();
  
  for (const usage of usages) {
    await connection.query(
      `INSERT INTO ai_usages (id, userId, caseId, serviceType, requestData, responseData, tokensUsed, cost, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usage._id.toString(),
        usage.userId?.toString() || null,
        usage.caseId?.toString() || null,
        usage.serviceType,
        usage.requestData ? JSON.stringify(usage.requestData) : null,
        usage.responseData ? JSON.stringify(usage.responseData) : null,
        usage.tokensUsed || null,
        usage.cost || null,
        usage.createdAt || new Date()
      ]
    );
  }
  console.log(`✅ AI使用数据迁移完成: ${usages.length} 条`);
}

if (require.main === module) {
  migrateData();
}

export default migrateData;
