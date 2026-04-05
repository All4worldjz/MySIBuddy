# Gemini Proxy

OpenAI-compatible proxy for Google Gemini via OAuth authentication. 运行在 OpenClaw 服务器上，通过 Google 账号的 OAuth 认证访问 Gemini 模型。

## 工作原理

```
OpenClaw (OpenAI 格式) → Gemini Proxy (本地) → Google Code Assist API
```

## 功能特性

- OpenAI 兼容接口 (`/v1/chat/completions`, `/v1/models`)
- 使用 Google OAuth 认证（与 Gemini CLI 相同）
- 支持流式输出 (SSE)
- 支持 Tool Calling (函数调用)
- Token 自动刷新
- 本地文件缓存认证信息

## 准备工作

### 第一步：本地获取 Google OAuth 凭证

1. 在**本地电脑**（非服务器）安装 Gemini CLI：
```bash
npm install -g @google/gemini-cli
```

2. 运行认证：
```bash
gemini
```
选择 `Login with Google` 并登录你的账号。

3. 找到凭证文件：
- Mac/Linux: `~/.gemini/oauth_creds.json`
- Windows: `C:\Users\你的用户名\.gemini\oauth_creds.json`

4. 复制该文件内容，后续步骤需要用到。

### 第二步：创建 GCP 项目（推荐）

虽然凭证可以自动发现项目 ID，但手动创建项目可以获得更好的控制：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 新建项目
3. 记下 Project ID（非项目名称）
4. 访问 [Gemini for Google Cloud API](https://console.cloud.google.com/apis/library/codegenassist.googleapis.com) 并启用

## 服务器部署

### 方式一：自动化部署脚本

```bash
# 在服务器上执行
curl -fsSL https://raw.githubusercontent.com/your-repo/gemini-proxy/main/deploy.sh | bash
```

### 方式二：手动部署

```bash
# 1. 克隆或上传项目到服务器
git clone <repo-url> /opt/gemini-proxy
cd /opt/gemini-proxy

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
nano .env

# 4. 编辑 .env，填入 OAuth 凭证（单行 JSON）
# GCP_SERVICE_ACCOUNT={"access_token":"...","refresh_token":"...","scope":"...","token_type":"Bearer","id_token":"...","expiry_date":...}

# 5. 设置开机启动（systemd）
sudo cp gemini-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gemini-proxy
sudo systemctl start gemini-proxy

# 6. 检查状态
sudo systemctl status gemini-proxy
```

## 验证

```bash
# 检查健康状态
curl http://127.0.0.1:8787/health

# 列出可用模型
curl http://127.0.0.1:8787/v1/models

# 测试对话（非流式）
curl -X POST http://127.0.0.1:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# 测试流式输出
curl -X POST http://127.0.0.1:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Write a haiku"}],
    "stream": true
  }'
```

## OpenClaw 配置

修改 OpenClaw 的 `openclaw.json`：

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "openai": {
        "baseUrl": "http://127.0.0.1:8787/v1",
        "apiKey": "sk-your-secret-api-key-here",
        "api": "openai-completions",
        "models": [
          {
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 1000000,
            "maxTokens": 65536
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gemini-2.5-flash"
      }
    }
  }
}
```

## 支持的模型

- `gemini-2.5-pro` - 最新的 Pro 模型，支持思考
- `gemini-2.5-flash` - 快速模型，支持思考
- `gemini-2.5-flash-lite` - 轻量快速模型
- `gemini-2.0-flash` - 2.0 快速模型
- `gemini-1.5-pro` - 1.5 Pro 模型
- `gemini-1.5-flash` - 1.5 快速模型

## 故障排查

### 401 Authentication Error
凭证无效或已过期。需要重新运行 `gemini auth` 获取新凭证。

### Token 刷新失败
`refresh_token` 被撤销。重新运行 `gemini auth` 获取新的完整凭证。

### 连接被拒绝
服务未启动或端口被占用：
```bash
systemctl status gemini-proxy
journalctl -u gemini-proxy -f
```

### 模型不支持
确保使用正确的模型 ID，可通过 `GET /v1/models` 查看可用模型。

## 安全建议

1. 设置 `OPENAI_API_KEY` 防止未授权访问
2. 保持服务只监听 `127.0.0.1`（不暴露公网）
3. 定期备份 `.token_cache.json` 文件

## License

MIT
