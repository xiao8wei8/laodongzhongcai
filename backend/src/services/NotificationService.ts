import nodemailer from 'nodemailer';

class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  // 初始化邮件服务
  initEmailService() {
    // 这里使用测试邮件服务，实际项目中应该使用真实的邮件服务配置
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'test@example.com',
        pass: 'testpassword'
      }
    });

    console.log('邮件服务已初始化');
  }

  // 发送邮件提醒
  async sendEmailReminder(email: string, schedule: any) {
    if (!this.transporter) {
      this.initEmailService();
    }

    try {
      const info = await this.transporter?.sendMail({
        from: '"劳动仲裁调解系统" <no-reply@laodongzhongcai.com>',
        to: email,
        subject: `日程提醒：${schedule.title}`,
        text: `尊敬的用户，您有一条日程提醒：

日程标题：${schedule.title}
日期：${new Date(schedule.date).toLocaleString()}
分类：${schedule.category}
案件编号：${schedule.caseNumber}

请准时参加相关活动。`,
        html: `<p>尊敬的用户，您有一条日程提醒：</p>
        <p><strong>日程标题：</strong>${schedule.title}</p>
        <p><strong>日期：</strong>${new Date(schedule.date).toLocaleString()}</p>
        <p><strong>分类：</strong>${schedule.category}</p>
        <p><strong>案件编号：</strong>${schedule.caseNumber}</p>
        <p>请准时参加相关活动。</p>`
      });

      console.log('邮件发送成功:', info?.messageId);
      return true;
    } catch (error) {
      console.error('邮件发送失败:', error);
      return false;
    }
  }

  // 发送短信提醒
  async sendSmsReminder(phone: string, schedule: any) {
    // 这里使用模拟短信服务，实际项目中应该集成真实的短信API
    try {
      // 模拟短信发送
      console.log(`发送短信到 ${phone}：您有一条日程提醒：${schedule.title}，时间：${new Date(schedule.date).toLocaleString()}`);
      
      // 实际项目中，这里应该调用短信API，例如：
      // const response = await axios.post('https://api.sms-service.com/send', {
      //   phone,
      //   message: `您有一条日程提醒：${schedule.title}，时间：${new Date(schedule.date).toLocaleString()}`
      // });
      
      return true;
    } catch (error) {
      console.error('短信发送失败:', error);
      return false;
    }
  }

  // 发送多渠道提醒
  async sendMultiChannelReminder(user: any, schedule: any) {
    const reminders = [];

    // 发送邮件提醒（如果用户有邮箱）
    if (user.email) {
      reminders.push(this.sendEmailReminder(user.email, schedule));
    }

    // 发送短信提醒（如果用户有手机号）
    if (user.phone) {
      reminders.push(this.sendSmsReminder(user.phone, schedule));
    }

    // 等待所有提醒发送完成
    const results = await Promise.all(reminders);
    return results.every(result => result);
  }
}

// 导出单例
const notificationService = new NotificationService();
export default notificationService;