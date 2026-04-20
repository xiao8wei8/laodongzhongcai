import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    required: true,
    unique: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  respondentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  disputeType: {
    type: String,
    required: true
  },
  caseAmount: {
    type: Number
  },
  requestItems: {
    type: String,
    required: true
  },
  factsReasons: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed']
  },
  mediatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  closeTime: {
    type: Date
  }
});

// 添加索引，优化查询性能
CaseSchema.index({ applicantId: 1 });
CaseSchema.index({ respondentId: 1 });
CaseSchema.index({ status: 1 });
CaseSchema.index({ createdAt: -1 });
CaseSchema.index({ mediatorId: 1 });

const Case = mongoose.model('Case', CaseSchema);

export default Case;
