# Gemini Proxy

OpenAI 兼容的 Gemini API 代理服务，使用 Gemini CLI 的 OAuth 认证，支持 Gemini 3.x 系列模型。

## 项目背景

### 问题
OpenClaw 需要使用 Gemini 3.1 系列模型，但直接使用 `generativelanguage.googleapis.com` API 需要：
- AI Studio API Key（用户没有）
- 或 Vertex AI 服务账号（需要额外配置）
- 或 OAuth token with `generative-language` scope（Gemini CLI 的 OAuth token 没有这个 scope）

### 解决方案
Gemini CLI 内部使用 **Code Assist API** (`cloudcode-pa.googleapis.com/v1internal`)，该 API：
- 支持 Gemini CLI 的 OAuth 认证（只需要 `cloud-platform` scope）
- 支持所有 Gemini 模型，包括 3.x 系列
- 使用 Gemini 免费订阅额度（Google One AI Pro / Gemini Code Assist standard-tier）

### 架构
```
OpenClaw → gemini-proxy (OpenAI API) → Code Assist API → Gemini Models
                    ↓
            OAuth Token (from Gemini CLI)
                    ↓
            cloudcode-pa.googleapis.com
```

## 支持的模型

| 模型 ID | 说明 | 状态 |
|---------|------|------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro (thinking) | ✅ 可用 |
| `gemini-3.1-flash-lite-preview` | 别名 → gemini-3-flash-preview | ✅ 可用 |
| `gemini-3-pro-preview` | Gemini 3 Pro (thinking) | ✅ 可用 |
| `gemini-3-flash-preview` | Gemini 3 Flash | ✅ 可用 |
| `gemini-2.5-pro` | Gemini 2.5 Pro (thinking) | ✅ 可用 |
| `gemini-2.5-flash` | Gemini 2.5 Flash (thinking) | ✅ 可用 |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | ✅ 可用 |
| `gemini-2.0-flash` | Gemini 2.0 Flash | ✅ 可用 |
| `gemini-1.5-pro` | Gemini 1.5 Pro | ✅ 可用 |
| `gemini-1.5-flash` | Gemini 1.5 Flash | ✅ 可用 |

## 安装部署

### 前置条件
1. 服务器已安装 Node.js 18+
2. 已安装 Gemini CLI 并完成 OAuth 认证

### 步骤

```bash
# 1. 安装依赖
npm install

# 2. 确保 OAuth 凭证存在
ls ~/.gemini/oauth_creds.json

# 3. 启动服务
node src/index.js

# 或使用 PM2 守护进程
pm2 start src/index.js --name gemini-proxy
```

### 环境变量

创建 `.env` 文件（可选）：

```env
PORT=8787                          # 服务端口，默认 8787
GEMINI_PROJECT_ID=your-project-id  # 可选，自动发现
```

## API 使用

### 端点

| 端点 | 说明 |
|------|------|
| `GET /` | 服务信息 |
| `GET /health` | 健康检查 |
| `GET /v1/models` | 列出可用模型 |
| `POST /v1/chat/completions` | Chat Completions API |

### 示例请求

```bash
# 非流式
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-pro-preview",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'

# 流式
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-pro-preview",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### OpenClaw 配置

在 OpenClaw 中配置：
```
API Base URL: http://your-server:8787/v1
API Key: (留空或任意值)
Model: gemini-3.1-pro-preview
```

## 配置要点

### 1. OAuth 认证
服务启动时会自动读取 `~/.gemini/oauth_creds.json`。确保：
- 已运行 `gemini auth` 完成认证
- Token 未过期（可运行 `gemini` 命令测试）

### 2. Project ID
Code Assist API 需要 Project ID。服务会自动调用 `loadCodeAssist` 发现项目 ID。
如果失败，可设置环境变量 `GEMINI_PROJECT_ID`。

### 3. 端口开放
服务监听 `0.0.0.0:8787`，确保防火墙/安全组开放该端口。

### 4. 速率限制
Code Assist API 有速率限制，超出会返回 429 错误，等待几秒后重试即可。

## 文件结构

```
gemini-proxy/
├── src/
│   ├── index.js          # Express 服务入口
│   ├── gemini-client.js  # Gemini API 客户端
│   ├── auth.js           # OAuth 认证管理
│   ├── stream-transformer.js
│   └── routes/
│       └── openai.js     # OpenAI API 路由
├── package.json
├── .env                  # 环境变量（不提交）
└── README.md
```

## 计费说明

本代理使用 Gemini CLI 的认证方式，所有 API 调用通过 Code Assist API：
- 使用 Gemini Code Assist 的免费额度（standard-tier）
- 或 Google One AI Pro 订阅额度
- **不会产生额外费用**

---

# AI Coding Handoff

> 以下信息供 AI 编码工具（如 Claude Code）参考，方便后续维护升级。

## 核心发现

### Code Assist API vs Generative Language API

**关键发现**：Gemini 3.x 模型可以通过 Code Assist API 访问，无需额外的 OAuth scope。

| API | 端点 | OAuth Scope | 支持 Gemini 3.x |
|-----|------|-------------|-----------------|
| Code Assist | `cloudcode-pa.googleapis.com/v1internal` | `cloud-platform` | ✅ |
| Generative Language | `generativelanguage.googleapis.com/v1beta` | `generative-language` | ❌ (需要额外 scope) |

Gemini CLI 内部使用 Code Assist API，所以其 OAuth token 可以访问所有模型。

### 认证流程

```
1. 读取 ~/.gemini/oauth_creds.json
2. 使用 client_id + client_secret 刷新 access_token
3. 调用 loadCodeAssist 获取 project_id
4. 使用 access_token + project_id 调用 streamGenerateContent
```

### OAuth 凭证（Gemini CLI 内置）

```javascript
const OAUTH_CLIENT_ID = "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
const OAUTH_CLIENT_SECRET = "YOUR_GOOGLE_OAUTH_CLIENT_SECRET";
const OAUTH_SCOPE = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
];
```

### Code Assist API 请求格式

```javascript
// 端点
POST https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse

