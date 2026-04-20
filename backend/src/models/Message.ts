import mongoose, { Schema, Document } from 'mongoose';

interface Message extends Document {
  content: string;
  type: 'system' | 'popup' | 'sms';
  recipientId: mongoose.Schema.Types.ObjectId;
  senderId?: mongoose.Schema.Types.ObjectId;
  caseId?: mongoose.Schema.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<Message>({
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['system', 'popup', 'sms']
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  isRead: {
    type: Boolean,
    default: false
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
MessageSchema.index({ recipientId: 1, isRead: 1 });
MessageSchema.index({ recipientId: 1, createdAt: -1 });

const Message = mongoose.model<Message>('Message', MessageSchema);

export default Message;