const axios = require('axios');

async function testSceneDetection() {
    console.log('Testing scene detection functionality...');
    
    // 测试1: 检测技术研究场景
    console.log('\\nTest 1: Tech research detection');
    try {
        const response1 = await axios.post('http://127.0.0.1:18790', {
            query: 'latest machine learning research papers'
            // 注意：这里没有提供scene，应该自动检测
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', response1.status);
        console.log('Response contains "TECH_RESEARCH":', response1.data.includes('TECH_RESEARCH'));
    } catch (error) {
        console.error('Test 1 failed:', error.message);
    }

    // 测试2: 检测中国社交媒体场景
    console.log('\\nTest 2: China social detection');
    try {
        const response2 = await axios.post('http://127.0.0.1:18790', {
            query: '微信最新功能 微博热搜'
            // 注意：这里没有提供scene，应该自动检测
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', response2.status);
        console.log('Response contains "CHINA_SOCIAL":', response2.data.includes('CHINA_SOCIAL'));
    } catch (error) {
        console.error('Test 2 failed:', error.message);
    }

    // 测试3: 检测全球趋势场景
    console.log('\\nTest 3: Global trends detection');
    try {
        const response3 = await axios.post('http://127.0.0.1:18790', {
            query: 'global technology trends 2026'
            // 注意：这里没有提供scene，应该自动检测
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', response3.status);
        console.log('Response contains "GLOBAL_TRENDS":', response3.data.includes('GLOBAL_TRENDS'));
    } catch (error) {
        console.error('Test 3 failed:', error.message);
    }

    // 测试4: 测试未明确匹配任何场景时的默认行为
    console.log('\\nTest 4: Default GENERAL scene detection');
    try {
        const response4 = await axios.post('http://127.0.0.1:18790', {
            query: 'weather forecast tomorrow'
            // 注意：这里没有提供scene，应该自动检测为GENERAL
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', response4.status);
        console.log('Response contains "GENERAL":', response4.data.includes('GENERAL'));
    } catch (error) {
        console.error('Test 4 failed:', error.message);
    }

    console.log('\\n✓ Scene detection tests completed');
}

testSceneDetection();