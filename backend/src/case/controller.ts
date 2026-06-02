import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import caseRepository from '../repositories/caseRepository';
import caseProgressRepository from '../repositories/caseProgressRepository';
import userRepository from '../repositories/userRepository';
import visitorRecordRepository from '../repositories/visitorRecordRepository';
import scheduleRepository from '../repositories/scheduleRepository';
import messageRepository from '../repositories/messageRepository';
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
    
    // 先获取所有正式案件
    let cases = await caseRepository.findAllWithRelations();
    
    // 先获取所有到访登记记录
    let visitorRecords = await visitorRecordRepository.findAll();
    
    // 应用关键词搜索
    if (keyword) {
      const searchKeyword = keyword as string;
      console.log('搜索关键词:', searchKeyword);
      
      // 过滤正式案件
      cases = cases.filter(caseObj => {
        return (
          caseObj.caseNumber.includes(searchKeyword) ||
          (caseObj.applicantName && caseObj.applicantName.includes(searchKeyword)) ||
          (caseObj.respondentName && caseObj.respondentName.includes(searchKeyword))
        );
      });
      
      // 过滤到访登记记录
      visitorRecords = visitorRecords.filter(record => {
        return (
          record.registerNumber.includes(searchKeyword) ||
          (record.visitorName && record.visitorName.includes(searchKeyword)) ||
          (record.phone && record.phone.includes(searchKeyword))
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
      cases = cases.filter(caseObj => caseObj.mediatorId === req.user?.id);
      visitorRecords = visitorRecords.filter(record => record.mediatorId === req.user?.id);
    } else if (req.user?.role === 'personal' || req.user?.role === 'company') {
      console.log('个人/企业用户过滤逻辑执行');
      // 个人和企业用户只能看到自己的案件
      cases = cases.filter(caseObj => {
        return caseObj.applicantId === req.user?.id || caseObj.respondentId === req.user?.id;
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
      id: record.id,
      _id: record.id,
      caseNumber: record.registerNumber,
      applicantId: { name: record.visitorName },
      applicantName: record.visitorName,
      respondentId: { name: '未知' },
      respondentName: '未知',
      disputeType: record.disputeType || '未知',
      caseAmount: 0,
      status: record.status || 'pending',
      mediatorId: record.mediatorId,
      createdAt: record.createdAt
    }));
    
    // 打印到访登记记录的状态
    console.log('到访登记记录状态:', visitorRecords.map(r => ({ id: r.id, status: r.status })));
    
    // 合并两种记录，确保不重复
    const allCases = [...formattedVisitorCases, ...cases];
  
  res.json({ cases: allCases });
  } catch (error) {
    console.error('获取案件列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取案件详情
export const getCaseById = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    let isVisitorRecord = false;
    
    // 先尝试按案件编号查询正式案件
    let caseData = await caseRepository.findByCaseNumber(caseId);
    
    // 如果按编号查询不到，尝试按ID查询
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      
      // 如果按编号查询不到，尝试按ID查询
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        // 将到访登记记录转换为案件格式
        caseData = {
          id: visitorRecord.id,
          _id: visitorRecord.id,
          caseNumber: visitorRecord.registerNumber,
          applicantId: { name: visitorRecord.visitorName },
          applicantName: visitorRecord.visitorName,
          respondentId: { name: '未知' },
          respondentName: '未知',
          disputeType: visitorRecord.disputeType || '未知',
          caseAmount: 0,
          status: visitorRecord.status || 'pending',
          mediatorId: visitorRecord.mediatorId,
          createdAt: visitorRecord.createdAt
        } as any;
        isVisitorRecord = true;
      }
    }
    
    if (!caseData) {
      return res.status(404).json({ message: '案件不存在' });
    }
    
    // 如果是正式案件，获取关联数据
    let caseWithRelations: any = caseData;
    if (!isVisitorRecord) {
      const relations = await caseRepository.findWithRelations(caseData.id);
      caseWithRelations = relations || caseData;
    }
    
    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      (caseWithRelations && (
        caseWithRelations.applicantId === req.user?.id || 
        caseWithRelations.respondentId === req.user?.id
      ));
    
    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 获取案件进度
    const progress = await caseProgressRepository.findByCaseIdWithRelations(caseData.id);
    
    res.json({ case: caseWithRelations, progress });
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
    const onDutyMediators = await userRepository.findOnDutyMediators();
    const onDutyMediator = onDutyMediators.length > 0 ? onDutyMediators[0] : null;
    
    // 创建案件
    const newCase = await caseRepository.create({
      id: uuidv4(),
      caseNumber,
      applicantId,
      respondentId,
      disputeType,
      caseAmount: caseAmount || 0,
      requestItems: requestItems || '',
      factsReasons: factsReasons || '',
      status: onDutyMediator ? 'processing' : 'pending',
      mediatorId: onDutyMediator?.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 创建案件进度记录
    let progressContent = '案件已登记';
    if (onDutyMediator) {
      progressContent += `，已自动分配给值班调解员 ${onDutyMediator.name}`;
    }
    
    await caseProgressRepository.create({
      id: uuidv4(),
      caseId: newCase.id,
      content: progressContent,
      type: 'register',
      creatorId: req.user?.id,
      createdAt: new Date()
    });
    
    // 发送案件更新通知
    io.emit('caseUpdated', newCase.id);
    
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    
    // 如果按编号查询不到，尝试按ID查询
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      
      // 如果按编号查询不到，尝试按ID查询
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 更新到访登记记录的状态
        await visitorRecordRepository.update(visitorRecord.id, {
          status,
          updatedAt: new Date()
        });
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 更新状态
      await caseRepository.update(caseData.id, {
        status,
        updatedAt: new Date()
      });
      
      // 创建案件进度记录
      await caseProgressRepository.create({
        id: uuidv4(),
        caseId: caseData.id,
        content: `案件状态更新为${status}${reason ? `，原因：${reason}` : ''}`,
        type: status === 'completed' ? 'close' : 'mediate',
        creatorId: req.user?.id,
        createdAt: new Date()
      });
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
    const mediator = await userRepository.findById(mediatorId);
    
    if (!mediator || mediator.role !== 'mediator') {
      return res.status(400).json({ message: '调解员不存在' });
    }
    
    // 先尝试按案件编号查询正式案件
    let caseData = await caseRepository.findByCaseNumber(caseId);
    
    // 如果按编号查询不到，尝试按ID查询
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      
      // 如果按编号查询不到，尝试按ID查询
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 更新到访登记记录的调解员
        await visitorRecordRepository.update(visitorRecord.id, {
          mediatorId
        });
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 分配调解员
      await caseRepository.assignMediator(caseData.id, mediatorId);
      
      // 创建案件进度记录
      await caseProgressRepository.create({
        id: uuidv4(),
        caseId: caseData.id,
        content: `分配调解员：${mediator.name}`,
        type: 'accept',
        creatorId: req.user?.id,
        createdAt: new Date()
      });
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    // 创建消息通知新分配的调解员
    const messageContent = `您被分配了一个新的案件，请及时处理。`;
    const message = await messageRepository.create({
      id: uuidv4(),
      content: messageContent,
      type: 'system',
      receiverId: mediatorId,
      senderId: req.user?.id,
      caseId: caseData?.id || (isVisitorRecord ? visitorRecord.id : caseId),
      isRead: false,
      createdAt: new Date()
    });
    
    // 发送实时消息通知
    io.to(mediatorId).emit('newMessage', message);
    
    // 发送弹窗通知
    io.to(mediatorId).emit('popupNotification', {
      content: messageContent,
      messageId: message.id
    });
    
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    
    // 如果按编号查询不到，尝试按ID查询
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      // 先尝试按登记编号查询到访登记
      let visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      
      // 如果按编号查询不到，尝试按ID查询
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 对于到访登记记录，直接返回成功
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 更新案件状态
      await caseRepository.update(caseData.id, {
        status,
        closeTime: new Date(),
        updatedAt: new Date()
      });
      
      // 创建案件进度记录
      await caseProgressRepository.create({
        id: uuidv4(),
        caseId: caseData.id,
        content: `案件已${status === 'completed' ? '成功' : '失败'}结案${reason ? `，原因：${reason}` : ''}`,
        type: 'close',
        creatorId: req.user?.id,
        createdAt: new Date()
      });
    }
    
    // 发送案件更新通知
    io.emit('caseUpdated', caseId);
    
    res.json({ success: true, message: '案件已结案' });
  } catch (error) {
    console.error('结案错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 其他函数保持不变（简化处理，因为大部分功能依赖于消息和日程等，这里保持原样）
// 获取案件会议记录
export const getCaseMeetings = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    res.json({ meetings: [] });
  } catch (error) {
    console.error('获取案件会议记录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 创建案件会议
export const createCaseMeeting = async (req: express.Request, res: express.Response) => {
  try {
    const caseId = req.params.id;
    res.json({ meeting: {}, success: true });
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    let mediatorId: string | null = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        mediatorId = visitorRecord.mediatorId;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      mediatorId = caseData.mediatorId || null;
    }
    
    // 创建案件进度记录
    const progress = await caseProgressRepository.create({
      id: uuidv4(),
      caseId: caseData?.id || (isVisitorRecord ? visitorRecord.id : caseId),
      content,
      type: type || 'mediate',
      creatorId: req.user?.id,
      createdAt: new Date()
    });
    
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let visitorRecord: any = null;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 创建日程记录
    const schedule = await scheduleRepository.create({
      id: uuidv4(),
      caseId: caseData?.id || (isVisitorRecord ? visitorRecord.id : caseId),
      date: new Date(date),
      title: title || '案件相关日程',
      description: description || '',
      category: category || '其他',
      creatorId: req.user?.id,
      createdAt: new Date()
    });
    
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    let actualCaseId = caseId;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      let visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        actualCaseId = visitorRecord.id;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      actualCaseId = caseData.id;
    }
    
    // 获取日程列表
    const schedules = await scheduleRepository.findByCaseId(actualCaseId);
    
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
    
    // 查找并更新日程
    const schedule = await scheduleRepository.update(scheduleId, {
      date: new Date(date),
      title,
      description,
      category
    });
    
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
    
    // 删除日程
    await scheduleRepository.delete(scheduleId);
    
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      let visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
        // 更新到访登记记录的状态
        await visitorRecordRepository.update(visitorRecord.id, {
          status: agree ? 'processing' : 'completed',
          updatedAt: new Date()
        });
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    } else {
      // 更新案件状态
      await caseRepository.update(caseData.id, {
        status: agree ? 'processing' : 'completed',
        updatedAt: new Date()
      });
      
      // 创建案件进度记录
      await caseProgressRepository.create({
        id: uuidv4(),
        caseId: caseData.id,
        content: agree ? '双方同意继续调解' : '当事人不同意调解，进入结案流程',
        type: 'mediate',
        creatorId: req.user?.id,
        createdAt: new Date()
      });
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let visitorRecord: any = null;
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
      }
      
      if (visitorRecord) {
        isVisitorRecord = true;
      } else {
        return res.status(404).json({ message: '案件不存在' });
      }
    }
    
    // 生成卷宗内容
    const fileContent = generateFileContent(caseData, visitorRecord, isVisitorRecord);
    
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
      调解员：${visitorRecord.mediatorId || '未分配'}
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
      申请人：${caseData.applicantId || '未知'}
      被申请人：${caseData.respondentId || '未知'}
      争议类型：${caseData.disputeType || '未知'}
      涉案金额：¥${caseData.caseAmount || 0}
      调解员：${caseData.mediatorId || '未分配'}
      状态：${caseData.status || 'pending'}
      
      卷宗目录清单
      1. 案件登记信息
      2. 调解记录
      3. 证据材料
      4. 结案审批表
      
      案件登记信息
      登记时间：${new Date(caseData.createdAt).toLocaleString()}
      申请人信息：${caseData.applicantId || '未知'}
      被申请人信息：${caseData.respondentId || '未知'}
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
    let caseData = await caseRepository.findByCaseNumber(caseId);
    if (!caseData) {
      caseData = await caseRepository.findById(caseId);
    }
    
    let visitorRecord: any = null;
    let isVisitorRecord = false;
    
    // 如果不是正式案件，尝试查询到访登记记录
    if (!caseData) {
      visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
      if (!visitorRecord) {
        visitorRecord = await visitorRecordRepository.findById(caseId);
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
      applicant: caseData.applicantId || '未知',
      respondent: caseData.respondentId || '未知',
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
