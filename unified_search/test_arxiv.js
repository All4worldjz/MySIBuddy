const axios = require('axios');

async function testArXiv() {
    try {
        console.log('Testing ArXiv search...');
        const response = await axios.post('http://127.0.0.1:18790', {
            query: 'machine learning',
            scene: 'TECH_RESEARCH'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Status:', response.status);
        console.log('Response preview:', response.data.substring(0, 500) + '...');
        
        // 检查是否包含ArXiv结果
        if (response.data.includes('ArXiv') || response.data.includes('arxiv')) {
            console.log('✓ ArXiv search functionality is working');
        } else {
            console.log('ℹ ArXiv may not have been used (other providers succeeded)');
        }
        
        console.log('✓ ArXiv test completed');
    } catch (error) {
        console.error('✗ ArXiv test failed:', error.message);
    }
}

testArXiv();