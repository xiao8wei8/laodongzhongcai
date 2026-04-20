import express from 'express';
import VisitorRecord from '../models/VisitorRecord';
import smsService from '../services/smsService';
import jwt from 'jsonwebtoken';
import config from '../config';

// 生成登记编号
const generateRegisterNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  // 查询当天的记录数
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayCount = await VisitorRecord.countDocuments({
    createdAt: {
      $gte: today,
      $lt: tomorrow
    }
  });
  
  // 生成序号（当天记录数+1，格式化为3位）
  const sequence = String(todayCount + 1).padStart(3, '0');
  
  // 使用街道代码+年月日+序号格式
  return `JD${dateStr}${sequence}`;
};

// 创建到访记录
export const createVisitorRecord = async (req: express.Request, res: express.Response) => {
  try {
    const { visitorName, phone, visitType, disputeType, reason, sendSmsVerification, sendEmailVerification, email } = req.body;
    
    // 验证互斥字段
    const isSmsVerification = sendSmsVerification === true || sendSmsVerification === 'true';
    const isEmailVerification = sendEmailVerification === true || sendEmailVerification === 'true';
    
    if (isSmsVerification && isEmailVerification) {
      return res.status(400).json({ message: '短信验证和邮箱验证只能选择一个' });
    }
    
    // 生成登记编号
    const registerNumber = await generateRegisterNumber();
    
    // 创建到访记录
    const visitorRecord = new VisitorRecord({
      registerNumber,
      visitorName,
      phone,
      visitType,
      disputeType,
      reason,
      sendSmsVerification: isSmsVerification,
      sendEmailVerification: isEmailVerification,
      email,
      mediatorId: req.user?.id
    });
    
    await visitorRecord.save();
    
    // 强制重新获取记录，确保包含所有字段
    const savedRecord = await VisitorRecord.findById(visitorRecord._id).populate('mediatorId', 'name');
    
    // 转换为普通对象，确保所有字段都被包含
    const recordObject = savedRecord?.toObject();
    
    res.status(201).json({ 
      record: recordObject, 
      registerNumber 
    });
  } catch (error) {
    console.error('创建到访记录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取到访记录列表
export const getVisitorRecords = async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, visitorName, phone } = req.query;
    const query: any = {};
    
    // 根据用户角色过滤
    if (req.user?.role === 'mediator') {
      query.mediatorId = req.user.id;
    }
    
    // 根据姓名和电话过滤
    if (visitorName) {
      query.visitorName = { $regex: visitorName, $options: 'i' };
    }
    
    if (phone) {
      query.phone = { $regex: phone, $options: 'i' };
    }
    
    // 计算分页
    const skip = (Number(page) - 1) * Number(limit);
    
    // 获取记录总数
    const total = await VisitorRecord.countDocuments(query);
    
    // 获取记录列表
    const records = await VisitorRecord.find(query)
      .populate('mediatorId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    res.json({
      records,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取到访记录列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取到访记录详情
export const getVisitorRecordById = async (req: express.Request, res: express.Response) => {
  try {
    const recordId = req.params.id;
    
    const record = await VisitorRecord.findById(recordId).populate('mediatorId', 'name');
    
    if (!record) {
      return res.status(404).json({ message: '到访记录不存在' });
    }
    
    // 检查权限
    if (req.user?.role === 'mediator' && record.mediatorId?._id.toString() !== req.user.id) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    res.json({ record });
  } catch (error) {
    console.error('获取到访记录详情错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取今日到访记录
export const getTodayVisitorRecords = async (req: express.Request, res: express.Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const query: any = {
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    };
    
    // 根据用户角色过滤
    if (req.user?.role === 'mediator') {
      query.mediatorId = req.user.id;
    }
    
    const records = await VisitorRecord.find(query)
      .populate('mediatorId', 'name')
      .sort({ createdAt: -1 });
    
    res.json({ records });
  } catch (error) {
    console.error('获取今日到访记录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 发送短信链接
export const sendSmsLink = async (req: express.Request, res: express.Response) => {
  try {
    const { recordId } = req.body;
    
    if (!recordId) {
      return res.status(400).json({ message: '缺少记录ID' });
    }
    
    // 查找到访记录
    const record = await VisitorRecord.findById(recordId);
    if (!record) {
      return res.status(404).json({ message: '到访记录不存在' });
    }
    
    // 生成加密token
    const token = jwt.sign(
      {
        recordId: record._id,
        phone: record.phone,
        visitorName: record.visitorName,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' }
    );
    
    // 创建注册链接
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registerLink = `${frontendUrl}/register?token=${token}`;
    
    // 发送短信
    let success = false;
    
    // 开发环境下模拟短信发送，直接返回链接
    if (process.env.NODE_ENV === 'development') {
      console.log('开发环境模拟短信发送:');
      console.log('收件人:', record.phone);
      console.log('访客姓名:', record.visitorName);
      console.log('生成的注册链接:', registerLink);
      success = true;
      res.json({ 
        success: true, 
        message: '短信链接发送成功',
        registerLink: registerLink // 返回生成的链接
      });
    } else {
      // 生产环境调用真实短信服务
      success = await smsService.sendNotification(
        record.phone,
        config.sms.templateIds.notification,
        [record.visitorName, registerLink]
      );
      
      if (!success) {
        return res.status(500).json({ message: '发送短信失败' });
      }
      
      res.json({ success: true, message: '短信链接发送成功' });
    }
  } catch (error) {
    console.error('发送短信链接错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
