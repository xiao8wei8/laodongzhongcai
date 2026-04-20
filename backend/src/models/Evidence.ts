import mongoose from 'mongoose';

// 定义Evidence接口
interface Evidence extends mongoose.Document {
  caseId: mongoose.Schema.Types.ObjectId;
  name: string;
  type: string;
  path: string;
  size: number;
  uploaderId: mongoose.Schema.Types.ObjectId;
  uploadTime: Date;
  recognizedContent?: string;
  recognizedKeyInfo?: any;
  recognitionStatus?: string;
  recognitionTime?: Date;
}

const EvidenceSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Case'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['pdf', 'image', 'word', 'other']
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploaderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  uploadTime: {
    type: Date,
    default: Date.now
  },
  recognizedContent: {
    type: String,
    trim: true
  },
  recognizedKeyInfo: {
    type: mongoose.Schema.Types.Mixed
  },
  recognitionStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  recognitionTime: {
    type: Date
  }
});

// 添加索引
EvidenceSchema.index({ caseId: 1 });
EvidenceSchema.index({ uploaderId: 1 });

const Evidence = mongoose.model<Evidence>('Evidence', EvidenceSchema);

export default Evidence;
