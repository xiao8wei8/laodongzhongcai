import { useState, useEffect } from 'react';
import { Card, Steps, Form, Input, Select, Button, message, Upload, Alert, Typography, Space, Tag, Row, Col, Statistic, Avatar, Modal } from 'antd';
import { SaveOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { PageHero, PageSectionCard, PageShell } from '../components/common/PageKit';
import type { UploadFile } from 'antd/es/upload/interface';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;
const { Text } = Typography;

interface TenantOption {
  id: string;
  tenantName: string;
}

const isImageFile = (file: UploadFile) => {
  const fileType = file.type || '';
  const fileName = String(file.name || '').toLowerCase();
  return fileType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileName);
};

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
});

const CaseApply: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, userInfo } = useAuthStore();
  
  // 使用state保存所有表单数据
  const [formData, setFormData] = useState<any>({});

  const isSuperAdmin = !!userInfo?.isSuperAdmin || userInfo?.role === 'superadmin';

  const fetchTenants = async () => {
    try {
      const response = await api.get('/tenant');
      setTenants(response.data.tenants || []);
    } catch (_error) {
      setTenants([]);
    }
  };

  // 组件挂载时，如果用户已登录，自动填充申请人信息
  useEffect(() => {
    if (isAuthenticated && userInfo) {
      const initialData = {
        applicantName: userInfo.name || '',
        applicantPhone: userInfo.phone || '',
        applicantIdCard: (userInfo as any).idCard || '',
        tenantId: userInfo.tenantId || undefined
      };
      setFormData(initialData);
      form.setFieldsValue(initialData);
    }
  }, [isAuthenticated, userInfo, form]);

  useEffect(() => {
    fetchTenants();
  }, []);

  // 步骤
  const steps = [
    { title: '身份信息', description: '填写申请人和被申请人信息' },
    { title: '案件信息', description: '填写案件基本信息' },
    { title: '争议详情', description: '填写争议事实和请求事项' },
    { title: '证据上传', description: '上传案件相关证据' },
    { title: '登记确认', description: '确认信息并完成登记' }
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
          idCard: formData.applicantIdCard
        },
        respondentInfo: {
          name: formData.respondentName,
          phone: formData.respondentPhone,
          idCard: formData.respondentIdCard,
          type: formData.respondentType
        },
        tenantId: formData.tenantId,
        disputeType: formData.disputeType,
        caseAmount: formData.caseAmount,
        requestItems: formData.requestItems,
        factsReasons: formData.factsReasons
      };
      
      console.log('构建的申请数据:', applicationData);
      
      const response = await api.post('/application', applicationData);
      console.log('申请提交成功，返回的数据:', response.data);
      message.success('登记提交成功，案件编号：' + response.data.caseNumber);
      
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
      message.error(error.response?.data?.message || '登记提交失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 处理文件上传
  const handleUpload = (file: UploadFile) => {
    setEvidenceFiles((prev) => [...prev, file]);
    return false; // 阻止自动上传
  };

  // 移除文件
  const handleRemove = (file: UploadFile) => {
    setEvidenceFiles((prev) => prev.filter(item => item.uid !== file.uid));
  };

  const handlePreview = async (file: UploadFile) => {
    if (isImageFile(file)) {
      let previewUrl = file.url || '';
      if (!previewUrl && typeof file.thumbUrl === 'string') {
        previewUrl = file.thumbUrl;
      }
      if (!previewUrl && file.originFileObj) {
        previewUrl = await fileToDataUrl(file.originFileObj as File);
      }
      if (previewUrl) {
        setPreviewImage(previewUrl);
        setPreviewTitle(file.name || '图片预览');
        setPreviewVisible(true);
        return;
      }
    }

    if (file.originFileObj) {
      const objectUrl = URL.createObjectURL(file.originFileObj as File);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    message.info('当前文件暂不支持预览');
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>申请人信息</div>
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
              name="applicantIdCard"
              label="身份证号"
              rules={[{ required: true, message: '请输入身份证号' }]}
            >
              <Input placeholder="请输入身份证号" />
            </Form.Item>

            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>被申请人信息</div>
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
              name="tenantId"
              label="受理街道"
              rules={[{ required: true, message: '请选择受理街道' }]}
              extra={isSuperAdmin ? '请选择本次登记要归属的街道。' : '默认使用当前账号所属街道。'}
            >
              <Select
                placeholder="请选择受理街道"
                disabled={!isSuperAdmin && !!userInfo?.tenantId}
                showSearch
                optionFilterProp="children"
              >
                {tenants.map((tenant) => (
                  <Option key={tenant.id} value={tenant.id}>
                    {tenant.tenantName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
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
                onPreview={handlePreview}
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
            <Card title="登记确认" bordered={false} style={{ background: '#f8fbff', borderRadius: 16 }}>
            <p>请确认以下信息是否正确：</p>
            <p><strong>申请人：</strong>{form.getFieldValue('applicantName')} ({form.getFieldValue('applicantPhone')})</p>
            <p><strong>被申请人：</strong>{form.getFieldValue('respondentName')} ({form.getFieldValue('respondentPhone')})</p>
            <p><strong>受理街道：</strong>{tenants.find(item => item.id === form.getFieldValue('tenantId'))?.tenantName || userInfo?.tenantName || '未选择'}</p>
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

  return (
    <PageShell>
      <PageHero
        tone="teal"
        icon={<EditOutlined />}
        title="到访登记"
        description="用于快速录入来访咨询或调解登记信息。先完成基础信息，再逐步补充争议详情和材料。"
        tags={
          <>
            <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>分步录入</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>完成后进入案件流转</Tag>
          </>
        }
        note={
          <Alert
            type="info"
            showIcon
            message="登记建议"
            description="优先填写基础身份信息和争议类型；事实与理由尽量写清时间、经过和核心诉求，后续处理会更顺。"
          />
        }
        metrics={
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>当前步骤</span>} value={current + 1} suffix={`/ ${steps.length}`} valueStyle={{ color: '#fff' }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>已上传材料</span>} value={evidenceFiles.length} valueStyle={{ color: '#fff' }} />
              </Card>
            </Col>
          </Row>
        }
      />

      {!isAuthenticated ? (
        <Alert
          message="请先登录"
          description="提交登记信息需要先登录，请登录后再操作。"
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
        <div style={{ display: 'grid', gap: 20 }}>
          <PageSectionCard title="登记步骤">
            <Steps current={current} size="small">
              {steps.map((step, index) => (
                <Step key={index} title={step.title} description={step.description} />
              ))}
            </Steps>
          </PageSectionCard>

          <PageSectionCard
            title={steps[current]?.title || '到访登记'}
            extra={
              <Space wrap>
                <Avatar size={32} icon={<EditOutlined />} style={{ background: '#e6f4ff', color: '#1677ff' }} />
                <Text type="secondary">{steps[current]?.description}</Text>
              </Space>
            }
          >
            <Form form={form} layout="vertical">
              {renderStepContent()}

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  {current > 0 && (
                    <Button onClick={prev}>
                      上一步
                    </Button>
                  )}
                </div>
                <div>
                  {current < steps.length - 1 ? (
                    <Button type="primary" onClick={next}>
                      下一步
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={handleSubmit}
                      loading={submitLoading}
                      icon={<SaveOutlined />}
                    >
                      完成登记
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          </PageSectionCard>
        </div>
      )}
      <Modal open={previewVisible} title={previewTitle} footer={null} onCancel={() => setPreviewVisible(false)} width={720}>
        <img src={previewImage} alt={previewTitle} style={{ width: '100%' }} />
      </Modal>
    </PageShell>
  );
};

export default CaseApply;
