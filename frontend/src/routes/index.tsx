import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '../components/layout/Layout';
import RequireAuth from '../components/common/RequireAuth';
import RoleBasedRoute from '../components/common/RoleBasedRoute';

// 使用React.lazy进行组件懒加载
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const VisitorRegister = lazy(() => import('../pages/VisitorRegister'));
const CaseQuery = lazy(() => import('../pages/CaseQuery'));
const CaseApply = lazy(() => import('../pages/CaseApply'));
const CaseDetail = lazy(() => import('../pages/CaseDetail'));
const Broadcast = lazy(() => import('../pages/Broadcast'));
const DataAnalysis = lazy(() => import('../pages/DataAnalysis'));
const UserManagement = lazy(() => import('../pages/UserManagement'));
const SystemSettings = lazy(() => import('../pages/SystemSettings'));
const ServiceManagement = lazy(() => import('../pages/ServiceManagement'));
const ScheduleManagement = lazy(() => import('../pages/ScheduleManagement'));
const ReminderSettings = lazy(() => import('../pages/ReminderSettings'));
const MessageCenter = lazy(() => import('../pages/MessageCenter'));
const SocketTest = lazy(() => import('../pages/SocketTest'));
const Monitoring = lazy(() => import('../pages/Monitoring'));
const Analytics = lazy(() => import('../pages/Analytics'));
const Test = lazy(() => import('../pages/Test'));
const ApiDocs = lazy(() => import('../pages/ApiDocs'));

// 创建一个加载组件
const Loading = () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>加载中...</div>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />
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
              <RoleBasedRoute roles={['mediator', 'admin']}>
                <VisitorRegister />
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
              <RoleBasedRoute roles={['personal', 'company', 'mediator', 'admin']}>
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
              <RoleBasedRoute roles={['mediator', 'admin']}>
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
              <RoleBasedRoute roles={['mediator', 'admin']}>
                <DataAnalysis />
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
              <RoleBasedRoute roles={['admin']}>
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
              <RoleBasedRoute roles={['admin']}>
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
              <RoleBasedRoute roles={['admin']}>
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
              <RoleBasedRoute roles={['admin']}>
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
              <RoleBasedRoute roles={['admin']}>
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
              <RoleBasedRoute roles={['mediator', 'admin']}>
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
              <RoleBasedRoute roles={['mediator', 'admin']}>
                <ReminderSettings />
              </RoleBasedRoute>
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
              <RoleBasedRoute roles={['admin']}>
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
