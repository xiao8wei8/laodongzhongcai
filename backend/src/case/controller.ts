import express from 'express';
import Case from '../models/Case';
import CaseProgress from '../models/CaseProgress';
import User from '../models/User';
import VisitorRecord from '../models/VisitorRecord';
import Schedule from '../models/Schedule';
import Message from '../models/Message';
import { io } from '../server';

// 生成案件编号
const generateCaseNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `LA${year}${month}${day}${random}`;
};

// 获取案件列表
export const getCases = async (req: express.Request, res: express.Response) => {
  try {
    // 检查用户是否认证
    if (!req.user) {
      return res.status(401).json({ message: '未认证' });
    }
    
    const { status, disputeType, keyword } = req.query;
    const query: any = {};
    
    // 先获取所有正式案件
    let cases = await Case.find({})
      .populate(['applicantId', 'respondentId', 'mediatorId'])
      .sort({ createdAt: -1 });
    
    // 先获取所有到访登记记录
    let visitorRecords = await VisitorRecord.find({})
      .populate('mediatorId')
      .sort({ createdAt: -1 });
    
    // 应用关键词搜索
    if (keyword) {
      const searchKeyword = keyword as string;
      console.log('搜索关键词:', searchKeyword);
      
      // 过滤正式案件
      cases = cases.filter(caseObj => {
        return (
          caseObj.caseNumber.includes(searchKeyword) ||
          (caseObj.applicantId && typeof caseObj.applicantId === 'object' && 'name' in caseObj.applicantId && typeof (caseObj.applicantId as any).name === 'string' && (caseObj.applicantId as any).name.includes(searchKeyword)) ||
          (caseObj.respondentId && typeof caseObj.respondentId === 'object' && 'name' in caseObj.respondentId && typeof (caseObj.respondentId as any).name === 'string' && (caseObj.respondentId as any).name.includes(searchKeyword))
        );
      });
      
      // 过滤到访登记记录
      visitorRecords = visitorRecords.filter(record => {
        return (
          record.registerNumber.includes(searchKeyword) ||
          (record.visitorName && typeof record.visitorName === 'string' && record.visitorName.includes(searchKeyword)) ||
          (record.phone && typeof record.phone === 'string' && record.phone.includes(searchKeyword))
        );
      });
    }
    
    // 应用状态过滤
    if (status) {
      cases = cases.filter(caseObj => caseObj.status === status);
    }
    
    // 应用争议类型过滤
    if (disputeType) {
      cases = cases.filter(caseObj => caseObj.disputeType === disputeType);
    }
    
    // 打印用户信息，用于调试
    console.log('用户信息:', { userId: req.user?.id, role: req.user?.role });
    
    // 根据用户角色过滤
    if (req.user?.role === 'mediator') {
      console.log('调解员过滤逻辑执行');
      cases = cases.filter(caseObj => caseObj.mediatorId && caseObj.mediatorId._id.toString() === req.user?.id);
      visitorRecords = visitorRecords.filter(record => record.mediatorId && record.mediatorId._id.toString() === req.user?.id);
    } else if (req.user?.role === 'personal' || req.user?.role === 'company') {
      console.log('个人/企业用户过滤逻辑执行');
      // 个人和企业用户只能看到自己的案件
      cases = cases.filter(caseObj => {
        // 检查 applicantId 和 respondentId 是否存在
        if (!caseObj.applicantId || !caseObj.respondentId) {
          return false;
        }
        
        // 处理 applicantId
        let applicantIdStr = '';
        if (typeof caseObj.applicantId === 'object' && caseObj.applicantId !== null) {
          if (caseObj.applicantId._id) {
            // 填充后的用户对象
            applicantIdStr = caseObj.applicantId._id.toString();
          } else if (caseObj.applicantId.toString) {
            // ObjectId 对象
            applicantIdStr = caseObj.applicantId.toString();
          }
        } else if (typeof caseObj.applicantId === 'string') {
          // 字符串
          applicantIdStr = caseObj.applicantId;
        }
        
        // 处理 respondentId
        let respondentIdStr = '';
        if (typeof caseObj.respondentId === 'object' && caseObj.respondentId !== null) {
          if (caseObj.respondentId._id) {
            // 填充后的用户对象
            respondentIdStr = caseObj.respondentId._id.toString();
          } else if (caseObj.respondentId.toString) {
            // ObjectId 对象
            respondentIdStr = caseObj.respondentId.toString();
          }
        } else if (typeof caseObj.respondentId === 'string') {
          // 字符串
          respondentIdStr = caseObj.respondentId;
        }
        
        // 移除 ObjectId 包装，只保留纯字符串
        applicantIdStr = applicantIdStr.replace(/^ObjectId\(|\)$/g, '');
        respondentIdStr = respondentIdStr.replace(/^ObjectId\(|\)$/g, '');
        
        const isMatch = applicantIdStr === req.user?.id || respondentIdStr === req.user?.id;
        console.log('案件过滤:', { caseId: caseObj._id, caseNumber: caseObj.caseNumber, applicantIdStr, respondentIdStr, userId: req.user?.id, isMatch });
        return isMatch;
      });
      // 个人和企业用户不应该看到到访登记记录
      console.log('清空到访登记记录');
      visitorRecords = [];
    } else {
      console.log('其他用户角色，不执行过滤');
    }
    
    console.log('正式案件数量:', cases.length);
    console.log('到访登记记录数量:', visitorRecords.length);
    
    // 将到访登记记录转换为案件格式
    const formattedVisitorCases = visitorRecords.map(record => ({
      _id: record._id,
      caseNumber: record.registerNumber,
      applicantId: { name: record.visitorName },
      respondentId: { name: '未知' },
      disputeType: record.disputeType || '未知',
      caseAmount: 0,
      status: record.status || 'pending',
      mediatorId: record.mediatorId || { name: '未分配' },
      createdAt: record.createdAt
    }));
    
    // 打印到访登记记录的状态
    console.log('到访登记记录状态:', visitorRecords.map(r => ({ _id: r._id, status: r.status })));
    
    // 合并两种记录，确保不重复
    const allCases = [...formattedVisitorCases, ...cases];
  
  res.json({ cases: allCases });
  } catch (error) {
    console.error('获取案件列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 检查字符串是否是有效的ObjectId
const isValidObjectId = (id: string) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// 获取案件详情
export const getCaseById = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    let isVisitorRecord = false;
    
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId })
      .populate(['applicantId', 'respondentId', 'mediatorId']);
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId)
        .populate(['applicantId', 'respondentId', 'mediatorId']);
    }
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId }).populate('mediatorId');
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId).populate('mediatorId');
      }
      
      if (visitorRecord) {
        // 将到访登记记录转换为案件格式
        let mediatorInfo = { name: '未分配' };
        if (visitorRecord.mediatorId) {
          // 查询调解员信息
          const mediator = await User.findById(visitorRecord.mediatorId);
          if (mediator) {
            mediatorInfo = { name: mediator.name };
          }
        }
        
        caseData = {
          _id: visitorRecord._id,
          caseNumber: visitorRecord.registerNumber,
          applicantId: { name: visitorRecord.visitorName },
          respondentId: { name: '未知' },
          disputeType: visitorRecord.disputeType || '未知',
          caseAmount: 0,
          status: visitorRecord.status || 'pending',
          mediatorId: mediatorInfo,
          createdAt: visitorRecord.createdAt
        } as any;
        isVisitorRecord = true;
      }
    }
    
    if (!caseData) {
      return res.status(404).json({ message: '案件不存在' });
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (caseData.applicantId?._id && caseData.applicantId._id.toString() === req.user?.id) ||
      (caseData.respondentId?._id && caseData.respondentId._id.toString() === req.user?.id);
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 获取案件进度
    const progress = await CaseProgress.find({ caseId: caseData._id })
      .populate('creatorId')
      .sort({ createdAt: 1 });
    
    res.json({ case: caseData, progress });
  } catch (error) {
    console.error('获取案件详情错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 创建案件
export const createCase = async (req: express.Request, res: express.Response) => {
  try {
    const { applicantId, respondentId, disputeType, caseAmount, requestItems, factsReasons } = req.body;
    
    // 生成案件编号
    const caseNumber = generateCaseNumber();
    
    // 查询当日值班调解员
    const onDutyMediator = await User.findOne({ role: 'mediator', isOnDuty: true });
    
    // 创建案件
    const newCase = new Case({
      caseNumber,
      applicantId,
      respondentId,
      disputeType,
      caseAmount,
      requestItems,
      factsReasons,
      status: onDutyMediator ? 'processing' : 'pending',
      mediatorId: onDutyMediator?._id
    });
    
    await newCase.save();
    
    // 创建案件进度记录
    let progressContent = '案件已登记';
    if (onDutyMediator) {
      progressContent += `，已自动分配给值班调解员 ${onDutyMediator.name}`;
    }
    
    const progress = new CaseProgress({
      caseId: newCase._id,
      content: progressContent,
      type: 'register',
      creatorId: req.user?.id
    });
    
    await progress.save();
    
    // 发送案件更新通知
    io.emit('caseUpdated', newCase._id);
    
    res.status(201).json({ 
      case: newCase, 
      caseNumber,
      mediatorName: onDutyMediator?.name 
    });
  } catch (error) {
    console.error('创建案件错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 更新案件状态
export const updateCaseStatus = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { status, reason } = req.body;
    
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 更新到访登记记录的状态
        visitorRecord.status = status;
        visitorRecord.updatedAt = new Date();
        await visitorRecord.save();
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 更新状态
      caseData.status = status;
      caseData.updatedAt = new Date();
      
      await caseData.save();
      
      // 创建案件进度记录
      const progress = new CaseProgress({
        caseId: caseData._id,
        content: `案件状态更新为${status}${reason ? `，原因：${reason}` : ''}`,
        type: status === 'completed' ? 'close' : 'mediate',
        creatorId: req.user?.id
      });
      
      await progress.save();
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ success: true, message: '状态更新成功' });
  } catch (error) {
    console.error('更新案件状态错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 分配调解员
export const assignMediator = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { mediatorId } = req.body;
    
    // 验证调解员是否存在
    const mediator = await User.findById(mediatorId);
    
    if (!mediator || mediator.role !== 'mediator') {
      return res.status(400).json({ message: '调解员不存在' });
    }
    
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 更新到访登记记录的调解员
        visitorRecord.mediatorId = mediatorId;
        await visitorRecord.save();
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 分配调解员
      caseData.mediatorId = mediatorId;
      caseData.status = 'processing';
      caseData.updatedAt = new Date();
      
      await caseData.save();
      
      // 创建案件进度记录
      const progress = new CaseProgress({
        caseId: caseData._id,
        content: `分配调解员：${mediator.name}`,
        type: 'accept',
        creatorId: req.user?.id
      });
      
      await progress.save();
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    // 创建消息通知新分配的调解员
    const messageContent = `您被分配了一个新的案件，请及时处理。`;
    const message = new Message({
      content: messageContent,
      type: 'system',
      recipientId: mediatorId,
      senderId: req.user?.id,
      caseId: caseData?._id || (isVisitorRecord ? visitorRecord._id : caseId)
    });
    
    await message.save();
    console.log('消息创建成功:', message._id);
    
    // 发送实时消息通知
    io.to(mediatorId).emit('newMessage', message);
    console.log('发送新消息通知到房间:', mediatorId);
    
    // 发送弹窗通知
    io.to(mediatorId).emit('popupNotification', {
      content: messageContent,
      messageId: message._id
    });
    console.log('发送弹窗通知到房间:', mediatorId);
    
    res.json({ success: true, message: '调解员分配成功' });
  } catch (error) {
    console.error('分配调解员错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 结案
export const closeCase = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { status, reason } = req.body;
    
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 对于到访登记记录，直接返回成功
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 更新案件状态
      caseData.status = status;
      caseData.closeTime = new Date();
      caseData.updatedAt = new Date();
      
      await caseData.save();
      
      // 创建案件进度记录
      const progress = new CaseProgress({
        caseId: caseData._id,
        content: `案件已${status === 'completed' ? '成功' : '失败'}结案${reason ? `，原因：${reason}` : ''}`,
        type: 'close',
        creatorId: req.user?.id
      });
      
      await progress.save();
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ success: true, message: '案件已结案' });
  } catch (error) {
    console.error('结案错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取案件会议记录
export const getCaseMeetings = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (!isVisitorRecord && caseData && (
        caseData.applicantId._id.toString() === req.user?.id ||
        caseData.respondentId._id.toString() === req.user?.id
      ));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 模拟会议数据，实际项目中应该从数据库获取
    const meetings = [
      {
        _id: '1',
        title: '第一次调解会议',
        description: '双方初步沟通，了解争议焦点',
        scheduledAt: new Date(),
        createdAt: new Date()
      }
    ];
    
    res.json({ meetings });
  } catch (error) {
    console.error('获取案件会议记录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 创建案件会议
export const createCaseMeeting = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { title, scheduledAt, description } = req.body;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 模拟创建会议，实际项目中应该保存到数据库
    const newMeeting = {
      _id: Math.random().toString(36).substr(2, 9),
      title,
      scheduledAt,
      description,
      caseId,
      createdAt: new Date()
    };
    
    // 创建案件进度记录（仅对正式案件）
    if (!isVisitorRecord) {
      const progress = new CaseProgress({
        caseId: caseData?._id || caseId,
        content: `预约调解会议：${title}`,
        type: 'mediate',
        creatorId: req.user?.id
      });
      
      await progress.save();
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ meeting: newMeeting, success: true });
  } catch (error) {
    console.error('创建案件会议错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 添加案件进度记录
export const addCaseProgress = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { content, type, notificationType } = req.body;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    let mediatorId: string | null = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        mediatorId = visitorRecord.mediatorId?.toString() || null;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      mediatorId = caseData.mediatorId?.toString() || null;
    }
    
    // 创建案件进度记录
    const progress = new CaseProgress({
      caseId: caseData?._id || (isVisitorRecord ? visitorRecord._id : caseId),
      content,
      type: type || 'mediate',
      creatorId: req.user?.id
    });
    
    await progress.save();
    
    // 处理通知类型，创建消息
    console.log('处理通知类型:', {
      mediatorId,
      notificationType,
      isArray: Array.isArray(notificationType),
      caseId: caseData?._id || (isVisitorRecord ? visitorRecord._id : caseId),
      currentUserId: req.user?.id
    });
    
    // 如果没有调解员，使用当前用户作为接收者
    const recipientId = mediatorId || req.user?.id;
    
    if (recipientId && notificationType && Array.isArray(notificationType)) {
      console.log('创建消息，通知类型:', notificationType, '接收者:', recipientId);
      // 为每种通知类型创建消息
      for (const notification of notificationType) {
        const message = new Message({
          content,
          type: notification,
          recipientId,
          senderId: req.user?.id,
          caseId: caseData?._id || (isVisitorRecord ? visitorRecord._id : caseId)
        });
        
        await message.save();
        console.log('消息创建成功:', message._id);
        
        // 发送实时消息通知
        io.to(recipientId).emit('newMessage', message);
        console.log('发送新消息通知到房间:', recipientId);
        
        // 如果是弹窗类型，发送弹窗通知
        if (notification === 'popup') {
          io.to(recipientId).emit('popupNotification', {
            content,
            messageId: message._id
          });
          console.log('发送弹窗通知到房间:', recipientId);
        }
      }
    } else {
      console.log('跳过消息创建，条件不满足:', {
        recipientId: !!recipientId,
        notificationType: !!notificationType,
        isArray: Array.isArray(notificationType)
      });
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ progress, success: true });
  } catch (error) {
    console.error('添加案件进度记录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 添加案件日程
export const addCaseSchedule = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { date, title, description, category } = req.body;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (!isVisitorRecord && caseData && (
        caseData.applicantId._id.toString() === req.user?.id ||
        caseData.respondentId._id.toString() === req.user?.id
      ));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 创建日程记录
    const schedule = new Schedule({
      caseId: caseData?._id || (isVisitorRecord ? visitorRecord._id : caseId),
      date,
      title: title || '案件相关日程',
      description: description || '',
      category: category || '其他',
      createdBy: req.user?.id
    });
    
    await schedule.save();
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ schedule, success: true, message: '日程添加成功' });
  } catch (error) {
    console.error('添加案件日程错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取案件日程列表
export const getCaseSchedules = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let actualCaseId = caseId;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        actualCaseId = visitorRecord._id.toString();
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      actualCaseId = caseData._id.toString();
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (!isVisitorRecord && caseData && (
        caseData.applicantId._id.toString() === req.user?.id ||
        caseData.respondentId._id.toString() === req.user?.id
      ));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 获取日程列表
    const schedules = await Schedule.find({ caseId: actualCaseId })
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    
    res.json({ schedules });
  } catch (error) {
    console.error('获取案件日程列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 更新案件日程
export const updateCaseSchedule = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const scheduleId = req.params.scheduleId;
    const { date, title, description, category } = req.body;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let actualCaseId = caseId;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        actualCaseId = visitorRecord._id.toString();
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      actualCaseId = caseData._id.toString();
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (!isVisitorRecord && caseData && (
        caseData.applicantId._id.toString() === req.user?.id ||
        caseData.respondentId._id.toString() === req.user?.id
      ));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 查找并更新日程
    const schedule = await Schedule.findOneAndUpdate(
      { _id: scheduleId, caseId: actualCaseId },
      { date, title, description, category },
      { new: true }
    );
    
    if (!schedule) {
      return res.status(404).json({ message: '日程不存在' });
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ schedule, success: true, message: '日程更新成功' });
  } catch (error) {
    console.error('更新案件日程错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 删除案件日程
export const deleteCaseSchedule = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const scheduleId = req.params.scheduleId;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let actualCaseId = caseId;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        actualCaseId = visitorRecord._id.toString();
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      actualCaseId = caseData._id.toString();
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (!isVisitorRecord && caseData && (
        caseData.applicantId._id.toString() === req.user?.id ||
        caseData.respondentId._id.toString() === req.user?.id
      ));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 删除日程
    const result = await Schedule.deleteOne({ _id: scheduleId, caseId: actualCaseId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: '日程不存在' });
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ success: true, message: '日程删除成功' });
  } catch (error) {
    console.error('删除案件日程错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 处理调解协议
export const handleMediationAgreement = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    const { agree } = req.body;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 更新到访登记记录的状态
        if (agree) {
          // 同意继续调解
          visitorRecord.status = 'processing';
        } else {
          // 不同意调解，进入结案流程
          visitorRecord.status = 'completed';
        }
        visitorRecord.updatedAt = new Date();
        await visitorRecord.save();
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 更新案件状态
      if (agree) {
        // 同意继续调解
        caseData.status = 'processing';
      } else {
        // 不同意调解，进入结案流程
        caseData.status = 'completed';
      }
      caseData.updatedAt = new Date();
      
      await caseData.save();
      
      // 创建案件进度记录
      const progress = new CaseProgress({
        caseId: caseData._id,
        content: agree ? '双方同意继续调解' : '当事人不同意调解，进入结案流程',
        type: 'mediate',
        creatorId: req.user?.id
      });
      
      await progress.save();
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ success: true, message: agree ? '已确认继续调解' : '已确认不同意调解，将进入结案流程' });
  } catch (error) {
    console.error('处理调解协议错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 导出卷宗
export const exportFile = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let visitorRecord: any = null;
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 生成卷宗内容
    const fileContent = generateFileContent(caseData, visitorRecord, isVisitorRecord);
    
    // 模拟生成PDF文件
    // 实际应用中，这里会使用PDF生成库生成真实的PDF文件
    
    // 设置响应头，让浏览器下载文件
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${caseData?.caseNumber || visitorRecord?.registerNumber || 'case'}.txt"`);
    
    // 发送文件内容
    res.send(fileContent);
  } catch (error) {
    console.error('导出卷宗错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 生成卷宗内容
const generateFileContent = (caseData: any, visitorRecord: any, isVisitorRecord: boolean) => {
  if (isVisitorRecord && visitorRecord) {
    return `
      卷宗目录封面
      案件编号：${visitorRecord.registerNumber}
      登记日期：${new Date(visitorRecord.createdAt).toLocaleString()}
      当事人：${visitorRecord.visitorName}
      联系电话：${visitorRecord.phone}
      争议类型：${visitorRecord.disputeType || '未知'}
      登记原因：${visitorRecord.reason}
      调解员：${visitorRecord.mediatorId?.name || '未分配'}
      状态：${visitorRecord.status || 'pending'}
      
      卷宗目录清单
      1. 案件登记信息
      2. 调解记录
      3. 证据材料
      4. 结案审批表
      
      案件登记信息
      登记时间：${new Date(visitorRecord.createdAt).toLocaleString()}
      登记方式：${visitorRecord.visitType === 'visit' ? '到访' : '电话'}
      当事人信息：${visitorRecord.visitorName} ${visitorRecord.phone}
      争议类型：${visitorRecord.disputeType || '未知'}
      登记原因：${visitorRecord.reason}
      
      调解记录
      暂无调解记录
      
      证据材料
      暂无证据材料
      
      结案审批表
      案件状态：${visitorRecord.status || 'pending'}
      结案时间：${visitorRecord.updatedAt ? new Date(visitorRecord.updatedAt).toLocaleString() : '未结案'}
    `;
  } else if (caseData) {
    return `
      卷宗目录封面
      案件编号：${caseData.caseNumber}
      登记日期：${new Date(caseData.createdAt).toLocaleString()}
      申请人：${caseData.applicantId?.name || '未知'}
      被申请人：${caseData.respondentId?.name || '未知'}
      争议类型：${caseData.disputeType || '未知'}
      涉案金额：¥${caseData.caseAmount || 0}
      调解员：${caseData.mediatorId?.name || '未分配'}
      状态：${caseData.status || 'pending'}
      
      卷宗目录清单
      1. 案件登记信息
      2. 调解记录
      3. 证据材料
      4. 结案审批表
      
      案件登记信息
      登记时间：${new Date(caseData.createdAt).toLocaleString()}
      申请人信息：${caseData.applicantId?.name || '未知'} ${caseData.applicantId?.phone || '未知'}
      被申请人信息：${caseData.respondentId?.name || '未知'} ${caseData.respondentId?.phone || '未知'}
      争议类型：${caseData.disputeType || '未知'}
      涉案金额：¥${caseData.caseAmount || 0}
      调解请求：${caseData.requestItems || '无'}
      事实与理由：${caseData.factsReasons || '无'}
      
      调解记录
      暂无调解记录
      
      证据材料
      暂无证据材料
      
      结案审批表
      案件状态：${caseData.status || 'pending'}
      结案时间：${caseData.closeTime ? new Date(caseData.closeTime).toLocaleString() : '未结案'}
    `;
  }
  return '卷宗内容';
};

// AI分析报告
export const getAIAnalysis = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    
    // 验证案件是否存在
    // 先尝试按案件编号查询正式案件
    let caseData = await Case.findOne({ caseNumber: caseId });
    
    // 如果按编号查询不到，且caseId是有效的ObjectId，尝试按ObjectId查询
    if (!caseData && isValidObjectId(caseId)) {
      caseData = await Case.findById(caseId);
    }
    
    let visitorRecord: any = null;
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await VisitorRecord.findOne({ registerNumber: caseId });
      
      // 如果按编号查询不到，尝试按ObjectId查询
      if (!visitorRecord) {
        visitorRecord = await VisitorRecord.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 生成AI分析报告
    const analysisReport = generateAIAnalysisReport(caseData, visitorRecord, isVisitorRecord);
    
    res.json({ success: true, data: analysisReport });
  } catch (error) {
    console.error('生成AI分析报告错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 生成AI分析报告
const generateAIAnalysisReport = (caseData: any, visitorRecord: any, isVisitorRecord: boolean) => {
  let caseInfo = {};
  let disputeType = '';
  
  if (isVisitorRecord && visitorRecord) {
    caseInfo = {
      caseNumber: visitorRecord.registerNumber,
      disputeType: visitorRecord.disputeType || '未知',
      applicant: visitorRecord.visitorName,
      respondent: '未知',
      caseAmount: 0,
      status: visitorRecord.status || 'pending'
    };
    disputeType = visitorRecord.disputeType || '未知';
  } else if (caseData) {
    caseInfo = {
      caseNumber: caseData.caseNumber,
      disputeType: caseData.disputeType || '未知',
      applicant: caseData.applicantId?.name || '未知',
      respondent: caseData.respondentId?.name || '未知',
      caseAmount: caseData.caseAmount || 0,
      status: caseData.status || 'pending'
    };
    disputeType = caseData.disputeType || '未知';
  }
  
  // 生成争议焦点分析
  let disputeFocus = '';
  let potentialRisks = '';
  
  switch (disputeType) {
    case '劳动报酬':
      disputeFocus = '根据案件信息，双方主要争议在于劳动报酬的支付问题。';
      potentialRisks = '如果调解不成功，可能会导致当事人提起劳动仲裁或诉讼，增加解决成本。';
      break;
    case '工伤赔偿':
      disputeFocus = '根据案件信息，双方主要争议在于工伤赔偿的金额和范围。';
      potentialRisks = '如果调解不成功，可能会导致当事人提起工伤认定和劳动仲裁，增加解决成本和时间。';
      break;
    case '解除劳动合同':
      disputeFocus = '根据案件信息，双方主要争议在于解除劳动合同的合法性和经济补偿。';
      potentialRisks = '如果调解不成功，可能会导致当事人提起劳动仲裁或诉讼，要求恢复劳动关系或支付赔偿金。';
      break;
    default:
      disputeFocus = '根据案件信息，双方存在一定的争议需要调解解决。';
      potentialRisks = '如果调解不成功，可能会导致当事人通过其他途径解决争议，增加解决成本。';
  }
  
  // 生成调解策略建议
  const mediationStrategies = [
    '1. 沟通协商：建议先与双方进行单独沟通，了解各自的诉求和底线。',
    '2. 证据收集：建议收集相关的证据材料，以便更好地了解案件事实。',
    '3. 法律依据：根据相关法律法规的规定，为双方提供法律参考。',
    '4. 解决方案：建议双方达成和解协议，明确各方的权利和义务。'
  ];
  
  // 生成类案推荐
  const similarCases = [
    {
      title: '某科技公司与员工劳动报酬争议案',
      result: '双方达成和解，公司一次性支付拖欠的工资及经济补偿金。',
      keyFactors: '公司承认拖欠工资的事实，员工提供了充分的证据。'
    },
    {
      title: '某制造企业与员工劳动报酬争议案',
      result: '双方达成分期支付协议，企业在3个月内支付全部拖欠工资。',
      keyFactors: '企业因经营困难暂时无法一次性支付，员工同意分期支付方案。'
    }
  ];
  
  // 生成后续建议
  const followUpSuggestions = [
    '1. 定期跟进：建议定期跟进案件进展，及时了解双方的态度变化。',
    '2. 文档记录：建议详细记录调解过程中的沟通内容和达成的共识，为后续可能的仲裁或诉讼做好准备。',
    '3. 法律支持：如调解过程中遇到法律问题，建议咨询专业律师的意见。'
  ];
  
  return {
    caseInfo,
    disputeFocus,
    potentialRisks,
    mediationStrategies,
    similarCases,
    followUpSuggestions
  };
};
