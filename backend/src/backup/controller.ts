import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import config from '../config';
import { backupDatabaseToFile, exportSchemaFile } from './service';
import { writeOperationLog } from '../utils/audit';

// 导出表结构
const exportSchema = async (req: Request, res: Response) => {
  try {
    const backupFile = await exportSchemaFile();

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
    const { backupFile, fileSize } = await backupDatabaseToFile();
    await writeOperationLog({
      req,
      module: 'backup',
      action: 'backup_database',
      targetType: 'database',
      targetDisplay: path.basename(backupFile),
      result: 'success',
      detail: `数据库备份成功，文件大小 ${fileSize}`
    });

    res.json({
      success: true,
      message: '数据库备份成功',
      backupFile,
      fileSize
    });
  } catch (error) {
    console.error('备份数据库失败:', error);
    await writeOperationLog({
      req,
      module: 'backup',
      action: 'backup_database',
      targetType: 'database',
      result: 'failed',
      errorMessage: (error as any).message || '数据库备份失败'
    });
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
