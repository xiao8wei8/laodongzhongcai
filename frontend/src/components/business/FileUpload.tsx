import React from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

// 获取API基础URL
const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    return import.meta.env.PROD ? '/laodongzhongcai/api' : 'http://localhost:5003/api';
  }
  return baseUrl;
};

interface FileUploadProps {
  caseId: string;
  onUploadSuccess?: () => void;
  initialFiles?: any[];
}

const FileUpload: React.FC<FileUploadProps> = ({ caseId, onUploadSuccess, initialFiles = [] }) => {
  const uploadProps = {
    name: 'file',
    action: `${getApiBaseUrl()}/evidence`,
    method: 'POST',
    data: { caseId },
    onChange: (info: any) => {
      if (info.file.status === 'done') {
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
    },
    showUploadList: true
  };

  return (
    <div>
      <Upload {...uploadProps}>
        <Button icon={<UploadOutlined />}>
          上传证据
        </Button>
      </Upload>
    </div>
  );
};

export default FileUpload;