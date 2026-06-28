import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Form, Input, Select, Modal, message, Popconfirm, Tree, Card, Typography, Switch, Alert, Row, Col, Space, Statistic, Avatar, Tag, Segmented, Calendar } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, UserOutlined, ApartmentOutlined, SafetyCertificateOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined } from '@ant-design/icons';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { ExportButton, PageHero, PageSectionCard, PageShell, PageToolbar } from '../components/common/PageKit';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { buildExportFileName, exportExcel, exportExcelWorkbook, type ExcelColumn, warnNoExportData } from '../utils/excel';

const { Title, Text } = Typography;

const { Option } = Select;
const DEFAULT_TENANT_NAME = '静安区天目西路街道';

interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  position: string;
  officePhone: string;
  phone?: string;
  role: string;
  street: string;
  department: string;
  tenantId?: string | null;
  tenantName?: string | null;
  isSuperAdmin?: boolean;
  createdAt: string;
}

interface TenantOption {
  id: string;
  tenantName: string;
}

interface DutyCandidate {
  id: string;
  username?: string;
  name: string;
  role: string;
  phone?: string | null;
  officePhone?: string | null;
}

interface DutyConfig {
  tenantId: string;
  tenantName: string;
  dutyUserIds: string[];
  currentDutyUserId: string | null;
  dutyRotationStartDate?: string | null;
  dutyOverrideUserId?: string | null;
  dutyOverrideDate?: string | null;
  allowAdminAsMediator: boolean;
  mediators: DutyCandidate[];
  admins: DutyCandidate[];
  currentDutyAssignee?: DutyCandidate & { source?: string };
  dutyPreview?: Array<{
    date: string;
    isToday?: boolean;
    isOverride?: boolean;
    assignee?: DutyCandidate & { source?: string } | null;
  }>;
}

interface DutyLogItem {
  id: string;
  actionType: 'rotation_update' | 'manual_override' | 'manual_override_clear' | 'advance_next';
  originalUserId?: string | null;
  targetUserId?: string | null;
  effectiveDate?: string | null;
  reason?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

interface DutyStats {
  totalAdjustments: number;
  overrideCount: number;
  advanceCount: number;
  rotationUpdateCount: number;
  activeDays: number;
  consecutiveOverrideDays: number;
  topOverrideMediator?: {
    id: string;
    name: string;
    overrideTimes: number;
  } | null;
}

interface DutyCalendarItem {
  date: string;
  isToday?: boolean;
  isOverride?: boolean;
  assignee?: DutyCandidate & { source?: string } | null;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [managementWorkspace, setManagementWorkspace] = useState<'people' | 'duty'>('people');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [treeData, setTreeData] = useState<any[]>([]);
  const [dutyConfig, setDutyConfig] = useState<DutyConfig | null>(null);
  const [dutyLogs, setDutyLogs] = useState<DutyLogItem[]>([]);
  const [dutyStats, setDutyStats] = useState<DutyStats | null>(null);
  const [dutyLogFilter, setDutyLogFilter] = useState<'all' | DutyLogItem['actionType']>('all');
  const [dutyCalendarMonth, setDutyCalendarMonth] = useState(dayjs());
  const [dutyCalendarPreview, setDutyCalendarPreview] = useState<DutyCalendarItem[]>([]);
  const [dutyLoading, setDutyLoading] = useState(false);
  const [savingDuty, setSavingDuty] = useState(false);
  const [dutyReason, setDutyReason] = useState('');
  const [dutyActionModalVisible, setDutyActionModalVisible] = useState(false);
  const [dutyActionType, setDutyActionType] = useState<'override' | 'advance' | 'clear_override'>('override');
  const [dutyActionUserId, setDutyActionUserId] = useState<string | undefined>(undefined);
  const [dutyActionReason, setDutyActionReason] = useState('');
  const [dutyCalendarVisible, setDutyCalendarVisible] = useState(false);
  const [dutyCalendarDetailVisible, setDutyCalendarDetailVisible] = useState(false);
  const [selectedDutyCalendarItem, setSelectedDutyCalendarItem] = useState<DutyCalendarItem | null>(null);
  const [draftDutyUserIds, setDraftDutyUserIds] = useState<string[]>([]);
  const [draftCurrentDutyUserId, setDraftCurrentDutyUserId] = useState<string | null>(null);
  const [draftAllowAdminAsMediator, setDraftAllowAdminAsMediator] = useState(true);
  const { userInfo } = useAuthStore();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = userInfo?.role === 'superadmin';
  const isTenantAdmin = userInfo?.role === 'tenant_admin';
  const targetDutyTenantId = isTenantAdmin ? (userInfo?.tenantId || '') : selectedTenantId;

  const fetchTenantOptions = async () => {
    try {
      const response = await api.get('/tenant');
      const tenantOptions = response.data.tenants || [];
      setTenants(tenantOptions);

      if (isSuperAdmin && !selectedTenantId) {
        const defaultTenant = tenantOptions.find((item: TenantOption) => item.tenantName === DEFAULT_TENANT_NAME);
        if (defaultTenant?.id) {
          setSelectedTenantId(defaultTenant.id);
          fetchDutyConfig(defaultTenant.id);
          try {
            const params: any = {};
            if (searchKeyword) params.search = searchKeyword;
            params.tenantId = defaultTenant.id;
            if (selectedDepartment) params.department = selectedDepartment;

            const userResponse = await api.get('/auth/users', { params });
            const userList = userResponse.data.users;
            setUsers(userList);

            const deptSet = new Set<string>();
            userList.forEach((user: User) => {
              if (user.department) deptSet.add(user.department);
            });
            setDepartments(Array.from(deptSet));
            generateTreeData(userList);
          } catch (_error) {
            message.error('获取默认街道用户列表失败');
          }
        }
      }
    } catch (error) {
      message.error('获取街道列表失败');
    }
  };

