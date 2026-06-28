export const getDefaultRouteByRole = (role?: string) => {
  if (role === 'personal' || role === 'company') {
    return '/case-query';
  }
  return '/dashboard';
};

export const getRoleLabel = (role?: string, tenantName?: string | null) => {
  if (role === 'superadmin') return '超级管理员';
  if (role === 'tenant_admin') return `街道管理员${tenantName ? `·${tenantName}` : ''}`;
  if (role === 'mediator') return '调解员';
  if (role === 'company') return '企业用户';
  return '个人用户';
};

export const getRoleNavigationMeta = (role?: string, tenantName?: string | null) => {
  if (role === 'superadmin') {
    return {
      title: '平台总控',
      description: '全局业务、组织、系统能力统一从这里进入。',
      accent: '#1677ff',
      background: 'linear-gradient(135deg, #e6f4ff 0%, #f8fbff 100%)'
    };
  }
  if (role === 'tenant_admin') {
    return {
      title: tenantName ? `${tenantName}运营台` : '街道运营台',
      description: '聚焦本街道案件流转、值班安排和人员协作。',
      accent: '#13a8a8',
      background: 'linear-gradient(135deg, #e6fffb 0%, #f6fffe 100%)'
    };
  }
  if (role === 'mediator') {
    return {
      title: '我的办案台',
      description: '优先处理待办案件、查看安排，再进入详细查询。',
      accent: '#722ed1',
      background: 'linear-gradient(135deg, #f9f0ff 0%, #fcf8ff 100%)'
    };
  }
  if (role === 'company') {
    return {
      title: '企业服务中心',
      description: '查看本企业案件、提交申请和反馈问题。',
      accent: '#fa8c16',
      background: 'linear-gradient(135deg, #fff7e6 0%, #fffdf7 100%)'
    };
  }
  return {
    title: '个人服务中心',
    description: '查看个人案件进度，按需发起新的调解申请。',
    accent: '#2f54eb',
    background: 'linear-gradient(135deg, #f0f5ff 0%, #fafcff 100%)'
  };
};
