import express from 'express';
import Message from '../models/Message';
import User from '../models/User';
import { io } from '../server';

// 创建消息
export const createMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { content, type, recipientId, caseId } = req.body;
    
    // 验证接收者是否存在
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: '接收者不存在' });
    }
    
    // 创建消息
    const message = new Message({
      content,
      type,
      recipientId,
      senderId: req.user?.id,
      caseId
    });
    
    await message.save();
    
    // 发送实时消息通知
    io.to(recipientId.toString()).emit('newMessage', message);
    
    // 如果是弹窗类型，发送弹窗通知
    if (type === 'popup') {
      io.to(recipientId.toString()).emit('popupNotification', {
        content,
        messageId: message._id
      });
    }
    
    res.status(201).json({ message, success: true });
  } catch (error) {
    console.error('创建消息错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取用户消息列表
export const getUserMessages = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, type } = req.query;
    
    const query: any = { recipientId: userId };
    if (type) {
      query.type = type;
    }
    
    // 计算分页
    const skip = (Number(page) - 1) * Number(limit);
    
    // 获取消息列表
    const messages = await Message.find(query)
      .populate('senderId', 'name')
      .populate('caseId', 'caseNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // 获取消息总数
    const total = await Message.countDocuments(query);
    
    res.json({
      messages,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
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
    
    const count = await Message.countDocuments({
      recipientId: userId,
      isRead: false
    });
    
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
    
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        recipientId: userId
      },
      { isRead: true },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    res.json({ message, success: true });
  } catch (error) {
    console.error('标记消息为已读错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 标记所有消息为已读
export const markAllMessagesAsRead = async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    
    await Message.updateMany(
      {
        recipientId: userId,
        isRead: false
      },
      { isRead: true }
    );
    
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
    
    const result = await Message.deleteOne({
      _id: messageId,
      recipientId: userId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: '消息不存在' });
    }
    
    res.json({ success: true, message: '消息已删除' });
  } catch (error) {
    console.error('删除消息错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};