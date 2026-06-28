import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import messageRepository from '../repositories/messageRepository';
import userRepository from '../repositories/userRepository';
import { caseRepository, visitorRecordRepository } from '../repositories';
import { io } from '../server';

// 创建消息
export const createMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { content, type, recipientId: rawRecipientId, caseId } = req.body;
    let recipientId = rawRecipientId;

    if (!recipientId && caseId) {
      let caseData = await caseRepository.findById(caseId);
      if (!caseData) {
        caseData = await caseRepository.findByCaseNumber(caseId);
      }

      if (caseData && caseData.mediatorId) {
        recipientId = caseData.mediatorId;
      } else {
        let visitorRecord = await visitorRecordRepository.findById(caseId);
        if (!visitorRecord) {
          visitorRecord = await visitorRecordRepository.findByRegisterNumber(caseId);
        }
        if (visitorRecord && visitorRecord.mediatorId) {
          recipientId = visitorRecord.mediatorId;
        }
      }
    }

    if (!recipientId) {
      return res.status(400).json({ message: '未找到可接收留言的调解员' });
    }
    
    // 验证接收者是否存在
    const recipient = await userRepository.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: '接收者不存在' });
    }
    
    // 创建消息
    const message = await messageRepository.create({
      id: uuidv4(),
      senderId: req.user?.id!,
      receiverId: recipientId,
      content,
      type: type || 'case_message',
      caseId,
      isRead: false,
      createdAt: new Date()
    });
    
    // 获取完整的消息信息，包括关联数据
    const fullMessage = await messageRepository.findByReceiverPaginated(recipientId, 1, 1);
    const createdMessage = fullMessage.messages[0] || message;
    
    // 发送实时消息通知
    io.to(recipientId.toString()).emit('newMessage', createdMessage);
    
    // 如果是弹窗类型，发送弹窗通知
    if (type === 'popup') {
      io.to(recipientId.toString()).emit('popupNotification', {
        content,
        messageId: message.id
      });
    }
    
    res.status(201).json({ message: createdMessage, success: true });
  } catch (error) {
    console.error('创建消息错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取用户消息列表
export const getUserMessages = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { page = 1, limit = 20, type, caseId } = req.query;
    const result = caseId
      ? userRole === 'admin'
        ? await messageRepository.findCaseMessages(
            caseId as string,
            Number(page),
            Number(limit)
          )
        : await messageRepository.findCaseMessagesForUser(
            caseId as string,
            userId!,
            Number(page),
            Number(limit)
          )
      : await messageRepository.findByReceiverPaginated(
          userId!,
          Number(page),
          Number(limit),
          type as string
        );
    
    res.json({
      messages: result.messages,
      pagination: {
        total: result.total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(result.total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取消息列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取未读消息数量
export const getUnreadMessageCount = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    
    const count = await messageRepository.countUnreadMessages(userId!);
    
    res.json({ count });
  } catch (error) {
    console.error('获取未读消息数量错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 标记消息为已读
export const markMessageAsRead = async (req: express.Request, res: express.Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    
    const message = await messageRepository.markAsRead(messageId, userId!);
    
    if (!message) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    // 获取完整的消息信息
    const fullMessage = await messageRepository.findByReceiverPaginated(userId!, 1, 1);
    const updatedMessage = fullMessage.messages.find(m => m.id === messageId) || message;
    
    res.json({ message: updatedMessage, success: true });
  } catch (error) {
    console.error('标记消息为已读错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 标记所有消息为已读
export const markAllMessagesAsRead = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    
    await messageRepository.markAllAsRead(userId!);
    
    res.json({ success: true, message: '所有消息已标记为已读' });
  } catch (error) {
    console.error('标记所有消息为已读错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 删除消息
export const deleteMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    
    const result = await messageRepository.deleteMessage(messageId, userId!);
    
    if (!result) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    res.json({ success: true, message: '消息已删除' });
  } catch (error) {
    console.error('删除消息错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
