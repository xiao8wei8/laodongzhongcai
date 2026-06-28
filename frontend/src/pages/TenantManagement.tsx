import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Form, Input, Modal, Select, Space, Tag, Popconfirm, message, Typography, Card, Row, Col, Statistic, Avatar, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import api from '../services/api';
import { ExportButton } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, type ExcelColumn, warnNoExportData } from '../utils/excel';

const { Title, Text } = Typography;
const { Option } = Select;

interface TenantRecord {
  id: string;
  tenantCode?: string | null;
  tenantName: string;
  districtName?: string | null;
  streetName?: string | null;
  status: 'active' | 'disabled';
  contactName?: string | null;
  contactPhone?: string | null;
  userCount?: number;
  staffUserCount?: number;
  externalUserCount?: number;
  caseCount?: number;
  visitorRecordCount?: number;
  queryCaseCount?: number;
  feedbackCount?: number;
  createdAt?: string;
}

interface AdminAccountInfo {
  username: string;
  password: string;
  name: string;
}

const TenantManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tenant/manage', {
        params: {
          ...(keyword ? { keyword } : {}),
          ...(status ? { status } : {})
        }
      });
      setTenants(response.data.tenants || []);
    } catch (error) {
      message.error('获取街道列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const openCreateModal = () => {
    setEditingTenant(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    setModalVisible(true);
  };

  const openEditModal = (record: TenantRecord) => {
    setEditingTenant(record);
    form.setFieldsValue({
      tenantCode: record.tenantCode || undefined,
      tenantName: record.tenantName,
      districtName: record.districtName || undefined,
      streetName: record.streetName || undefined,
      contactName: record.contactName || undefined,
      contactPhone: record.contactPhone || undefined,
      status: record.status
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingTenant(null);
    form.resetFields();
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingTenant) {
        await api.put(`/tenant/${editingTenant.id}`, values);
        message.success('街道更新成功');
      } else {
        const response = await api.post('/tenant', values);
        const adminAccount: AdminAccountInfo | undefined = response.data.adminAccount;
        message.success(response.data.message || '街道创建成功');
        if (adminAccount) {
          Modal.info({
            title: '默认管理员已生成',
            content: (
              <div>
                <p>系统已为该街道自动创建默认管理员。</p>
                <p>账号：<strong>{adminAccount.username}</strong></p>
                <p>密码：<strong>{adminAccount.password}</strong></p>
                <p>姓名：<strong>{adminAccount.name}</strong></p>
              </div>
            )
          });
        }
      }
      closeModal();
      fetchTenants();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/tenant/${id}`);
      message.success('街道删除成功');
      fetchTenants();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '街道名称',
      dataIndex: 'tenantName',
      key: 'tenantName',
      render: (_: any, record: TenantRecord) => (
        <div>
          <div style={{ fontWeight: 700 }}>{record.tenantName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            编码：{record.tenantCode || '未设置'}
          </Text>
        </div>
      )
    },
    {
      title: '区/街道拆分',
      key: 'region',
      render: (_: any, record: TenantRecord) => (
        <div>
          <div>{record.districtName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.streetName || '-'}</Text>
        </div>
      )
    },
    {
      title: '联系人',
      key: 'contact',
      render: (_: any, record: TenantRecord) => (
        <div>
          <div>{record.contactName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.contactPhone || '-'}</Text>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => value === 'active' ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>
    },
    {
      title: '关联数据',
      key: 'refs',
      render: (_: any, record: TenantRecord) => (
        <div style={{ display: 'grid', gap: 8 }}>
          <Space wrap size={[8, 8]}>
            <Tag color="blue">后台用户 {record.staffUserCount ?? record.userCount ?? 0}</Tag>
            <Tag>外部用户 {record.externalUserCount || 0}</Tag>
            <Tag color="gold">案件查询 {record.queryCaseCount ?? record.caseCount ?? 0}</Tag>
            <Tag color="purple">反馈 {record.feedbackCount || 0}</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            正式案件 {record.caseCount || 0}，到访登记 {Math.max((record.queryCaseCount ?? 0) - (record.caseCount || 0), 0)}
          </Text>
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TenantRecord) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个街道吗？"
            description="若存在关联用户、案件、反馈，则不允许删除。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((item) => item.status === 'active').length,
    disabled: tenants.filter((item) => item.status === 'disabled').length,
    totalCases: tenants.reduce((sum, item) => sum + (item.caseCount || 0), 0),
    totalQueryCases: tenants.reduce((sum, item) => sum + (item.queryCaseCount ?? item.caseCount ?? 0), 0),
    totalStaffUsers: tenants.reduce((sum, item) => sum + (item.staffUserCount ?? item.userCount ?? 0), 0),
    totalExternalUsers: tenants.reduce((sum, item) => sum + (item.externalUserCount || 0), 0)
  }), [tenants]);

  const exportColumns: ExcelColumn<TenantRecord>[] = [
    { header: '街道名称', key: 'tenantName' },
    { header: '街道编码', key: 'tenantCode', formatter: (row) => row.tenantCode || '' },
    { header: '区名称', key: 'districtName', formatter: (row) => row.districtName || '' },
    { header: '街道简称', key: 'streetName', formatter: (row) => row.streetName || '' },
    { header: '联系人', key: 'contactName', formatter: (row) => row.contactName || '' },
    { header: '联系电话', key: 'contactPhone', formatter: (row) => row.contactPhone || '' },
    { header: '状态', key: 'status', formatter: (row) => row.status === 'active' ? '启用' : '停用' },
    { header: '后台用户数', key: 'staffUserCount', formatter: (row) => row.staffUserCount ?? row.userCount ?? 0 },
    { header: '外部用户数', key: 'externalUserCount', formatter: (row) => row.externalUserCount || 0 },
    { header: '正式案件数', key: 'caseCount', formatter: (row) => row.caseCount || 0 },
    { header: '案件查询口径', key: 'queryCaseCount', formatter: (row) => row.queryCaseCount ?? row.caseCount ?? 0 },
    { header: '反馈数', key: 'feedbackCount', formatter: (row) => row.feedbackCount || 0 },
    { header: '创建时间', key: 'createdAt', formatter: (row) => row.createdAt || '' }
  ];

  const handleExport = () => {
    if (tenants.length === 0) {
      warnNoExportData('当前没有可导出的街道数据');
      return;
    }
    exportExcel(buildExportFileName('街道管理'), exportColumns, tenants);
    message.success(`已导出 ${tenants.length} 条街道记录`);
  };

  return (
    <div style={{ padding: 4 }}>
      <Card
        bordered={false}
        style={{
          marginBottom: 20,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 100%)',
          color: '#fff',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={10}>
              <Space size={12} align="start">
                <Avatar size={46} icon={<ApartmentOutlined />} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>街道租户管理台</div>
                  <div style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
                    用于维护街道租户、默认管理员和关联业务规模。建议先筛选范围，再进入表格执行新增、编辑或删除操作。
                  </div>
                </div>
              </Space>
              <Space wrap>
                <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>租户配置</Tag>
                <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>自动生成默认管理员</Tag>
              </Space>
            </Space>
          </Col>
          <Col xs={24} lg={8}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                  <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>街道总数</span>} value={stats.total} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                  <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>启用街道</span>} value={stats.active} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card bordered={false} style={{ borderRadius: 18, marginBottom: 20, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }} bodyStyle={{ padding: 22 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={10}>
            <Text type="secondary">关键词搜索</Text>
            <Input
              placeholder="搜索街道、区、联系人、电话"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary">状态筛选</Text>
            <Select
              placeholder="按状态筛选"
              allowClear
              value={status}
              onChange={setStatus}
              style={{ width: '100%', marginTop: 8 }}
            >
              <Option value="active">启用</Option>
              <Option value="disabled">停用</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={fetchTenants}>搜索</Button>
              <Button onClick={() => { setKeyword(''); setStatus(undefined); setTimeout(fetchTenants, 0); }}>重置</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                新增街道
              </Button>
              <ExportButton onClick={handleExport} />
            </Space>
          </Col>
        </Row>

        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24} md={8}>
            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#f8fbff' }}>
              <Statistic title="停用街道" value={stats.disabled} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#f3faf7' }}>
              <Statistic title="后台用户总量" value={stats.totalStaffUsers} prefix={<TeamOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fff9e8' }}>
              <Statistic title="案件查询总量" value={stats.totalQueryCases} />
              <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
                其中正式案件 {stats.totalCases}，外部用户共 {stats.totalExternalUsers} 个
              </Text>
            </Card>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 14, marginTop: 16 }}
          message="口径说明"
          description="“后台用户”指街道管理员和调解员；“外部用户”指咨询或申请过程中关联到该街道的个人/企业账号；“案件查询”口径与街道管理员在案件查询页里看到的总量保持一致，包含正式案件和未并入正式案件流转的到访登记。"
        />
      </Card>

      <Card bordered={false} style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }} bodyStyle={{ padding: 12 }}>
        <div style={{ padding: '8px 12px 16px' }}>
          <Title level={4} style={{ margin: 0 }}>街道列表</Title>
          <Text type="secondary">优先关注后台用户规模、案件量和外部用户量，避免把咨询用户误认为后台人员。</Text>
        </div>
        <Table
          columns={columns}
          dataSource={tenants}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editingTenant ? '编辑街道' : '新增街道'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="tenantName" label="街道名称" rules={[{ required: true, message: '请输入街道名称' }]}>
                <Input placeholder="例如：静安区天目西路街道" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="tenantCode" label="街道编码">
                <Input placeholder="选填，便于内部管理" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="districtName" label="区名称">
                <Input placeholder="例如：静安区" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="streetName" label="街道简称">
                <Input placeholder="例如：天目西路街道" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="contactName" label="联系人">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select>
              <Option value="active">启用</Option>
              <Option value="disabled">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
              <Button onClick={closeModal}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantManagement;
