import config from '../config';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

// 邮件服务类
class EmailService {
  private config = config.email;
  private client: any;

  constructor() {
    // 初始化腾讯云邮件客户端
    const SesClient = tencentcloud.ses.v20201002.Client;
    this.client = new SesClient({
      credential: {
        secretId: this.config.secretId,
        secretKey: this.config.secretKey,
      },
      region: this.config.region,
    });
  }

  /**
   * 发送注册成功邮件
   * @param toEmail 收件人邮箱
   * @param userName 用户名
   * @returns Promise<boolean> 发送是否成功
   */
  async sendRegisterSuccessEmail(toEmail: string, userName: string): Promise<boolean> {
    try {
      // 发送邮件
      const result = await this.client.SendEmail({
        FromEmailAddress: this.config.sender.email,
        Destination: {
          ToAddresses: [toEmail],
        },
        Template: {
          TemplateID: this.config.templates.registerSuccess,
          TemplateData: JSON.stringify({ userName }),
        },
      });

      console.log(`[邮件服务] 发送注册成功邮件到 ${toEmail}，用户：${userName}`);
      return true;
    } catch (error) {
      console.error('发送注册成功邮件失败:', error);
      return false;
    }
  }

  /**
   * 发送密码重置邮件
   * @param toEmail 收件人邮箱
   * @param resetLink 重置链接
   * @returns Promise<boolean> 发送是否成功
   */
  async sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
    try {
      // 发送邮件
      const result = await this.client.SendEmail({
        FromEmailAddress: this.config.sender.email,
        Destination: {
          ToAddresses: [toEmail],
        },
        Template: {
          TemplateID: this.config.templates.passwordReset,
          TemplateData: JSON.stringify({ resetLink }),
        },
      });

      console.log(`[邮件服务] 发送密码重置邮件到 ${toEmail}，重置链接：${resetLink}`);
      return true;
    } catch (error) {
      console.error('发送密码重置邮件失败:', error);
      return false;
    }
  }

  /**
   * 发送案件通知邮件
   * @param toEmail 收件人邮箱
   * @param caseInfo 案件信息
   * @returns Promise<boolean> 发送是否成功
   */
  async sendCaseNotificationEmail(toEmail: string, caseInfo: any): Promise<boolean> {
    try {
      // 发送邮件
      const result = await this.client.SendEmail({
        FromEmailAddress: this.config.sender.email,
        Destination: {
          ToAddresses: [toEmail],
        },
        Template: {
          TemplateID: this.config.templates.caseNotification,
          TemplateData: JSON.stringify(caseInfo),
        },
      });

      console.log(`[邮件服务] 发送案件通知邮件到 ${toEmail}，案件信息：${JSON.stringify(caseInfo)}`);
      return true;
    } catch (error) {
      console.error('发送案件通知邮件失败:', error);
      return false;
    }
  }
}

// 导出单例
export default new EmailService();
