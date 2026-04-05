import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import openaiRoutes from './routes/openai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const env = {
  GCP_SERVICE_ACCOUNT: process.env.GCP_SERVICE_ACCOUNT || null,
  GEMINI_PROJECT_ID: process.env.GEMINI_PROJECT_ID || null,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  ENABLE_REAL_THINKING: process.env.ENABLE_REAL_THINKING || 'false',
  ENABLE_FAKE_THINKING: process.env.ENABLE_FAKE_THINKING || 'false'
};

if (!env.GCP_SERVICE_ACCOUNT) {
  const credsPath = path.join(process.env.HOME || '/root', '.gemini', 'oauth_creds.json');
  if (fs.existsSync(credsPath)) {
    try {
      const credsContent = fs.readFileSync(credsPath, 'utf8');
      const credsJson = JSON.parse(credsContent);
      env.GCP_SERVICE_ACCOUNT = JSON.stringify(credsJson);
      console.log(`[Server] Loaded OAuth credentials from ${credsPath}`);
    } catch (e) {
      console.error(`[Server] Failed to load credentials from ${credsPath}:`, e.message);
    }
  }
}

if (!env.GCP_SERVICE_ACCOUNT) {
  console.error('[Server] ERROR: GCP_SERVICE_ACCOUNT not set and no ~/.gemini/oauth_creds.json found');
  console.error('[Server] Please run `gemini auth` on your local machine and copy credentials to the server');
  process.exit(1);
}

app.locals.env = env;

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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Server] Gemini Proxy running on http://127.0.0.1:${PORT}`);
  console.log(`[Server] OpenAI-compatible endpoint: http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log(`[Server] Models endpoint: http://127.0.0.1:${PORT}/v1/models`);
});
