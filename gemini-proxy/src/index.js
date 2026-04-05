import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import openaiRoutes from './routes/openai.js';
import { GeminiApiClient } from './gemini-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 环境配置
const env = {
  GCP_SERVICE_ACCOUNT: process.env.GCP_SERVICE_ACCOUNT || null,
  GEMINI_PROJECT_ID: process.env.GEMINI_PROJECT_ID || null,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  ENABLE_REAL_THINKING: process.env.ENABLE_REAL_THINKING || 'false',
  ENABLE_FAKE_THINKING: process.env.ENABLE_FAKE_THINKING || 'false'
};

// 加载 OAuth 凭证
if (!env.GCP_SERVICE_ACCOUNT) {
  const credsPath = path.join(process.env.HOME || '/root', '.gemini', 'oauth_creds.json');
  if (fs.existsSync(credsPath)) {
    try {
      const credsContent = fs.readFileSync(credsPath, 'utf8');
      const credsJson = JSON.parse(credsContent);
      env.GCP_SERVICE_ACCOUNT = JSON.stringify(credsJson);
      console.log(`[Server] Loaded OAuth credentials from ${credsPath}`);
    } catch (e) {
      console.error(`[Server] Failed to load credentials:`, e.message);
    }
  }
}

if (!env.GCP_SERVICE_ACCOUNT) {
  console.error('[Server] ERROR: No OAuth credentials found');
  console.error('[Server] Please run `gemini auth` first');
  process.exit(1);
}

app.locals.env = env;

// 路由
app.use('/v1', openaiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'Gemini Proxy',
    description: 'OpenAI-compatible API for Google Gemini via OAuth',
    version: '1.0.0',
    authentication: env.OPENAI_API_KEY ? 'Bearer token required' : 'None',
    endpoints: {
      chat_completions: '/v1/chat/completions',
      models: '/v1/models'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ========== 启动服务（含预热）==========

async function startServer() {
  const startTime = Date.now();

  // 创建客户端实例用于预热
  const warmupClient = new GeminiApiClient(env);

  // 并行执行预热和服务器启动
  console.log('[Server] Starting warmup...');

  // 先启动服务器监听（不等待预热完成）
  const server = app.listen(PORT, '0.0.0.0', () => {
    const elapsed = Date.now() - startTime;
    console.log(`[Server] Gemini Proxy running on http://0.0.0.0:${PORT} (${elapsed}ms)`);
    console.log(`[Server] Endpoints: /v1/chat/completions, /v1/models`);
  });

  // 后台预热
  warmupClient.warmup().catch(err => {
    console.warn('[Server] Warmup failed (will retry on first request):', err.message);
  });
}

startServer().catch(err => {
  console.error('[Server] Startup failed:', err);
  process.exit(1);
});