import React from 'react';
import { Form, Input, Select, Button, message } from 'antd';
import { UserOutlined, PhoneOutlined, MessageOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;

interface VisitorFormProps {
  onSubmitSuccess?: () => void;
}

const VisitorForm: React.FC<VisitorFormProps> = ({ onSubmitSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await api.post('/visitor', {
        visitorName: values.visitorName,
        phone: values.phone,
        visitType: values.visitType,
        disputeType: values.disputeType,
        reason: values.reason,
      });
      message.success(`登记成功，编号：${response.data.registerNumber}`);
      form.resetFields();
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      message.error('登记失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      name="visitor"
      onFinish={onFinish}
      layout="vertical"
      size="middle"
    >
      <Form.Item
        name="visitorName"
        label="来访者姓名"
        rules={[{ required: true, message: '请输入来访者姓名' }]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入来访者姓名"
        />
      </Form.Item>

      <Form.Item
        name="phone"
        label="联系方式"
        rules={[{ required: true, message: '请输入联系方式' }]}
      >
        <Input
          prefix={<PhoneOutlined />}
          placeholder="请输入手机号码"
        />
      </Form.Item>

      <Form.Item
        name="visitType"
        label="来访类型"
        rules={[{ required: true, message: '请选择来访类型' }]}
      >
        <Select placeholder="请选择来访类型">
          <Option value="visit">现场来访</Option>
          <Option value="phone">电话咨询</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="disputeType"
        label="争议类别"
        rules={[{ required: true, message: '请选择争议类别' }]}
      >
        <Select placeholder="请选择争议类别">
          <Option value="wage">工资争议</Option>
          <Option value="contract">劳动合同争议</Option>
          <Option value="social">社会保险争议</Option>
          <Option value="compensation">工伤赔偿争议</Option>
          <Option value="other">其他争议</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="reason"
        label="事由描述"
        rules={[{ required: true, message: '请描述来访事由' }]}
      >
        <Input.TextArea
          prefix={<MessageOutlined />}
          placeholder="请详细描述来访事由"
          rows={4}
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          style={{ width: '100%' }}
        >
          提交登记
        </Button>
      </Form.Item>
    </Form>
  );
};

export default VisitorForm;
