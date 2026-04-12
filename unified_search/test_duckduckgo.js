const axios = require('axios');

async function testDuckDuckGo() {
    try {
        console.log('Testing DuckDuckGo search...');
        const response = await axios.post('http://127.0.0.1:18790', {
            query: '人工智能发展趋势',
            scene: 'GENERAL'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', response.status);
        console.log('Response preview:', response.data.substring(0, 500) + '...');
        
        // 检查是否包含DuckDuckGo结果（如果其他提供商失败的话）
        if (response.data.includes('DuckDuckGo')) {
            console.log('✓ DuckDuckGo search functionality is working');
        } else {
            console.log('ℹ DuckDuckGo may not have been used (other providers succeeded)');
        }
        
        console.log('✓ DuckDuckGo test completed');
    } catch (error) {
        console.error('✗ DuckDuckGo test failed:', error.message);
    }
}

testDuckDuckGo();