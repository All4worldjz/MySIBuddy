const http = require("http");
const fs = require("fs");
const path = require("path");

// 配置选项
const PORT = process.env.SEARCH_SERVICE_PORT || 18790;
const SECRETS_PATH = process.env.SECRETS_PATH || './runtime-secrets.json'; // 默认使用本地路径便于调试

// 超时和重试配置
const REQUEST_TIMEOUT = 20000; // 20秒请求超时
const MAX_RETRIES = 2; // 最大重试次数
const RETRY_DELAY = 1000; // 重试延迟（毫秒）

// 辅助函数：带超时的fetch
function fetchWithTimeout(url, options = {}) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
        )
    ]);
}

// 辅助函数：带重试的异步函数执行
async function retryAsync(fn, retries = MAX_RETRIES) {
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < retries) {
                console.log(`[Retry ${i+1}/${retries}] Retrying after error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1))); // 指数退避
            }
        }
    }
    
    throw lastError;
}

// 路由优先级定义 (Load Balancing & Smart Routing)
const ROUTE_PRIORITY = {
    "CHINA_SOCIAL": ["tavily", "exa", "duckduckgo"],
    "GLOBAL_TRENDS": ["exa", "tavily", "duckduckgo"],
    "TECH_RESEARCH": ["exa", "tavily", "arxiv"],
    "GENERAL": ["tavily", "exa", "duckduckgo"]
};

function getSecrets() {
    try {
        const data = fs.readFileSync(SECRETS_PATH, "utf8");
        console.log(`[${new Date().toISOString()}] Successfully loaded secrets from ${SECRETS_PATH}`);
        return JSON.parse(data);
    } catch (e) {
        console.error(`[${new Date().toISOString()}] Failed to load secrets from ${SECRETS_PATH}:`, e.message);
        return {};
    }
}

async function callExa(query, key) {
    if (!key) {
        console.log(`[${new Date().toISOString()}] No Exa API key provided`);
        throw new Error("No Exa Key");
    }
    
    console.log(`[${new Date().toISOString()}] Calling Exa API with query: ${query.substring(0, 50)}...`);
    
    return await retryAsync(async () => {
        const resp = await fetchWithTimeout("https://api.exa.ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": key },
            body: JSON.stringify({ query, useAutoprompt: true, numResults: 5 })
        });
        
        if (!resp.ok) {
            console.error(`[${new Date().toISOString()}] Exa API error: ${resp.status}`);
            throw new Error(`Exa API error: ${resp.status}`);
        }
        
        const data = await resp.json();
        console.log(`[${new Date().toISOString()}] Exa API response received with ${data.results?.length || 0} results`);
        
        const results = data.results || data.contents || [];
        return results.map(r => ({
            title: r.title || "Exa Result",
            url: r.url,
            content: r.content || r.snippet || "No snippet available."
        }));
    });
}

async function callTavily(query, key) {
    if (!key) {
        console.log(`[${new Date().toISOString()}] No Tavily API key provided`);
        throw new Error("No Tavily Key");
    }
    
    console.log(`[${new Date().toISOString()}] Calling Tavily API with query: ${query.substring(0, 50)}...`);
    
    return await retryAsync(async () => {
        const resp = await fetchWithTimeout("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: key, query, search_depth: "advanced" })
        });
        
        if (!resp.ok) {
            console.error(`[${new Date().toISOString()}] Tavily API error: ${resp.status}`);
            throw new Error(`Tavily API error: ${resp.status}`);
        }
        
        const data = await resp.json();
        console.log(`[${new Date().toISOString()}] Tavily API response received with ${data.results?.length || 0} results`);
        
        const results = data.results || [];
        return results.map(r => ({
            title: r.title || "Tavily Result",
            url: r.url,
            content: r.content || "No content available."
        }));
    });
}

// DuckDuckGo 搜索实现（免 API Key）
async function callDuckDuckGo(query) {
    console.log(`[${new Date().toISOString()}] Calling DuckDuckGo with query: ${query.substring(0, 50)}...`);
    
    return await retryAsync(async () => {
        // 使用 DuckDuckGo HTML 端点进行搜索
        const encodedQuery = encodeURIComponent(query);
        const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
        
        const response = await fetchWithTimeout(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
        });
        
        if (!response.ok) {
            throw new Error(`DuckDuckGo search error: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // 简单的正则表达式来解析DuckDuckGo搜索结果
        // 这是简化版本，实际实现可能需要更复杂的HTML解析
        const results = [];
        const regex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs;
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            if (results.length >= 5) break; // 限制结果数量
            
            const url = match[1];
            const title = match[2].replace(/<[^>]*>/g, '').trim(); // 移除HTML标签
            
            // 尝试找到对应的摘要
            const snippetRegex = new RegExp(`<a[^>]*href="${match[1]}"[^>]*>.*?</a>.*?<span[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</span>`, 's');
            const snippetMatch = snippetRegex.exec(html);
            const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : "No snippet available.";
            
            results.push({
                title: title || "DuckDuckGo Result",
                url: url,
                content: snippet
            });
        }
        
        console.log(`[${new Date().toISOString()}] DuckDuckGo returned ${results.length} results`);
        
        if (results.length === 0) {
            throw new Error("No results found from DuckDuckGo");
        }
        
        return results;
    });
}