  const fetchDutyConfig = async (tenantId?: string) => {
    const finalTenantId = tenantId || targetDutyTenantId;
    if (!finalTenantId) {
      setDutyConfig(null);
      return;
    }
    setDutyLoading(true);
    try {
      const response = await api.get('/tenant/duty-config', {
        params: isSuperAdmin ? { tenantId: finalTenantId } : {}
      });
      setDutyConfig(response.data);
      setDraftDutyUserIds(response.data.dutyUserIds || []);
      setDraftCurrentDutyUserId(response.data.dutyUserIds?.includes(response.data.currentDutyUserId) ? response.data.currentDutyUserId : (response.data.dutyUserIds?.[0] || null));
      setDraftAllowAdminAsMediator(Boolean(response.data.allowAdminAsMediator));
      const logsResponse = await api.get('/tenant/duty-logs', {
        params: isSuperAdmin ? { tenantId: finalTenantId, actionType: dutyLogFilter } : { actionType: dutyLogFilter }
      });
      setDutyLogs(logsResponse.data.logs || []);
      const statsResponse = await api.get('/tenant/duty-stats', {
        params: isSuperAdmin ? { tenantId: finalTenantId } : {}
      });
      setDutyStats(statsResponse.data || null);
      const calendarResponse = await api.get('/tenant/duty-config', {
        params: isSuperAdmin
          ? { tenantId: finalTenantId, previewDays: 42, previewStartDate: dutyCalendarMonth.startOf('month').format('YYYY-MM-DD') }
          : { previewDays: 42, previewStartDate: dutyCalendarMonth.startOf('month').format('YYYY-MM-DD') }
      });
      setDutyCalendarPreview(calendarResponse.data.dutyPreview || []);
    } catch (_error) {
      message.error('获取值班调解员配置失败');
    } finally {
      setDutyLoading(false);
    }
  };

  const updateDutyConfig = async (patch: Partial<DutyConfig>, customReason?: string) => {
    if (!targetDutyTenantId || !dutyConfig) return;
    setSavingDuty(true);
    try {
      const response = await api.put('/tenant/duty-config', {
        tenantId: isSuperAdmin ? targetDutyTenantId : undefined,
        dutyUserIds: patch.dutyUserIds ?? dutyConfig.dutyUserIds,
        currentDutyUserId: patch.currentDutyUserId ?? dutyConfig.currentDutyUserId,
        dutyRotationStartDate: patch.dutyRotationStartDate ?? dutyConfig.dutyRotationStartDate ?? dayjs().format('YYYY-MM-DD'),
        allowAdminAsMediator: patch.allowAdminAsMediator ?? dutyConfig.allowAdminAsMediator,
        reason: customReason || dutyReason || '调整值班名单或轮值顺序'
      });
      setDutyConfig(response.data);
      setDutyReason('');
      fetchDutyConfig(targetDutyTenantId);
      message.success('值班调解员配置已更新');
    } catch (_error) {
      message.error('保存值班调解员配置失败');
    } finally {
      setSavingDuty(false);
    }
  };

  const saveFormalDutyConfig = async () => {
    await updateDutyConfig({
      dutyUserIds: draftDutyUserIds,
      currentDutyUserId: draftDutyUserIds.includes(String(draftCurrentDutyUserId || '')) ? draftCurrentDutyUserId : (draftDutyUserIds[0] || null),
      dutyRotationStartDate: dayjs().format('YYYY-MM-DD'),
      allowAdminAsMediator: draftAllowAdminAsMediator
    }, dutyReason || '保存正式值班配置');
  };

  const updateDutyOverride = async (overrideUserId: string | null, customReason?: string) => {
    if (!targetDutyTenantId || !dutyConfig) return;
    setSavingDuty(true);
    try {
      const response = await api.put('/tenant/duty-override', {
        tenantId: isSuperAdmin ? targetDutyTenantId : undefined,
        overrideUserId,
        overrideDate: dayjs().format('YYYY-MM-DD'),
        reason: customReason || dutyReason || (overrideUserId ? '设置今日临时代理' : '清除今日临时代理')
      });
      setDutyConfig(response.data);
      setDutyReason('');
      fetchDutyConfig(targetDutyTenantId);
      message.success(overrideUserId ? '今日临时代理已更新' : '今日临时代理已清除');
    } catch (_error) {
      message.error('保存今日临时代理失败');
    } finally {
      setSavingDuty(false);
    }
  };

  const moveDutyUser = async (userId: string, direction: 'up' | 'down') => {
    if (!dutyConfig) return;
    const currentIndex = dutyConfig.dutyUserIds.findIndex((item) => item === userId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= dutyConfig.dutyUserIds.length) return;
    const nextIds = [...dutyConfig.dutyUserIds];
    const [current] = nextIds.splice(currentIndex, 1);
    nextIds.splice(targetIndex, 0, current);
    await updateDutyConfig({ dutyUserIds: nextIds });
  };

  const advanceDutyToNext = async (customReason?: string) => {
    if (!targetDutyTenantId) return;
    setSavingDuty(true);
    try {
      const response = await api.post('/tenant/duty-advance', {
        tenantId: isSuperAdmin ? targetDutyTenantId : undefined,
        reason: customReason || dutyReason || '管理员一键顺延到下一位'
      });
      setDutyConfig(response.data);
      setDutyReason('');
      fetchDutyConfig(targetDutyTenantId);
      message.success('已顺延到下一位值班调解员');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '顺延值班失败');
    } finally {
      setSavingDuty(false);
    }
  };

