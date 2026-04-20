import mongoose from 'mongoose';

const VisitorRecordSchema = new mongoose.Schema({
  registerNumber: {
    type: String,
    required: true,
    unique: true
  },
  visitorName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  visitType: {
    type: String,
    required: true,
    enum: ['visit', 'phone']
  },
  disputeType: {
    type: String
  },
  reason: {
    type: String,
    required: true
  },
  mediatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sendSmsVerification: {
    type: Boolean,
    default: false
  },
  sendEmailVerification: {
    type: Boolean,
    default: false
  },
  email: {
    type: String
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed']
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 添加索引，优化查询性能
VisitorRecordSchema.index({ createdAt: -1 });
VisitorRecordSchema.index({ mediatorId: 1 });
VisitorRecordSchema.index({ phone: 1 });
VisitorRecordSchema.index({ visitorName: 1 });

const VisitorRecord = mongoose.model('VisitorRecord', VisitorRecordSchema);

export default VisitorRecord;
