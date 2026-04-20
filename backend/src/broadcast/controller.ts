import express from 'express';
import mongoose from 'mongoose';
import Broadcast from '../models/Broadcast';
import { io } from '../server';

// 发布广播
export const createBroadcast = async (req: express.Request, res: express.Response) => {
  try {
    const { title, content, type, urgency, attachments } = req.body;
    
    // 计算过期时间：普通广播30天，重要广播90天
    let expireDays = 30;
    if (urgency === 'important' || urgency === 'emergency') {
      expireDays = 90;
    }
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expireDays);
    
    // 创建广播
    const broadcast = new Broadcast({
      title,
      content,
      type,
      urgency,
      status: 'pending',
      creatorId: req.user?.id,
      attachments,
      expireAt
    });
    
    await broadcast.save();
    
    // 发送实时通知给管理员
    io.emit('newBroadcastPending', broadcast);
    
    res.status(201).json({ broadcast, success: true, message: '广播已提交，等待审核' });
  } catch (error) {
    console.error('发布广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取广播列表
export const getBroadcasts = async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, type, urgency, status } = req.query;
    const query: any = {};
    
    // 普通用户可以看到自己创建的所有广播（包括待审核和被驳回的）以及所有已通过的广播
    if (req.user?.role !== 'admin') {
      const userId = req.user?.id;
      if (userId) {
        query.$or = [
          { status: 'approved' },
          { creatorId: new mongoose.Types.ObjectId(userId) }
        ];
      } else {
        // 如果没有用户ID，只显示已通过的广播
        query.status = 'approved';
      }
    } else if (status) {
      // 管理员可以按状态筛选
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (urgency) {
      query.urgency = urgency;
    }
    
    // 计算分页
    const skip = (Number(page) - 1) * Number(limit);
    
    // 获取记录总数
    const total = await Broadcast.countDocuments(query);
    
    // 获取记录列表
    const broadcasts = await Broadcast.find(query)
      .populate('creatorId', 'name')
      .populate('approverId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    res.json({
      broadcasts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取广播列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取广播详情
export const getBroadcastById = async (req: express.Request, res: express.Response) => {
  try {
    const broadcastId = req.params.id;
    
    const broadcast = await Broadcast.findById(broadcastId)
      .populate('creatorId', 'name')
      .populate('approverId', 'name');
    
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    // 检查是否需要标记为已读
    if (broadcast.status === 'approved' && req.user?.id) {
      const userId = req.user.id;
      const hasRead = broadcast.readBy.some(item => item.userId && item.userId.toString() === userId.toString());
      if (!hasRead) {
        broadcast.readBy.push({
          userId: new mongoose.Types.ObjectId(userId),
          readAt: new Date()
        });
        await broadcast.save();
      }
    }
    
    res.json({ broadcast });
  } catch (error) {
    console.error('获取广播详情错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取最新广播
export const getLatestBroadcasts = async (req: express.Request, res: express.Response) => {
  try {
    const broadcasts = await Broadcast.find({ status: 'approved' })
      .populate('creatorId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // 计算未读数量
    const unreadCount = broadcasts.filter(broadcast => {
      return !broadcast.readBy.some(item => item.userId && item.userId.toString() === req.user?.id?.toString());
    }).length;
    
    res.json({ broadcasts, unreadCount });
  } catch (error) {
    console.error('获取最新广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 审核广播
export const approveBroadcast = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { action, reason, content } = req.body;
    
    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    if (action === 'approve') {
      // 批准广播
      broadcast.status = 'approved';
      broadcast.approverId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      broadcast.approvalTime = new Date();
      
      if (content) {
        broadcast.content = content;
      }
      
      await broadcast.save();
      
      // 发送实时通知
      io.emit('broadcastApproved', broadcast);
      
      res.json({ broadcast, success: true, message: '广播已批准' });
    } else if (action === 'reject') {
      // 驳回广播
      broadcast.status = 'rejected';
      broadcast.approverId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      broadcast.approvalTime = new Date();
      broadcast.rejectionReason = reason;
      
      await broadcast.save();
      
      // 发送实时通知给创建者
      io.emit('broadcastRejected', broadcast);
      
      res.json({ broadcast, success: true, message: '广播已驳回' });
    } else {
      res.status(400).json({ message: '无效的操作' });
    }
  } catch (error) {
    console.error('审核广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取待审核广播列表
export const getPendingBroadcasts = async (req: express.Request, res: express.Response) => {
  try {
    const broadcasts = await Broadcast.find({ status: 'pending' })
      .populate('creatorId', 'name')
      .sort({ createdAt: -1 });
    
    res.json({ broadcasts });
  } catch (error) {
    console.error('获取待审核广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取广播阅读统计
export const getBroadcastStats = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    
    const broadcast = await Broadcast.findById(id)
      .populate('readBy.userId', 'name');
    
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    const stats = {
      totalRead: broadcast.readBy.length,
      readers: broadcast.readBy
        .filter((item): item is { userId: any; readAt: Date } => item.userId !== undefined)
        .map(item => {
          const userId = item.userId;
          return {
            userId: userId.toString(),
            userName: userId instanceof mongoose.Types.ObjectId ? 'Unknown' : (userId as any).name || 'Unknown',
            readAt: item.readAt
          };
        })
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('获取广播统计错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 修改被驳回的广播
export const updateRejectedBroadcast = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { title, content, type, urgency, attachments } = req.body;
    
    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    // 检查是否是广播的创建者
    if (broadcast.creatorId?.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({ message: '无权限修改此广播' });
    }
    
    // 检查广播状态是否为被驳回
    if (broadcast.status !== 'rejected') {
      return res.status(400).json({ message: '只能修改被驳回的广播' });
    }
    
    // 更新广播信息
    broadcast.title = title || broadcast.title;
    broadcast.content = content || broadcast.content;
    broadcast.type = type || broadcast.type;
    broadcast.urgency = urgency || broadcast.urgency;
    broadcast.attachments = attachments || broadcast.attachments;
    
    // 重置状态为待审核
    broadcast.status = 'pending';
    broadcast.approverId = undefined;
    broadcast.approvalTime = undefined;
    broadcast.rejectionReason = undefined;
    
    // 重新计算过期时间
    let expireDays = 30;
    if (broadcast.urgency === 'important' || broadcast.urgency === 'emergency') {
      expireDays = 90;
    }
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expireDays);
    broadcast.expireAt = expireAt;
    
    await broadcast.save();
    
    // 发送实时通知给管理员
    io.emit('newBroadcastPending', broadcast);
    
    res.json({ broadcast, success: true, message: '广播已修改并重新提交审核' });
  } catch (error) {
    console.error('修改广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
