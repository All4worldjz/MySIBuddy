# MySiBuddy - QWEN.md

## 项目概述

**MySiBuddy** 是一个**控制平面仓库**，用于部署、加固和运维基于 OpenClaw 的个人智能体系统。这**不是**应用源代码仓库，而是生产环境的配置和运维仓库。

生产系统运行在远程 Linux 服务器 `admin@47.82.234.46` 上，使用 OpenClaw `2026.4.5` 和 Node `24.13.0`。

### 核心架构

**8 智能体集群：**
| Agent | 角色 | 主责域 | 渠道入口 |
|-------|------|--------|----------|
| `chief-of-staff` | 编排器 | 跨域统筹、审批、系统维护 | Telegram chief |
| `work-hub` | 工作中枢 | 正式工作事务（不含公众号） | Feishu work |
| `venture-hub` | 创业中枢 | 创业战略/PMF/MVP（不含技术选型） | Telegram personal (群组) |
| `life-hub` | 生活中枢 | 生活财务事务（不含学习安排） | Telegram personal |
| `product-studio` | 产品设计 | PRD、产品设计（后台specialist） | 无直接入口 |
| `zh-scribe` | 中文成文 | 公众号全流程、中文成文、读书笔记 | Feishu scribe |
| `tech-mentor` | AI导师 | 技术选型、科技学习、前沿跟踪 | Telegram mentor |
| `coder-hub` | 编程助手 | 编程、代码生成与分析、CLI调用 | 无直接入口 (仅限内部调用) |

**通信渠道：**
- Telegram：3 个账号（`chief`、`personal`、`mentor`）
- Feishu：2 个账号（`work`、`scribe`，通过 `openclaw-lark` 插件）

**模型路由（2026-04-06 实际配置）：**
- 主提供商：MiniMax（`minimax/MiniMax-M2.7`）
- 备用提供商：阿里云百炼 ModelStudio（`modelstudio/qwen3.5-plus`、`modelstudio/kimi-k2.5` 等）
- 所有智能体共享相同的主模型和备用链
- **注意**：不再使用 Google Gemini

**系统安全加固（2026-04-06 完成）：**
- SSH：禁用 root 登录、禁用密码认证（仅密钥登录）
- 防火墙：仅允许 SSH(22) + 已建立连接 + 本地回环
- Swap：4GB swapfile 配置完成

---

## 关键文件

### 运维文档
- `codex_handsoff.md`：权威部署手册，用于在新环境重建完整 OpenClaw 拓扑
- `AGENTS.md`：仓库级 AI 智能体操作规则（变更顺序、备份纪律、人机协作规范）
- `session_handoff.md`：生产变更日志和当前状态记录

### 防护脚本（`scripts/`）
- `safe_openclaw_validate.sh`：验证候选配置（JSON 语法 + 拓扑检查）
- `safe_openclaw_apply.sh`：唯一允许的生产发布路径（备份 → 验证 → 重启 → 冒烟测试 → 失败自动回滚）
- `safe_openclaw_smoke.sh`：快速健康检查（渠道状态 + 致命日志信号）
- `safe_openclaw_rollback.sh`：恢复已知良好的配置备份
- `lib_openclaw_guardrails.sh`：防护逻辑共享库
- `backup_openclaw_config.sh`：配置备份脚本（备份配置/记忆/系统文件到本地仓库）

### 备份技能（`skills/backup-openclaw/`）
- `SKILL.md`：OpenClaw 配置备份技能文档
- **功能**：备份远程服务器的 agents 配置、记忆文件、系统 JSON 配置
- **用法**：`./scripts/backup_openclaw_config.sh [--config|--memory|--system|--all|--dry-run]`


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
# 检查系统深度状态
ssh admin@47.82.234.46 'openclaw status --deep'

# 检查渠道状态
ssh admin@47.82.234.46 'openclaw status --deep | grep -E "(ON|OK|Channel)"'