// 请求体
{
  "model": "gemini-3.1-pro-preview",
  "project": "modified-bus-18gwt",  // 从 loadCodeAssist 获取
  "request": {
    "contents": [{ "role": "user", "parts": [{ "text": "Hello" }] }],
    "generationConfig": { ... }
  }
}

// 响应格式 (SSE)
data: {"response": {"candidates": [{"content": {"parts": [{"text": "..."}]}}]}}
```

### 响应解析注意事项

Gemini 3.x 的响应中，`parts` 可能同时包含：
- `text`: 输出文本
- `thoughtSignature`: 思考签名（二进制数据，用于内部）
- `thought: true`: 表示这是思考内容

正确解析：
```javascript
for (const part of candidate.content.parts) {
  // 普通文本（thought !== true）
  if (part.text && part.thought !== true) {
    yield { type: 'text', data: part.text };
  }
  // 思考内容
  if (part.thought === true && part.text) {
    yield { type: 'reasoning', data: part.text };
  }
}
```

### 模型别名

某些模型名称在 Code Assist API 中不存在，需要映射：

```javascript
const MODEL_ALIASES = {
  'gemini-3.1-flash-lite-preview': 'gemini-3-flash-preview',
  'gemini-3.1-flash-preview': 'gemini-3-flash-preview',
};
```

### 常见错误

| 错误码 | 原因 | 解决方案 |
|--------|------|----------|
| 401 | Token 过期 | 刷新 OAuth token |
| 404 | 模型不存在 | 检查模型名称，使用别名 |
| 429 | 速率限制 | 等待几秒后重试 |
| 403 | Project ID 无效 | 检查 loadCodeAssist 返回的 project |

## 升级维护指南

### 添加新模型

1. 在 `gemini-client.js` 的 `DEFAULT_MODELS` 中添加：
```javascript
'gemini-x.x-model-name': {
  contextWindow: 1000000,
  maxTokens: 65536,
  thinking: true/false,
  api: 'codeassist'
}
```

2. 如需别名，在 `MODEL_ALIASES` 中添加映射。

### 调试技巧

```bash
# 测试 Code Assist API 直接调用
ACCESS_TOKEN="ya29..."
PROJECT_ID="..."

curl -X POST "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"gemini-3.1-pro-preview\", \"project\": \"$PROJECT_ID\", \"request\": {\"contents\": [{\"role\": \"user\", \"parts\": [{\"text\": \"Hello\"}]}]}}"

# 刷新 Token
curl -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com" \
  -d "client_secret=YOUR_GOOGLE_OAUTH_CLIENT_SECRET" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

### Gemini CLI 源码位置

Gemini CLI 的关键代码在（用于参考）：
```
~/npm-global/lib/node_modules/@google/gemini-cli/bundle/chunk-2OFO4ODK.js
```

搜索关键词：
- `CODE_ASSIST_ENDPOINT` - API 端点
- `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` - 认证凭证
- `toGenerateContentRequest` - 请求格式
- `fromGenerateContentResponse` - 响应解析

## 已知限制

1. **速率限制**：Code Assist API 有请求频率限制，超出需等待
2. **模型可用性**：某些模型名称（如 `gemini-3.1-flash-lite-preview`）在 API 中不存在，需要别名
3. **思考内容**：Gemini 3.x Pro 模型会生成 `thoughtSignature`，这是二进制数据，不应输出给用户

## License

MIT