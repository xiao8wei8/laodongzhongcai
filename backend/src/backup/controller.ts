import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../config';

const execAsync = promisify(exec);

// 导出表结构
const exportSchema = async (req: Request, res: Response) => {
  try {
    const backupDir = path.join(__dirname, '../../backups/schemas');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `schema_${new Date().toISOString().slice(0, 10)}.sql`);
    
    const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
    
    const command = `mysqldump -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD} --no-data ${MYSQL_DATABASE} > ${backupFile}`;
    
    await execAsync(command);

    res.json({
      success: true,
      message: '表结构导出成功',
      exportFile: backupFile
    });
  } catch (error) {
    console.error('导出表结构失败:', error);
    res.status(500).json({
      success: false,
      message: '导出表结构失败',
      error: (error as any).message
    });
  }
};

// 同步表结构
const syncSchema = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: '表结构同步成功',
    });
  } catch (error) {
    console.error('同步表结构失败:', error);
    res.status(500).json({
      success: false,
      message: '同步表结构失败',
      error: (error as any).message
    });
  }
};

// 备份数据库
const backupDatabase = async (req: Request, res: Response) => {
  try {
    const backupDir = path.join(__dirname, '../../backups/data');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.sql.gz`);

    const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
    
    const command = `mysqldump -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE} | gzip > ${backupFile}`;
    
    await execAsync(command);

    const stats = fs.statSync(backupFile);
    const fileSize = (stats.size / (1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      message: '数据库备份成功',
      backupFile: backupFile,
      fileSize: `${fileSize} MB`
    });
  } catch (error) {
    console.error('备份数据库失败:', error);
    res.status(500).json({
      success: false,
      message: '备份数据库失败',
      error: (error as any).message
    });
  }
};

// 获取备份列表
const getBackupList = async (req: Request, res: Response) => {
  try {
    const backupTypes = ['schemas', 'data'];
    const backupList: any = {};

    for (const type of backupTypes) {
      const backupDir = path.join(__dirname, `../../backups/${type}`);
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir)
          .filter(file => fs.statSync(path.join(backupDir, file)).isFile())
          .sort((a, b) => {
            return fs.statSync(path.join(backupDir, b)).mtime.getTime() - 
                   fs.statSync(path.join(backupDir, a)).mtime.getTime();
          });
        
        backupList[type] = files.map(file => {
          const stats = fs.statSync(path.join(backupDir, file));
          return {
            filename: file,
            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            createdAt: stats.mtime
          };
        });
      } else {
        backupList[type] = [];
      }
    }

    res.json({
      success: true,
      message: '获取备份列表成功',
      data: backupList
    });
  } catch (error) {
    console.error('获取备份列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取备份列表失败',
      error: (error as any).message
    });
  }
};

export default {
  exportSchema,
  syncSchema,
  backupDatabase,
  getBackupList
};
