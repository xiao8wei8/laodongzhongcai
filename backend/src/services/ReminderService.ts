import * as cron from 'node-cron';
import Schedule from '../models/Schedule';
import User from '../models/User';
import ReminderSetting from '../models/ReminderSetting';
import Case from '../models/Case';
import { io } from '../server';
import notificationService from './NotificationService';

class ReminderService {
  private reminderTask: cron.ScheduledTask | null = null;

  // 启动提醒服务
  start() {
    // 每天凌晨 8 点检查当天的日程
    this.reminderTask = cron.schedule('0 8 * * *', async () => {
      await this.checkTodaySchedules();
    });

    // 每小时检查待处理案件和超过期限的案件
    cron.schedule('0 * * * *', async () => {
      await this.checkPendingCases();
      await this.checkOverdueCases();
    });

    console.log('提醒服务已启动');
  }

  // 停止提醒服务
  stop() {
    if (this.reminderTask) {
      this.reminderTask.stop();
      console.log('提醒服务已停止');
    }
  }

  // 检查当天的日程并发送提醒
  private async checkTodaySchedules() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // 查找今天的所有日程
      const todaySchedules = await Schedule.find({
        date: {
          $gte: today,
          $lt: tomorrow
        }
      }).populate('createdBy', 'name');

      // 发送提醒
    for (const schedule of todaySchedules) {
      await this.sendReminder(schedule);
    }
    } catch (error) {
      console.error('检查日程提醒失败:', error);
    }
  }

  // 发送提醒
  private async sendReminder(schedule: any) {
    try {
      // 获取创建日程的用户信息
      const user = await User.findById(schedule.createdBy);
      if (user) {
        // 获取用户的提醒设置
        const setting = await ReminderSetting.findOne({ userId: user._id });
        
        // 检查是否仅工作日提醒
        if (setting?.workdayOnly) {
          const scheduleDate = new Date(schedule.date);
          const dayOfWeek = scheduleDate.getDay();
          // 0 是周日，6 是周六
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log(`跳过非工作日提醒: ${schedule.title} - ${scheduleDate.toLocaleString()}`);
            return;
          }
        }
        
        // 1. 通过 Socket.IO 发送实时提醒
        if (!setting || (setting.notificationChannels && setting.notificationChannels.system)) {
          io.emit('scheduleReminder', {
            scheduleId: schedule._id,
            title: schedule.title,
            date: schedule.date,
            caseId: schedule.caseId,
            category: schedule.category,
            createdBy: schedule.createdBy.name
          });
        }

        // 2. 发送邮件和短信提醒
        if (setting) {
          await notificationService.sendMultiChannelReminder(user, schedule);
        }

        console.log(`发送日程提醒: ${schedule.title} - ${new Date(schedule.date).toLocaleString()}`);
      }
    } catch (error) {
      console.error('发送多渠道提醒失败:', error);
    }
  }

  // 检查待处理案件并发送提醒
  private async checkPendingCases() {
    try {
      // 查找所有待处理的案件
      const pendingCases = await Case.find({ status: 'pending' }).populate('mediatorId', 'name');

      for (const caseObj of pendingCases) {
        if (caseObj.mediatorId) {
          // 发送提醒给调解员
          io.emit('caseReminder', {
            caseId: caseObj._id,
            caseNumber: caseObj.caseNumber,
            message: '案件状态为待处理，需要确认双方调解意向',
            mediatorId: caseObj.mediatorId._id
          });

          console.log(`发送案件提醒: ${caseObj.caseNumber} - 待处理状态`);
        }
      }
    } catch (error) {
      console.error('检查待处理案件失败:', error);
    }
  }

  // 检查超过期限的案件并自动改为失败状态
  private async checkOverdueCases() {
    try {
      // 获取默认的提醒天数，或者从系统设置中获取
      const defaultSetting = await ReminderSetting.findOne({});
      const reminderDays = defaultSetting?.caseReminderDays || 15;

      // 计算期限日期
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() - reminderDays);

      // 查找超过期限且状态不是成功的案件
      const overdueCases = await Case.find({
        status: { $ne: 'completed' },
        createdAt: { $lt: deadlineDate }
      });

      for (const caseObj of overdueCases) {
        // 将案件状态改为失败
        caseObj.status = 'failed';
        caseObj.closeTime = new Date();
        await caseObj.save();

        // 发送提醒
        if (caseObj.mediatorId) {
          io.emit('caseOverdue', {
            caseId: caseObj._id,
            caseNumber: caseObj.caseNumber,
            message: `案件已超过${reminderDays}天未处理，已自动标记为失败`,
            mediatorId: caseObj.mediatorId
          });
        }

        console.log(`自动处理超过期限案件: ${caseObj.caseNumber} - 改为失败状态`);
      }
    } catch (error) {
      console.error('检查超过期限案件失败:', error);
    }
  }


}

// 导出单例
const reminderService = new ReminderService();
export default reminderService;