  const dutyWarnings = useMemo(() => {
    if (!dutyConfig) return [];
    const warnings: Array<{ type: 'warning' | 'info'; message: string; description: string }> = [];
    if (dutyConfig.dutyUserIds.length === 0) {
      warnings.push({
        type: 'warning',
        message: '当前没有值班名单',
        description: '系统仍可能走旧兜底逻辑，但不会形成稳定轮值。建议先至少配置 2 名调解员进入值班名单。'
      });
    } else if (dutyConfig.dutyUserIds.length === 1) {
      warnings.push({
        type: 'warning',
        message: '当前只有 1 名值班调解员',
        description: '只配 1 人时无法顺延或轮换，遇到请假和外出会比较被动，建议至少配置 2 名调解员。'
      });
    }
    if (dutyConfig.currentDutyAssignee?.source === 'tenant_admin_fallback') {
      warnings.push({
        type: 'warning',
        message: '当前由街道管理员兜底接收',
        description: '说明值班名单或轮值结果不可用，建议尽快补齐调解员排班。'
      });
    }
    const tomorrowPreview = dutyConfig.dutyPreview?.find((item) => dayjs(item.date).isSame(dayjs().add(1, 'day'), 'day'));
    if (dutyConfig.dutyOverrideUserId && dutyConfig.dutyOverrideDate) {
      warnings.push({
        type: 'info',
        message: '今日存在临时代理',
        description: `今日代理仅在 ${dayjs(dutyConfig.dutyOverrideDate).format('MM月DD日')} 生效，明天将恢复为 ${tomorrowPreview?.assignee?.name || '系统自动轮值结果'}。`
      });
    }
    const recentOverrideCount = dutyLogs.filter((item) => item.actionType === 'manual_override' && dayjs(item.createdAt).isAfter(dayjs().subtract(7, 'day'))).length;
    if (recentOverrideCount >= 3) {
      warnings.push({
        type: 'warning',
        message: '近期临时代理较频繁',
        description: '近 7 天多次使用临时代理，建议检查当前值班顺序是否合理，或补充更多可轮值调解员。'
      });
    }
    if ((dutyStats?.consecutiveOverrideDays || 0) >= 2) {
      warnings.push({
        type: 'warning',
        message: '连续多日使用代理值班',
        description: `当前已连续 ${dutyStats?.consecutiveOverrideDays} 天使用代理值班，建议调整正式轮值顺序或补充值班人员，避免长期依赖临时处理。`
      });
    }
    return warnings;
  }, [dutyConfig, dutyLogs, dutyStats]);

  const openDutyActionModal = (actionType: 'override' | 'advance' | 'clear_override' = 'override') => {
    setDutyActionType(actionType);
    setDutyActionUserId(undefined);
    setDutyActionReason('');
    setDutyActionModalVisible(true);
  };

  const submitDutyAction = async () => {
    if (dutyActionType === 'override') {
      if (!dutyActionUserId) {
        message.warning('请选择临时代理调解员');
        return;
      }
      await updateDutyOverride(dutyActionUserId, dutyActionReason || '请假/调班：设置今日临时代理');
    } else if (dutyActionType === 'advance') {
      await advanceDutyToNext(dutyActionReason || '请假/调班：顺延到下一位');
    } else {
      await updateDutyOverride(null, dutyActionReason || '请假/调班：清除今日临时代理');
    }
    setDutyActionModalVisible(false);
    setDutyActionUserId(undefined);
    setDutyActionReason('');
  };

  // 获取用户列表
  const fetchUsers = async (overrides?: { tenantId?: string; searchKeyword?: string; department?: string }) => {
    setLoading(true);
    try {
      const params: any = {};
      const finalSearchKeyword = overrides?.searchKeyword ?? searchKeyword;
      const finalTenantId = overrides?.tenantId ?? selectedTenantId;
      const finalDepartment = overrides?.department ?? selectedDepartment;
      if (finalSearchKeyword) params.search = finalSearchKeyword;
      if (finalTenantId) params.tenantId = finalTenantId;
      if (finalDepartment) params.department = finalDepartment;
      
      const response = await api.get('/auth/users', { params });
      const userList = (response.data.users || []).filter((user: User) => user.role !== 'personal' && user.role !== 'company');
      setUsers(userList);
      
      const deptSet = new Set<string>();
      userList.forEach(user => {
        if (user.department) deptSet.add(user.department);
      });
      setDepartments(Array.from(deptSet));
      generateTreeData(userList);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTenantOptions();
  }, []);

  useEffect(() => {
    const tenantIdFromQuery = searchParams.get('tenantId');
    if (isSuperAdmin && tenantIdFromQuery) {
      setSelectedTenantId(tenantIdFromQuery);
    }
  }, [isSuperAdmin, searchParams]);

  useEffect(() => {
    fetchDutyConfig();
  }, [targetDutyTenantId, dutyLogFilter, dutyCalendarMonth]);

  // 打开添加用户模态框
  const openAddModal = () => {
    setEditingUser(null);
    form.resetFields();
    if (isTenantAdmin && userInfo?.tenantName) {
      form.setFieldsValue({ tenantId: userInfo.tenantId || undefined, street: userInfo.tenantName, role: 'mediator' });
    }
    setModalVisible(true);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  // 处理街道筛选
  const handleTenantChange = (value: string) => {
    setSelectedTenantId(value);
    setSelectedDepartment(''); // 重置科室选择
  };

  // 处理科室筛选
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
  };

  const handleFormTenantChange = (value: string) => {
    const selectedTenant = tenants.find(item => item.id === value);
    form.setFieldsValue({
      tenantId: value,
      street: selectedTenant?.tenantName || ''
    });
  };

  // 执行搜索和筛选
  const executeSearch = () => {
    fetchUsers();
  };

  // 重置筛选条件
  const resetFilters = () => {
    setSearchKeyword('');
    let nextTenantId = '';
    if (isSuperAdmin) {
      const defaultTenant = tenants.find(item => item.tenantName === DEFAULT_TENANT_NAME);
      nextTenantId = defaultTenant?.id || '';
      setSelectedTenantId(nextTenantId);
    } else {
      setSelectedTenantId('');
    }
    setSelectedDepartment('');
    fetchUsers({ tenantId: nextTenantId, searchKeyword: '', department: '' });
  };

