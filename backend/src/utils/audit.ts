import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import operationLogRepository from '../repositories/operationLogRepository';

export const getRequestIp = (req?: express.Request) => {
  const forwarded = req?.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0] || '';
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || '';
};

export const writeOperationLog = async (payload: {
  req?: express.Request;
  userId?: string | null;
  username?: string | null;
  role?: string | null;
  tenantId?: string | null;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetDisplay?: string | null;
  result: 'success' | 'failed';
  errorMessage?: string | null;
  detail?: string | null;
}) => {
  await operationLogRepository.create({
    id: uuidv4(),
    userId: payload.userId || payload.req?.user?.id || null,
    username: payload.username || payload.req?.user?.username || null,
    role: payload.role || payload.req?.user?.role || null,
    tenantId: payload.tenantId || payload.req?.user?.tenantId || null,
    module: payload.module,
    action: payload.action,
    targetType: payload.targetType || null,
    targetId: payload.targetId || null,
    targetDisplay: payload.targetDisplay || null,
    result: payload.result,
    errorMessage: payload.errorMessage || null,
    ip: getRequestIp(payload.req),
    userAgent: payload.req?.headers['user-agent'] || null,
    detail: payload.detail || null,
    createdAt: new Date()
  } as any);
};
