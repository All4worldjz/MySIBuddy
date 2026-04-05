# MySiBuddy - QWEN.md

## 项目概述

**MySiBuddy** 是一个**控制平面仓库**，用于部署、加固和运维基于 OpenClaw 的个人智能体系统。这**不是**应用源代码仓库，而是生产环境的配置和运维仓库。

生产系统运行在远程 Linux 服务器 `admin@47.82.234.46` 上，使用 OpenClaw `2026.4.2` 和 Node `24.13.0`。

### 核心架构

**7 智能体集群：**
- `chief-of-staff`：编排器，拥有全局会话可见性、管理员权限、搜索委派能力（`sandbox.mode = off`）
- `work-hub`、`venture-hub`、`life-hub`、`product-studio`、`zh-scribe`、`tech-mentor`：领域专用沙盒工作智能体（`sandbox.mode = all`）

**通信渠道：**
- Telegram：3 个账号（`chief`、`personal`、`mentor`）
- Feishu：2 个账号（`work`、`scribe`，通过 `openclaw-lark` 插件）
- Weixin：1 个账号

**模型路由：**
- 主提供商：Google Gemini（多密钥故障转移：`google:primary` → `google:secondary` → `google:tertiary`）
- 备用提供商：MiniMax（`minimax/MiniMax-M2.7`）
- `zh-scribe` 的主模型是 `minimax/MiniMax-M2.7`（中文场景优化）

**子项目：**
- `gemini-proxy/`：OpenAI 兼容的 Gemini 代理，运行在端口 `8787`，通过 Google OAuth 认证访问 Gemini 模型

---

## 关键文件

### 运维文档
- `codex_handsoff.md`：权威部署手册，用于在新环境重建完整 OpenClaw 拓扑
- `AGENTS.md`：仓库级 AI 智能体操作规则（变更顺序、备份纪律、人机协作规范）
- `skills/openclaw-plugin-channel-recovery/SKILL.md`：完整的 Codex 部署/恢复运行手册
- `GEMINI.md`：Gemini 模型配置和多密钥认证设计说明
- `session_handoff.md`：生产变更日志和当前状态记录

### 防护脚本（`scripts/`）
- `safe_openclaw_validate.sh`：验证候选配置（JSON 语法 + 7 智能体拓扑 + 插件策略）
- `safe_openclaw_apply.sh`：唯一允许的生产发布路径（备份 → 验证 → 重启 → 冒烟测试 → 失败自动回滚）
- `safe_openclaw_smoke.sh`：快速健康检查（渠道状态 + 致命日志信号）
- `safe_openclaw_rollback.sh`：恢复已知良好的配置备份
- `lib_openclaw_guardrails.sh`：防护逻辑共享库

### 子项目（`gemini-proxy/`）
- `package.json`：Node.js 项目定义（Express、cors、dotenv、node-fetch）
- `src/index.js`：代理主程序
- `.env.example`：环境变量模板
- `gemini-proxy.service`：systemd 服务定义

---

## 运行和验证命令

### 生产配置变更（必须使用防护脚本）

```bash
# 验证候选配置
scripts/safe_openclaw_validate.sh /tmp/openclaw.candidate.json

# 应用配置（自动备份、重启、冒烟测试、失败回滚）
scripts/safe_openclaw_apply.sh /tmp/openclaw.candidate.json

# 快速健康检查
scripts/safe_openclaw_smoke.sh

# 回滚到指定备份
scripts/safe_openclaw_rollback.sh /home/admin/.openclaw/openclaw.json.pre-apply-YYYYmmdd-HHMMSS
```

### 远程执行（SSH）

```bash
# 检查系统状态
ssh admin@47.82.234.46 'openclaw status --deep'

# 检查智能体状态
ssh admin@47.82.234.46 'openclaw status --deep | grep -E "(ON|OK|Agents)"'
```

### Gemini Proxy 子项目

```bash
cd gemini-proxy && npm install      # 安装依赖
npm start                           # 启动代理（端口 8787）
npm run dev                         # 开发模式（watch）
curl http://127.0.0.1:8787/health   # 健康检查
```

---

## 配置约束（防护脚本强制检查）

### 智能体拓扑
必须精确包含 7 个智能体：
1. `chief-of-staff`
2. `work-hub`
3. `venture-hub`
4. `life-hub`
5. `product-studio`
6. `zh-scribe`
7. `tech-mentor`

### 插件策略
```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram", "duckduckgo", "openclaw-weixin", "minimax", "unified-search"],
    "deny": ["feishu"]
  }
}
```

### 渠道账号
- Telegram：`chief`、`personal`、`mentor`（+ `dev`）
- Feishu：`work`、`scribe`
- **禁止**：顶层 `channels.feishu.appId/appSecret`
- **禁止**：`channels.feishu.accounts.default`（多账号模式下）

### 绑定规则
- 必须有 7 条 `bindings` 路由规则
- 账号到智能体的路由必须定义在顶层 `bindings`，而非智能体 prompt 文本中
- `chief-of-staff` 的 `subagents.allowAgents` 必须包含所有 6 个工作智能体

### 多智能体协作
```json
{
  "tools": {
    "profile": "full",
    "sessions": { "visibility": "all" },
    "agentToAgent": {
      "enabled": true,
      "allow": ["chief-of-staff", "work-hub", "venture-hub", "life-hub", "product-studio", "zh-scribe", "tech-mentor"]
    }
  }
}
```

---

## 安全规则

1. **编辑前必须备份**：使用带时间戳的备份
2. **不要仅信任配置读取**：必须用真实入站消息验证运行时行为
3. **禁止自动运行 `openclaw doctor --fix`**
4. **配置损坏时优先回滚**：如果出现 `Unknown channel`、`Outbound not configured`、`channels/bindings` 为空，立即回滚再调试
5. **默认不推送到 `origin`**：除非用户明确要求
6. **新智能体目录必须包含**：
   - `auth-profiles.json`
   - `models.json`

---

## 已知陷阱

### 配置损坏事件（2026-04-01）
- `config.apply` 曾覆盖 `openclaw.json` 为不完整对象
- 导致 `channels` 和 `bindings` 消失，所有机器人停止响应
- **应对措施**：回滚到最近的 `openclaw.json.pre-*` 备份，重启 gateway

### Feishu 重复账号问题
- 同一 Feishu 应用同时出现在顶层 `channels.feishu.*` 和 `channels.feishu.accounts.work` 会导致消息间歇性丢失
- **解决**：移除顶层 `appId/appSecret`，移除 `default` 账号，只保留明确的真实账号（`work`、`scribe`）

### 新智能体认证缺失
- 新建智能体目录后，如果没有复制 `auth-profiles.json` 和 `models.json`，会导致所有模型报认证错误
- **解决**：从现有智能体（如 `chief-of-staff`）复制这两个文件

---

## 分支策略

- `main`：稳定基线，用于已验证的变更
- `dev`：活跃开发分支

---

## 完成定义

任务完成必须满足以下所有条件：
1. `openclaw status --deep` 健康
2. 目标渠道/账号状态为 `ON/OK`
3. 直接智能体调用成功，使用预期的模型/提供商
4. 真实入站消息路由到预期的会话键
5. 文档反映已验证的行为
