import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import broadcastRepository from '../repositories/broadcastRepository';
import { io } from '../server';

const isInternalRole = (role?: string) => ['superadmin', 'tenant_admin', 'mediator'].includes(role || '');

const canAccessBroadcast = (broadcast: any, userId?: string, userRole?: string, tenantId?: string | null) => {
  if (userRole === 'superadmin') {
    return true;
  }

  if (userRole === 'tenant_admin') {
    return broadcast.tenantId === tenantId;
  }

  if (isInternalRole(userRole)) {
    return broadcast.status === 'approved' || (!!userId && broadcast.creatorId === userId);
  }

  return broadcast.status === 'approved' && broadcast.type === 'all';
};

const filterBroadcastsForUser = (broadcasts: any[], userId?: string, userRole?: string, tenantId?: string | null) => {
  return broadcasts.filter(b => canAccessBroadcast(b, userId, userRole, tenantId));
};

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
    const broadcast = await broadcastRepository.create({
      id: uuidv4(),
      title,
      content,
      type,
      urgency,
      status: 'pending',
      creatorId: req.user?.id as string,
      tenantId: req.user?.tenantId || null,
      attachments: attachments ? JSON.stringify(attachments) : null,
      expireAt,
    } as any);
    
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
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;

    if (userRole !== 'superadmin') {
      const allBroadcasts = await broadcastRepository.findAllWithRelations();
      let filteredBroadcasts = filterBroadcastsForUser(allBroadcasts, userId, userRole, tenantId);

      if (type) {
        filteredBroadcasts = filteredBroadcasts.filter(b => b.type === type);
      }
      if (urgency) {
        filteredBroadcasts = filteredBroadcasts.filter(b => b.urgency === urgency);
      }
      if (status) {
        filteredBroadcasts = filteredBroadcasts.filter(b => b.status === status);
      }

      // 分页
      const startIndex = (Number(page) - 1) * Number(limit);
      const paginatedBroadcasts = filteredBroadcasts.slice(startIndex, startIndex + Number(limit));

      res.json({
        broadcasts: paginatedBroadcasts,
        pagination: {
          total: filteredBroadcasts.length,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(filteredBroadcasts.length / Number(limit))
        }
      });
    } else {
      const result = await broadcastRepository.paginateBroadcasts(
        Number(page), Number(limit), type as string, urgency as string, status as string
      );
      
      res.json({
        broadcasts: result.broadcasts,
        pagination: {
          total: result.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(result.total / Number(limit))
        }
      });
    }
  } catch (error) {
    console.error('获取广播列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取广播详情
export const getBroadcastById = async (req: express.Request, res: express.Response) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;
    
    const broadcast = await broadcastRepository.findById(broadcastId);
    
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }

    if (!canAccessBroadcast(broadcast, userId, userRole, tenantId)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    // 检查是否需要标记为已读
    if (broadcast.status === 'approved' && userId) {
      await broadcastRepository.markAsRead(broadcastId, userId);
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
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;
    const broadcasts = await broadcastRepository.findActiveBroadcastsWithRelations();
    const latest = filterBroadcastsForUser(broadcasts, userId, userRole, tenantId).slice(0, 5);
    
    // 计算未读数量
    let unreadCount = 0;
    if (req.user?.id) {
      for (const b of latest) {
        const isRead = await broadcastRepository.isReadByUser(b.id, req.user.id);
        if (!isRead) {
          unreadCount++;
        }
      }
    }
    
    res.json({ broadcasts: latest, unreadCount });
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
    
    const broadcast = await broadcastRepository.findById(id);
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    if (action === 'approve') {
      // 批准广播
      const updateData: any = {
        status: 'approved',
        approverId: req.user?.id,
        approvalTime: new Date(),
      };
      if (content) {
        updateData.content = content;
      }
      
      const updated = await broadcastRepository.update(id, updateData);
      
      // 发送实时通知
      if (updated) {
        io.emit('broadcastApproved', updated);
      }
      
      res.json({ broadcast: updated, success: true, message: '广播已批准' });
    } else if (action === 'reject') {
      // 驳回广播
      const updated = await broadcastRepository.update(id, {
        status: 'rejected',
        approverId: req.user?.id,
        approvalTime: new Date(),
        rejectionReason: reason,
      } as any);
      
      // 发送实时通知给创建者
      if (updated) {
        io.emit('broadcastRejected', updated);
      }
      
      res.json({ broadcast: updated, success: true, message: '广播已驳回' });
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
    const withRelations = await broadcastRepository.findAllWithRelations();
    const pendingWithRelations = withRelations.filter(b => {
      if (b.status !== 'pending') return false;
      if (req.user?.role === 'superadmin') return true;
      return b.tenantId === req.user?.tenantId;
    });
    
    res.json({ broadcasts: pendingWithRelations });
  } catch (error) {
    console.error('获取待审核广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取广播阅读统计
export const getBroadcastStats = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    
    const broadcast = await broadcastRepository.findById(id);
    
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    let readBy = [];
    if (broadcast.readBy) {
      try {
        readBy = typeof broadcast.readBy === 'string' ? JSON.parse(broadcast.readBy) : broadcast.readBy;
      } catch {
        readBy = [];
      }
    }
    
    if (req.user?.role === 'tenant_admin' && broadcast.tenantId !== req.user?.tenantId) {
      return res.status(403).json({ message: '权限不足' });
    }

    const stats = {
      totalRead: readBy.length,
      readers: readBy.map((item: any) => ({
        userId: item.userId,
        userName: 'Unknown',
        readAt: item.readAt
      }))
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
    
    const broadcast = await broadcastRepository.findById(id);
    if (!broadcast) {
      return res.status(404).json({ message: '广播不存在' });
    }
    
    // 检查是否是广播的创建者
    if (broadcast.creatorId !== req.user?.id) {
      return res.status(403).json({ message: '无权限修改此广播' });
    }
    
    // 检查广播状态是否为被驳回
    if (broadcast.status !== 'rejected') {
      return res.status(400).json({ message: '只能修改被驳回的广播' });
    }
    
    // 计算过期时间
    let expireDays = 30;
    const newUrgency = urgency || broadcast.urgency;
    if (newUrgency === 'important' || newUrgency === 'emergency') {
      expireDays = 90;
    }
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expireDays);
    
    // 更新广播
    const updated = await broadcastRepository.update(id, {
      title: title || broadcast.title,
      content: content || broadcast.content,
      type: type || broadcast.type,
      urgency: newUrgency,
      attachments: attachments ? JSON.stringify(attachments) : broadcast.attachments,
      status: 'pending',
      approverId: null,
      approvalTime: null,
      rejectionReason: null,
      expireAt,
    } as any);
    
    if (updated) {
      // 发送实时通知给管理员
      io.emit('newBroadcastPending', updated);
    }
    
    res.json({ broadcast: updated, success: true, message: '广播已修改并重新提交审核' });
  } catch (error) {
    console.error('修改广播错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
