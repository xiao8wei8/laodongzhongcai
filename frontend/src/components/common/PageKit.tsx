import React from 'react';
import { Button, Card, Col, Row, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

type HeroTone = 'blue' | 'teal' | 'violet' | 'slate';

interface PageShellProps {
  children: React.ReactNode;
}

interface PageHeroProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  tags?: React.ReactNode;
  actions?: React.ReactNode;
  note?: React.ReactNode;
  metrics?: React.ReactNode;
  tone?: HeroTone;
}

interface PageMetricGridProps {
  children: React.ReactNode;
}

interface PageMetricItemProps {
  children: React.ReactNode;
}

interface PageSectionCardProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  title?: React.ReactNode;
  extra?: React.ReactNode;
}

interface PageToolbarProps {
  children: React.ReactNode;
  className?: string;
}

interface ExportButtonProps {
  onClick?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

const toneClassMap: Record<HeroTone, string> = {
  blue: 'page-hero--blue',
  teal: 'page-hero--teal',
  violet: 'page-hero--violet',
  slate: 'page-hero--slate'
};

export const PageShell: React.FC<PageShellProps> = ({ children }) => {
  return <div className="page-shell">{children}</div>;
};

export const PageHero: React.FC<PageHeroProps> = ({
  icon,
  title,
  description,
  tags,
  actions,
  note,
  metrics,
  tone = 'blue'
}) => {
  return (
    <Card bordered={false} className={`page-hero ${toneClassMap[tone]}`}>
      <Row gutter={[24, 24]} align="middle">
        <Col xs={24} lg={16}>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space size={12} align="start" wrap={false}>
              {icon ? <div className="page-hero__icon">{icon}</div> : null}
              <div className="page-hero__content">
                <div className="page-hero__title">{title}</div>
                {description ? <div className="page-hero__description">{description}</div> : null}
              </div>
            </Space>
            {tags ? <div className="page-hero__tags">{tags}</div> : null}
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {actions ? <div className="page-hero__actions">{actions}</div> : null}
            {note ? <div className="page-hero__note">{note}</div> : null}
            {metrics ? <div className="page-hero__metrics">{metrics}</div> : null}
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export const PageMetricGrid: React.FC<PageMetricGridProps> = ({ children }) => {
  return <Row gutter={[12, 12]} className="page-metric-grid">{children}</Row>;
};

export const PageMetricItem: React.FC<PageMetricItemProps> = ({ children }) => {
  return (
    <Col xs={12} md={6} className="page-metric-grid__item">
      <Card bordered={false} className="page-metric-card">
        {children}
      </Card>
    </Col>
  );
};

export const PageSectionCard: React.FC<PageSectionCardProps> = ({
  children,
  className = '',
  bodyClassName = '',
  title,
  extra
}) => {
  return (
    <Card
      bordered={false}
      title={title}
      extra={extra}
      className={`page-section-card ${className}`.trim()}
      bodyStyle={{}}
    >
      <div className={`page-section-card__body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </Card>
  );
};

export const PageToolbar: React.FC<PageToolbarProps> = ({ children, className = '' }) => {
  return (
    <Card bordered={false} className={`page-toolbar ${className}`.trim()}>
      <div className="page-toolbar__body">
        {children}
      </div>
    </Card>
  );
};

export const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  children = '导出 Excel',
  disabled = false
}) => {
  return (
    <Button
      icon={<DownloadOutlined />}
      onClick={onClick}
      disabled={disabled}
      style={{ borderRadius: 10 }}
    >
      {children}
    </Button>
  );
};
