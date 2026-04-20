import { useState, useEffect } from 'react';
import { Card, Steps, Form, Input, Select, Button, message, Upload, Spin, Alert, Typography } from 'antd';
import { SaveOutlined, UploadOutlined, ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';

const { Title } = Typography;
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

const CaseApply: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);
  const navigate = useNavigate();
  const { isAuthenticated, userInfo } = useAuthStore();
  const [loading, setLoading] = useState(false);
  
  // 使用state保存所有表单数据
  const [formData, setFormData] = useState<any>({});

  // 组件挂载时，如果用户已登录，自动填充申请人信息
  useEffect(() => {
    if (isAuthenticated && userInfo) {
      const initialData = {
        applicantName: userInfo.name || '',
        applicantPhone: userInfo.phone || '',
        applicantEmail: userInfo.email || '',
        applicantIdCard: userInfo.idCard || ''
      };
      setFormData(initialData);
      form.setFieldsValue(initialData);
    }
  }, [isAuthenticated, userInfo, form]);

  // 步骤
  const steps = [
    { title: '身份信息', description: '填写申请人和被申请人信息' },
    { title: '案件信息', description: '填写案件基本信息' },
    { title: '争议详情', description: '填写争议事实和请求事项' },
    { title: '证据上传', description: '上传案件相关证据' },
    { title: '提交申请', description: '确认信息并提交申请' }
  ];

  // 争议类型选项
  const disputeTypeOptions = [
    { label: '工资纠纷', value: '工资纠纷' },
    { label: '加班纠纷', value: '加班纠纷' },
    { label: '社保纠纷', value: '社保纠纷' },
    { label: '工伤纠纷', value: '工伤纠纷' },
    { label: '解除劳动合同', value: '解除劳动合同' },
    { label: '其他纠纷', value: '其他纠纷' }
  ];

  // 被申请人类型选项
  const respondentTypeOptions = [
    { label: '个人', value: 'personal' },
    { label: '企业', value: 'company' }
  ];

  // 下一步
  const next = async () => {
    try {
      const values = await form.validateFields();
      // 保存当前步骤的数据
      setFormData(prev => ({ ...prev, ...values }));
      setCurrent(current + 1);
    } catch (error) {
      message.error('请填写必填字段');
    }
  };

  // 上一步
  const prev = () => {
    setCurrent(current - 1);
    // 重新填充表单数据
    setTimeout(() => {
      form.setFieldsValue(formData);
    }, 100);
  };

  // 提交申请
  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      console.log('开始提交申请');
      console.log('保存的表单数据:', formData);
      
      // 构建申请数据
      const applicationData = {
        applicantInfo: {
          name: formData.applicantName,
          phone: formData.applicantPhone,
          email: formData.applicantEmail,
          idCard: formData.applicantIdCard
        },
        respondentInfo: {
          name: formData.respondentName,
          phone: formData.respondentPhone,
          email: formData.respondentEmail,
          idCard: formData.respondentIdCard,
          type: formData.respondentType
        },
        disputeType: formData.disputeType,
        caseAmount: formData.caseAmount,
        requestItems: formData.requestItems,
        factsReasons: formData.factsReasons
      };
      
      console.log('构建的申请数据:', applicationData);
      
      const response = await api.post('/application', applicationData);
      console.log('申请提交成功，返回的数据:', response.data);
      message.success('申请提交成功，案件编号：' + response.data.caseNumber);
      
      // 重置表单
      form.resetFields();
      setCurrent(0);
      setEvidenceFiles([]);
      setFormData({});
      
      // 跳转到案件查询页面
      navigate('/case-query');
    } catch (error: any) {
      console.error('提交申请失败:', error);
      console.error('错误详情:', error.response?.data);
      message.error('申请提交失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 处理文件上传
  const handleUpload = (file: any) => {
    setEvidenceFiles([...evidenceFiles, file]);
    return false; // 阻止自动上传
  };

  // 移除文件
  const handleRemove = (file: any) => {
    setEvidenceFiles(evidenceFiles.filter(item => item.uid !== file.uid));
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <>
            <h3>申请人信息</h3>
            <Form.Item
              name="applicantName"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item
              name="applicantPhone"
              label="联系电话"
              rules={[{ required: true, message: '请输入联系电话' }]}
            >
              <Input placeholder="请输入联系电话" />
            </Form.Item>
            <Form.Item
              name="applicantEmail"
              label="电子邮箱"
            >
              <Input placeholder="请输入电子邮箱" />
            </Form.Item>
            <Form.Item
              name="applicantIdCard"
              label="身份证号"
              rules={[{ required: true, message: '请输入身份证号' }]}
            >
              <Input placeholder="请输入身份证号" />
            </Form.Item>

            <h3>被申请人信息</h3>
            <Form.Item
              name="respondentType"
              label="类型"
              rules={[{ required: true, message: '请选择类型' }]}
            >
              <Select placeholder="请选择被申请人类型">
                {respondentTypeOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="respondentName"
              label="姓名/单位名称"
              rules={[{ required: true, message: '请输入姓名或单位名称' }]}
            >
              <Input placeholder="请输入姓名或单位名称" />
            </Form.Item>
            <Form.Item
              name="respondentPhone"
              label="联系电话"
              rules={[{ required: true, message: '请输入联系电话' }]}
            >
              <Input placeholder="请输入联系电话" />
            </Form.Item>
            <Form.Item
              name="respondentEmail"
              label="电子邮箱"
            >
              <Input placeholder="请输入电子邮箱" />
            </Form.Item>
            <Form.Item
              name="respondentIdCard"
              label="身份证号/统一社会信用代码"
              rules={[{ required: true, message: '请输入身份证号或统一社会信用代码' }]}
            >
              <Input placeholder="请输入身份证号或统一社会信用代码" />
            </Form.Item>
          </>
        );
      case 1:
        return (
          <>
            <Form.Item
              name="disputeType"
              label="争议类型"
              rules={[{ required: true, message: '请选择争议类型' }]}
            >
              <Select placeholder="请选择争议类型">
                {disputeTypeOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="caseAmount"
              label="涉案金额"
              rules={[{ required: true, message: '请输入涉案金额' }]}
            >
              <Input type="number" placeholder="请输入涉案金额" addonBefore="¥" />
            </Form.Item>
          </>
        );
      case 2:
        return (
          <>
            <Form.Item
              name="requestItems"
              label="请求事项"
              rules={[{ required: true, message: '请填写请求事项' }]}
            >
              <TextArea rows={4} placeholder="请详细填写请求事项" />
            </Form.Item>
            <Form.Item
              name="factsReasons"
              label="事实与理由"
              rules={[{ required: true, message: '请填写事实与理由' }]}
            >
              <TextArea rows={6} placeholder="请详细填写事实与理由" />
            </Form.Item>
          </>
        );
      case 3:
        return (
          <>
            <Card title="证据上传">
              <Dragger
                name="files"
                multiple
                beforeUpload={handleUpload}
                onRemove={handleRemove}
                fileList={evidenceFiles}
                listType="picture"
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持上传图片、PDF、Word等文件，单个文件不超过10MB
                </p>
              </Dragger>
            </Card>
          </>
        );
      case 4:
        return (
          <Card title="申请确认">
            <p>请确认以下信息是否正确：</p>
            <p><strong>申请人：</strong>{form.getFieldValue('applicantName')} ({form.getFieldValue('applicantPhone')})</p>
            <p><strong>被申请人：</strong>{form.getFieldValue('respondentName')} ({form.getFieldValue('respondentPhone')})</p>
            <p><strong>争议类型：</strong>{form.getFieldValue('disputeType')}</p>
            <p><strong>涉案金额：</strong>¥{form.getFieldValue('caseAmount')}</p>
            <p><strong>请求事项：</strong>{form.getFieldValue('requestItems')}</p>
            <p><strong>事实与理由：</strong>{form.getFieldValue('factsReasons')}</p>
            <p><strong>证据数量：</strong>{evidenceFiles.length} 个</p>
          </Card>
        );
      default:
        return null;
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 8 }}>
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 8 }}>
            返回
          </Button>
          <EditOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px' }}>申请调解</Title>
        </div>
      </div>
      
      {!isAuthenticated ? (
        <Alert
          message="请先登录"
          description="提交调解申请需要先登录，请登录后再操作。"
          type="warning"
          action={
            <Button type="primary" size="small" onClick={() => navigate('/login')}>
              去登录
            </Button>
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <>
          <Steps 
            current={current} 
            style={{ marginBottom: 16 }}
            size="small"
          >
            {steps.map((step, index) => (
              <Step 
                key={index} 
                title={step.title} 
                description={step.description} 
              />
            ))}
          </Steps>
          
          <Card>
            <Form form={form} layout="vertical">
              {renderStepContent()}
              
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                {current > 0 && (
                  <Button onClick={prev} size="small">
                    上一步
                  </Button>
                )}
                {current < steps.length - 1 ? (
                  <Button type="primary" onClick={next} size="small">
                    下一步
                  </Button>
                ) : (
                  <Button 
                    type="primary" 
                    onClick={handleSubmit} 
                    loading={submitLoading}
                    icon={<SaveOutlined />}
                    size="small"
                  >
                    提交申请
                  </Button>
                )}
              </div>
            </Form>
          </Card>
        </>
      )}
    </div>
  );
};

export default CaseApply;