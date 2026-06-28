import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import './index.css'
import router from './routes'
import { initAnalytics } from './services/analytics'
import useAuthStore from './store/authStore'

// 初始化分析服务
initAnalytics();

function AuthBootstrap() {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const refreshMe = useAuthStore((state) => state.refreshMe);

  useEffect(() => {
    try {
      window.localStorage.removeItem('auth-storage');
      window.localStorage.removeItem('auth-storage-v2');
    } catch (_error) {}
  }, []);

  useEffect(() => {
    const hydrateFallbackTimer = window.setTimeout(() => {
      const state = useAuthStore.getState();
      if (!state.hydrated) {
        useAuthStore.setState({
          token: state.token,
          userInfo: state.userInfo,
          isAuthenticated: !!state.token && !!state.userInfo,
          hydrated: true,
          checkingAuth: false,
          loading: false,
          error: null
        });
      }
    }, 1500);

    const authTimeoutTimer = window.setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.checkingAuth) {
        useAuthStore.setState({
          token: state.token,
          userInfo: state.userInfo,
          isAuthenticated: !!state.token && !!state.userInfo,
          hydrated: true,
          checkingAuth: false,
          loading: false,
          error: null
        });
      }
    }, 12000);

    return () => {
      window.clearTimeout(hydrateFallbackTimer);
      window.clearTimeout(authTimeoutTimer);
    };
  }, []);

  useEffect(() => {
    if (hydrated && token) {
      refreshMe();
    }
  }, [hydrated, token, refreshMe]);

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DndProvider backend={HTML5Backend}>
      <AuthBootstrap />
    </DndProvider>
  </StrictMode>,
)
