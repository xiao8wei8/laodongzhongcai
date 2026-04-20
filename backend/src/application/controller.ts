import express from 'express';
import Case from '../models/Case';
import CaseProgress from '../models/CaseProgress';
import User from '../models/User';

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
    let applicantId;
    console.log('创建申请人前的信息:', applicantInfo);
    console.log('当前登录用户:', req.user);
    
    // 如果用户已登录，直接使用当前登录用户作为申请人
    if (req.user && req.user.id) {
      applicantId = req.user.id;
      console.log('使用当前登录用户作为申请人，ID:', applicantId);
    } 
    // 如果用户未登录，检查表单数据并创建新用户
    else if (applicantInfo && applicantInfo.phone) {
      const existingApplicant = await User.findOne({ phone: applicantInfo.phone });
      if (existingApplicant) {
        applicantId = existingApplicant._id;
      } else {
        const applicant = new User({
          username: `user_${Date.now()}`,
          password: '123456', // 默认密码
          name: applicantInfo.name || '',
          phone: applicantInfo.phone || '',
          email: applicantInfo.email,
          role: 'personal',
          idCard: applicantInfo.idCard,
          position: '申请人',
          officePhone: applicantInfo.phone || '',
          street: '默认街道',
          department: '默认部门'
        });
        console.log('创建的申请人:', applicant);
        await applicant.save();
        applicantId = applicant._id;
      }
    } else {
      console.error('申请人信息不完整');
      return res.status(400).json({ message: '申请人信息不完整' });
    }

    // 创建被申请人（如果不存在）
    let respondentId;
    console.log('创建被申请人前的信息:', respondentInfo);
    if (respondentInfo && respondentInfo.phone) {
      const existingRespondent = await User.findOne({ phone: respondentInfo.phone });
      if (existingRespondent) {
        respondentId = existingRespondent._id;
      } else {
        const respondent = new User({
          username: `user_${Date.now()}_resp`,
          password: '123456', // 默认密码
          name: respondentInfo.name || '',
          phone: respondentInfo.phone || '',
          email: respondentInfo.email,
          role: respondentInfo.type === 'company' ? 'company' : 'personal',
          idCard: respondentInfo.idCard,
          position: respondentInfo.type === 'company' ? '企业代表' : '个人',
          officePhone: respondentInfo.phone || '',
          street: '默认街道',
          department: '默认部门'
        });
        console.log('创建的被申请人:', respondent);
        await respondent.save();
        respondentId = respondent._id;
      }
    } else {
      console.error('被申请人信息不完整');
      return res.status(400).json({ message: '被申请人信息不完整' });
    }

    // 创建案件
    const newCase = new Case({
      caseNumber,
      applicantId,
      respondentId,
      disputeType,
      caseAmount,
      requestItems,
      factsReasons,
      status: 'pending'
    });

    await newCase.save();

    // 创建案件进度记录
    const progress = new CaseProgress({
      caseId: newCase._id,
      content: '案件已申请',
      type: 'register',
      creatorId: req.user?.id
    });

    await progress.save();

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
    const query: any = {};

    if (status) {
      query.status = status;
    }

    // 计算分页
    const skip = (Number(page) - 1) * Number(limit);

    // 获取记录总数
    const total = await Case.countDocuments(query);

    // 获取记录列表
    const applications = await Case.find(query)
      .populate(['applicantId', 'respondentId', 'mediatorId'])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      applications,
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

    const application = await Case.findById(applicationId)
      .populate(['applicantId', 'respondentId', 'mediatorId']);

    if (!application) {
      return res.status(404).json({ message: '申请不存在' });
    }

    // 检查权限
    const isAuthorized = 
      req.user?.role === 'admin' ||
      req.user?.role === 'mediator' ||
      application.applicantId._id.toString() === req.user?.id ||
      application.respondentId._id.toString() === req.user?.id;

    if (!isAuthorized) {
      return res.status(403).json({ message: '权限不足' });
    }

    // 获取案件进度
    const progress = await CaseProgress.find({ caseId: applicationId })
      .populate('creatorId')
      .sort({ createdAt: 1 });

    res.json({ application, progress });
  } catch (error) {
    console.error('获取申请详情错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 保存申请草稿
export const saveDraft = async (req: express.Request, res: express.Response) => {
  try {
    const {
      applicantInfo,
      respondentInfo,
      disputeType,
      caseAmount,
      requestItems,
      factsReasons
    } = req.body;

    // 这里可以将草稿保存到数据库或缓存中
    // 为了简化，这里直接返回成功
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
    const draftId = req.params.id;

    // 这里可以从数据库或缓存中获取草稿
    // 为了简化，这里返回模拟数据
    const draft = {
      applicantInfo: {
        name: '',
        phone: '',
        email: '',
        idCard: ''
      },
      respondentInfo: {
        name: '',
        phone: '',
        email: '',
        idCard: '',
        type: 'company'
      },
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
