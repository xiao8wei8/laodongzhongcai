import React from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

interface FileUploadProps {
  caseId: string;
  onUploadSuccess?: () => void;
  initialFiles?: any[];
}

const FileUpload: React.FC<FileUploadProps> = ({ caseId, onUploadSuccess, initialFiles = [] }) => {
  const uploadProps = {
    name: 'file',
    action: '/api/evidence',
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