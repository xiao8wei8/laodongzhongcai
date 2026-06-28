import express from 'express';
import { exec, spawn } from 'child_process';
import path from 'path';
import axios from 'axios';
import pool from '../config/mysql';
import { io } from '../server';
import { writeOperationLog } from '../utils/audit';

// 服务进程管理
const serviceProcesses: Record<string, any> = {};

// 检查服务状态
export const checkServiceStatus = [
  async (req: express.Request, res: express.Response) => {
    try {
      // 检查 MySQL 连接状态
      let mysqlConnected = false;
      try {
        await pool.query('SELECT 1');
        mysqlConnected = true;
      } catch (error) {
        console.error('MySQL 连接检查失败:', error);
        mysqlConnected = false;
      }

      // 检查后端服务状态
      const backendStatus = 'running';

      // 检查前端服务状态
      let frontendStatus = 'running';
      let frontendMessage = '前端服务运行正常';
      try {
        // 尝试连接前端页面
        // 当前项目在生产形态下是由后端托管 frontend/dist（子路径 /laodongzhongcai），
        // 因此这里使用后端同端口探测，而不是固定 5175（避免误报“未连接”）。
        const frontendResponse = await axios.get('http://localhost:5003/laodongzhongcai/', {
          timeout: 3000
        });
        if (frontendResponse.status === 200) {
          frontendStatus = 'running';
          frontendMessage = '前端页面可访问（由后端托管 dist）';
        }
      } catch (error) {
        console.error('检查前端服务状态失败:', error);
        frontendStatus = 'disconnected';
        frontendMessage = '前端页面访问失败';
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
      const mysqlHost = process.env.MYSQL_HOST || '152.136.175.14';
      const mysqlPort = process.env.MYSQL_PORT || '3306';
      const mysqlDatabase = process.env.MYSQL_DATABASE || 'laodongzhongcai';

      // 构建服务状态响应
      const serviceStatus = {
        backend: {
          status: backendStatus,
          message: '后端服务运行正常',
          timestamp: new Date().toISOString()
        },
        mysql: {
          status: mysqlConnected ? 'connected' : 'disconnected',
          message: mysqlConnected ? 'MySQL 连接正常' : 'MySQL 连接失败',
          timestamp: new Date().toISOString()
        },
        frontend: {
          status: frontendStatus,
          message: frontendMessage,
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
          mysqlHost,
          mysqlPort,
          mysqlDatabase,
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

      await writeOperationLog({
        req,
        module: 'service_management',
        action: 'start_service',
        targetType: 'service',
        targetDisplay: serviceName,
        result: 'success',
        detail: `启动服务 ${serviceName}`
      });

      res.json({ success: true, message: `服务 ${serviceName} 启动成功` });
    } catch (error) {
      console.error('启动服务失败:', error);
      await writeOperationLog({
        req,
        module: 'service_management',
        action: 'start_service',
        targetType: 'service',
        targetDisplay: req.body?.serviceName,
        result: 'failed',
        errorMessage: (error as any).message || '启动服务失败'
      });
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

      await writeOperationLog({
        req,
        module: 'service_management',
        action: 'stop_service',
        targetType: 'service',
        targetDisplay: serviceName,
        result: 'success',
        detail: `停止服务 ${serviceName}`
      });

      res.json({ success: true, message: `服务 ${serviceName} 停止成功` });
    } catch (error) {
      console.error('停止服务失败:', error);
      await writeOperationLog({
        req,
        module: 'service_management',
        action: 'stop_service',
        targetType: 'service',
        targetDisplay: req.body?.serviceName,
        result: 'failed',
        errorMessage: (error as any).message || '停止服务失败'
      });
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

      await writeOperationLog({
        req,
        module: 'service_management',
        action: 'restart_service',
        targetType: 'service',
        targetDisplay: serviceName,
        result: 'success',
        detail: `重启服务 ${serviceName}`
      });

      res.json({ success: true, message: `服务 ${serviceName} 重启成功` });
    } catch (error) {
      console.error('重启服务失败:', error);
      await writeOperationLog({
        req,
        module: 'service_management',
        action: 'restart_service',
        targetType: 'service',
        targetDisplay: req.body?.serviceName,
        result: 'failed',
        errorMessage: (error as any).message || '重启服务失败'
      });
      res.status(500).json({ success: false, message: '服务器内部错误' });
    }
  }
];
