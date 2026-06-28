import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface UserInfo {
  id: string;
  username: string;
  name: string;
  phone: string;
  role: string;
  isSuperAdmin?: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
}

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  checkingAuth: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string, role: string) => Promise<void>;
  setAuth: (token: string, userInfo?: Partial<UserInfo>) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const normalizeUserInfo = (userInfo?: Partial<UserInfo> | null): UserInfo | null => {
  if (!userInfo) return null;
  const role = userInfo.role || 'personal';
  return {
    id: userInfo.id || '',
    username: userInfo.username || 'unknown_user',
    name: userInfo.name || '未知用户',
    phone: userInfo.phone || '',
    role,
    isSuperAdmin: role === 'superadmin' ? true : !!userInfo.isSuperAdmin,
    tenantId: userInfo.tenantId || null,
    tenantName: userInfo.tenantName || null
  };
};

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userInfo: null,
      isAuthenticated: false,
      hydrated: false,
      checkingAuth: false,
      loading: false,
      error: null,
      login: async (username, password, role) => {
        set({ loading: true, error: null });
        try {
          console.log('登录请求:', { username, password, role });
          let response;
          try {
            response = await api.post('/auth/login', { username, password, role });
          } catch (error: any) {
            if (error?.response?.status >= 500) {
              response = await api.post('/auth/login', { username, password, role });
            } else {
              throw error;
            }
          }
          const data = response.data;
          console.log('登录成功:', data);
          set({
            token: data.token,
            userInfo: normalizeUserInfo(data.userInfo),
            isAuthenticated: true,
            hydrated: true,
            checkingAuth: false,
            loading: false
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || '登录失败';
          console.error('登录错误:', errorMessage);
          set({
            error: errorMessage,
            loading: false
          });
          throw new Error(errorMessage);
        }
      },
      // 微信登录回调或其他方式：直接通过 token + userInfo 设置登录态
      setAuth: (token, userInfo) => {
        set({
          token,
          userInfo: normalizeUserInfo(userInfo),
          isAuthenticated: true,
          hydrated: true,
          checkingAuth: false,
          error: null,
          loading: false
        });
      },
      refreshMe: async () => {
        const { token } = useAuthStore.getState();
        set({ checkingAuth: !!token });
        if (!token) {
          set({ userInfo: null, isAuthenticated: false, checkingAuth: false, hydrated: true });
          return;
        }
        try {
          const response = await api.get('/auth/me');
          const nextUserInfo = normalizeUserInfo(response.data?.userInfo);
          set({
            userInfo: nextUserInfo,
            isAuthenticated: !!nextUserInfo,
            hydrated: true,
            checkingAuth: false,
            error: null
          });
        } catch (error: any) {
          const status = error?.response?.status;
          // 仅在明确未认证/用户失效时清空登录态
          if (status === 401 || status === 404) {
            set({
              token: null,
              userInfo: null,
              isAuthenticated: false,
              hydrated: true,
              checkingAuth: false,
              error: null
            });
            return;
          }

          // 网络波动、服务超时、临时 5xx 等情况，不直接判定登录失效
          const currentState = useAuthStore.getState();
          set({
            token: currentState.token,
            userInfo: currentState.userInfo,
            isAuthenticated: !!currentState.token && !!currentState.userInfo,
            hydrated: true,
            checkingAuth: false,
            error: null
          });
        }
      },
      logout: () => {
        set({
          token: null,
          userInfo: null,
          isAuthenticated: false,
          checkingAuth: false,
          hydrated: true
        });
      },
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage-v3',
      version: 3,
      partialize: (state) => ({
        token: state.token,
        userInfo: state.userInfo,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        window.setTimeout(() => {
          const currentState = useAuthStore.getState();
          useAuthStore.setState({
            ...currentState,
            hydrated: true,
            checkingAuth: false,
            loading: false,
            error: null
          });
        }, 0);
      }
    }
  )
);

export default useAuthStore;
