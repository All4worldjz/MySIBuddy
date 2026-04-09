const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 18790;
const SECRETS_PATH = path.join(process.env.HOME, ".openclaw/runtime-secrets.json");

// 路由优先级定义 (Load Balancing & Smart Routing)
const ROUTE_PRIORITY = {
    "CHINA_SOCIAL": ["tavily", "exa"],
    "GLOBAL_TRENDS": ["exa", "tavily"],
    "TECH_RESEARCH": ["exa", "tavily"],
    "GENERAL": ["tavily", "exa"]
};

function getSecrets() {
    try {
        const data = fs.readFileSync(SECRETS_PATH, "utf8");
        return JSON.parse(data);
    } catch (e) { return {}; }
}

async function callExa(query, key) {
    if (!key) throw new Error("No Exa Key");
    const resp = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ query, useAutoprompt: true, numResults: 5 })
    });
    if (!resp.ok) throw new Error(`Exa API error: ${resp.status}`);
    const data = await resp.json();
    const results = data.results || data.contents || [];
    return results.map(r => ({
        title: r.title || "Exa Result",
        url: r.url,
        content: r.content || r.snippet || "No snippet available."
    }));
}

async function callTavily(query, key) {
    if (!key) throw new Error("No Tavily Key");
    const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query, search_depth: "advanced" })
    });
    if (!resp.ok) throw new Error(`Tavily API error: ${resp.status}`);
    const data = await resp.json();
    const results = data.results || [];
    return results.map(r => ({
        title: r.title || "Tavily Result",
        url: r.url,
        content: r.content || "No content available."
    }));
}

async function unifiedSearchLogic(query, scene) {
    const secrets = getSecrets();
    const providers = ROUTE_PRIORITY[scene] || ["tavily", "exa"];
    let errors = [];

    for (const provider of providers) {
        try {
            console.log(`[${new Date().toISOString()}] Attempting ${provider} for ${scene}...`);
            let results;
            if (provider === "exa") results = await callExa(query, secrets.EXA_API_KEY);
            if (provider === "tavily") results = await callTavily(query, secrets.TAVILY_API_KEY);
            
            if (results && results.length > 0) {
                return { results, provider };
            }
        } catch (e) {
            console.error(`[${provider}] Fail:`, e.message);
            errors.push(`${provider}: ${e.message}`);
        }
    }
    
    return { 
        results: [{ title: "System Fallback", url: "#", content: "All premium providers failed. Errors: " + errors.join("; ") }],
        provider: "error-fallback"
    };
}

const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
        res.writeHead(405);
        return res.end("Method Not Allowed");
    }

    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
        try {
            const { query, scene = "GENERAL" } = JSON.parse(body);
            if (!query) {
                res.writeHead(400);
                return res.end("Missing query");
            }

            const { results, provider } = await unifiedSearchLogic(query, scene);
            
            let md = `### Unified Search [ Scene: ${scene} | Provider: ${provider} ]\n\n`;
            results.forEach((r, i) => {
                md += `${i+1}. **[${r.title}](${r.url})**\n   > ${r.content}\n\n`;
            });

            res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
            res.end(md);
        } catch (e) {
            console.error("Critical Server Error:", e);
            res.writeHead(500);
            res.end("Internal Server Error: " + e.message);
        }
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[${new Date().toISOString()}] Unified Search Service v5.5 running on http://127.0.0.1:${PORT}`);
});
