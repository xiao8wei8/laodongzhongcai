import config from '../config';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

// 短信服务类
class SmsService {
  private config = config.sms;
  private client: any;

  constructor() {
    // 初始化腾讯云短信客户端
    const SmsClient = tencentcloud.sms.v20210111.Client;
    this.client = new SmsClient({
      credential: {
        secretId: this.config.secretId,
        secretKey: this.config.secretKey,
      },
      region: this.config.region,
    });
  }

  /**
   * 发送验证码短信
   * @param phone 手机号
   * @param code 验证码
   * @returns Promise<boolean> 发送是否成功
   */
  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    try {
      // 发送短信
      const result = await this.client.SendSms({
        SdkAppId: this.config.sdkAppId,
        SignName: this.config.signName,
        TemplateId: this.config.templateIds.verification,
        PhoneNumberSet: [phone],
        TemplateParamSet: [code],
      });

      console.log(`[短信服务] 发送验证码到 ${phone}: ${code}`);
      return true;
    } catch (error) {
      console.error('发送验证码失败:', error);
      return false;
    }
  }

  /**
   * 发送通知短信
   * @param phone 手机号
   * @param templateId 模板ID
   * @param params 模板参数
   * @returns Promise<boolean> 发送是否成功
   */
  async sendNotification(phone: string, templateId: string, params: string[]): Promise<boolean> {
    try {
      // 发送短信
      const result = await this.client.SendSms({
        SdkAppId: this.config.sdkAppId,
        SignName: this.config.signName,
        TemplateId: templateId,
        PhoneNumberSet: [phone],
        TemplateParamSet: params,
      });

      console.log(`[短信服务] 发送通知到 ${phone}，模板：${templateId}，参数：${params.join(', ')}`);
      return true;
    } catch (error) {
      console.error('发送通知失败:', error);
      return false;
    }
  }

  /**
   * 发送到访登记成功通知
   * @param phone 手机号
   * @param registerNumber 登记编号
   * @returns Promise<boolean> 发送是否成功
   */
  async sendVisitorRegisterSuccess(phone: string, registerNumber: string): Promise<boolean> {
    return this.sendNotification(phone, this.config.templateIds.notification, [registerNumber]);
  }

  /**
   * 发送案件状态变更通知
   * @param phone 手机号
   * @param caseNumber 案件编号
   * @param status 案件状态
   * @returns Promise<boolean> 发送是否成功
   */
  async sendCaseStatusChange(phone: string, caseNumber: string, status: string): Promise<boolean> {
    return this.sendNotification(phone, this.config.templateIds.notification, [caseNumber, status]);
  }
}

// 导出单例
export default new SmsService();
