import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import caseRepository from '../repositories/caseRepository';
import userRepository from '../repositories/userRepository';
import caseProgressRepository from '../repositories/caseProgressRepository';

// 生成案件编号
const generateCaseNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `LA${year}${month}${day}${random}`;
};

// 提交调解申请
export const createApplication = async (req: express.Request, res: express.Response) => {
  try {
    console.log('接收到的请求数据:', req.body);
    
    const {
      applicantInfo,
      respondentInfo,
      disputeType,
      caseAmount,
      requestItems,
      factsReasons
    } = req.body;

    console.log('解析后的申请人信息:', applicantInfo);
    console.log('解析后的被申请人信息:', respondentInfo);

    // 生成案件编号
    const caseNumber = generateCaseNumber();

    // 创建申请人（如果不存在）
    let applicantId = '';
    console.log('创建申请人前的信息:', applicantInfo);
    console.log('当前登录用户:', req.user);
    
    // 如果用户已登录，直接使用当前登录用户作为申请人
    if (req.user && req.user.id) {
      applicantId = req.user.id;
      console.log('使用当前登录用户作为申请人，ID:', applicantId);
    } 
    // 如果用户未登录，检查表单数据并创建新用户
    else if (applicantInfo && applicantInfo.phone) {
      const existingApplicant = await userRepository.findByPhone(applicantInfo.phone);
      if (existingApplicant) {
        applicantId = existingApplicant.id;
      } else {
        const applicant = await userRepository.create({
          id: uuidv4(),
          username: `user_${Date.now()}`,
          password: await bcrypt.hash('123456', 10),
          name: applicantInfo.name || '',
          phone: applicantInfo.phone || '',
          email: applicantInfo.email,
          role: 'personal',
          idCard: applicantInfo.idCard,
          position: '申请人',
        } as any);
        console.log('创建的申请人:', applicant);
        applicantId = applicant.id;
      }
    } else {
      console.error('申请人信息不完整');
      return res.status(400).json({ message: '申请人信息不完整' });
    }

    // 创建被申请人（如果不存在）
    let respondentId = '';
    console.log('创建被申请人前的信息:', respondentInfo);
    if (respondentInfo && respondentInfo.phone) {
      const existingRespondent = await userRepository.findByPhone(respondentInfo.phone);
      if (existingRespondent) {
        respondentId = existingRespondent.id;
      } else {
        const respondent = await userRepository.create({
          id: uuidv4(),
          username: `user_${Date.now()}_resp`,
          password: await bcrypt.hash('123456', 10),
          name: respondentInfo.name || '',
          phone: respondentInfo.phone || '',
          email: respondentInfo.email,
          role: respondentInfo.type === 'company' ? 'company' : 'personal',
          idCard: respondentInfo.idCard,
          position: respondentInfo.type === 'company' ? '企业代表' : '个人',
        } as any);
        console.log('创建的被申请人:', respondent);
        respondentId = respondent.id;
      }
    } else {
      console.error('被申请人信息不完整');
      return res.status(400).json({ message: '被申请人信息不完整' });
    }

    // 创建案件
    const newCase = await caseRepository.create({
      id: uuidv4(),
      caseNumber,
      applicantId,
      respondentId,
      disputeType,
      caseAmount: caseAmount ? parseFloat(caseAmount) : undefined,
      requestItems,
      factsReasons,
      status: 'pending' as any,
    });

    // 创建案件进度记录
    await caseProgressRepository.create({
      id: uuidv4(),
      caseId: newCase.id,
      content: '案件已申请',
      type: 'register',
      creatorId: req.user?.id || applicantId,
    } as any);

    res.status(201).json({ case: newCase, caseNumber });
  } catch (error) {
    console.error('提交调解申请错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取申请列表
export const getApplications = async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { total, cases } = await caseRepository.paginateCases(
      Number(page), Number(limit), status as string | undefined
    );

    res.json({
      applications: cases,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取申请列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取申请详情
export const getApplicationById = async (req: express.Request, res: express.Response) => {
  try {
    const applicationId = req.params.id;

    const application = await caseRepository.findById(applicationId);

    if (!application) {
      return res.status(404).json({ message: '申请不存在' });
    }

    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      application.applicantId === req.user?.id ||
      application.respondentId === req.user?.id;

    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }

    // 获取案件进度
    const progress = await caseProgressRepository.findByCaseId(applicationId);

    res.json({ application, progress });
  } catch (error) {
    console.error('获取申请详情错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 保存申请草稿
export const saveDraft = async (req: express.Request, res: express.Response) => {
  try {
    const draftId = `draft_${Date.now()}`;
    res.json({ draftId, success: true });
  } catch (error) {
    console.error('保存草稿错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取申请草稿
export const getDraft = async (req: express.Request, res: express.Response) => {
  try {
    const draft = {
      applicantInfo: { name: '', phone: '', email: '', idCard: '' },
      respondentInfo: { name: '', phone: '', email: '', idCard: '', type: 'company' },
      disputeType: '',
      caseAmount: 0,
      requestItems: '',
      factsReasons: ''
    };
    res.json({ draft });
  } catch (error) {
    console.error('获取草稿错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
