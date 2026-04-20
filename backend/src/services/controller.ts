import express from 'express';
import mongoose from 'mongoose';
import { exec, spawn } from 'child_process';
import path from 'path';
import axios from 'axios';
import config from '../config';
import { io } from '../server';

// 服务进程管理
const serviceProcesses: Record<string, any> = {};

// 检查服务状态
export const checkServiceStatus = [
  async (req: express.Request, res: express.Response) => {
    try {
      // 检查 MongoDB 连接状态
      const mongoStatus = mongoose.connection.readyState;
      const mongoConnected = mongoStatus === 1;

      // 检查后端服务状态
      const backendStatus = 'running';

      // 检查前端服务状态
      let frontendStatus = 'running';
      let frontendMessage = '前端服务运行正常';
      try {
        // 尝试连接前端服务
        const frontendResponse = await axios.get('http://localhost:5175');
        if (frontendResponse.status === 200) {
          frontendStatus = 'running';
          frontendMessage = '前端服务运行正常';
        }
      } catch (error) {
        console.error('检查前端服务状态失败:', error);
        frontendStatus = 'disconnected';
        frontendMessage = '前端服务连接失败';
      }



      // 检查短信服务状态
      let smsStatus = 'unknown';
      let smsMessage = '短信服务状态需要通过配置检查';
      try {
        const { sms } = config;
        const requiredFields = [
          sms.secretId,
          sms.secretKey,
          sms.sdkAppId,
          sms.signName,
          sms.templateIds.verification,
          sms.templateIds.notification,
          sms.templateIds.registerSuccess
        ];
        
        const allFieldsPresent = requiredFields.every(field => field && field.trim() !== '');
        
        if (allFieldsPresent) {
          smsStatus = 'configured';
          smsMessage = '短信服务配置完整';
        } else {
          smsStatus = 'incomplete';
          smsMessage = '短信服务配置不完整';
        }
      } catch (error) {
        console.error('检查短信服务状态失败:', error);
        smsStatus = 'error';
        smsMessage = '短信服务配置错误';
      }

      // 检查邮件服务状态
      let emailStatus = 'unknown';
      let emailMessage = '邮件服务状态需要通过配置检查';
      try {
        const { email } = config;
        const requiredFields = [
          email.secretId,
          email.secretKey,
          email.sender.email,
          email.sender.name,
          email.templates.registerSuccess,
          email.templates.passwordReset,
          email.templates.caseNotification
        ];
        
        const allFieldsPresent = requiredFields.every(field => field && field.trim() !== '');
        
        if (allFieldsPresent) {
          emailStatus = 'configured';
          emailMessage = '邮件服务配置完整';
        } else {
          emailStatus = 'incomplete';
          emailMessage = '邮件服务配置不完整';
        }
      } catch (error) {
        console.error('检查邮件服务状态失败:', error);
        emailStatus = 'error';
        emailMessage = '邮件服务配置错误';
      }

      // 检查 Socket.IO 服务状态
      let socketStatus = 'running';
      let socketMessage = 'Socket.IO 服务运行正常';
      try {
        // 获取 Socket.IO 连接数
        const sockets = io.sockets;
        const connectedSockets = sockets.sockets.size;
        socketMessage = `Socket.IO 服务运行正常，当前连接数: ${connectedSockets}`;
      } catch (error) {
        console.error('检查 Socket.IO 服务状态失败:', error);
        socketStatus = 'error';
        socketMessage = 'Socket.IO 服务错误';
      }

      // 获取数据库环境信息
      const dbEnv = process.env.DB_ENV || 'development';
      const mongoUri = process.env.MONGO_URI_DEV || 'mongodb://localhost:27017/laodong';
      const prodMongoUri = process.env.MONGO_URI_PROD || 'mongodb://152.136.175.14:27017';

      // 构建服务状态响应
      const serviceStatus = {
        backend: {
          status: backendStatus,
          message: '后端服务运行正常',
          timestamp: new Date().toISOString()
        },
        mongodb: {
          status: mongoConnected ? 'connected' : 'disconnected',
          message: mongoConnected ? 'MongoDB 连接正常' : 'MongoDB 连接失败',
          timestamp: new Date().toISOString()
        },
        frontend: {
          status: frontendStatus,
          message: frontendMessage,
          timestamp: new Date().toISOString()
        },
        sms: {
          status: smsStatus,
          message: smsMessage,
          timestamp: new Date().toISOString()
        },
        email: {
          status: emailStatus,
          message: emailMessage,
          timestamp: new Date().toISOString()
        },
        socket: {
          status: socketStatus,
          message: socketMessage,
          timestamp: new Date().toISOString()
        },
        environment: {
          status: 'configured',
          message: `当前环境: ${dbEnv === 'production' ? '生产环境' : '开发环境'}`,
          dbEnv: dbEnv,
          mongoUri: dbEnv === 'production' ? prodMongoUri : mongoUri,
          timestamp: new Date().toISOString()
        }
      };

      res.json({ success: true, services: serviceStatus });
    } catch (error) {
      console.error('检查服务状态失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];

// 启动服务
export const startService = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { serviceName } = req.body;

      // 检查服务名称是否有效
      if (!['frontend', 'backend'].includes(serviceName)) {
        return res.status(400).json({ success: false, message: '无效的服务名称' });
      }

      // 检查服务是否已经在运行
      if (serviceProcesses[serviceName]) {
        return res.status(400).json({ success: false, message: '服务已经在运行' });
      }

      // 定义服务启动命令和工作目录
      let command: string = 'npm';
      let args: string[] = ['run', 'dev'];
      let cwd: string = path.join(__dirname, '../..');

      if (serviceName === 'frontend') {
        cwd = path.join(__dirname, '../../frontend');
      } else if (serviceName === 'backend') {
        cwd = path.join(__dirname, '../..');
      }

      // 启动服务进程
      const process = spawn(command, args, {
        cwd,
        detached: true,
        stdio: 'ignore'
      });

      // 保存服务进程信息
      serviceProcesses[serviceName] = {
        process,
        pid: process.pid,
        startTime: new Date().toISOString()
      };

      // 监听进程退出事件
      process.on('exit', (code) => {
        console.log(`${serviceName} 服务进程退出，退出码: ${code}`);
        delete serviceProcesses[serviceName];
      });

      // 允许进程独立运行
      process.unref();

      res.json({ success: true, message: `服务 ${serviceName} 启动成功` });
    } catch (error) {
      console.error('启动服务失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];

// 停止服务
export const stopService = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { serviceName } = req.body;

      // 检查服务名称是否有效
      if (!['frontend', 'backend'].includes(serviceName)) {
        return res.status(400).json({ success: false, message: '无效的服务名称' });
      }

      // 检查服务是否在运行
      if (!serviceProcesses[serviceName]) {
        return res.status(400).json({ success: false, message: '服务未运行' });
      }

      // 终止服务进程
      const processInfo = serviceProcesses[serviceName];
      processInfo.process.kill();

      // 删除服务进程信息
      delete serviceProcesses[serviceName];

      res.json({ success: true, message: `服务 ${serviceName} 停止成功` });
    } catch (error) {
      console.error('停止服务失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];

// 重启服务
export const restartService = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { serviceName } = req.body;

      // 检查服务名称是否有效
      if (!['frontend', 'backend'].includes(serviceName)) {
        return res.status(400).json({ success: false, message: '无效的服务名称' });
      }

      // 检查服务是否在运行，如果是则停止
      if (serviceProcesses[serviceName]) {
        const processInfo = serviceProcesses[serviceName];
        processInfo.process.kill();
        delete serviceProcesses[serviceName];
      }

      // 定义服务启动命令和工作目录
      let command: string = 'npm';
      let args: string[] = ['run', 'dev'];
      let cwd: string = path.join(__dirname, '../..');

      if (serviceName === 'frontend') {
        cwd = path.join(__dirname, '../../frontend');
      } else if (serviceName === 'backend') {
        cwd = path.join(__dirname, '../..');
      }

      // 启动服务进程
      const process = spawn(command, args, {
        cwd,
        detached: true,
        stdio: 'ignore'
      });

      // 保存服务进程信息
      serviceProcesses[serviceName] = {
        process,
        pid: process.pid,
        startTime: new Date().toISOString()
      };

      // 监听进程退出事件
      process.on('exit', (code) => {
        console.log(`${serviceName} 服务进程退出，退出码: ${code}`);
        delete serviceProcesses[serviceName];
      });

      // 允许进程独立运行
      process.unref();

      res.json({ success: true, message: `服务 ${serviceName} 重启成功` });
    } catch (error) {
      console.error('重启服务失败:', error);
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];