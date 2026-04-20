import mongoose from 'mongoose';

// 定义Notification接口
interface Notification extends mongoose.Document {
  userId: mongoose.Schema.Types.ObjectId;
  type: string;
  content: string;
  status: string;
  created_at: Date;
  read_at: Date | null;
}

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: ['sms', 'email', 'system']
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['sent', 'read', 'unread']
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  read_at: {
    type: Date,
    default: null
  }
});

// 添加索引
NotificationSchema.index({ userId: 1 });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ created_at: 1 });

const Notification = mongoose.model<Notification>('Notification', NotificationSchema);

export default Notification;
