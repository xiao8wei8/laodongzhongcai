import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// 定义User接口
interface User extends mongoose.Document {
  username: string;
  password: string;
  name: string;
  position: string;
  officePhone: string;
  phone?: string;
  email?: string;
  address?: string;
  street: string;
  department: string;
  role: 'mediator' | 'admin' | 'personal' | 'company';
  identity?: 'applicant' | 'respondent';
  caseAmount?: number;
  idCard?: string;
  isOnDuty?: boolean; // 标记当日值班调解员
  lastOnDutyDate?: Date; // 记录上次值班日期
  createdAt: Date;
  updatedAt: Date;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true
  },
  officePhone: {
    type: String,
    required: true
  },
  phone: {
    type: String
  },
  street: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true
  },
  address: {
    type: String
  },
  role: {
    type: String,
    required: true,
    enum: ['mediator', 'admin', 'personal', 'company']
  },
  identity: {
    type: String,
    enum: ['applicant', 'respondent']
  },
  caseAmount: {
    type: Number
  },
  idCard: {
    type: String
  },
  isOnDuty: {
    type: Boolean,
    default: false
  },
  lastOnDutyDate: {
    type: Date
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

// 添加复合索引，优化登录查询性能
UserSchema.index({ username: 1, role: 1 });
// 添加索引，优化值班调解员查询性能
UserSchema.index({ role: 1, isOnDuty: 1 });

// 处理空email的中间件
UserSchema.pre('save', function (next) {
  // 确保email字段始终有值，避免唯一索引冲突
  if (!this.email || this.email.trim() === '') {
    // 生成唯一邮箱
    this.email = `${this.username}_${Date.now()}@example.com`;
  }
  next();
});

// 密码加密中间件
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 密码验证方法
UserSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<User>('User', UserSchema);

export default User;
