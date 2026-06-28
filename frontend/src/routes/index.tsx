import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '../components/layout/Layout';
import RequireAuth from '../components/common/RequireAuth';
import RoleBasedRoute from '../components/common/RoleBasedRoute';
import useAuthStore from '../store/authStore';
import { getDefaultRouteByRole } from '../utils/roleNavigation';
import Broadcast from '../pages/Broadcast';

// 使用React.lazy进行组件懒加载
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const CaseQuery = lazy(() => import('../pages/CaseQuery'));
const CaseApply = lazy(() => import('../pages/CaseApply'));
const CaseDetail = lazy(() => import('../pages/CaseDetail'));
const DataAnalysis = lazy(() => import('../pages/DataAnalysis'));
const UserManagement = lazy(() => import('../pages/UserManagement'));
const TenantManagement = lazy(() => import('../pages/TenantManagement'));
const SystemSettings = lazy(() => import('../pages/SystemSettings'));
const ServiceManagement = lazy(() => import('../pages/ServiceManagement'));
const ScheduleManagement = lazy(() => import('../pages/ScheduleManagement'));
const MediatorAnalysis = lazy(() => import('../pages/MediatorAnalysis'));
const MessageCenter = lazy(() => import('../pages/MessageCenter'));
const FeedbackCenter = lazy(() => import('../pages/FeedbackCenter'));
const SocketTest = lazy(() => import('../pages/SocketTest'));
const Monitoring = lazy(() => import('../pages/Monitoring'));
const Analytics = lazy(() => import('../pages/Analytics'));
const Test = lazy(() => import('../pages/Test'));
const ApiDocs = lazy(() => import('../pages/ApiDocs'));

// 创建一个加载组件
const Loading = () => (
  <div className="session-restore-shell">
    <div className="session-restore-card">
      <div className="session-restore-spinner" />
      <div className="session-restore-title">页面加载中</div>
      <div className="session-restore-desc">请稍候，正在准备当前页面内容。</div>
    </div>
  </div>
);

const HomeRedirect = () => {
  const { isAuthenticated, hydrated, checkingAuth, userInfo } = useAuthStore();

  if (!hydrated || checkingAuth) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteByRole(userInfo?.role)} replace />;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeRedirect />
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<Loading />}>
        <Login />
      </Suspense>
    )
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<Loading />}>
        <Register />
      </Suspense>
    )
  },
  {
    path: '/test',
    element: (
      <Suspense fallback={<Loading />}>
        <Test />
      </Suspense>
    )
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'visitor-register',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['mediator', 'tenant_admin', 'superadmin']}>
                <CaseApply />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'case-query',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <CaseQuery />
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'case-apply',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['personal', 'company', 'mediator', 'tenant_admin', 'superadmin']}>
                <CaseApply />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'case/:id',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <CaseDetail />
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'broadcast',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['mediator', 'tenant_admin', 'superadmin']}>
                <Broadcast />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'data-analysis',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['tenant_admin', 'superadmin']}>
                <DataAnalysis />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'mediator-analysis',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['mediator']}>
                <MediatorAnalysis />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'tenant-management',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <TenantManagement />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'user-management',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['tenant_admin', 'superadmin']}>
                <UserManagement />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'system-settings',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <SystemSettings />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'service-management',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <ServiceManagement />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'monitoring',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <Monitoring />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'analytics',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <Analytics />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'schedule-management',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['mediator', 'tenant_admin', 'superadmin']}>
                <ScheduleManagement />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'reminder-settings',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <Navigate to="/system-settings" replace />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'feedback-center',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <FeedbackCenter />
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'message-center',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <MessageCenter />
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'socket-test',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <SocketTest />
            </RequireAuth>
          </Suspense>
        )
      },
      {
        path: 'api-docs',
        element: (
          <Suspense fallback={<Loading />}>
            <RequireAuth>
              <RoleBasedRoute roles={['superadmin']}>
                <ApiDocs />
              </RoleBasedRoute>
            </RequireAuth>
          </Suspense>
        )
      }
    ]
  }
], {
  basename: '/laodongzhongcai'
});

export default router;