# 查看当前配置
ssh admin@47.82.234.46 'cat /home/admin/.openclaw/openclaw.json'

# 列出备份文件
ssh admin@47.82.234.46 'ls -la /home/admin/.openclaw/*.json.pre-*'

# 验证安全配置
ssh admin@47.82.234.46 'grep -E "^PermitRootLogin|^PasswordAuthentication" /etc/ssh/sshd_config'
ssh admin@47.82.234.46 'sudo iptables -L INPUT -n'
ssh admin@47.82.234.46 'free -h | grep Swap'
```

### 配置备份（本地仓库）

```bash
# 备份全部（配置+记忆+系统文件）
./scripts/backup_openclaw_config.sh --all

# 仅备份配置文件（AGENTS.md等）
./scripts/backup_openclaw_config.sh --config

# 仅备份记忆文件（memory目录）
./scripts/backup_openclaw_config.sh --memory

# 仅备份系统配置（JSON文件）
./scripts/backup_openclaw_config.sh --system

# 预览模式（不实际执行）
./scripts/backup_openclaw_config.sh --dry-run --all
```

**备份输出目录：**
- `docs/agents-config-backup-YYYYMMDD/`：各agent的AGENTS.md、MEMORY.md、SOUL.md等
- `docs/agents-memory-backup-YYYYMMDD/`：各agent的memory/*.md记忆条目
- `docs/openclaw-config-backup-YYYYMMDD/`：openclaw.json、cron、telegram、feishu等系统配置

---

## 职能边界（2026-04-06 细化）

| 职能域 | 主责Agent | 转交规则 |
|--------|-----------|----------|
| **公众号运营全流程** | zh-scribe | 策略、选题、正文、标题、排版、发布、数据复盘 |
| **中文成文/研究** | zh-scribe | 公众号正文、读书笔记、历史研究、哲学研究 |
| **纯生活学习安排** | zh-scribe | 读书计划等 |
| **技术选型** | tech-mentor | 创业中的技术选型决策 |
| **科技学习路径** | tech-mentor | 学习路径设计、训练考核、前沿跟踪 |
| **创业战略** | venture-hub | PMF、MVP、实验设计（技术选型→tech-mentor） |
| **正式工作事务** | work-hub | 不含公众号运营（公众号→zh-scribe） |
| **生活财务事务** | life-hub | 不含学习安排（学习→zh-scribe/tech-mentor） |

---

## 配置约束

### 智能体拓扑
必须精确包含 8 个智能体：`chief-of-staff`, `work-hub`, `venture-hub`, `life-hub`, `product-studio`, `zh-scribe`, `tech-mentor`, `coder-hub`

### 插件策略
```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram", "duckduckgo", "minimax", "openai", "qwen"],
    "deny": ["feishu"]
  }
}
```

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
      "allow": ["chief-of-staff", "work-hub", "venture-hub", "life-hub", "product-studio", "zh-scribe", "tech-mentor", "coder-hub"]
    }
  }
}
```

### Sandbox 配置（已分层安全隔离）
- `chief-of-staff` / `coder-hub`：`sandbox.mode = "off"`（允许系统级访问）
- 6个 Hub 智能体：`sandbox.mode = "all"`（全面沙盒隔离防注入）

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

### 配置损坏事件（2026-04-01 历史）
- `config.apply` 曾覆盖 `openclaw.json` 为不完整对象
- 导致 `channels` 和 `bindings` 消失，所有机器人停止响应
- **应对措施**：回滚到最近的 `openclaw.json.pre-*` 备份，重启 gateway

### Feishu 重复账号问题
- 同一 Feishu 应用同时出现在顶层 `channels.feishu.*` 和 `channels.feishu.accounts.work` 会导致消息间歇性丢失
- **解决**：移除顶层 `appId/appSecret`，只保留明确的真实账号（`work`、`scribe`）
- **注意**：`accounts.default` 无 appId/appSecret，不影响实际消息处理

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