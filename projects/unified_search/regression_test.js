#!/usr/bin/env node

const { spawn } = require('child_process');
const axios = require('axios');

async function runComprehensiveTests() {
    console.log('🔍 开始运行综合回归测试...\n');
    
    // 定义测试用例
    const testCases = [
        {
            name: 'TECH_RESEARCH场景测试',
            payload: {
                query: '人工智能发展趋势',
                scene: 'TECH_RESEARCH'
            },
            description: '测试技术研究场景下的搜索功能'
        },
        {
            name: 'GENERAL场景测试',
            payload: {
                query: '最新科技新闻',
                scene: 'GENERAL'
            },
            description: '测试通用场景下的搜索功能'
        },
        {
            name: 'GLOBAL_TRENDS场景测试',
            payload: {
                query: '全球气候变化',
                scene: 'GLOBAL_TRENDS'
            },
            description: '测试全球趋势场景下的搜索功能'
        },
        {
            name: 'CHINA_SOCIAL场景测试',
            payload: {
                query: '中国文化发展',
                scene: 'CHINA_SOCIAL'
            },
            description: '测试中国社交场景下的搜索功能'
        },
        {
            name: '默认场景测试（无场景参数）',
            payload: {
                query: '机器学习算法',
                scene: undefined
            },
            description: '测试不指定场景时的默认行为'
        },
        {
            name: '空查询测试',
            payload: {
                query: '',
                scene: 'GENERAL'
            },
            description: '测试空查询的错误处理'
        },
        {
            name: '长查询测试',
            payload: {
                query: '这是一个非常长的查询字符串，用于测试服务对长查询的处理能力，以及验证服务是否能够正确处理各种长度的输入参数，同时检查返回结果的相关性。',
                scene: 'GENERAL'
            },
            description: '测试长查询字符串的处理能力'
        }
    ];

    let passedTests = 0;
    let totalTests = testCases.length;
    let serviceReady = false;

    // 启动服务
    console.log('🚀 启动搜索服务...');
    const service = spawn('node', ['debug_search_service.js'], {
        env: { ...process.env, SECRETS_PATH: './runtime-secrets.json', SEARCH_SERVICE_PORT: '18791' },
        cwd: __dirname
    });

    // 监听服务输出
    service.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Unified Search Service') && !serviceReady) {
            console.log('✅ 服务已启动并正在监听端口 18791\n');
            serviceReady = true;
            
            // 稍等一下让服务完全就绪
            setTimeout(async () => {
                await executeTests();
            }, 2000);
        }
    });

    service.stderr.on('data', (data) => {
        console.error(`❌ 服务错误: ${data}`);
    });

    service.on('close', (code) => {
        console.log(`\n🔧 服务进程退出，代码 ${code}`);
    });

    // 执行测试函数
    async function executeTests() {
        for (const testCase of testCases) {
            console.log(`🧪 运行测试: ${testCase.name}`);
            console.log(`📝 ${testCase.description}`);
            
            try {
                // 构建请求体，如果scene为undefined则不包含该字段
                const requestBody = testCase.payload.scene !== undefined 
                    ? testCase.payload 
                    : { query: testCase.payload.query };

                const response = await axios.post('http://127.0.0.1:18791', requestBody, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000 // 15秒超时
                });

                // 检查响应状态
                if (response.status === 200) {
                    console.log(`   ✓ 状态码: ${response.status}`);
                    
                    // 检查响应内容类型
                    if (response.headers['content-type'] && response.headers['content-type'].includes('text/markdown')) {
                        console.log('   ✓ 内容类型: text/markdown');
                    } else {
                        console.log('   ⚠ 警告: 内容类型不是text/markdown');
                    }
                    
                    // 检查响应内容
                    if (response.data && response.data.includes('Unified Search')) {
                        console.log('   ✓ 响应包含预期内容');
                        
                        // 检查是否有结果
                        const resultCount = (response.data.match(/\*\*\[(.*?)\]\(/g) || []).length;
                        console.log(`   ✓ 搜索结果数量: ${resultCount}`);
                        
                        // 检查是否包含正确的场景和提供商信息
                        if (response.data.includes(testCase.payload.scene || 'GENERAL')) {
                            console.log('   ✓ 响应包含正确的场景信息');
                        } else if (testCase.name.includes('默认场景')) {
                            // 对于默认场景测试，检查是否使用了默认值
                            if (response.data.includes('GENERAL')) {
                                console.log('   ✓ 响应正确使用了默认场景');
                            } else {
                                console.log('   ⚠ 响应可能未使用正确的默认场景');
                            }
                        }
                        
                        console.log(`   ✅ ${testCase.name} - 通过\n`);
                        passedTests++;
                    } else {
                        console.log(`   ❌ ${testCase.name} - 失败: 响应不包含预期内容\n`);
                    }
                } else {
                    console.log(`   ❌ ${testCase.name} - 失败: 状态码 ${response.status}\n`);
                }
            } catch (error) {
                // 特殊处理空查询的情况
                if (testCase.name === '空查询测试') {
                    if (error.response && error.response.status === 400) {
                        console.log(`   ✓ 空查询测试 - 正确返回400错误: ${error.response.data}`);
                        passedTests++;
                    } else {
                        console.log(`   ⚠ 空查询测试 - 未按预期返回400错误`);
                    }
                } else {
                    console.log(`   ❌ ${testCase.name} - 失败: ${error.message}\n`);
                }
            }
        }

        console.log(`\n📊 测试总结: ${passedTests}/${totalTests} 测试通过`);
        
        if (passedTests === totalTests) {
            console.log('🎉 所有回归测试均已通过！');
        } else {
            console.log(`⚠️  ${totalTests - passedTests} 个测试失败`);
        }
        
        // 终止服务
        service.kill();
        process.exit(passedTests === totalTests ? 0 : 1);
    }
    
    // 设置总超时时间
    setTimeout(() => {
        console.log('\n⏰ 测试超时，终止服务');
        service.kill();
        process.exit(1);
    }, 90000); // 90秒超时
}

// 如果直接运行此文件，则启动测试
if (require.main === module) {
    runComprehensiveTests().catch(error => {
        console.error('测试过程中发生错误:', error);
        process.exit(1);
    });
}