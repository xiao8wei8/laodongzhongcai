import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Modal, message, Popconfirm, Tree, Card, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, UserOutlined, ApartmentOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

const { Option } = Select;

interface User {
  _id: string;
  username: string;
  password: string;
  name: string;
  position: string;
  officePhone: string;
  phone?: string;
  email?: string;
  role: string;
  street: string;
  department: string;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStreet, setSelectedStreet] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [streets, setStreets] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [treeData, setTreeData] = useState<any[]>([]);

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchKeyword) params.search = searchKeyword;
      if (selectedStreet) params.street = selectedStreet;
      if (selectedDepartment) params.department = selectedDepartment;
      
      const response = await api.get('/auth/users', { params });
      const userList = response.data.users;
      setUsers(userList);
      
      // 提取街道和科室信息
    const streetSet = new Set<string>();
    const deptSet = new Set<string>();
    userList.forEach(user => {
      if (user.street) streetSet.add(user.street);
      if (user.department) deptSet.add(user.department);
    });
    setStreets(Array.from(streetSet));
    setDepartments(Array.from(deptSet));
    
    // 生成树形结构数据
    generateTreeData(userList);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 打开添加用户模态框
  const openAddModal = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  // 处理街道筛选
  const handleStreetChange = (value: string) => {
    setSelectedStreet(value);
    setSelectedDepartment(''); // 重置科室选择
  };

  // 处理科室筛选
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
  };

  // 执行搜索和筛选
  const executeSearch = () => {
    fetchUsers();
  };

  // 重置筛选条件
  const resetFilters = () => {
    setSearchKeyword('');
    setSelectedStreet('');
    setSelectedDepartment('');
    fetchUsers();
  };

  // 生成树形结构数据
  const generateTreeData = (userList: User[]) => {
    // 按街道分组
    const streetMap = new Map<string, Map<string, User[]>>();
    
    userList.forEach(user => {
      const street = user.street || '未知街道';
      const department = user.department || '未知科室';
      
      if (!streetMap.has(street)) {
        streetMap.set(street, new Map<string, User[]>());
      }
      
      const deptMap = streetMap.get(street)!;
      if (!deptMap.has(department)) {
        deptMap.set(department, []);
      }
      
      deptMap.get(department)!.push(user);
    });
    
    // 构建树形结构
    const tree: any[] = [];
    streetMap.forEach((deptMap, streetName) => {
      const streetNode = {
        title: streetName,
        key: `street-${streetName}`,
        icon: <ApartmentOutlined />,
        children: []
      };
      
      deptMap.forEach((users, deptName) => {
        const deptNode = {
          title: deptName,
          key: `dept-${streetName}-${deptName}`,
          icon: <TeamOutlined />,
          children: users.map(user => ({
            title: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{user.name}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{user.position}</span>
              </div>
            ),
            key: `user-${user._id}`,
            icon: <UserOutlined />,
            userInfo: user
          }))
        };
        
        streetNode.children.push(deptNode);
      });
      
      tree.push(streetNode);
    });
    
    setTreeData(tree);
  };

  // 打开编辑用户模态框
  const openEditModal = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      name: user.name,
      position: user.position,
      officePhone: user.officePhone,
      phone: user.phone,
      email: user.email,
      role: user.role,
      street: user.street,
      department: user.department
    });
    setModalVisible(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (editingUser) {
        // 更新用户
        await api.put(`/auth/users/${editingUser._id}`, values);
        message.success('用户更新成功');
      } else {
        // 创建用户
        await api.post('/auth/register', values);
        message.success('用户创建成功');
      }
      fetchUsers();
      closeModal();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除用户
  const deleteUser = async (userId: string) => {
    setLoading(true);
    try {
      await api.delete(`/auth/users/${userId}`);
      message.success('用户删除成功');
      fetchUsers();
    } catch (error) {
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '组织架构',
      key: 'organization',
      render: (_, record: User) => (
        <span>{record.street} - {record.department}</span>
      )
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '岗位',
      dataIndex: 'position',
      key: 'position',
      render: (position: string) => position || '-'
    },
    {
      title: '办公室电话',
      dataIndex: 'officePhone',
      key: 'officePhone',
      render: (officePhone: string) => officePhone || '-'
    },
    {
      title: '手机',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || '-'
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleMap: Record<string, string> = {
          admin: '管理员',
          mediator: '调解员',
          personal: '个人用户',
          company: '企业用户'
        };
        return roleMap[role] || role;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <>
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ marginRight: 8 }}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => deleteUser(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </>
      )
    }
  ];

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ 
        marginBottom: 24, 
        display: 'flex', 
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>用户管理</Title>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          添加用户
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input
                placeholder="模糊搜索（姓名、电话、邮箱）"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ minWidth: 150, flex: 1 }}>
              <Select
                placeholder="按街道筛选"
                style={{ width: '100%' }}
                value={selectedStreet}
                onChange={handleStreetChange}
                allowClear
              >
                {streets.map(street => (
                  <Option key={street} value={street}>{street}</Option>
                ))}
              </Select>
            </div>
            <div style={{ minWidth: 150, flex: 1 }}>
              <Select
                placeholder="按科室筛选"
                style={{ width: '100%' }}
                value={selectedDepartment}
                onChange={handleDepartmentChange}
                allowClear
                disabled={!selectedStreet}
              >
                {departments.map(dept => (
                  <Option key={dept} value={dept}>{dept}</Option>
                ))}
              </Select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button type="primary" onClick={executeSearch}>搜索</Button>
            <Button onClick={resetFilters}>重置</Button>
            <Button 
              type={viewMode === 'tree' ? 'primary' : 'default'}
              onClick={() => setViewMode('tree')}
            >
              树形视图
            </Button>
            <Button 
              type={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            >
              表格视图
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="_id"
            loading={loading}
            pagination={{ 
              pageSize: 10,
              responsive: true
            }}
            scroll={{ 
              x: 'max-content'
            }}
            className="responsive-table"
          />
        </div>
      ) : (
        <Card title="组织架构树" style={{ marginBottom: 24, overflowX: 'auto' }}>
          <Tree
            treeData={treeData}
            defaultExpandAll
            onSelect={(selectedKeys, info) => {
              // 处理节点选择，点击用户节点时可以打开编辑模态框
              if (info.node.userInfo) {
                openEditModal(info.node.userInfo);
              }
            }}
            titleRender={(node) => {
              if (node.userInfo) {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200 }}>
                    <span>{node.title}</span>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(node.userInfo);
                        }}
                      >
                        编辑
                      </Button>
                    </div>
                  </div>
                );
              }
              return node.title;
            }}
          />
        </Card>
      )}

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="position"
            label="岗位"
            rules={[{ required: true, message: '请输入岗位' }]}
          >
            <Input placeholder="请输入岗位" />
          </Form.Item>

          <Form.Item
            name="officePhone"
            label="办公室电话"
            rules={[{ required: true, message: '请输入办公室电话' }]}
          >
            <Input placeholder="请输入办公室电话" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机"
          >
            <Input placeholder="请输入手机（可选）" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
          >
            <Input placeholder="请输入邮箱（可选）" />
          </Form.Item>

          <Form.Item
            name="street"
            label="街道"
            rules={[{ required: true, message: '请输入街道' }]}
          >
            <Input placeholder="请输入街道" />
          </Form.Item>

          <Form.Item
            name="department"
            label="科室"
            rules={[{ required: true, message: '请输入科室' }]}
          >
            <Input placeholder="请输入科室" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="admin">管理员</Option>
              <Option value="mediator">调解员</Option>
              <Option value="personal">个人用户</Option>
              <Option value="company">企业用户</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
              保存
            </Button>
            <Button onClick={closeModal}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;