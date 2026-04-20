import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const Test: React.FC = () => {
  return (
    <div style={{ padding: 24, backgroundColor: 'white', borderRadius: 8 }}>
      <Title level={2}>测试页面</Title>
      <p>这是一个测试页面，用于检查应用是否能正常渲染。</p>
    </div>
  );
};

export default Test;