// ArXiv 搜索实现
async function callArXiv(query) {
    console.log(`[${new Date().toISOString()}] Calling ArXiv with query: ${query.substring(0, 50)}...`);
    
    return await retryAsync(async () => {
        // 将查询转换为arXiv API兼容的格式
        const searchQuery = encodeURIComponent(query);
        // 使用arXiv API进行搜索
        const url = `http://export.arxiv.org/api/query?search_query=all:${searchQuery}&start=0&max_results=5`;
        
        const response = await fetchWithTimeout(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; UnifiedSearchBot/1.0)"
            }
        });
        
        if (!response.ok) {
            throw new Error(`ArXiv search error: ${response.status} ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        // 简单的XML解析来提取arXiv论文信息
        // 这是一个简化的实现，实际应用中可能需要更健壮的XML解析
        const results = [];
        
        // 提取论文标题
        const titleRegex = /<title>(.*?)<\/title>/gs;
        const titles = [];
        let titleMatch;
        while ((titleMatch = titleRegex.exec(xmlText)) !== null) {
            titles.push(titleMatch[1]);
        }
        
        // 提取摘要
        const summaryRegex = /<summary>(.*?)<\/summary>/gs;
        const summaries = [];
        let summaryMatch;
        while ((summaryMatch = summaryRegex.exec(xmlText)) !== null) {
            summaries.push(summaryMatch[1]);
        }
        
        // 提取链接
        const linkRegex = /<id>(.*?)<\/id>/gs;
        const links = [];
        let linkMatch;
        while ((linkMatch = linkRegex.exec(xmlText)) !== null) {
            links.push(linkMatch[1]);
        }
        
        // 组合结果
        const count = Math.min(titles.length, summaries.length, links.length);
        for (let i = 0; i < count && i < 5; i++) {
            results.push({
                title: titles[i] || "ArXiv Paper",
                url: links[i] || "#",
                content: summaries[i] ? summaries[i].substring(0, 300) + "..." : "No abstract available."
            });
        }
        
        console.log(`[${new Date().toISOString()}] ArXiv returned ${results.length} results`);
        
        if (results.length === 0) {
            throw new Error("No results found from ArXiv");
        }
        
        return results;
    });
}

async function unifiedSearchLogic(query, scene) {
    console.log(`[${new Date().toISOString()}] Starting unified search for query: "${query}", scene: "${scene}"`);
    
    const secrets = getSecrets();
    const providers = ROUTE_PRIORITY[scene] || ["tavily", "exa", "duckduckgo"];
    let errors = [];

    console.log(`[${new Date().toISOString()}] Selected providers for scene ${scene}: [${providers.join(', ')}]`);

    for (const provider of providers) {
        try {
            console.log(`[${new Date().toISOString()}] Attempting ${provider} for ${scene}...`);
            let results;
            
            if (provider === "exa") {
                results = await callExa(query, secrets.EXA_API_KEY);
            } else if (provider === "tavily") {
                results = await callTavily(query, secrets.TAVILY_API_KEY);
            } else if (provider === "duckduckgo") {
                results = await callDuckDuckGo(query);
            } else if (provider === "arxiv") {
                results = await callArXiv(query);
            }
            
            if (results && results.length > 0) {
                console.log(`[${new Date().toISOString()}] Success with ${provider}, got ${results.length} results`);
                return { results, provider };
            } else {
                console.log(`[${new Date().toISOString()}] ${provider} returned no results`);
            }
        } catch (e) {
            console.error(`[${new Date().toISOString()}] [${provider}] Fail:`, e.message);
            errors.push(`${provider}: ${e.message}`);
        }
    }
    
    console.error(`[${new Date().toISOString()}] All providers failed. Errors: ${errors.join('; ')}`);
    
    return { 
        results: [{ title: "System Fallback", url: "#", content: "All providers failed. Errors: " + errors.join("; ") }],
        provider: "error-fallback"
    };
}

// 场景智能识别函数
function detectScene(query) {
    // 将查询转换为小写以便比较
    const lowerQuery = query.toLowerCase();
    
    // 定义场景关键词
    const chinaSocialKeywords = [
        '微信', '微博', '抖音', '快手', '小红书', '知乎', 'bilibili', '社交', '社交媒体',
        'wechat', 'weibo', 'douyin', 'kuaishou', 'xiaohongshu', 'zhihu', 'social media',
        'tiktok', 'chinese social', 'chinese app', 'chinese platform'
    ];
    
    const globalTrendsKeywords = [
        'trend', 'trending', 'trends', 'global', 'world', 'international', 'global trend',
        'trend forecast', 'trend analysis', 'trend prediction', 'trend insight',
        '流行', '趋势', '全球', '国际', '预测', '分析', '洞察'
    ];
    
    const techResearchKeywords = [
        'research', 'study', 'academic', 'scholarly', 'paper', 'arxiv', 'scientific',
        'technology', 'tech', 'ai', 'ml', 'dl', 'machine learning', 'deep learning',
        'algorithm', 'neural network', 'computer science', 'research paper',
        '研究', '学术', '论文', '科研', '技术', '人工智能', '机器学习', '深度学习', '算法'
    ];
    
    // 计算各场景关键词匹配数
    let chinaSocialScore = 0;
    let globalTrendsScore = 0;
    let techResearchScore = 0;
    
    for (const keyword of chinaSocialKeywords) {
        if (lowerQuery.includes(keyword)) {
            chinaSocialScore++;
        }
    }
    
    for (const keyword of globalTrendsKeywords) {
        if (lowerQuery.includes(keyword)) {
            globalTrendsScore++;
        }
    }
    
    for (const keyword of techResearchKeywords) {
        if (lowerQuery.includes(keyword)) {
            techResearchScore++;
        }
    }
    
    // 确定最高分的场景
    const scores = [
        { scene: 'CHINA_SOCIAL', score: chinaSocialScore },
        { scene: 'GLOBAL_TRENDS', score: globalTrendsScore },
        { scene: 'TECH_RESEARCH', score: techResearchScore },
        { scene: 'GENERAL', score: 0 }  // GENERAL 作为默认场景
    ];
    
    // 按分数排序，返回得分最高的场景
    scores.sort((a, b) => b.score - a.score);
    
    // 如果最高分场景得分为0，使用默认场景GENERAL
    return scores[0].score > 0 ? scores[0].scene : 'GENERAL';
}

const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] Received ${req.method} request to ${req.url}`);
    
    if (req.method !== "POST") {
        console.log(`[${new Date().toISOString()}] Method not allowed: ${req.method}`);
        res.writeHead(405);
        return res.end("Method Not Allowed");
    }

    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
        try {
            let { query, scene } = JSON.parse(body);
            if (!query) {
                console.log(`[${new Date().toISOString()}] Missing query in request`);
                res.writeHead(400);
                return res.end("Missing query");
            }
            
            // 如果没有提供场景，则尝试智能识别场景
            if (!scene) {
                scene = detectScene(query);
                console.log(`[${new Date().toISOString()}] Auto-detected scene: ${scene} for query: "${query.substring(0, 50)}..."`);
            }
            
            console.log(`[${new Date().toISOString()}] Parsed request - Query: "${query}", Scene: "${scene}"`);

            const { results, provider } = await unifiedSearchLogic(query, scene);
            
            let md = `### Unified Search [ Scene: ${scene} | Provider: ${provider} ]\n\n`;
            results.forEach((r, i) => {
                md += `${i+1}. **[${r.title}](${r.url})**\n   > ${r.content}\n\n`;
            });

            console.log(`[${new Date().toISOString()}] Sending ${results.length} results back to client`);
            
            res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
            res.end(md);
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Critical Server Error:`, e);
            res.writeHead(500);
            res.end("Internal Server Error: " + e.message);
        }
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[${new Date().toISOString()}] Unified Search Service v5.5 running on http://127.0.0.1:${PORT}`);
    console.log(`[${new Date().toISOString()}] Using secrets file: ${SECRETS_PATH}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully`);
    server.close(() => {
        console.log(`[${new Date().toISOString()}] Server closed`);
    });
});

process.on('SIGINT', () => {
    console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully`);
    server.close(() => {
        console.log(`[${new Date().toISOString()}] Server closed`);
    });
});