import { useEffect } from 'react';
import { Typography, Alert, Tag, Button } from 'antd';
import { ApiOutlined, LinkOutlined } from '@ant-design/icons';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { PageHero, PageSectionCard, PageShell } from '../components/common/PageKit';

const { Title, Text } = Typography;

const ApiDocs: React.FC = () => {
  const { userInfo, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const docsUrl = `${window.location.origin}/laodongzhongcai/api/docs`;

  useEffect(() => {
    // 检查用户是否已认证且是管理员
    if (!isAuthenticated || userInfo?.role !== 'superadmin') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, userInfo, navigate]);

  if (!isAuthenticated || userInfo?.role !== 'superadmin') {
    return null;
  }

  return (
    <PageShell>
      <PageHero
        tone="teal"
        icon={<ApiOutlined />}
        title="API 文档中心"
        description="这里展示系统全部后端接口文档，适合超级管理员做接口查阅、联调和故障排查。"
        tags={
          <>
            <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>接口总览</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>超级管理员可见</Tag>
          </>
        }
        actions={
          <Button icon={<LinkOutlined />} size="large" href={docsUrl} target="_blank" style={{ borderRadius: 10 }}>
            新窗口打开文档
          </Button>
        }
      />

      <PageSectionCard>
        <div style={{ display: 'grid', gap: 18 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>在线接口文档</Title>
            <Text type="secondary">包含接口说明、参数、返回结构和调试信息。只有超级管理员可以访问此页面。</Text>
          </div>
          <Alert
            message="访问说明"
            description="如需复制链接、单独打开或浏览器内使用 Swagger 功能，可点击上方按钮在新窗口查看。"
            type="info"
            showIcon
            style={{ borderRadius: 12 }}
          />
          <div style={{ height: '80vh', border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden' }}>
            <iframe
              src={docsUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="API文档"
            />
          </div>
        </div>
      </PageSectionCard>
    </PageShell>
  );
};

export default ApiDocs;
