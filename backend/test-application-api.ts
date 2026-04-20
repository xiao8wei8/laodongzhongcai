import axios from 'axios';

const API_BASE = 'http://localhost:5002/api';

interface UserInfo {
  id: string;
  username: string;
  name: string;
  phone: string;
  role: string;
}

interface LoginResponse {
  token: string;
  userInfo: UserInfo;
}

interface Case {
  _id: string;
  caseNumber: string;
  applicantId: string;
  respondentId: string;
  disputeType: string;
  caseAmount: number;
  requestItems: string;
  factsReasons: string;
  status: string;
}

interface ApplicationResponse {
  case: Case;
  caseNumber: string;
}

interface SimplifiedLoginResponse {
  token: string;
  user: UserInfo;
}

// 测试登录
const testLogin = async (username: string, password: string, role: string): Promise<SimplifiedLoginResponse> => {
  console.log('测试登录...');
  try {
    const response = await axios.post<LoginResponse>(`${API_BASE}/auth/login`, {
      username,
      password,
      role
    });
    console.log('登录成功:', response.data.userInfo.username);
    return {
      token: response.data.token,
      user: response.data.userInfo
    };
  } catch (error: any) {
    console.error('登录失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    throw error;
  }
};

// 测试提交申请
const testSubmitApplication = async (token: string): Promise<ApplicationResponse> => {
  console.log('\n测试提交申请...');
  try {
    const response = await axios.post<ApplicationResponse>(
      `${API_BASE}/application`,
      {
        applicantInfo: {
          name: '张三',
          phone: '13812345678',
          email: 'zhangsan@test.com',
          idCard: '110101199001011234'
        },
        respondentInfo: {
          name: '测试公司',
          phone: '13887654321',
          email: 'company@test.com',
          idCard: '91110000123456789X',
          type: 'company'
        },
        disputeType: '工资纠纷',
        caseAmount: 50000,
        requestItems: '请求支付拖欠的工资50000元',
        factsReasons: '自2024年1月起，用人单位未按时支付工资...'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log('申请提交成功!');
    console.log('案件编号:', response.data.caseNumber);
    console.log('案件ID:', response.data.case._id);
    return response.data;
  } catch (error: any) {
    console.error('申请提交失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    throw error;
  }
};

// 主测试流程
const runTests = async () => {
  console.log('=== 开始API测试 ===\n');
  try {
    // 1. 登录
    const loginData = await testLogin('personal', '123456', 'personal');
    
    // 2. 提交申请
    await testSubmitApplication(loginData.token);
    
    console.log('\n=== 所有测试通过 ===');
  } catch (error) {
    console.error('\n=== 测试失败 ===');
    process.exit(1);
  }
};

runTests();
