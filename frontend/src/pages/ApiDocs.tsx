import { useEffect } from 'react';
import { Card, Typography, Alert } from 'antd';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const ApiDocs: React.FC = () => {
  const { userInfo, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // 检查用户是否已认证且是管理员
    if (!isAuthenticated || userInfo?.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, userInfo, navigate]);

  if (!isAuthenticated || userInfo?.role !== 'admin') {
    return null;
  }

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, fontSize: '18px' }}>API文档</Title>
        <p style={{ color: '#666', marginTop: 8 }}>这里显示系统的API接口文档，包含所有可用的后端接口信息。</p>
      </div>

      <Card>
        <Alert
          message="访问说明"
          description="本页面显示系统的API接口文档，包含接口的详细信息、参数说明和返回值格式。只有管理员可以访问此页面。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ height: '80vh', border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
          <iframe
            src="http://localhost:5002/api/docs"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="API文档"
          />
        </div>
      </Card>
    </div>
  );
};

export default ApiDocs;