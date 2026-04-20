import { Layout as AntLayout, Menu, Button, Badge, message, Popover, Dropdown } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { io, Socket } from 'socket.io-client';
import { DashboardOutlined, FileSearchOutlined, FileAddOutlined, UserAddOutlined, BellOutlined, BarChartOutlined, LogoutOutlined, UserOutlined, SettingOutlined, CalendarOutlined, CheckCircleOutlined, MenuOutlined, BankOutlined, BuildOutlined, TeamOutlined, FileTextOutlined } from '@ant-design/icons';

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
        systemName: response.data.basic?.systemName || '劳动仲裁调解系统',
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
      const newSocket = io('http://localhost:5002', {
        transports: ['websocket']
      });

      // 连接成功后加入用户房间
      newSocket.on('connect', () => {
        newSocket.emit('joinUserRoom', userInfo.id);
      });

      // 监听弹窗通知
      newSocket.on('popupNotification', (data: { content: string; messageId: string }) => {
        setNotification(data);
        setVisible(true);
        fetchUnreadCount();
      });

      // 监听新消息
      newSocket.on('newMessage', () => {
        fetchUnreadCount();
      });

      setSocket(newSocket);

      // 组件卸载时断开连接
      return () => {
        newSocket.disconnect();
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

  // 根据用户角色动态生成菜单项
  const generateMenuItems = () => {
    const baseItems = [
      { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">工作台</Link> },
      { key: '/case-query', icon: <FileSearchOutlined />, label: <Link to="/case-query">案件查询</Link> }
    ];

    // 移除个人用户和企业用户的申请调解菜单

    // 调解员和管理员可以登记到访
    if (userInfo?.role === 'mediator' || userInfo?.role === 'admin') {
      baseItems.push({ key: '/visitor-register', icon: <UserAddOutlined />, label: <Link to="/visitor-register">到访登记</Link> });
    }

    // 调解员和管理员可以发布站内广播
    if (userInfo?.role === 'mediator' || userInfo?.role === 'admin') {
      baseItems.push({ key: '/broadcast', icon: <BellOutlined />, label: <Link to="/broadcast">站内广播</Link> });
    }

    // 调解员和管理员可以查看数据分析
    if (userInfo?.role === 'mediator' || userInfo?.role === 'admin') {
      baseItems.push({ key: '/data-analysis', icon: <BarChartOutlined />, label: <Link to="/data-analysis">数据分析</Link> });
      baseItems.push({ key: '/schedule-management', icon: <CalendarOutlined />, label: <Link to="/schedule-management">日程管理</Link> });
      baseItems.push({ key: '/reminder-settings', icon: <SettingOutlined />, label: <Link to="/reminder-settings">提醒设置</Link> });
    }

    // 管理员可以访问用户管理、系统设置和服务管理
    if (userInfo?.role === 'admin') {
      baseItems.push({ key: '/user-management', icon: <UserOutlined />, label: <Link to="/user-management">用户管理</Link> });
      baseItems.push({ key: '/system-settings', icon: <SettingOutlined />, label: <Link to="/system-settings">系统设置</Link> });
      baseItems.push({ key: '/service-management', icon: <SettingOutlined />, label: <Link to="/service-management">服务管理</Link> });
      baseItems.push({ key: '/api-docs', icon: <FileTextOutlined />, label: <Link to="/api-docs">API文档</Link> });
      baseItems.push({ key: '/monitoring', icon: <BarChartOutlined />, label: <Link to="/monitoring">系统监控</Link> });
      baseItems.push({ key: '/analytics', icon: <BarChartOutlined />, label: <Link to="/analytics">用户行为分析</Link> });
    }

    return baseItems;
  };

  const menuItems = generateMenuItems();

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
            {userInfo?.role === 'mediator' || userInfo?.role === 'admin' ? (
              <Button type="text" icon={<BellOutlined />} style={{ color: 'white' }}>
                <Link to="/message-center">
                  <Badge count={unreadCount} showZero />
                </Link>
              </Button>
            ) : null}
            
            {/* 在大屏幕上显示用户信息和退出按钮 */}
            {!isMobile && (
              <>
                <span style={{ color: 'white', fontSize: '12px', whiteSpace: 'nowrap' }}>{userInfo?.name} ({userInfo?.role})</span>
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
                      label: <span>{userInfo?.name} ({userInfo?.role})</span>
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
            style={{ backgroundColor: '#f0f2f5' }}
            breakpoint="md"
            collapsedWidth="0"
            onBreakpoint={(broken) => console.log(broken)}
            onCollapse={(collapsed, type) => console.log(collapsed, type)}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{ height: '100%', borderRight: 0 }}
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
