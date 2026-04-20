import mongoose from 'mongoose';

const ScheduleSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  title: {
    type: String
  },
  description: {
    type: String
  },
  category: {
    type: String,
    enum: ['调解会议', '证据提交', '案件讨论', '其他'],
    default: '其他'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 添加索引，优化查询性能
ScheduleSchema.index({ caseId: 1 });
ScheduleSchema.index({ date: 1 });
ScheduleSchema.index({ category: 1 });
ScheduleSchema.index({ createdAt: -1 });

const Schedule = mongoose.model('Schedule', ScheduleSchema);

export default Schedule;