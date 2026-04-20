import { useState, useEffect } from 'react';
import { Card, Form, Select, Switch, Button, message, Typography } from 'antd';
import { SettingOutlined, BellOutlined, MailOutlined, PhoneOutlined, CalendarOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

const { Option } = Select;

interface ReminderSetting {
  reminderTime: string;
  notificationChannels: {
    system: boolean;
    email: boolean;
    sms: boolean;
  };
  workdayOnly: boolean;
  caseReminderDays: number;
}

const ReminderSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<ReminderSetting>({
    reminderTime: '30min',
    notificationChannels: {
      system: true,
      email: true,
      sms: false
    },
    workdayOnly: true,
    caseReminderDays: 15
  });

  // 获取当前提醒设置
  const fetchReminderSetting = async () => {
    setLoading(true);
    try {
      const response = await api.get('/user/reminder/setting');
      setInitialValues(response.data.setting);
      form.setFieldsValue(response.data.setting);
    } catch (error) {
      message.error('获取提醒设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminderSetting();
  }, []);

  // 提交设置
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await api.put('/user/reminder/setting', values);
      message.success('提醒设置更新成功');
    } catch (error) {
      message.error('更新提醒设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <SettingOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>提醒设置</Title>
        </div>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={initialValues}
        >
          <Form.Item
            name="reminderTime"
            label="提醒时间"
            rules={[{ required: true, message: '请选择提醒时间' }]}
          >
            <Select style={{ width: '100%', maxWidth: 200 }} placeholder="请选择提醒时间">
              <Option value="15min">提前15分钟</Option>
              <Option value="30min">提前30分钟</Option>
              <Option value="1h">提前1小时</Option>
              <Option value="2h">提前2小时</Option>
              <Option value="1d">提前1天</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="提醒渠道"
          >
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 16, 
              marginBottom: 16,
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Form.Item
                  name={['notificationChannels', 'system']}
                  valuePropName="checked"
                  noStyle
                >
                  <Switch checkedChildren={<BellOutlined />} unCheckedChildren={<BellOutlined />} />
                </Form.Item>
                <span>系统通知</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Form.Item
                  name={['notificationChannels', 'email']}
                  valuePropName="checked"
                  noStyle
                >
                  <Switch checkedChildren={<MailOutlined />} unCheckedChildren={<MailOutlined />} />
                </Form.Item>
                <span>邮件提醒</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Form.Item
                  name={['notificationChannels', 'sms']}
                  valuePropName="checked"
                  noStyle
                >
                  <Switch checkedChildren={<PhoneOutlined />} unCheckedChildren={<PhoneOutlined />} />
                </Form.Item>
                <span>短信提醒</span>
              </div>
            </div>
          </Form.Item>

          <Form.Item
            name="workdayOnly"
            label="仅工作日提醒"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            name="caseReminderDays"
            label="案件提醒期限（天）"
            rules={[{ required: true, message: '请输入案件提醒期限' }]}
          >
            <Select style={{ width: '100%', maxWidth: 200 }} placeholder="请选择案件提醒期限">
              <Option value="7">7天</Option>
              <Option value="10">10天</Option>
              <Option value="15">15天</Option>
              <Option value="20">20天</Option>
              <Option value="30">30天</Option>
            </Select>
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
            >
              保存设置
            </Button>
          </div>
        </Form>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={3} style={{ marginBottom: 16 }}>提醒设置说明</Title>
        <ul style={{ lineHeight: '24px' }}>
          <li>系统通知：在系统内显示实时提醒</li>
          <li>邮件提醒：向您的注册邮箱发送提醒邮件</li>
          <li>短信提醒：向您的注册手机号发送提醒短信</li>
          <li>仅工作日提醒：仅在周一至周五发送提醒</li>
          <li>提醒时间：在日程开始前的指定时间发送提醒</li>
          <li>案件提醒期限：案件超过指定天数未处理且状态不是成功时，将自动标记为失败</li>
        </ul>
      </Card>
    </div>
  );
};

export default ReminderSettings;