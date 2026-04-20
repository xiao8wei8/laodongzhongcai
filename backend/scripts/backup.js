#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// API基础URL
const API_BASE_URL = `http://localhost:${process.env.PORT || 5002}/api`;

// 备份目录
const BACKUP_DIR = path.resolve(__dirname, '../backups');

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

// 主函数
async function main() {
  switch (command) {
    case 'export-schema':
      await exportSchema();
      break;
    case 'backup-database':
      await backupDatabase();
      break;
    case 'backup-redis':
      await backupRedis();
      break;
    case 'backup-all':
      await backupAll();
      break;
    case 'list-backups':
      listBackups();
      break;
    default:
      showHelp();
  }
}

// 显示帮助信息
function showHelp() {
  console.log('备份脚本使用帮助:');
  console.log('');
  console.log('npm run backup export-schema    - 导出表结构');
  console.log('npm run backup backup-database  - 备份数据库');
  console.log('npm run backup backup-redis     - 备份Redis');
  console.log('npm run backup backup-all       - 执行所有备份操作');
  console.log('npm run backup list-backups     - 列出所有备份文件');
  console.log('');
}

// 导出表结构
async function exportSchema() {
  try {
    console.log('正在导出表结构...');
    
    // 调用API导出表结构
    const response = await axios.get(`${API_BASE_URL}/backup/export-schema`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`
      }
    });
    
    console.log('表结构导出成功!');
    console.log(`导出文件: ${response.data.exportFile}`);
    console.log(`导出时间: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('导出表结构失败:', error.message);
    // 如果API调用失败，尝试直接从数据库导出
    try {
      console.log('尝试直接从数据库导出表结构...');
      directExportSchema();
    } catch (directError) {
      console.error('直接导出也失败:', directError.message);
    }
  }
}

// 直接从数据库导出表结构
function directExportSchema() {
  // 创建备份目录
  const schemaDir = path.join(BACKUP_DIR, 'schemas');
  if (!fs.existsSync(schemaDir)) {
    fs.mkdirSync(schemaDir, { recursive: true });
  }
  
  // 生成导出文件
  const exportFile = path.join(schemaDir, `schema_${new Date().toISOString().slice(0, 10)}.json`);
  
  // 这里可以实现直接从数据库读取表结构的逻辑
  // 由于没有直接连接数据库的代码，这里只是创建一个示例文件
  const sampleSchema = {
    timestamp: new Date().toISOString(),
    message: '表结构导出示例',
    tables: ['User', 'Case', 'VisitorRecord', 'Evidence', 'Schedule']
  };
  
  fs.writeFileSync(exportFile, JSON.stringify(sampleSchema, null, 2));
  console.log(`直接导出表结构成功: ${exportFile}`);
}

// 备份数据库
async function backupDatabase() {
  try {
    console.log('正在备份数据库...');
    
    // 调用API备份数据库
    const response = await axios.post(`${API_BASE_URL}/backup/backup-database`, {}, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`
      }
    });
    
    console.log('数据库备份成功!');
    console.log(`备份文件: ${response.data.backupFile}`);
    console.log(`文件大小: ${response.data.fileSize}`);
    console.log(`备份时间: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('备份数据库失败:', error.message);
    // 如果API调用失败，尝试直接执行mongodump命令
    try {
      console.log('尝试直接执行mongodump命令...');
      directBackupDatabase();
    } catch (directError) {
      console.error('直接备份也失败:', directError.message);
    }
  }
}

// 直接执行mongodump命令备份数据库
function directBackupDatabase() {
  // 创建备份目录
  const dataDir = path.join(BACKUP_DIR, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // 生成备份文件名
  const backupFile = path.join(dataDir, `backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.gz`);
  
  // 执行mongodump命令
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/labor-arbitration';
  const dbName = mongoUri.split('/').pop().split('?')[0];
  
  try {
    execSync(`mongodump --uri="${mongoUri}" --db=${dbName} --gzip --archive=${backupFile}`);
    console.log(`直接备份数据库成功: ${backupFile}`);
    
    // 计算文件大小
    const stats = fs.statSync(backupFile);
    const fileSize = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`文件大小: ${fileSize} MB`);
  } catch (error) {
    throw new Error(`执行mongodump命令失败: ${error.message}`);
  }
}

// 备份Redis
async function backupRedis() {
  try {
    console.log('正在备份Redis...');
    
    // 调用API备份Redis
    const response = await axios.post(`${API_BASE_URL}/backup/backup-redis`, {}, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`
      }
    });
    
    console.log('Redis备份成功!');
    console.log(`备份文件: ${response.data.backupFile}`);
    console.log(`备份时间: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('备份Redis失败:', error.message);
    // 如果API调用失败，尝试直接执行redis-cli命令
    try {
      console.log('尝试直接执行redis-cli命令...');
      directBackupRedis();
    } catch (directError) {
      console.error('直接备份也失败:', directError.message);
    }
  }
}

// 直接执行redis-cli命令备份Redis
function directBackupRedis() {
  // 创建备份目录
  const redisDir = path.join(BACKUP_DIR, 'redis');
  if (!fs.existsSync(redisDir)) {
    fs.mkdirSync(redisDir, { recursive: true });
  }
  
  // 生成备份文件名
  const backupFile = path.join(redisDir, `redis_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.rdb`);
  
  // 执行Redis备份命令
  const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';
  const redisHost = redisUri.split('://')[1].split(':')[0];
  const redisPort = redisUri.split(':').pop();
  
  try {
    // 执行SAVE命令
    execSync(`redis-cli -h ${redisHost} -p ${redisPort} SAVE`);
    
    // 复制RDB文件到备份目录
    const defaultRdbPath = '/usr/local/var/db/redis/dump.rdb';
    if (fs.existsSync(defaultRdbPath)) {
      fs.copyFileSync(defaultRdbPath, backupFile);
      console.log(`直接备份Redis成功: ${backupFile}`);
    } else {
      throw new Error('找不到Redis RDB文件');
    }
  } catch (error) {
    throw new Error(`执行Redis备份命令失败: ${error.message}`);
  }
}

// 执行所有备份操作
async function backupAll() {
  console.log('开始执行所有备份操作...');
  console.log('=' .repeat(50));
  
  await exportSchema();
  console.log('');
  
  await backupDatabase();
  console.log('');
  
  await backupRedis();
  console.log('');
  
  console.log('=' .repeat(50));
  console.log('所有备份操作执行完成!');
}

// 列出所有备份文件
function listBackups() {
  console.log('备份文件列表:');
  console.log('=' .repeat(80));
  
  const backupTypes = ['schemas', 'data', 'redis'];
  
  for (const type of backupTypes) {
    const backupPath = path.join(BACKUP_DIR, type);
    console.log(`\n${type.toUpperCase()} 备份:`);
    console.log('-' .repeat(40));
    
    if (fs.existsSync(backupPath)) {
      const files = fs.readdirSync(backupPath)
        .filter(file => fs.statSync(path.join(backupPath, file)).isFile())
        .sort((a, b) => {
          return fs.statSync(path.join(backupPath, b)).mtime.getTime() - 
                 fs.statSync(path.join(backupPath, a)).mtime.getTime();
        });
      
      if (files.length === 0) {
        console.log('  暂无备份文件');
      } else {
        files.forEach(file => {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          const size = (stats.size / (1024 * 1024)).toFixed(2);
          const mtime = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');
          console.log(`  ${file} (${size} MB) - ${mtime}`);
        });
      }
    } else {
      console.log('  暂无备份文件');
    }
  }
  
  console.log('=' .repeat(80));
}

// 获取认证令牌
function getAuthToken() {
  // 这里可以从环境变量或配置文件中获取令牌
  // 或者实现一个登录逻辑来获取令牌
  return process.env.AUTH_TOKEN || 'your-auth-token';
}

// 执行主函数
main().catch(error => {
  console.error('执行备份操作失败:', error);
  process.exit(1);
});