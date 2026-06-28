import React from 'react';
import { Typography, Space, Tag, Alert } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import MessageCenterComponent from '../components/business/MessageCenter';
import { PageHero, PageSectionCard, PageShell } from '../components/common/PageKit';

const { Title, Text } = Typography;

const MessageCenter: React.FC = () => {
  return (
    <PageShell>
      <PageHero
        tone="blue"
        icon={<BellOutlined />}
        title="消息收件箱"
        description="集中查看系统消息、案件提醒和弹窗通知。建议优先处理未读和高优先级内容。"
        tags={
          <>
            <Tag color="blue-inverse" style={{ borderRadius: 999 }}>未读优先</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>案件提醒集中处理</Tag>
          </>
        }
        note={
          <Alert
            message="处理建议"
            description="先处理案件相关消息，再查看系统通知。处理完成后建议及时标记已读，避免重复打扰。"
            type="info"
            showIcon
          />
        }
      />
      <PageSectionCard>
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>全部消息</Title>
            <Text type="secondary">按收件箱方式查看消息，更适合日常连续处理。</Text>
          </div>
          <MessageCenterComponent />
        </Space>
      </PageSectionCard>
    </PageShell>
  );
};

export default MessageCenter;
