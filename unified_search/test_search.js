const axios = require('axios');

async function runRegressionTests() {
    console.log('开始运行回归测试...\n');
    
    // 测试不同场景
    const testCases = [
        {
            name: 'TECH_RESEARCH场景测试',
            payload: {
                query: '人工智能发展趋势',
                scene: 'TECH_RESEARCH'
            }
        },
        {
            name: 'GENERAL场景测试',
            payload: {
                query: '最新科技新闻',
                scene: 'GENERAL'
            }
        },
        {
            name: 'GLOBAL_TRENDS场景测试',
            payload: {
                query: '全球气候变化',
                scene: 'GLOBAL_TRENDS'
            }
        },
        {
            name: 'CHINA_SOCIAL场景测试',
            payload: {
                query: '中国文化发展',
                scene: 'CHINA_SOCIAL'
            }
        },
        {
            name: '默认场景测试（无场景参数）',
            payload: {
                query: '机器学习算法',
                scene: undefined
            }
        }
    ];

    let passedTests = 0;
    let totalTests = testCases.length;

    for (const testCase of testCases) {
        console.log(`运行测试: ${testCase.name}`);
        
        try {
            // 构建请求体，如果scene为undefined则不包含该字段
            const requestBody = testCase.payload.scene !== undefined 
                ? testCase.payload 
                : { query: testCase.payload.query };

            const response = await axios.post('http://127.0.0.1:18791', requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10秒超时
            });

            // 检查响应状态
            if (response.status === 200) {
                console.log(`  ✓ 状态码: ${response.status}`);
                
                // 检查响应内容类型
                if (response.headers['content-type'] && response.headers['content-type'].includes('text/markdown')) {
                    console.log('  ✓ 内容类型: text/markdown');
                } else {
                    console.log('  ⚠ 警告: 内容类型不是text/markdown');
                }
                
                // 检查响应内容
                if (response.data && response.data.includes('Unified Search')) {
                    console.log('  ✓ 响应包含预期内容');
                    
                    // 检查是否有结果
                    const resultCount = (response.data.match(/\*\*\[(.*?)\]\(/g) || []).length;
                    console.log(`  ✓ 搜索结果数量: ${resultCount}`);
                    
                    console.log(`  ✓ ${testCase.name} - 通过\n`);
                    passedTests++;
                } else {
                    console.log(`  ✗ ${testCase.name} - 失败: 响应不包含预期内容\n`);
                }
            } else {
                console.log(`  ✗ ${testCase.name} - 失败: 状态码 ${response.status}\n`);
            }
        } catch (error) {
            console.log(`  ✗ ${testCase.name} - 失败: ${error.message}\n`);
        }
    }

    console.log(`\n测试总结: ${passedTests}/${totalTests} 测试通过`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有回归测试均已通过！');
    } else {
        console.log(`⚠️  ${totalTests - passedTests} 个测试失败`);
    }
}

// 启动服务并运行测试
async function startServiceAndTest() {
    console.log('启动搜索服务...');
    
    // 在子进程中启动服务
    const { spawn } = require('child_process');
    
    const service = spawn('node', ['debug_search_service.js'], {
        env: { ...process.env, SECRETS_PATH: './runtime-secrets.json' },
        cwd: process.cwd()
    });
    
    // 监听服务输出
    service.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Unified Search Service')) {
            console.log('服务已启动，开始运行测试...\n');
            setTimeout(runRegressionTests, 2000); // 等待服务完全初始化
        }
        // console.log(`服务输出: ${output}`);
    });
    
    service.stderr.on('data', (data) => {
        console.error(`服务错误: ${data}`);
    });
    
    service.on('close', (code) => {
        console.log(`服务进程退出，代码 ${code}`);
    });
    
    // 设置超时处理
    setTimeout(() => {
        console.log('测试超时');
        service.kill();
    }, 60000); // 60秒超时
}

// 如果直接运行此文件，则启动服务并测试
if (require.main === module) {
    startServiceAndTest();
}

module.exports = { runRegressionTests };