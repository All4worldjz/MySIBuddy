# OpenClaw 密钥配置指南

**文档版本**：2026-04-07  
**适用版本**：OpenClaw 2026.4.5

---

## 1. 密钥存储架构

OpenClaw 使用**双层密钥解析机制**，需要维护两份配置文件：

```
密钥存储架构：

┌─────────────────────────────────────────────────────────────────┐
│                    systemd 服务启动                              │
│                         ↓                                        │
│    gateway.env (环境变量) ──→ 进程环境变量注入                    │
│                         ↓                                        │
│                   OpenClaw Gateway 进程                          │
│                         ↓                                        │
│    runtime-secrets.json ──→ 运行时 SecretRef 解析                │
│                         ↓                                        │
│              models.json / channels 配置引用                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 文件职责

| 文件 | 格式 | 用途 | 权限 |
|------|------|------|------|
| `runtime-secrets.json` | JSON | OpenClaw 运行时密钥解析（SecretRef） | 600 |
| `gateway.env` | ENV | systemd 服务启动时环境变量注入 | 600 |

### 1.2 为什么需要两份配置？

**根本原因**：OpenClaw 的密钥解析有两个阶段：

1. **进程启动阶段**：systemd 启动 gateway 进程时，`models.json` 中的 `${VAR}` 语法需要从环境变量解析
2. **运行时阶段**：OpenClaw 运行后，`channels` 配置中的 SecretRef 对象从 `runtime-secrets.json` 解析

**错误场景**：如果只配置 `runtime-secrets.json` 而不配置环境变量：
```
Gateway failed to start: Error: Startup failed: required secrets are unavailable.
SecretRefResolutionError: Environment variable "MODELSTUDIO_API_KEY" is missing or empty.
```

---

## 2. 配置文件详解

### 2.1 runtime-secrets.json

**位置**：`/home/admin/.openclaw/runtime-secrets.json`

**完整结构**：
```json
{
  "MINIMAX_API_KEY": "sk-cp-...",
  "MODELSTUDIO_API_KEY": "sk-sp-...",
  "OPENCLAW_GATEWAY_TOKEN": "...",
  
  "TELEGRAM_BOT_TOKEN_CHIEF": "...",
  "TELEGRAM_BOT_TOKEN_PERSONAL": "...",
  "TELEGRAM_BOT_TOKEN_MENTOR": "...",
  
  "FEISHU_APP_SECRET": "...",
  "FEISHU_APP_SECRET_SCRIBE": "...",
  
  "/TELEGRAM_BOT_TOKEN_CHIEF": "...",
  "/TELEGRAM_BOT_TOKEN_PERSONAL": "...",
  "/TELEGRAM_BOT_TOKEN_MENTOR": "...",
  "/FEISHU_APP_SECRET": "...",
  "/OPENCLAW_GATEWAY_TOKEN": "...",
  
  "tokens": {
    "openai": {
      "openai:bailian": "sk-sp-..."
    },
    "minimax": {
      "minimax:primary": "sk-cp-...",
      "minimax:global": "sk-cp-..."
    }
  }
}
```

**键名约定**：

| 键名格式 | 用途 | 示例 |
|---------|------|------|
| `VAR_NAME` | `${VAR}` 语法引用 | `MINIMAX_API_KEY` |
| `/VAR_NAME` | SecretRef 对象引用（绝对JSON指针） | `/TELEGRAM_BOT_TOKEN_CHIEF` |
| `tokens.provider.profile` | auth-profiles 认证配置 | `tokens.minimax.minimax:primary` |

### 2.2 gateway.env

**位置**：`/home/admin/.openclaw/gateway.env`

**内容**：
```bash
MINIMAX_API_KEY=sk-cp-...
MODELSTUDIO_API_KEY=sk-sp-...
OPENCLAW_GATEWAY_TOKEN=...
```

**用途**：systemd 服务启动时加载，供 `models.json` 中的 `${VAR}` 语法解析。

### 2.3 systemd 服务配置

**位置**：`~/.config/systemd/user/openclaw-gateway.service`

**关键配置项**：
```ini
[Service]
EnvironmentFile=/home/admin/.openclaw/gateway.env
```

---

## 3. 密钥引用方式

### 3.1 方式A：SecretRef 对象（推荐用于 channels）

**openclaw.json 配置**：
```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "chief": {
          "botToken": {
            "source": "file",
            "provider": "runtime",
            "id": "/TELEGRAM_BOT_TOKEN_CHIEF"
          }
        }
      }
    }
  },
  "gateway": {
    "auth": {
      "mode": "token",
      "token": {
        "source": "file",
        "provider": "runtime",
        "id": "/OPENCLAW_GATEWAY_TOKEN"
      }
    }
  }
}
```

**对应 runtime-secrets.json**：
```json
{
  "/TELEGRAM_BOT_TOKEN_CHIEF": "实际的token值",
  "/OPENCLAW_GATEWAY_TOKEN": "实际的gateway token"
}
```

**注意**：`id` 必须以 `/` 开头（绝对 JSON 指针格式），否则会报错：
```
File secret reference id must be an absolute JSON pointer (example: "/providers/openai/apiKey")
```

### 3.2 方式B：${VAR} 语法（用于 models.json）

**models.json 配置**：
```json
{
  "providers": {
    "minimax": {
      "apiKey": "${MINIMAX_API_KEY}"
    },
    "modelstudio": {
      "apiKey": "${MODELSTUDIO_API_KEY}"
    }
  }
}
```

**要求**：
- 对应的环境变量必须在进程启动时存在
- 需要在 `gateway.env` 中定义
- 需要在 systemd 服务配置中添加 `EnvironmentFile`

### 3.3 方式C：tokens 嵌套结构（用于 auth-profiles）

**runtime-secrets.json**：
```json
{
  "tokens": {
    "minimax": {
      "minimax:primary": "sk-cp-..."
    }
  }
}
```

**auth-profiles.json 引用**：
```json
{
  "profiles": {
    "minimax:primary": {
      "type": "token",
      "provider": "minimax",
      "token": "${MINIMAX_API_KEY}"
    }
  }
}
```

---

## 4. 排错经验

### 4.1 Gateway 启动失败：环境变量缺失

**错误日志**：
```
Gateway failed to start: Error: Startup failed: required secrets are unavailable.
SecretRefResolutionError: Environment variable "MODELSTUDIO_API_KEY" is missing or empty.
```

**原因**：`models.json` 使用 `${VAR}` 语法，但进程启动时环境变量不存在。

**解决方案**：
1. 创建 `gateway.env` 文件
2. 在 systemd 服务配置中添加 `EnvironmentFile=/home/admin/.openclaw/gateway.env`
3. 执行 `systemctl --user daemon-reload && systemctl --user restart openclaw-gateway`

### 4.2 SecretRef id 格式错误

**错误日志**：
```
Invalid config: gateway.auth.token.id: File secret reference id must be an absolute JSON pointer
```

**原因**：SecretRef 的 `id` 字段未以 `/` 开头。

**错误示例**：
```json
{
  "id": "OPENCLAW_GATEWAY_TOKEN"  // ❌ 缺少 / 前缀
}
```

**正确示例**：
```json
{
  "id": "/OPENCLAW_GATEWAY_TOKEN"  // ✅ 正确格式
}
```

### 4.3 CLI 命令报错：missing env var

**错误日志**：
```
Config: missing env var "OPENCLAW_GATEWAY_TOKEN" at gateway.auth.token
```

**原因**：CLI 模式下不解析 `runtime-secrets.json`，只能通过环境变量或 SecretRef 对象解析。

**解决方案**：确保 `gateway.auth.token` 使用 SecretRef 格式，并且 runtime-secrets.json 中有对应的 `/OPENCLAW_GATEWAY_TOKEN` 键。

### 4.4 secrets audit 警告

**运行**：`openclaw secrets audit`

**常见警告**：
- `PLAINTEXT_FOUND`：auth-profiles 中的 `key` 字段被识别为明文（实际是 `${VAR}` 语法，可忽略）
- `REF_UNRESOLVED`：models.json 中的 `apiKey` 无法解析（检查环境变量是否配置）

**注意**：这些警告不影响实际运行，但建议优化配置格式。

---

## 5. 配置变更流程

### 5.1 添加新密钥

1. 更新 `runtime-secrets.json`（添加顶层变量和 `/` 前缀变量）
2. 更新 `gateway.env`（如果 models.json 需要引用）
3. 执行 `openclaw secrets reload`
4. 如需重启：`systemctl --user restart openclaw-gateway`

### 5.2 轮换密钥

1. 更新 `runtime-secrets.json` 和 `gateway.env` 中的密钥值
2. 执行 `openclaw secrets reload`
3. 验证系统状态：`openclaw status --deep`
4. **重要**：轮换后删除旧的备份文件

### 5.3 删除密钥

1. 从 `runtime-secrets.json` 和 `gateway.env` 中删除对应键
2. 检查并更新引用该密钥的配置文件
3. 执行 `openclaw secrets reload`

---

## 6. 最佳实践

### 6.1 权限管理

```bash
chmod 600 /home/admin/.openclaw/runtime-secrets.json
chmod 600 /home/admin/.openclaw/gateway.env
chmod 700 /home/admin/.openclaw/credentials/
```

### 6.2 备份策略

**不要备份**：
- `runtime-secrets.json`（包含明文密钥）
- `gateway.env`（包含明文密钥）
- `credentials/` 目录

**可以备份**：
- `openclaw.json`（不含密钥值，只有引用配置）
- `agents/*/agent/models.json`（不含密钥值，只有变量名）

### 6.3 审计检查

定期执行：
```bash
# 密钥审计
openclaw secrets audit

# 检查明文密钥泄露
grep -r "sk-cp-\|sk-sp-\|AAG\|AIza" /home/admin/.openclaw/ --include="*.json" --exclude-dir=backup

# 检查备份文件
find /home/admin/.openclaw -name "*.pre-*" -o -name "*.bak" | wc -l
```

---

## 7. 常见问题 FAQ

### Q1: .env 文件还有用吗？

**答**：`/home/admin/.openclaw/.env` 文件**已废弃**，不再被 OpenClaw 使用。当前使用的是：
- `runtime-secrets.json`（运行时）
- `gateway.env`（systemd 服务启动）

### Q2: 为什么有两个地方存储密钥？

**答**：OpenClaw 的密钥解析有两个阶段：
1. 进程启动时：需要环境变量（`gateway.env`）
2. 运行时：需要 SecretRef 解析（`runtime-secrets.json`）

### Q3: 密钥应该存在哪里？

**答**：
- **API Key**：同时存储在 `runtime-secrets.json` 和 `gateway.env`
- **Bot Token**：仅存储在 `runtime-secrets.json`（使用 `/` 前缀格式）
- **Gateway Token**：同时存储在两个文件

---

## 8. 参考链接

- OpenClaw 官方文档：https://docs.openclaw.ai/gateway/security
- 本项目运维手册：`QWEN.md`、`codex_handsoff.md`