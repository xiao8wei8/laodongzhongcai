import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import feedbackRepository from './repository';

const normalizeSource = (value: any) => (value === 'admin_web' ? 'admin_web' : 'miniapp');
const normalizeType = (value: any) => {
  const allowed = ['bug', 'suggestion', 'complaint', 'other'];
  return allowed.includes(value) ? value : 'other';
};

export const createFeedback = async (req: express.Request, res: express.Response) => {
  try {
    const { title, content, type, source, contactName, contactPhone, screenshots } = req.body;

    if (!String(title || '').trim()) {
      return res.status(400).json({ message: '请输入反馈标题' });
    }
    if (!String(content || '').trim()) {
      return res.status(400).json({ message: '请输入反馈内容' });
    }

    const feedback = await feedbackRepository.create({
      id: uuidv4(),
      userId: req.user!.id,
      tenantId: req.user!.tenantId || null,
      source: normalizeSource(source),
      type: normalizeType(type),
      title: String(title).trim(),
      content: String(content).trim(),
      contactName: String(contactName || '').trim() || undefined,
      contactPhone: String(contactPhone || '').trim() || undefined,
      screenshots: Array.isArray(screenshots) ? screenshots.filter(Boolean) : [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({ feedback, success: true });
  } catch (error) {
    console.error('创建反馈失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

export const getMyFeedbacks = async (req: express.Request, res: express.Response) => {
  try {
    const feedbacks = await feedbackRepository.findMine(req.user!.id);
    res.json({ feedbacks });
  } catch (error) {
    console.error('获取我的反馈失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

export const getAllFeedbacks = async (req: express.Request, res: express.Response) => {
  try {
    const { status, source, type, keyword } = req.query;
    const feedbacks = await feedbackRepository.findAll({
      status: status as string,
      source: source as string,
      type: type as string,
      keyword: keyword as string,
      tenantId: req.user?.role === 'tenant_admin' ? (req.user?.tenantId || null) : undefined
    });
    res.json({ feedbacks });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

export const updateFeedbackStatus = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { status, replyContent } = req.body;

    if (!['pending', 'processing', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ message: '反馈状态不正确' });
    }

    const existing = await feedbackRepository.findById(id);
    if (!existing) {
      return res.status(404).json({ message: '反馈不存在' });
    }
    if (req.user?.role === 'tenant_admin' && existing.tenantId !== req.user?.tenantId) {
      return res.status(403).json({ message: '无权处理其他街道的反馈' });
    }

    const feedback = await feedbackRepository.updateStatus(id, {
      status,
      replyContent: String(replyContent || '').trim(),
      handledBy: req.user!.id
    });

    res.json({ feedback, success: true });
  } catch (error) {
    console.error('更新反馈状态失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
