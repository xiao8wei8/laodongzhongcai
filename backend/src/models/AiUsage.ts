import mongoose, { Schema, Document } from 'mongoose';

interface AiUsage extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  service: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  purpose: string;
  createdAt: Date;
}

const AiUsageSchema = new Schema<AiUsage>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: String,
    required: true,
    enum: ['aliqwen', 'baidu', 'aliyun', 'tencent', 'local']
  },
  modelName: {
    type: String,
    required: true
  },
  inputTokens: {
    type: Number,
    required: true
  },
  outputTokens: {
    type: Number,
    required: true
  },
  totalTokens: {
    type: Number,
    required: true
  },
  purpose: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

AiUsageSchema.index({ userId: 1 });
AiUsageSchema.index({ service: 1 });
AiUsageSchema.index({ createdAt: 1 });

const AiUsage = mongoose.model<AiUsage>('AiUsage', AiUsageSchema);

export default AiUsage;