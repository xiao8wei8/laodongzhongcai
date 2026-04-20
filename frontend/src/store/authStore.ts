import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface UserInfo {
  id: string;
  username: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
}

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userInfo: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      login: async (username, password, role) => {
        set({ loading: true, error: null });
        try {
          console.log('登录请求:', { username, password, role });
          const response = await api.post('/auth/login', { username, password, role });
          const data = response.data;
          console.log('登录成功:', data);
          set({
            token: data.token,
            userInfo: data.userInfo,
            isAuthenticated: true,
            loading: false
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || '登录失败';
          console.error('登录错误:', errorMessage);
          set({
            error: errorMessage,
            loading: false
          });
          // 抛出异常，让调用者知道登录失败
          throw new Error(errorMessage);
        }
      },
      logout: () => {
        set({
          token: null,
          userInfo: null,
          isAuthenticated: false
        });
      },
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage'
    }
  )
);

export default useAuthStore;