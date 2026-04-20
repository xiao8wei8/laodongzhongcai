import mongoose from 'mongoose';

const ReminderSettingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  reminderTime: {
    type: String,
    enum: ['15min', '30min', '1h', '2h', '1d'],
    default: '30min'
  },
  notificationChannels: {
    system: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    }
  },
  workdayOnly: {
    type: Boolean,
    default: true
  },
  caseReminderDays: {
    type: Number,
    default: 15
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 添加索引，优化查询性能
ReminderSettingSchema.index({ userId: 1 });

const ReminderSetting = mongoose.model('ReminderSetting', ReminderSettingSchema);

export default ReminderSetting;