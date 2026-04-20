import { Request, Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import config from '../config';

// 导出表结构
const exportSchema = async (req: Request, res: Response) => {
  try {
    // 获取所有模型
    const models: any = mongoose.models;
    const schemas: any = {};

    // 遍历所有模型，提取schema信息
    for (const modelName in models) {
      const model = models[modelName];
      const schema = model.schema;
      
      // 提取schema字段信息
      const fields: any = {};
      for (const [fieldName, field] of Object.entries(schema.paths)) {
        // 跳过内部字段
        if (fieldName === '_id' || fieldName === '__v') continue;
        
        const fieldType = (field as any).instance;
        const fieldOptions = (field as any).options || {};
        
        fields[fieldName] = {
          type: fieldType,
          required: fieldOptions.required || false,
          unique: fieldOptions.unique || false,
          default: fieldOptions.default,
          enum: fieldOptions.enum,
          ref: fieldOptions.ref
        };
      }
      
      schemas[modelName] = {
        fields,
        indexes: schema.indexes()
      };
    }

    // 生成导出文件
    const exportPath = path.join(__dirname, '../../backups/schemas');
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    const exportFile = path.join(exportPath, `schema_${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(exportFile, JSON.stringify(schemas, null, 2));

    res.json({
      success: true,
      message: '表结构导出成功',
      data: schemas,
      exportFile: exportFile
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
    const { schemaData } = req.body;
    
    if (!schemaData) {
      return res.status(400).json({
        success: false,
        message: '请提供表结构数据'
      });
    }

    // 这里可以实现表结构同步逻辑
    // 1. 比较本地和提供的表结构
    // 2. 生成并执行迁移脚本
    // 3. 应用变更

    res.json({
      success: true,
      message: '表结构同步成功',
      data: schemaData
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
    // 创建备份目录
    const backupPath = path.join(__dirname, '../../backups/data');
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // 生成备份文件名
    const backupFile = path.join(backupPath, `backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.gz`);

    // 使用mongodump命令备份数据库
    const mongoUri = config.mongoUri;
    const dbName = mongoUri.split('/').pop()?.split('?')[0] || 'labor-arbitration';
    
    // 执行mongodump命令
    execSync(`mongodump --uri="${mongoUri}" --db=${dbName} --gzip --archive=${backupFile}`);

    // 计算文件大小
    const stats = fs.statSync(backupFile);
    const fileSize = stats.size / (1024 * 1024); // MB

    res.json({
      success: true,
      message: '数据库备份成功',
      backupFile: backupFile,
      fileSize: `${fileSize.toFixed(2)} MB`
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
      const backupPath = path.join(__dirname, `../../backups/${type}`);
      if (fs.existsSync(backupPath)) {
        const files = fs.readdirSync(backupPath)
          .filter(file => fs.statSync(path.join(backupPath, file)).isFile())
          .sort((a, b) => {
            return fs.statSync(path.join(backupPath, b)).mtime.getTime() - 
                   fs.statSync(path.join(backupPath, a)).mtime.getTime();
          });
        
        backupList[type] = files.map(file => {
          const stats = fs.statSync(path.join(backupPath, file));
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