  // 生成树形结构数据
  const generateTreeData = (userList: User[]) => {
    // 按街道分组
    const streetMap = new Map<string, Map<string, User[]>>();
    
    userList.forEach(user => {
      const street = user.tenantName || user.street || '未知街道';
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
                <span>{formatMediatorDisplayName(user)}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{user.position}</span>
              </div>
            ),
            key: `user-${user.id}`,
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
      role: user.role,
      street: user.street,
      department: user.department,
      tenantId: user.tenantId || undefined
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
      const selectedTenant = tenants.find(item => item.id === values.tenantId);
      const payload = {
        ...values,
        street: selectedTenant?.tenantName || values.street
      };
      if (editingUser) {
        // 更新用户
        await api.put(`/auth/users/${editingUser.id}`, payload);
        message.success('用户更新成功');
      } else {
        // 创建用户
        await api.post('/auth/users', payload);
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
        <span>{record.tenantName || record.street} - {record.department}</span>
      )
    },
    {
      title: '登录账号',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: User) => (
        record.role === 'mediator'
          ? `${name}（账号：${record.username}）`
          : name
      )
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
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleMap: Record<string, string> = {
          superadmin: '超级管理员',
          tenant_admin: '街道管理员',
          mediator: '调解员'
        };
        return roleMap[role] || role;
      }
    },
    {
      title: '所属街道',
      key: 'tenantName',
      render: (_: any, record: User) => record.tenantName || record.street || '-'
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
            onConfirm={() => deleteUser(record.id)}
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

  const stats = useMemo(() => {
    return {
      total: users.length,
      tenantAdmin: users.filter((item) => item.role === 'tenant_admin').length,
      mediator: users.filter((item) => item.role === 'mediator').length
    };
  }, [users]);

  const hasFormalDutyConfig = Boolean(dutyConfig?.dutyUserIds.length);
  const hasDraftFormalDutyConfig = draftDutyUserIds.length > 0;

  const dutyModeText = useMemo(() => {
    if (!dutyConfig?.currentDutyAssignee?.source) return '未设置';
    const sourceMap: Record<string, string> = {
      rotation: '正式轮值',
      manual_override: '今日代理',
      legacy_on_duty: '旧值班兜底',
      tenant_admin_fallback: '管理员兜底'
    };
    return sourceMap[dutyConfig.currentDutyAssignee.source] || '未设置';
  }, [dutyConfig]);

  const duplicateDutyNameSet = useMemo(() => {
    const candidates = dutyConfig?.mediators || [];
    const countMap = new Map<string, number>();
    candidates.forEach((item) => {
      countMap.set(item.name, (countMap.get(item.name) || 0) + 1);
    });
    return new Set(Array.from(countMap.entries()).filter(([, count]) => count > 1).map(([name]) => name));
  }, [dutyConfig]);

  function formatDutyCandidateName(candidate?: DutyCandidate | null) {
    if (!candidate) return '未安排';
    const accountText = candidate.username ? `（账号：${candidate.username}）` : '';
    if (!duplicateDutyNameSet.has(candidate.name)) return `${candidate.name}${accountText}`;
    const contact = candidate.phone || candidate.officePhone || '';
    const suffix = contact ? contact.slice(-4) : candidate.id.slice(-4);
    return `${candidate.name}（尾号${suffix}）${accountText}`;
  }

  function formatMediatorDisplayName(record: User) {
    if (record.role !== 'mediator') return record.name;
    return `${record.name}（账号：${record.username}）`;
  }

  const userExportColumns: ExcelColumn<User>[] = [
    { header: '用户名', key: 'username' },
    { header: '姓名', key: 'name' },
    { header: '岗位', key: 'position', formatter: (row) => row.position || '' },
    { header: '角色', key: 'role', formatter: (row) => roleLabels[row.role] || row.role },
    { header: '科室', key: 'department', formatter: (row) => row.department || '' },
    { header: '办公电话', key: 'officePhone', formatter: (row) => row.officePhone || '' },
    { header: '手机', key: 'phone', formatter: (row) => row.phone || '' },
    { header: '所属街道', key: 'tenantName', formatter: (row) => row.tenantName || row.street || '' },
    { header: '创建时间', key: 'createdAt', formatter: (row) => row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') : '' }
  ];

  const handleExportUsers = () => {
    if (users.length === 0) {
      warnNoExportData('当前没有可导出的用户数据');
      return;
    }
    exportExcel(buildExportFileName('用户管理'), userExportColumns, users);
    message.success(`已导出 ${users.length} 条用户记录`);
  };

  const handleExportDutyConfig = () => {
    if (!dutyConfig) {
      warnNoExportData('当前没有可导出的值班配置');
      return;
    }

    const rosterRows = dutyConfig.dutyUserIds.map((userId, index) => {
      const person = dutyConfig.mediators.find((item) => item.id === userId);
      return {
        序号: index + 1,
        调解员: formatDutyCandidateName(person),
        手机: person?.phone || '',
        办公电话: person?.officePhone || '',
        今日起点: dutyConfig.currentDutyUserId === userId ? '是' : '否'
      };
    });

    const logRows = dutyLogs.map((item) => ({
      动作类型: ({
        rotation_update: '更新名单/顺序',
        manual_override: '设置今日代理',
        manual_override_clear: '清除今日代理',
        advance_next: '顺延到下一位'
      } as Record<string, string>)[item.actionType] || item.actionType,
      生效日期: item.effectiveDate || '',
      原因: item.reason || '',
      操作人: item.createdByName || '',
      操作时间: item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss') : ''
    }));

    exportExcelWorkbook(buildExportFileName('值班配置'), [
      {
        name: '值班名单',
        columns: [
          { header: '序号', key: '序号' },
          { header: '调解员', key: '调解员' },
          { header: '手机', key: '手机' },
          { header: '办公电话', key: '办公电话' },
          { header: '今日起点', key: '今日起点' }
        ],
        rows: rosterRows
      },
      {
        name: '调整记录',
        columns: [
          { header: '动作类型', key: '动作类型' },
          { header: '生效日期', key: '生效日期' },
          { header: '原因', key: '原因' },
          { header: '操作人', key: '操作人' },
          { header: '操作时间', key: '操作时间' }
        ],
        rows: logRows
      }
    ]);
    message.success('已导出值班配置与调整记录');
  };

  const dutyCoverage = useMemo(() => {
    if (!dutyConfig) {
      return {
        hasGap: false,
        nextSevenDays: [] as Array<{ date: string; assignee: string; isCurrent: boolean; isOverride?: boolean }>
      };
    }

    const nextSevenDays = (dutyConfig.dutyPreview || []).map((item) => ({
      date: dayjs(item.date).format('MM-DD'),
      assignee: formatDutyCandidateName(item.assignee),
      isCurrent: Boolean(item.isToday),
      isOverride: Boolean(item.isOverride)
    }));

    return {
      hasGap: dutyConfig.dutyUserIds.length === 0 || !dutyConfig.currentDutyAssignee,
      nextSevenDays
    };
  }, [dutyConfig, formatDutyCandidateName]);

  const dutyCalendarMap = useMemo(() => {
    const map = new Map<string, DutyCalendarItem>();
    dutyCalendarPreview.forEach((item) => {
      if (hasFormalDutyConfig || item.assignee?.source === 'manual_override') {
        map.set(item.date, item);
      }
    });
    return map;
  }, [dutyCalendarPreview, hasFormalDutyConfig]);

  const openDutyCalendarDetail = (date: dayjs.Dayjs) => {
    const item = dutyCalendarMap.get(date.format('YYYY-MM-DD'));
    if (!item) return;
    setSelectedDutyCalendarItem(item);
    setDutyCalendarDetailVisible(true);
  };

  return (
    <PageShell>
      <PageHero
        tone="blue"
        icon={<UserOutlined />}
        title={isTenantAdmin ? '街道人员与值班中心' : '人员与值班中心'}
        description="统一管理组织架构、人员资料和街道值班调解员。建议先切换到当前要处理的工作区，再进入对应视图。"
        tags={
          <>
            <Tag color="blue-inverse" style={{ borderRadius: 999 }}>人员管理</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>值班调解员配置</Tag>
            <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>{isTenantAdmin ? '街道范围' : '全局范围'}</Tag>
          </>
        }
        metrics={
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>人员总数</span>} value={stats.total} valueStyle={{ color: '#fff' }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>调解员</span>} value={stats.mediator} valueStyle={{ color: '#fff' }} />
              </Card>
            </Col>
          </Row>
        }
      />

      <PageSectionCard title="工作区切换">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {managementWorkspace === 'people' ? '当前正在处理人员管理' : '当前正在处理值班管理'}
            </div>
            <Text type="secondary">
              {managementWorkspace === 'people'
                ? '用于筛选、维护人员资料、组织架构和角色。'
                : '用于配置正式值班名单、临时调整、本周预览和最近调整记录。'}
            </Text>
          </div>
          <Segmented
            value={managementWorkspace}
            onChange={(value) => setManagementWorkspace(value as 'people' | 'duty')}
            options={[
              { label: '人员管理', value: 'people' },
              { label: '值班管理', value: 'duty' }
            ]}
          />
        </div>
      </PageSectionCard>

      <PageToolbar>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} lg={isTenantAdmin ? 14 : 8}>
            <Text type="secondary">关键词搜索</Text>
            <Input
              placeholder="按姓名、电话、用户名搜索"
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: '100%', marginTop: 8 }}
            />
          </Col>
          {!isTenantAdmin && (
            <Col xs={24} sm={12} lg={6}>
              <Text type="secondary">街道筛选</Text>
              <Select
                placeholder="按街道筛选"
                style={{ width: '100%', marginTop: 8 }}
                value={selectedTenantId}
                onChange={handleTenantChange}
                allowClear
              >
                {tenants.map(tenant => (
                  <Option key={tenant.id} value={tenant.id}>{tenant.tenantName}</Option>
                ))}
              </Select>
            </Col>
          )}
          <Col xs={24} sm={12} lg={6}>
            <Text type="secondary">科室筛选</Text>
            <Select
              placeholder="按科室筛选"
              style={{ width: '100%', marginTop: 8 }}
              value={selectedDepartment}
              onChange={handleDepartmentChange}
              allowClear
              disabled={!selectedTenantId && !isTenantAdmin}
            >
              {departments.map(dept => (
                <Option key={dept} value={dept}>{dept}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} lg={4}>
            <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={executeSearch}>搜索</Button>
              <Button onClick={resetFilters}>重置</Button>
            </Space>
          </Col>
        </Row>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Space wrap>
            {managementWorkspace === 'people' ? (
              <>
                <Tag color="blue">街道管理员 {stats.tenantAdmin}</Tag>
                <Tag color="green">调解员 {stats.mediator}</Tag>
              </>
            ) : (
              <>
                <Tag color="green">正式值班 {dutyConfig?.dutyUserIds.length || 0}</Tag>
                <Tag color="gold">近30天调整 {dutyStats?.totalAdjustments || 0}</Tag>
                <Tag color="blue">{targetDutyTenantId ? '已选街道可配置值班' : '请先选择街道后配置值班'}</Tag>
              </>
            )}
          </Space>
          <Space wrap>
            {managementWorkspace === 'people' ? (
              <>
                <Segmented
                  value={viewMode}
                  onChange={(value) => setViewMode(value as 'table' | 'tree')}
                  options={[
                    { label: '表格视图', value: 'table' },
                    { label: '树形视图', value: 'tree' }
                  ]}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                  添加用户
                </Button>
                <ExportButton onClick={handleExportUsers}>导出用户</ExportButton>
              </>
            ) : null}
          </Space>
        </div>
      </PageToolbar>

      {managementWorkspace === 'duty' && (isTenantAdmin || (isSuperAdmin && selectedTenantId)) && (
        <PageSectionCard title="值班调解员配置">
          {dutyConfig && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ExportButton onClick={handleExportDutyConfig}>导出值班配置</ExportButton>
              </div>
              <Alert
                type={hasFormalDutyConfig ? 'success' : hasDraftFormalDutyConfig ? 'info' : 'warning'}
                showIcon
                message={hasFormalDutyConfig ? `已完成正式值班配置：${dutyConfig.tenantName}` : hasDraftFormalDutyConfig ? `已选择值班人员，待保存生效：${dutyConfig.tenantName}` : `当前尚未完成正式值班配置：${dutyConfig.tenantName}`}
                description={dutyConfig.currentDutyAssignee
                  ? `${hasFormalDutyConfig ? '当前接收人' : '当前临时接收人'}：${formatDutyCandidateName(dutyConfig.currentDutyAssignee)}${dutyConfig.currentDutyAssignee.phone ? `（${dutyConfig.currentDutyAssignee.phone}）` : ''}。下方先处理正式轮值，再按需做今天的临时调整。`
                  : '当前没有可用值班人员，请先完成正式轮值配置。'}
              />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#f8fbff' }}>
                    <Statistic title="正式值班人数" value={dutyConfig.dutyUserIds.length} />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#f3faf7' }}>
                    <Statistic title="当前状态" value={hasFormalDutyConfig ? dutyModeText : '待完成正式配置'} />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fff9e8' }}>
                    <Statistic title="近30天调整" value={dutyStats?.totalAdjustments || 0} />
                  </Card>
                </Col>
              </Row>
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={16}>
                  <Card bordered={false} style={{ borderRadius: 16, background: '#fafafa' }}>
                    <div style={{ display: 'grid', gap: 18 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>正式轮值配置</div>
                        <Text type="secondary">按“选人、排顺序、确定起点”三步完成正式值班。保存后系统会自动轮换。</Text>
                      </div>
                      <div>
                        <div style={{ marginBottom: 8, color: '#666', fontWeight: 600 }}>1. 选择值班人员</div>
                        <Select
                          mode="multiple"
                          style={{ width: '100%' }}
                          value={draftDutyUserIds}
                          placeholder="请选择参与值班的调解员"
                          disabled={savingDuty}
                          onChange={(value) => {
                            const nextIds = value as string[];
                            setDraftDutyUserIds(nextIds);
                            setDraftCurrentDutyUserId(nextIds.includes(String(draftCurrentDutyUserId || ''))
                              ? draftCurrentDutyUserId
                              : (nextIds[0] || null));
                          }}
                          options={dutyConfig.mediators.map(item => ({
                            value: item.id,
                            label: `${formatDutyCandidateName(item)}${item.phone ? `（${item.phone}）` : item.officePhone ? `（${item.officePhone}）` : ''}`
                          }))}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 8, color: '#666', fontWeight: 600 }}>2. 调整轮值顺序</div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {draftDutyUserIds.length === 0 ? (
                            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fff7e6' }}>
                              <Text type="secondary">请先选择值班人员，再调整顺序。</Text>
                            </Card>
                          ) : draftDutyUserIds.map((userId, index) => {
                            const person = dutyConfig.mediators.find(item => item.id === userId);
                            const isRotationToday = dutyConfig.currentDutyAssignee?.id === userId && dutyConfig.currentDutyAssignee?.source === 'rotation';
                            const isOverrideToday = dutyConfig.currentDutyAssignee?.id === userId && dutyConfig.currentDutyAssignee?.source === 'manual_override';
                            return (
                              <Card key={userId} size="small" bordered={false} style={{ borderRadius: 14, background: isRotationToday ? '#f0f7ff' : isOverrideToday ? '#fff7e6' : '#ffffff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                  <Space>
                                    <Avatar>{index + 1}</Avatar>
                                    <div>
                                      <div style={{ fontWeight: 700 }}>{formatDutyCandidateName(person)}</div>
                                      <Text type="secondary">{person?.phone || person?.officePhone || '暂无电话'}</Text>
                                    </div>
                                  </Space>
                                  <Space wrap>
                                    {isRotationToday && <Tag color="blue">今天轮值</Tag>}
                                    {isOverrideToday && <Tag color="gold">今天代理</Tag>}
                                    <Button icon={<ArrowUpOutlined />} disabled={index === 0 || savingDuty} onClick={() => {
                                      const nextIds = [...draftDutyUserIds];
                                      const [current] = nextIds.splice(index, 1);
                                      nextIds.splice(index - 1, 0, current);
                                      setDraftDutyUserIds(nextIds);
                                    }} />
                                    <Button icon={<ArrowDownOutlined />} disabled={index === draftDutyUserIds.length - 1 || savingDuty} onClick={() => {
                                      const nextIds = [...draftDutyUserIds];
                                      const [current] = nextIds.splice(index, 1);
                                      nextIds.splice(index + 1, 0, current);
                                      setDraftDutyUserIds(nextIds);
                                    }} />
                                  </Space>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={{ marginBottom: 8, color: '#666', fontWeight: 600 }}>3. 确定今天从谁开始</div>
                        <Select
                          style={{ width: '100%' }}
                          value={draftDutyUserIds.length > 0 ? (draftCurrentDutyUserId || undefined) : undefined}
                          placeholder="请选择今天的轮值起点"
                          disabled={savingDuty || draftDutyUserIds.length === 0}
                          onChange={(value) => setDraftCurrentDutyUserId(value)}
                          options={dutyConfig.mediators
                            .filter(item => draftDutyUserIds.includes(item.id))
                            .map(item => ({
                              value: item.id,
                              label: `${formatDutyCandidateName(item)}${item.phone ? `（${item.phone}）` : item.officePhone ? `（${item.officePhone}）` : ''}`
                            }))}
                        />
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Text type="secondary">保存后会按当前顺序和起点继续自动轮换。</Text>
                          <Button type="primary" disabled={savingDuty || draftDutyUserIds.length === 0} onClick={saveFormalDutyConfig}>
                            保存正式值班配置
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} xl={8}>
                  <div style={{ display: 'grid', gap: 16 }}>
                    <Card bordered={false} style={{ borderRadius: 16, background: '#f8fbff' }}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>当前值班状态</div>
                          <Text type="secondary">先看当前谁在接收，再决定是否需要做今天的临时调整。</Text>
                        </div>
                        <div>
                          <div style={{ color: '#666', marginBottom: 6 }}>当前接收人</div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>
                            {dutyConfig.currentDutyAssignee ? formatDutyCandidateName(dutyConfig.currentDutyAssignee) : '未安排'}
                          </div>
                          <Text type="secondary">
                            {dutyConfig.currentDutyAssignee?.phone || dutyConfig.currentDutyAssignee?.officePhone || '暂无联系电话'}
                          </Text>
                        </div>
                        <div>
                          <div style={{ color: '#666', marginBottom: 6 }}>原因说明</div>
                          <Input
                            placeholder="如：今日外出开会、临时请假、重新开始轮值"
                            value={dutyReason}
                            onChange={(e) => setDutyReason(e.target.value)}
                            maxLength={100}
                          />
                        </div>
                        <Space wrap>
                          <Button
                            icon={<SwapOutlined />}
                            disabled={savingDuty || !hasFormalDutyConfig || dutyConfig.dutyUserIds.length < 2}
                            onClick={() => openDutyActionModal('advance')}
                          >
                            顺延到下一位
                          </Button>
                          <Button disabled={!hasFormalDutyConfig} onClick={() => openDutyActionModal('override')}>
                            设置今日代理
                          </Button>
                          {dutyConfig.dutyOverrideUserId && (
                            <Button onClick={() => openDutyActionModal('clear_override')}>
                              清除今日代理
                            </Button>
                          )}
                        </Space>
                        <Text type="secondary">临时调整只影响当天，不会改动正式轮值顺序。</Text>
                        {hasFormalDutyConfig && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <Switch
                              checked={draftAllowAdminAsMediator}
                              disabled={savingDuty}
                              onChange={(checked) => setDraftAllowAdminAsMediator(checked)}
                            />
                            <span style={{ color: '#666' }}>正式值班不可用时，允许街道管理员临时接收</span>
                          </div>
                        )}
                      </div>
                    </Card>

                    {dutyWarnings.length > 0 && (
                      <Card bordered={false} style={{ borderRadius: 16, background: '#fffdf6' }}>
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>提醒</div>
                          {dutyWarnings.slice(0, 2).map((item, index) => (
                            <Alert
                              key={`${item.message}-${index}`}
                              type={item.type}
                              showIcon
                              message={item.message}
                              description={item.description}
                            />
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                  <Card bordered={false} style={{ borderRadius: 16, background: '#fafafa', height: '100%' }}>
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>本周值班预览</div>
                          <Text type="secondary">确认未来几天的接收顺序是否符合预期。</Text>
                        </div>
                        <Button onClick={() => setDutyCalendarVisible(true)}>
                          查看月历
                        </Button>
                      </div>
                      <Row gutter={[12, 12]}>
                        {!hasFormalDutyConfig ? (
                          <Col span={24}>
                            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fff7e6' }}>
                              <Text type="secondary">尚未保存正式值班名单，暂不展示正式轮值预览。</Text>
                            </Card>
                          </Col>
                        ) : dutyCoverage.nextSevenDays.length === 0 ? (
                          <Col span={24}>
                            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fff7e6' }}>
                              <Text type="secondary">当前没有可预览的轮值，请先配置值班名单。</Text>
                            </Card>
                          </Col>
                        ) : dutyCoverage.nextSevenDays.map((item) => (
                          <Col xs={12} md={8} lg={6} key={item.date}>
                            <Card size="small" bordered={false} style={{ borderRadius: 14, background: item.isCurrent ? '#f0f7ff' : '#ffffff' }}>
                              <div style={{ fontWeight: 700 }}>{item.date}</div>
                              <div style={{ marginTop: 6 }}>{item.assignee}</div>
                              {item.isCurrent && <Tag color="blue" style={{ marginTop: 8 }}>今天</Tag>}
                              {item.isOverride && <Tag color="gold" style={{ marginTop: 8 }}>代理</Tag>}
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card bordered={false} style={{ borderRadius: 16, background: '#fafafa', height: '100%' }}>
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>最近调整记录</div>
                          <Text type="secondary">只保留最近的调整痕迹，方便快速回看。</Text>
                        </div>
                        <Select
                          style={{ width: 180 }}
                          value={dutyLogFilter}
                          onChange={(value) => setDutyLogFilter(value as typeof dutyLogFilter)}
                          options={[
                            { label: '全部动作', value: 'all' },
                            { label: '更新名单/顺序', value: 'rotation_update' },
                            { label: '设置今日代理', value: 'manual_override' },
                            { label: '清除今日代理', value: 'manual_override_clear' },
                            { label: '顺延到下一位', value: 'advance_next' }
                          ]}
                        />
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {dutyLogs.length === 0 ? (
                          <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#ffffff' }}>
                            <Text type="secondary">暂时没有值班调整记录。</Text>
                          </Card>
                        ) : dutyLogs.slice(0, 6).map((item) => {
                          const actionLabelMap: Record<string, string> = {
                            rotation_update: '更新名单/顺序',
                            manual_override: '设置今日代理',
                            manual_override_clear: '清除今日代理',
                            advance_next: '顺延到下一位'
                          };
                          return (
                            <Card key={item.id} size="small" bordered={false} style={{ borderRadius: 14, background: '#ffffff' }}>
                              <div>
                                <Space wrap>
                                  <Tag color="blue">{actionLabelMap[item.actionType] || item.actionType}</Tag>
                                  {item.effectiveDate ? <Tag>{dayjs(item.effectiveDate).format('MM-DD')}</Tag> : null}
                                </Space>
                                <div style={{ marginTop: 6, fontWeight: 600 }}>{item.reason || '未填写原因'}</div>
                                <Text type="secondary">
                                  操作人：{item.createdByName || '系统'} · {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                                </Text>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </PageSectionCard>
      )}

      {managementWorkspace === 'duty' && !(isTenantAdmin || (isSuperAdmin && selectedTenantId)) && (
        <PageSectionCard title="值班调解员配置">
          <Alert
            type="info"
            showIcon
            message="请先选择街道"
            description="超级管理员进入值班管理时，需要先在上方筛选区选择一个街道，才能查看和维护该街道的值班配置。"
          />
        </PageSectionCard>
      )}

      {managementWorkspace === 'people' && (
        viewMode === 'table' ? (
          <PageSectionCard bodyClassName="">
          <div style={{ overflowX: 'auto' }}>
            <Table
              columns={columns}
              dataSource={users}
              rowKey="id"
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
          </PageSectionCard>
        ) : (
          <PageSectionCard title="组织架构树">
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
          </PageSectionCard>
        )
      )}

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" disabled={!!editingUser} />
              </Form.Item>
            </Col>
            {!editingUser && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password placeholder="请输入密码" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="position"
                label="岗位"
                rules={[{ required: true, message: '请输入岗位' }]}
              >
                <Input placeholder="请输入岗位" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="officePhone"
                label="办公室电话"
                rules={[{ required: true, message: '请输入办公室电话' }]}
              >
                <Input placeholder="请输入办公室电话" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="手机"
              >
                <Input placeholder="请输入手机（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="tenantId"
                label="所属街道"
                rules={[{ required: true, message: '请选择所属街道' }]}
              >
                <Select placeholder="请选择所属街道" disabled={isTenantAdmin} onChange={handleFormTenantChange}>
                  {tenants.map(tenant => (
                    <Option key={tenant.id} value={tenant.id}>{tenant.tenantName}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="street"
                label="街道"
                rules={[{ required: true, message: '请选择所属街道' }]}
              >
                <Input placeholder="自动带出所选街道" disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="department"
                label="科室"
                rules={[{ required: true, message: '请输入科室' }]}
              >
                <Input placeholder="请输入科室" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select placeholder="请选择角色">
                  {isSuperAdmin && <Option value="superadmin">超级管理员</Option>}
                  {(isSuperAdmin || isTenantAdmin) && <Option value="tenant_admin">街道管理员</Option>}
                  <Option value="mediator">调解员</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

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

      <Modal
        title="请假 / 调班处理"
        open={dutyActionModalVisible}
        onCancel={() => setDutyActionModalVisible(false)}
        onOk={submitDutyAction}
        okText="确认执行"
        cancelText="取消"
        confirmLoading={savingDuty}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <Alert
            type="info"
            showIcon
            message="处理说明"
            description="临时代理只影响今天；顺延到下一位会把今天的轮值起点直接切到下一位，并从明天继续顺序轮转。"
          />
          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>处理方式</div>
            <Segmented
              block
              value={dutyActionType}
              onChange={(value) => setDutyActionType(value as 'override' | 'advance' | 'clear_override')}
              options={[
                { label: '设今日代理', value: 'override' },
                { label: '顺延到下一位', value: 'advance' },
                { label: '清除今日代理', value: 'clear_override' }
              ]}
            />
          </div>
          {dutyActionType === 'override' && (
            <div>
              <div style={{ marginBottom: 8, color: '#666' }}>代理调解员</div>
              <Select
                style={{ width: '100%' }}
                value={dutyActionUserId}
                placeholder="请选择今日代理调解员"
                onChange={(value) => setDutyActionUserId(value)}
                options={(dutyConfig?.mediators || [])
                  .filter(item => dutyConfig?.dutyUserIds.includes(item.id))
                  .map(item => ({
                    value: item.id,
                    label: `${formatDutyCandidateName(item)}${item.phone ? `（${item.phone}）` : item.officePhone ? `（${item.officePhone}）` : ''}`
                  }))}
              />
            </div>
          )}
          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>原因说明</div>
            <Input.TextArea
              rows={4}
              value={dutyActionReason}
              onChange={(e) => setDutyActionReason(e.target.value)}
              placeholder="例如：今日开庭外出，由同组调解员临时代理；或当前值班人请假，顺延到下一位。"
              maxLength={200}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="值班月历"
        open={dutyCalendarVisible}
        onCancel={() => setDutyCalendarVisible(false)}
        footer={null}
        width={920}
      >
        <Alert
          type="info"
          showIcon
          message="值班月历"
          description="用于查看整月排班。点击某一天可以继续查看当天详情。"
          style={{ marginBottom: 16 }}
        />
        <Calendar
          value={dutyCalendarMonth}
          onPanelChange={(value) => setDutyCalendarMonth(value)}
          onSelect={openDutyCalendarDetail}
          fullscreen={false}
          headerRender={({ value, type, onChange, onTypeChange }) => {
            const currentYear = value.year();
            const monthOptions = dayjs.monthsShort().map((month, index) => ({
              label: month,
              value: index
            }));
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <Space wrap>
                  <Select
                    style={{ width: 120 }}
                    value={currentYear}
                    onChange={(newYear) => onChange(value.clone().year(newYear))}
                    options={Array.from({ length: 5 }).map((_, index) => {
                      const year = dayjs().year() - 2 + index;
                      return { label: `${year}`, value: year };
                    })}
                  />
                  <Select
                    style={{ width: 120 }}
                    value={value.month()}
                    onChange={(newMonth) => onChange(value.clone().month(newMonth))}
                    options={monthOptions}
                  />
                </Space>
                <Segmented
                  value={type}
                  onChange={(nextType) => onTypeChange(nextType as 'month' | 'year')}
                  options={[
                    { label: 'Month', value: 'month' },
                    { label: 'Year', value: 'year' }
                  ]}
                  style={{ minWidth: 180 }}
                />
              </div>
            );
          }}
          cellRender={(date) => {
            const item = dutyCalendarMap.get(date.format('YYYY-MM-DD'));
            if (!item?.assignee) return null;
            return (
              <div style={{ marginTop: 6, cursor: 'pointer' }}>
                <Tag color={item.isOverride ? 'gold' : 'blue'} style={{ marginInlineEnd: 0 }}>
                  {formatDutyCandidateName(item.assignee)}
                </Tag>
              </div>
            );
          }}
        />
      </Modal>

      <Modal
        title="值班详情"
        open={dutyCalendarDetailVisible}
        onCancel={() => setDutyCalendarDetailVisible(false)}
        footer={null}
      >
        {selectedDutyCalendarItem ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <Alert
              type={selectedDutyCalendarItem.isOverride ? 'warning' : 'info'}
              showIcon
              message={dayjs(selectedDutyCalendarItem.date).format('YYYY年MM月DD日')}
              description={selectedDutyCalendarItem.isOverride ? '当天存在临时代理，次日会恢复正常轮值。' : '当天按系统顺序正常轮值。'}
            />
            <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fafafa' }}>
              <div style={{ fontWeight: 700 }}>{formatDutyCandidateName(selectedDutyCalendarItem.assignee)}</div>
              <Text type="secondary">
                {selectedDutyCalendarItem.assignee?.phone || selectedDutyCalendarItem.assignee?.officePhone || '暂无联系电话'}
              </Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  <Tag color={selectedDutyCalendarItem.isOverride ? 'gold' : 'blue'}>
                    {selectedDutyCalendarItem.isOverride ? '临时代理' : '正常轮值'}
                  </Tag>
                  {selectedDutyCalendarItem.isToday && <Tag color="green">今天</Tag>}
                </Space>
              </div>
            </Card>
          </div>
        ) : null}
      </Modal>
    </PageShell>
  );
};

export default UserManagement;
