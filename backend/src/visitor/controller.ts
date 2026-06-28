import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import visitorRecordRepository from '../repositories/visitorRecordRepository';
import pool from '../config/mysql';

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
  
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as count FROM visitor_records WHERE createdAt >= ? AND createdAt < ?`,
    [today, tomorrow]
  );
  
  const todayCount = (countResult as any)[0].count;
  
  // 生成序号（当天记录数+1，格式化为3位）
  const sequence = String(todayCount + 1).padStart(3, '0');
  
  // 使用街道代码+年月日+序号格式
  return `JD${dateStr}${sequence}`;
};

// 创建到访记录
export const createVisitorRecord = async (req: express.Request, res: express.Response) => {
  try {
    const { visitorName, phone, visitType, disputeType, reason } = req.body;
    
    // 生成登记编号
    const registerNumber = await generateRegisterNumber();
    
    // 创建到访记录
    const visitorRecord = await visitorRecordRepository.create({
      id: uuidv4(),
      registerNumber,
      visitorName,
      phone,
      visitType: visitType as any,
      disputeType,
      reason,
      mediatorId: req.user?.id,
      tenantId: req.user?.tenantId || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 获取关联数据
    const savedRecord = await visitorRecordRepository.findWithRelations(visitorRecord.id);
    
    res.status(201).json({ 
      record: savedRecord, 
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
    
    // 根据用户角色和过滤条件获取记录
    const result = await visitorRecordRepository.paginateRecords(
      Number(page), 
      Number(limit),
      undefined,
      req.user?.role === 'tenant_admin' ? (req.user?.tenantId || null) : undefined
    );
    
    let filteredRecords = result.records;
    
    // 根据姓名和电话过滤
    if (visitorName) {
      filteredRecords = filteredRecords.filter(record => 
        record.visitorName.toLowerCase().includes((visitorName as string).toLowerCase())
      );
    }
    
    if (phone) {
      filteredRecords = filteredRecords.filter(record => 
        record.phone.includes(phone as string)
      );
    }
    
    // 根据用户角色过滤
    if (req.user?.role === 'mediator') {
      filteredRecords = filteredRecords.filter(record => record.mediatorId === req.user!.id);
    } else if (req.user?.role === 'tenant_admin') {
      filteredRecords = filteredRecords.filter((record: any) => record.tenantId === req.user!.tenantId);
    }
    
    res.json({
      records: filteredRecords,
      pagination: {
        total: result.total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(result.total / Number(limit))
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
    
    const record = await visitorRecordRepository.findWithRelations(recordId);
    
    if (!record) {
      return res.status(404).json({ message: '到访记录不存在' });
    }
    
    // 检查权限
    if (req.user?.role === 'mediator' && record.mediatorId !== req.user.id) {
      return res.status(403).json({ message: '权限不足' });
    }
    if (req.user?.role === 'tenant_admin' && (record as any).tenantId !== req.user.tenantId) {
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
    
    // 获取所有记录并过滤今天的
    const allRecords = await visitorRecordRepository.findAllWithRelations(req.user?.role === 'tenant_admin' ? (req.user?.tenantId || null) : undefined);
    
    let records = allRecords.filter(record => {
      const recordDate = new Date(record.createdAt);
      return recordDate >= today && recordDate < tomorrow;
    });
    
    // 根据用户角色过滤
    if (req.user?.role === 'mediator') {
      records = records.filter(record => record.mediatorId === req.user!.id);
    } else if (req.user?.role === 'tenant_admin') {
      records = records.filter((record: any) => record.tenantId === req.user!.tenantId);
    }
    
    res.json({ records });
  } catch (error) {
    console.error('获取今日到访记录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
