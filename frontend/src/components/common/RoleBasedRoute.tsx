import useAuthStore from '../../store/authStore';

interface RoleBasedRouteProps {
  roles: string[];
  children: React.ReactNode;
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ roles, children }) => {
  const { userInfo } = useAuthStore();

  if (!userInfo || !roles.includes(userInfo.role)) {
    return <div>无权访问此页面</div>;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;
