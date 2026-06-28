import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as cron from 'node-cron';

const execAsync = promisify(exec);
const DATA_BACKUP_DIR = path.join(__dirname, '../../backups/data');
const SCHEMA_BACKUP_DIR = path.join(__dirname, '../../backups/schemas');

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const getMysqlConfig = () => {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  return {
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE
  };
};

export const exportSchemaFile = async () => {
  ensureDir(SCHEMA_BACKUP_DIR);
  const backupFile = path.join(SCHEMA_BACKUP_DIR, `schema_${new Date().toISOString().slice(0, 10)}.sql`);
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = getMysqlConfig();
  const command = `mysqldump -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD} --no-data ${MYSQL_DATABASE} > ${backupFile}`;
  await execAsync(command);
  return backupFile;
};

export const cleanupExpiredBackups = (dir: string, keepDays: number = 3) => {
  ensureDir(dir);
  const expireAt = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(dir).map((file) => path.join(dir, file));

  files.forEach((filePath) => {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && stats.mtime.getTime() < expireAt) {
        fs.unlinkSync(filePath);
      }
    } catch (_error) {}
  });
};

export const backupDatabaseToFile = async () => {
  ensureDir(DATA_BACKUP_DIR);
  const backupFile = path.join(DATA_BACKUP_DIR, `backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.sql.gz`);
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = getMysqlConfig();
  const command = `mysqldump --single-transaction -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE} | gzip > ${backupFile}`;
  await execAsync(command);
  cleanupExpiredBackups(DATA_BACKUP_DIR, 3);
  const stats = fs.statSync(backupFile);
  return {
    backupFile,
    fileSize: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`
  };
};

class BackupSchedulerService {
  private task: cron.ScheduledTask | null = null;

  start() {
    if (this.task) return;
    this.task = cron.schedule('30 2 * * *', async () => {
      try {
        await backupDatabaseToFile();
        console.log('数据库自动备份成功');
      } catch (error) {
        console.error('数据库自动备份失败:', error);
      }
    });
    console.log('数据库备份定时任务已启动');
  }

  stop() {
    this.task?.stop();
    this.task = null;
  }
}

export default new BackupSchedulerService();
