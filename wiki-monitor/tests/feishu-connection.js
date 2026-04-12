const axios = require('axios');
const config = require('../config/default.json');

/**
 * 测试飞书连接
 * 运行：npm run test:feishu-connection
 */
async function testFeishuConnection() {
  console.log('测试飞书连接...');
  console.log(`App ID: ${config.feishu.appId}`);

  try {
    const response = await axios.post(
      `${config.feishu.baseUrl}/auth/v3/tenant_access_token/internal`,
      {
        app_id: config.feishu.appId,
        app_secret: config.feishu.appSecret
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.data.tenant_access_token) {
      console.log('✅ 飞书认证成功');
      console.log(`Token: ${response.data.tenant_access_token.substring(0, 20)}...`);
      process.exit(0);
    } else {
      console.error('❌ 飞书认证失败: 未获取到 tenant_access_token');
      console.error('响应:', response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 飞书认证失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

testFeishuConnection();
