import React from 'react';
import { Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import MessageCenterComponent from '../components/business/MessageCenter';

const { Title } = Typography;

const MessageCenter: React.FC = () => {
  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <MessageOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>消息中心</Title>
        </div>
      </div>
      <MessageCenterComponent />
    </div>
  );
};

export default MessageCenter;