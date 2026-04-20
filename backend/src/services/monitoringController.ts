import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';

// 模拟监控数据
const generateMonitoringData = () => {
  // 模拟 CPU 使用率
  const cpuUsage = Math.random() * 100;
  
  // 模拟内存使用率
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  
  // 模拟磁盘使用率
  const diskUsage = Math.random() * 100;
  
  // 模拟网络流量
  const networkIn = Math.random() * 1000;
  const networkOut = Math.random() * 1000;
  
  return {
    cpu: parseFloat(cpuUsage.toFixed(2)),
    memory: parseFloat(memoryUsage.toFixed(2)),
    disk: parseFloat(diskUsage.toFixed(2)),
    network: {
      in: parseFloat(networkIn.toFixed(2)),
      out: parseFloat(networkOut.toFixed(2))
    },
    timestamp: new Date().toISOString()
  };
};

// 模拟日志数据
const generateLogs = (filter: any) => {
  const logLevels = ['error', 'warn', 'info', 'debug'];
  const services = ['backend', 'frontend', 'socket', 'mongodb'];
  
  const logs = [];
  for (let i = 0; i < 50; i++) {
    const log = {
      _id: `log-${i}`,
      level: logLevels[Math.floor(Math.random() * logLevels.length)],
      message: `测试日志消息 ${i}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      service: services[Math.floor(Math.random() * services.length)]
    };
    
    // 应用筛选
    if (filter.level && log.level !== filter.level) continue;
    if (filter.service && log.service !== filter.service) continue;
    if (filter.keyword && !log.message.includes(filter.keyword)) continue;
    
    logs.push(log);
  }
  
  // 按时间戳排序
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return logs;
};

// 获取监控数据
export const getMonitoringData = [
  async (req: express.Request, res: express.Response) => {
    try {
      // 生成模拟监控数据
      const data = [];
      for (let i = 0; i < 24; i++) {
        data.push(generateMonitoringData());
        // 模拟时间间隔
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      res.json({ success: true, data });
    } catch (error) {
      console.error('获取监控数据失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];

// 获取日志数据
export const getLogs = [
  async (req: express.Request, res: express.Response) => {
    try {
      const filter = req.query;
      const logs = generateLogs(filter);
      res.json({ success: true, logs });
    } catch (error) {
      console.error('获取日志失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];
