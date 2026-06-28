import { Layout as AntLayout, Menu, Button, Badge, message, Popover, Dropdown } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import socketService from '../../services/socketService';
import { io, Socket } from 'socket.io-client';
import { DashboardOutlined, FileSearchOutlined, FileAddOutlined, UserAddOutlined, BellOutlined, BarChartOutlined, LogoutOutlined, UserOutlined, SettingOutlined, CalendarOutlined, CheckCircleOutlined, MenuOutlined, BankOutlined, BuildOutlined, TeamOutlined, FileTextOutlined, ApartmentOutlined } from '@ant-design/icons';
import { getRoleLabel, getRoleNavigationMeta } from '../../utils/roleNavigation';

const { Header, Content, Sider } = AntLayout;

const Layout: React.FC = () => {
  const { isAuthenticated, userInfo, logout } = useAuthStore();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState<{ content: string; messageId: string } | null>(null);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [systemSettings, setSystemSettings] = useState({
    systemName: '劳动仲裁调解系统',
    systemIcon: 'BankOutlined'
  });

  // 监听屏幕宽度变化
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取未读通知数量
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/message/unread-count');
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('获取未读通知数量失败:', error);
    }
  };

  // 获取系统设置
  const fetchSystemSettings = async () => {
    try {
      const response = await api.get('/system/settings');
      setSystemSettings({
        // 兼容：后端可能返回 basic.systemName 或旧字段 basic.siteName
        systemName: response.data.basic?.systemName || response.data.basic?.siteName || '劳动仲裁调解系统',
        systemIcon: response.data.basic?.systemIcon || 'BankOutlined'
      });
    } catch (error) {
      console.error('获取系统设置失败:', error);
    }
  };

  // 标记消息为已读
  const markAsRead = async (messageId: string) => {
    try {
      await api.put(`/message/${messageId}/read`);
      setVisible(false);
      fetchUnreadCount();
      message.success('消息已标记为已读');
    } catch (error) {
      message.error('标记消息为已读失败');
    }
  };

  // 关闭弹窗
  const handleClose = () => {
    setVisible(false);
  };

  useEffect(() => {
    fetchSystemSettings();
    if (isAuthenticated) {
      fetchUnreadCount();
      // 每30秒刷新一次未读通知数量
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // 初始化Socket连接
  useEffect(() => {
    if (userInfo) {
      const socket = socketService.connect();

      // 连接成功后加入用户房间
      socket.on('connect', () => {
        socket.emit('joinUserRoom', userInfo.id);
      });

      // 监听弹窗通知
      socket.on('popupNotification', (data: { content: string; messageId: string }) => {
        setNotification(data);
        setVisible(true);
        fetchUnreadCount();
      });

      // 监听新消息
      socket.on('newMessage', () => {
        fetchUnreadCount();
      });

      setSocket(socket);

      // 组件卸载时断开连接
      return () => {
        socketService.disconnect();
      };
    }
  }, [userInfo]);

  // 根据系统图标名称获取图标组件
  const getSystemIcon = () => {
    const iconMap: Record<string, React.ReactNode> = {
      BankOutlined: <BankOutlined />,
      BuildingOutlined: <BuildOutlined />,
      TeamOutlined: <TeamOutlined />,
      UserOutlined: <UserOutlined />,
      FileTextOutlined: <FileTextOutlined />,
      SettingOutlined: <SettingOutlined />,
      BellOutlined: <BellOutlined />,
      DashboardOutlined: <DashboardOutlined />
    };
    return iconMap[systemSettings.systemIcon] || <BankOutlined />;
  };

  const createMenuItem = (path: string, label: string, icon: React.ReactNode) => ({
    key: path,
    icon,
    label: <Link to={path}>{label}</Link>
  });

  // 根据用户角色动态生成菜单项
  const generateMenuItems = () => {
    const isSuperAdmin = userInfo?.role === 'superadmin';
    const isTenantAdmin = userInfo?.role === 'tenant_admin';
    const isMediator = userInfo?.role === 'mediator';
    const isInternalUser = ['superadmin', 'tenant_admin', 'mediator'].includes(userInfo?.role || '');
    const isExternalUser = ['personal', 'company'].includes(userInfo?.role || '');

    if (isExternalUser) {
      return [
        {
          type: 'group' as const,
          label: '我的服务',
          children: [
            createMenuItem('/dashboard', '我的首页', <DashboardOutlined />),
            createMenuItem('/case-apply', '申请调解', <FileAddOutlined />),
            createMenuItem('/case-query', '我的案件', <FileSearchOutlined />)
          ]
        },
        {
          type: 'group' as const,
          label: '帮助与反馈',
          children: [
            createMenuItem('/feedback-center', '意见反馈', <FileTextOutlined />)
          ]
        }
      ];
    }

    const businessChildren = [
      createMenuItem('/dashboard', '工作台', <DashboardOutlined />),
      createMenuItem('/case-query', '案件查询', <FileSearchOutlined />)
    ];

    if (isInternalUser) {
      businessChildren.push(createMenuItem('/visitor-register', '到访登记', <UserAddOutlined />));
      businessChildren.push(createMenuItem('/broadcast', '站内广播', <BellOutlined />));
      businessChildren.push(createMenuItem('/schedule-management', '日程管理', <CalendarOutlined />));
    }

    const items: any[] = [
      {
        type: 'group',
        label: isMediator ? '我的工作' : '业务中心',
        children: businessChildren
      }
    ];

    if (isMediator) {
      items.push({
        type: 'group',
        label: '支持与复盘',
        children: [
          createMenuItem('/mediator-analysis', '办案分析', <BarChartOutlined />),
          createMenuItem('/feedback-center', '意见反馈', <FileTextOutlined />)
        ]
      });
      return items;
    }

    if (isTenantAdmin) {
      items.push({
        type: 'group',
        label: '街道运营',
        children: [
          createMenuItem('/user-management', '人员与值班', <UserOutlined />),
          createMenuItem('/data-analysis', '数据分析', <BarChartOutlined />)
        ]
      });
      items.push({
        type: 'group',
        label: '协作支持',
        children: [
          createMenuItem('/feedback-center', '意见反馈', <FileTextOutlined />)
        ]
      });
      return items;
    }

    if (isSuperAdmin) {
      items.push({
        type: 'group',
        label: '组织管理',
        children: [
          createMenuItem('/user-management', '人员与值班', <UserOutlined />),
          createMenuItem('/tenant-management', '街道管理', <ApartmentOutlined />)
        ]
      });
      items.push({
        type: 'group',
        label: '运营分析',
        children: [
          createMenuItem('/data-analysis', '数据分析', <BarChartOutlined />),
          createMenuItem('/analytics', '用户行为分析', <BarChartOutlined />)
        ]
      });
      items.push({
        type: 'group',
        label: '系统管理',
        children: [
          createMenuItem('/system-settings', '系统设置', <SettingOutlined />),
          createMenuItem('/service-management', '服务管理', <BuildOutlined />),
          createMenuItem('/monitoring', '系统监控', <BarChartOutlined />),
          createMenuItem('/api-docs', 'API文档', <FileTextOutlined />),
          createMenuItem('/feedback-center', '意见反馈', <FileTextOutlined />)
        ]
      });
      return items;
    }

    return items;
  };

  const menuItems = generateMenuItems();
  const roleNavigationMeta = getRoleNavigationMeta(userInfo?.role, userInfo?.tenantName);
  const roleLabel = getRoleLabel(userInfo?.role, userInfo?.tenantName);

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 通知弹窗 */}
      {notification && visible && (
        <Popover
          content={
            <div style={{ width: '90vw', maxWidth: 300, padding: 16 }}>
              <div style={{ marginBottom: 16, lineHeight: 1.5 }}>
                {notification.content}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button size="small" onClick={handleClose}>
                  关闭
                </Button>
                <Button 
                  size="small" 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  onClick={() => markAsRead(notification.messageId)}
                >
                  标记已读
                </Button>
              </div>
            </div>
          }
          title="新消息"
          open={visible}
          onOpenChange={setVisible}
          trigger="click"
          placement="bottomRight"
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}
        >
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }} />
        </Popover>
      )}
      <Header style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#001529', padding: '12px 16px', flexWrap: 'wrap', minHeight: 64, zIndex: 1000 }}>
        <div style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: '20px' }}>{getSystemIcon()}</div>
          {systemSettings.systemName}
        </div>
        {isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* 只有调解员和管理员可以看到通知按钮 */}
            {['superadmin', 'tenant_admin', 'mediator'].includes(userInfo?.role || '') ? (
              <Button type="text" icon={<BellOutlined />} style={{ color: 'white' }}>
                <Link to="/message-center">
                  <Badge count={unreadCount} showZero />
                </Link>
              </Button>
            ) : null}
            
            {/* 在大屏幕上显示用户信息和退出按钮 */}
            {!isMobile && (
              <>
                <span style={{ color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {userInfo?.name} ({roleLabel})
                </span>
                <Button type="text" icon={<LogoutOutlined />} style={{ color: 'white' }} onClick={logout}>
                  退出登录
                </Button>
              </>
            )}
            
            {/* 在小屏幕上显示下拉菜单 */}
            {isMobile && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'user',
                      label: <span>{userInfo?.name} ({roleLabel})</span>
                    },
                    {
                      key: 'logout',
                      label: <Button type="text" icon={<LogoutOutlined />} style={{ color: 'black' }} onClick={logout}>
                        退出登录
                      </Button>
                    }
                  ]
                }}
              >
                <Button type="text" icon={<MenuOutlined />} style={{ color: 'white' }} />
              </Dropdown>
            )}
          </div>
        )}
      </Header>
      {isAuthenticated && (
        <AntLayout>
          <Sider 
            width={200} 
            style={{ backgroundColor: '#f7f8fa', borderRight: '1px solid #eef1f5' }}
            breakpoint="md"
            collapsedWidth="0"
            onBreakpoint={(broken) => console.log(broken)}
            onCollapse={(collapsed, type) => console.log(collapsed, type)}
          >
            <div style={{ padding: 12, borderBottom: '1px solid #eef1f5' }}>
              <div
                style={{
                  padding: '12px 12px 10px',
                  borderRadius: 12,
                  background: roleNavigationMeta.background,
                  border: `1px solid ${roleNavigationMeta.accent}22`
                }}
              >
                <div style={{ fontSize: 12, color: roleNavigationMeta.accent, fontWeight: 700, marginBottom: 6 }}>
                  {roleNavigationMeta.title}
                </div>
                <div style={{ fontSize: 12, color: '#5b6475', lineHeight: 1.5 }}>
                  {roleNavigationMeta.description}
                </div>
              </div>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{ height: '100%', borderRight: 0, backgroundColor: '#f7f8fa', paddingTop: 8 }}
              items={menuItems}
            />
          </Sider>
          <Content style={{ padding: '16px', backgroundColor: '#f0f2f5', minHeight: 280 }}>
            <Outlet />
          </Content>
        </AntLayout>
      )}
      {!isAuthenticated && (
        <Content style={{ padding: '16px', backgroundColor: '#f0f2f5', minHeight: 280 }}>
          <Outlet />
        </Content>
      )}
    </AntLayout>
  );
};

export default Layout;
