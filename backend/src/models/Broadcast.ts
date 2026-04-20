import mongoose from 'mongoose';

const BroadcastSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['handover', 'special', 'notice', 'policy']
  },
  urgency: {
    type: String,
    required: true,
    enum: ['normal', 'important', 'emergency']
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected']
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalTime: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  attachments: {
    type: [String]
  },
  readBy: {
    type: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expireAt: {
    type: Date
  }
});

// 设置过期时间索引
BroadcastSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

export default Broadcast;
