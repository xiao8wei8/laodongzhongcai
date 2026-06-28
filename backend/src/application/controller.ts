import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import pool from '../config/mysql';
import caseRepository from '../repositories/caseRepository';
import userRepository from '../repositories/userRepository';
import caseProgressRepository from '../repositories/caseProgressRepository';
import messageRepository from '../repositories/messageRepository';
import { resolveDutyMediator } from '../utils/dutyMediator';
import { io } from '../server';

// 生成案件编号（基础格式）
const generateCaseNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
  const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `LA${year}${month}${day}${time}${random}`;
};

// 生成唯一案件编号（避免唯一索引冲突）
const generateUniqueCaseNumber = async () => {
  for (let i = 0; i < 10; i++) {
    const caseNumber = generateCaseNumber();
    const existing = await caseRepository.findByCaseNumber(caseNumber);
    if (!existing) {
      return caseNumber;
    }
  }

  // 极端情况下兜底，确保仍有更高熵
  return `LA${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

const normalizeText = (value: any) => String(value || '').trim();
const isValidMainlandPhone = (value: string) => /^1[3-9]\d{9}$/.test(value);

const buildConsultationNumber = () => `CONSULT${Date.now()}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;

const notifyAssignedMediator = async ({
  senderId,
  receiverId,
  caseId,
  content
}: {
  senderId?: string;
  receiverId?: string;
  caseId?: string;
  content: string;
}) => {
  if (!senderId || !receiverId || !caseId || !content) return;

  const created = await messageRepository.create({
    id: uuidv4(),
    senderId,
    receiverId,
    content,
    type: 'case_message',
    caseId,
    isRead: false,
    createdAt: new Date()
  } as any);

  try {
    const result = await messageRepository.findByReceiverPaginated(receiverId, 1, 20);
    const fullMessage = result.messages.find((item) => item.id === created.id) || created;
    io.to(receiverId.toString()).emit('newMessage', fullMessage);
  } catch (_error) {
    io.to(receiverId.toString()).emit('newMessage', created);
  }
};

const getConsultationReceiver = async (tenantId: string, dutyAssignee?: any) => {
  if (dutyAssignee?.id) {
    return dutyAssignee;
  }

  const [tenantAdminRows] = await pool.query(
    `SELECT id, name, phone, officePhone, role
     FROM users
     WHERE tenantId = ? AND role = 'tenant_admin'
     ORDER BY createdAt ASC
     LIMIT 1`,
    [tenantId]
  );
  const tenantAdmin = (tenantAdminRows as any[])[0];
  if (tenantAdmin) {
    return {
      ...tenantAdmin,
      source: 'tenant_admin_default'
    };
  }

  const [superAdminRows] = await pool.query(
    `SELECT id, name, phone, officePhone, role
     FROM users
     WHERE role = 'superadmin' OR isSuperAdmin = 1
     ORDER BY createdAt ASC
     LIMIT 1`
  );
  const superAdmin = (superAdminRows as any[])[0];
  if (superAdmin) {
    return {
      ...superAdmin,
      source: 'superadmin_default'
    };
  }

  return null;
};

export const getCurrentDutyMediator = async (req: express.Request, res: express.Response) => {
  try {
    const tenantId = String(req.query.tenantId || '').trim();
    if (!tenantId) {
      return res.status(400).json({ message: '请选择街道' });
    }

    const assignee = await resolveDutyMediator(tenantId);
    res.json({
      mediator: assignee
        ? {
            id: assignee.id,
            name: assignee.name,
            role: assignee.role,
            phone: assignee.phone || assignee.officePhone || '',
            source: assignee.source
          }
        : null
    });
  } catch (error) {
    console.error('获取当前值班调解员失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 提交调解申请
export const createApplication = async (req: express.Request, res: express.Response) => {
  try {
    console.log('接收到的请求数据:', req.body);
    
    const {
      applicantInfo,
      respondentInfo,
      tenantId,
      disputeType,
      caseAmount,
      requestItems,
      factsReasons
    } = req.body;

    console.log('解析后的申请人信息:', applicantInfo);
    console.log('解析后的被申请人信息:', respondentInfo);

    const applicantName = normalizeText(applicantInfo?.name);
    const applicantPhone = normalizeText(applicantInfo?.phone);
    const applicantIdCard = normalizeText(applicantInfo?.idCard);
    const respondentName = normalizeText(respondentInfo?.name);
    const respondentPhone = normalizeText(respondentInfo?.phone);
    const respondentIdCard = normalizeText(respondentInfo?.idCard);

    if (!applicantName || !isValidMainlandPhone(applicantPhone)) {
      return res.status(400).json({ message: '申请人姓名或手机号不正确' });
    }
    if (!respondentName || !isValidMainlandPhone(respondentPhone)) {
      return res.status(400).json({ message: '被申请人姓名或手机号不正确' });
    }
    if (!tenantId) {
      return res.status(400).json({ message: '请选择受理街道' });
    }

    const [tenantRows] = await pool.query(
      `SELECT id, tenantName
       FROM tenants
       WHERE id = ? AND status = 'active'
       LIMIT 1`,
      [tenantId]
    );
    const tenant = (tenantRows as any[])[0];
    if (!tenant) {
      return res.status(400).json({ message: '所选受理街道不存在或已停用' });
    }

    // 生成案件编号
    const caseNumber = await generateUniqueCaseNumber();

    // 创建申请人（如果不存在）
    let applicantId = '';
    console.log('创建申请人前的信息:', applicantInfo);
    console.log('当前登录用户:', req.user);
    
    // 如果用户已登录，直接使用当前登录用户作为申请人
    if (req.user && req.user.id) {
      applicantId = req.user.id;
      console.log('使用当前登录用户作为申请人，ID:', applicantId);

      // 生产级对齐：已登录用户提交申请时，同步表单中的申请人关键信息到当前用户
      const currentApplicant = await userRepository.findById(applicantId);
      if (currentApplicant && applicantInfo) {
        const applicantUpdates: any = {};

        if (applicantName && applicantName !== currentApplicant.name) {
          applicantUpdates.name = applicantName;
        }
        if (applicantPhone && applicantPhone !== currentApplicant.phone) {
          applicantUpdates.phone = applicantPhone;
        }
        if (applicantIdCard && applicantIdCard !== currentApplicant.idCard) {
          applicantUpdates.idCard = applicantIdCard;
        }

        if (Object.keys(applicantUpdates).length > 0) {
          applicantUpdates.tenantId = tenant.id;
          applicantUpdates.street = tenant.tenantName;
          await userRepository.update(applicantId, applicantUpdates);
        }
        if (Object.keys(applicantUpdates).length === 0 && (((currentApplicant as any).tenantId || null) !== tenant.id || currentApplicant.street !== tenant.tenantName)) {
          await userRepository.update(applicantId, {
            tenantId: tenant.id,
            street: tenant.tenantName
          } as any);
        }
      }
    } 
    // 如果用户未登录，检查表单数据并创建新用户
    else if (applicantPhone) {
      const existingApplicant = await userRepository.findByPhone(applicantPhone);
      if (existingApplicant) {
        applicantId = existingApplicant.id;
      } else {
        const applicant = await userRepository.create({
          id: uuidv4(),
          username: `user_${Date.now()}`,
          password: await bcrypt.hash('123456', 10),
          name: applicantName,
          phone: applicantPhone,
          role: 'personal',
          idCard: applicantIdCard,
          position: '申请人',
          tenantId: tenant.id,
          street: tenant.tenantName
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
    if (respondentPhone) {
      const existingRespondent = await userRepository.findByPhone(respondentPhone);
      if (existingRespondent) {
        respondentId = existingRespondent.id;

        // 已存在被申请人时，也补齐本次表单中的关键信息，保证详情展示与录入一致
        const respondentUpdates: any = {};
        if (respondentName && respondentName !== existingRespondent.name) {
          respondentUpdates.name = respondentName;
        }
        if (respondentIdCard && respondentIdCard !== existingRespondent.idCard) {
          respondentUpdates.idCard = respondentIdCard;
        }
        const expectedRole = respondentInfo.type === 'company' ? 'company' : 'personal';
        if (expectedRole !== existingRespondent.role) {
          respondentUpdates.role = expectedRole;
        }
        const expectedPosition = respondentInfo.type === 'company' ? '企业代表' : '个人';
        if (expectedPosition !== existingRespondent.position) {
          respondentUpdates.position = expectedPosition;
        }

        if (Object.keys(respondentUpdates).length > 0) {
          await userRepository.update(respondentId, respondentUpdates);
        }
      } else {
        const respondent = await userRepository.create({
          id: uuidv4(),
          username: `user_${Date.now()}_resp`,
          password: await bcrypt.hash('123456', 10),
          name: respondentName,
          phone: respondentPhone,
          role: respondentInfo.type === 'company' ? 'company' : 'personal',
          idCard: respondentIdCard,
          position: respondentInfo.type === 'company' ? '企业代表' : '个人',
        } as any);
        console.log('创建的被申请人:', respondent);
        respondentId = respondent.id;
      }
    } else {
      console.error('被申请人信息不完整');
      return res.status(400).json({ message: '被申请人信息不完整' });
    }

    const dutyAssignee = await resolveDutyMediator(tenant.id);

    // 创建案件
    const newCase = await caseRepository.create({
      id: uuidv4(),
      caseNumber,
      applicantId,
      respondentId,
      applicantDisplayName: applicantName,
      respondentDisplayName: respondentName,
      applicantPhone: applicantPhone,
      respondentPhone: respondentPhone,
      disputeType,
      caseAmount: caseAmount ? parseFloat(caseAmount) : undefined,
      requestItems,
      factsReasons,
      tenantId: tenant.id,
      mediatorId: dutyAssignee?.id,
      status: 'pending' as any,
    });

    // 强制二次写入并回读校验，确保手机号与姓名确实落库到 cases 表
    const ensuredCase = await caseRepository.update(newCase.id, {
      applicantDisplayName: applicantName,
      respondentDisplayName: respondentName,
      applicantPhone: applicantPhone,
      respondentPhone: respondentPhone,
    });

    const snapshotValid =
      ensuredCase &&
      normalizeText((ensuredCase as any).applicantDisplayName) === applicantName &&
      normalizeText((ensuredCase as any).respondentDisplayName) === respondentName &&
      normalizeText((ensuredCase as any).applicantPhone) === applicantPhone &&
      normalizeText((ensuredCase as any).respondentPhone) === respondentPhone;

    if (!snapshotValid) {
      console.error('案件快照落库校验失败:', {
        caseId: newCase.id,
        caseNumber,
        expected: { applicantName, applicantPhone, respondentName, respondentPhone },
        actual: ensuredCase
      });
      return res.status(500).json({ message: '案件联系人信息保存失败，请重试' });
    }

    // 创建案件进度记录
    await caseProgressRepository.create({
      id: uuidv4(),
      caseId: newCase.id,
      content: '案件已申请',
      type: 'register',
      creatorId: req.user?.id || applicantId,
    } as any);

    if (dutyAssignee) {
      await caseProgressRepository.create({
        id: uuidv4(),
        caseId: newCase.id,
        content:
          dutyAssignee.source === 'tenant_admin_fallback'
            ? `当前街道暂无调解员，已由街道管理员 ${dutyAssignee.name} 暂时接收该申请`
            : `已分配当前值班调解员 ${dutyAssignee.name}`,
        type: 'accept',
        creatorId: req.user?.id || applicantId,
      } as any);

      await notifyAssignedMediator({
        senderId: applicantId,
        receiverId: dutyAssignee.id,
        caseId: newCase.id,
        content: `新调解申请：${applicantName} 已提交劳动争议申请，案号 ${caseNumber}，请尽快查看并处理。`
      });
    }

    res.status(201).json({
      case: newCase,
      caseNumber,
      assignedMediator: dutyAssignee
        ? {
            id: dutyAssignee.id,
            name: dutyAssignee.name,
            role: dutyAssignee.role,
            phone: dutyAssignee.phone || dutyAssignee.officePhone || '',
            source: dutyAssignee.source
          }
        : null
    });
  } catch (error) {
    console.error('提交调解申请错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

export const createConsultation = async (req: express.Request, res: express.Response) => {
  try {
    const {
      tenantId,
      phone,
      content
    } = req.body || {};

    const normalizedTenantId = String(tenantId || '').trim();
    const normalizedPhone = String(phone || '').trim();
    const normalizedContent = String(content || '').trim();

    if (!normalizedTenantId) {
      return res.status(400).json({ message: '请选择咨询街道' });
    }
    if (!isValidMainlandPhone(normalizedPhone)) {
      return res.status(400).json({ message: '请输入正确的手机号' });
    }
    if (!normalizedContent) {
      return res.status(400).json({ message: '请输入咨询内容' });
    }

    const [tenantRows] = await pool.query(
      `SELECT id, tenantName
       FROM tenants
       WHERE id = ? AND status = 'active'
       LIMIT 1`,
      [normalizedTenantId]
    );
    const tenant = (tenantRows as any[])[0];
    if (!tenant) {
      return res.status(404).json({ message: '未找到可用街道' });
    }

    const dutyAssignee = await resolveDutyMediator(normalizedTenantId);
    const receiver = await getConsultationReceiver(normalizedTenantId, dutyAssignee);
    if (!receiver?.id) {
      return res.status(400).json({ message: '当前街道暂未配置受理人员，请联系管理员' });
    }

    const currentUser = req.user ? await userRepository.findById(req.user.id) : null;
    const applicantId = req.user!.id;
    const creatorName = String(
      req.user?.name ||
      req.user?.nickname ||
      req.user?.username ||
      currentUser?.name ||
      '咨询用户'
    ).trim();

    const userUpdates: any = {};
    if (normalizedPhone && currentUser && normalizedPhone !== currentUser.phone) {
      userUpdates.phone = normalizedPhone;
    }
    if (tenant.id && currentUser && (((currentUser as any).tenantId || null) !== tenant.id || currentUser.street !== tenant.tenantName)) {
      userUpdates.tenantId = tenant.id;
      userUpdates.street = tenant.tenantName;
    }
    if (Object.keys(userUpdates).length > 0) {
      await userRepository.update(applicantId, userUpdates);
    }

    const caseNumber = buildConsultationNumber();
    const consultationCase = await caseRepository.create({
      id: uuidv4(),
      caseNumber,
      applicantId,
      respondentId: receiver.id,
      applicantDisplayName: creatorName,
      respondentDisplayName: receiver.name || '街道咨询受理台',
      applicantPhone: normalizedPhone,
      respondentPhone: receiver.phone || receiver.officePhone || '',
      disputeType: '咨询',
      caseAmount: 0,
      requestItems: normalizedContent,
      factsReasons: normalizedContent,
      tenantId: tenant.id,
      mediatorId: receiver.id,
      status: 'pending' as any
    } as any);

    await caseProgressRepository.create({
      id: uuidv4(),
      caseId: consultationCase.id,
      content: '咨询已提交',
      type: 'register',
      creatorId: applicantId
    } as any);

    await caseProgressRepository.create({
      id: uuidv4(),
      caseId: consultationCase.id,
      content:
        receiver.source === 'tenant_admin_fallback' || receiver.source === 'tenant_admin_default'
          ? `当前街道由 ${receiver.name} 接收该咨询`
          : `已分配当前接收人 ${receiver.name}`,
      type: 'accept',
      creatorId: applicantId
    } as any);

    await notifyAssignedMediator({
      senderId: applicantId,
      receiverId: receiver.id,
      caseId: consultationCase.id,
      content: `新咨询：${creatorName} 已提交咨询，案号 ${caseNumber}，请尽快查看并回复。`
    });

    res.status(201).json({
      consultation: consultationCase,
      case: consultationCase,
      caseNumber,
      tenantName: tenant.tenantName,
      assignedMediator: receiver
        ? {
            id: receiver.id,
            name: receiver.name,
            role: receiver.role,
            phone: receiver.phone || receiver.officePhone || '',
            source: receiver.source
          }
        : null
    });
  } catch (error) {
    console.error('提交咨询失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取申请列表
export const getApplications = async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { total, cases } = await caseRepository.paginateCases(
      Number(page), Number(limit), status as string | undefined, req.user?.role === 'tenant_admin' ? (req.user?.tenantId || null) : undefined
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
      req.user?.role === 'superadmin' ||
      (req.user?.role === 'tenant_admin' && application.tenantId === req.user?.tenantId) ||
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
      applicantInfo: { name: '', phone: '', idCard: '' },
      respondentInfo: { name: '', phone: '', idCard: '', type: 'company' },
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
