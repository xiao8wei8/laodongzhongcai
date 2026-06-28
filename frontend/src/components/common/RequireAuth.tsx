import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, hydrated, checkingAuth } = useAuthStore();

  if (!hydrated || checkingAuth) {
    return (
      <div className="session-restore-shell">
        <div className="session-restore-card">
          <div className="session-restore-spinner" />
          <div className="session-restore-title">正在恢复会话</div>
          <div className="session-restore-desc">请稍候，系统正在确认你的登录状态。</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
