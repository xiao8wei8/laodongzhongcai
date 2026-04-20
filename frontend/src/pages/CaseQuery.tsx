import { useState, useEffect } from 'react';
import { Table, Input, Button, message, Modal, Form, Select, Typography } from 'antd';
import { SearchOutlined, CommentOutlined, FileTextOutlined, PlusOutlined, FileSearchOutlined } from '@ant-design/icons';

const { Title } = Typography;
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const { Search, TextArea } = Input;
const { Option } = Select;

interface Case {
  _id: string;
  caseNumber: string;
  applicantId: {
    name: string;
  };
  respondentId: {
    name: string;
  };
  status: string;
  mediatorId: {
    name: string;
    phone?: string;
  };
  createdAt: string;
  latestProgress?: string;
}

const CaseQuery: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [leaveMessageVisible, setLeaveMessageVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { userInfo } = useAuthStore();

  const fetchCases = async () => {
    setLoading(true);
    try {
      const response = await api.get('/case', {
        params: { keyword }
      });
      setCases(response.data.cases);
    } catch (error) {
      message.error('获取案件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [keyword]);

  const handleSearch = (value: string) => {
    setKeyword(value);
  };

  const handleViewSummary = (record: Case) => {
    setSelectedCase(record);
    setModalVisible(true);
  };

  const handleLeaveMessage = (record: Case) => {
    setSelectedCase(record);
    form.resetFields();
    setLeaveMessageVisible(true);
  };

  const handleQuickRegister = () => {
    navigate('/case-apply');
  };

  const handleSubmitMessage = async (values: any) => {
    if (!selectedCase) return;
    
    console.log('提交留言:', {
      caseId: selectedCase._id,
      content: values.content,
      notificationType: values.notificationType,
      isArray: Array.isArray(values.notificationType)
    });
    
    try {
      // 调用API保存留言
      await api.post(`/case/${selectedCase._id}/progress`, {
        content: values.content,
        type: 'mediate',
        notificationType: values.notificationType
      });
      message.success('留言发送成功');
      setLeaveMessageVisible(false);
      // 刷新案件列表
      fetchCases();
    } catch (error) {
      console.error('留言发送失败:', error);
      message.error('留言发送失败');
    }
  };

  const columns = [
    {
      title: '案件编号',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      width: 150,
      render: (text: string, record: Case) => (
        <Link to={`/case/${record._id}`}>{text}</Link>
      )
    },
    {
      title: '登记日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => {
        const statusMap: Record<string, string> = {
          pending: '待处理',
          processing: '调解中',
          completed: '已完成',
          failed: '失败',
          '已驳回': '失败'
        };
        return statusMap[value] || value;
      }
    },
    {
      title: '承办调解员',
      dataIndex: ['mediatorId', 'name'],
      key: 'mediator',
      width: 120
    },
    {
      title: '联系方式',
      dataIndex: ['mediatorId', 'phone'],
      key: 'contact',
      width: 130,
      render: (value: string) => value || '无'
    },
    {
      title: '最近进展',
      dataIndex: 'latestProgress',
      key: 'latestProgress',
      width: 200,
      render: (value: string) => {
        if (!value) return '无';
        return value.length > 50 ? `${value.substring(0, 50)}...` : value;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Case) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleViewSummary(record)}
          >
            查看摘要
          </Button>
          <Button
            size="small"
            icon={<CommentOutlined />}
            onClick={() => handleLeaveMessage(record)}
          >
            调解员留言
          </Button>
        </div>
      )
    }
  ];

  return (
    <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 8 }}>
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <FileSearchOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px' }}>案件查询</Title>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Search
            placeholder="按申请人姓名/被申请人姓名/企业名称搜索"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: '100%', maxWidth: 400 }}
            size="small"
          />
          {(userInfo?.role !== 'personal' && userInfo?.role !== 'company') && (
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleQuickRegister} size="small">
              快速登记
            </Button>
          )}
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={cases}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10, size: 'small' }}
        scroll={{ x: 1000 }}
        size="small"
        locale={{
          emptyText: (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ marginBottom: 12 }}>未找到相关案件</div>
              {(userInfo?.role !== 'personal' && userInfo?.role !== 'company') && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleQuickRegister} size="small">
                  快速登记案件
                </Button>
              )}
            </div>
          )
        }}
      />

      {/* 查看摘要模态框 */}
      <Modal
        title="案件摘要"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)} size="small">
            关闭
          </Button>
        ]}
        width="90vw"
        maxWidth={500}
      >
        {selectedCase && (
          <div style={{ fontSize: '14px' }}>
            <p><strong>案件编号：</strong>{selectedCase.caseNumber}</p>
            <p><strong>登记日期：</strong>{new Date(selectedCase.createdAt).toLocaleString()}</p>
            <p><strong>当前状态：</strong>
              {{
                pending: '待处理',
                processing: '调解中',
                completed: '已完成',
                failed: '失败',
                '已驳回': '失败'
              }[selectedCase.status] || selectedCase.status}
            </p>
            <p><strong>承办调解员：</strong>{selectedCase.mediatorId.name}</p>
            <p><strong>联系方式：</strong>{selectedCase.mediatorId.phone || '无'}</p>
            <p><strong>最近进展：</strong>{selectedCase.latestProgress || '无'}</p>
            <p><strong>申请人：</strong>{selectedCase.applicantId.name}</p>
            <p><strong>被申请人：</strong>{selectedCase.respondentId.name}</p>
          </div>
        )}
      </Modal>

      {/* 调解员留言模态框 */}
      <Modal
        title="调解员留言"
        open={leaveMessageVisible}
        onCancel={() => setLeaveMessageVisible(false)}
        footer={null}
        width="90vw"
        maxWidth={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitMessage}
        >
          <Form.Item
            name="content"
            label="留言内容"
            rules={[{ required: true, message: '请输入留言内容' }]}
          >
            <TextArea rows={4} placeholder="请输入留言内容" size="small" />
          </Form.Item>
          <Form.Item
            name="notificationType"
            label="通知方式"
            rules={[{ required: true, message: '请选择通知方式' }]}
          >
            <Select mode="multiple" size="small">
              <Option value="system">站内消息</Option>
              <Option value="popup">弹窗提醒</Option>
              <Option value="sms">短信提醒</Option>
            </Select>
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setLeaveMessageVisible(false)} size="small">
              取消
            </Button>
            <Button type="primary" htmlType="submit" size="small">
              发送留言
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default CaseQuery;
