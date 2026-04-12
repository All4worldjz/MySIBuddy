# MySiBuddy - QWEN.md

## 项目概述

**MySiBuddy** 是一个**控制平面仓库**，用于部署、加固和运维基于 OpenClaw 的个人智能体系统。这**不是**应用源代码仓库，而是生产环境的配置和运维仓库。

生产系统运行在远程 Linux 服务器 `admin@47.82.234.46` 上，使用 OpenClaw `2026.4.11` 和 Node `24.13.0`。

### 核心架构

**8 智能体集群（2026-04-12 完整配置）：**
| Agent | 角色 | 主责域 | 渠道入口 | 备注 |
|-------|------|--------|----------|------|
| `neo` | Guardian | 系统守护、全局统筹、审批决策 | Telegram neo, Feishu neo | 原 chief-of-staff |
| `link` | Operator | 编程助手+系统运维合并 | Telegram link, Feishu link | 原 coder-hub + sysop |
| `trinity` | Worker | 工作中枢、职场事务 | Telegram trinity, Feishu work | 原 work-hub |
| `morpheus` | Strategist | 创业中枢、战略规划 | Telegram morpheus, Feishu morpheus | 原 venture-hub |
| `oracle` | Mentor | AI导师+生活中枢合并 | Telegram oracle, Feishu oracle | 原 tech-mentor + life-hub |
| `smith` | Challenger | 挑战者、批判性思维 | Telegram smith | 新建，无飞书 |
| `architect` | Designer | 产品设计、架构规划 | Telegram architect, Feishu architect | 原 product-studio |
| `theodore` | Scribe | 中文成文、公众号全流程 | Telegram theodore, Feishu scribe | 原 zh-scribe |

**通信渠道（2026-04-12 完整配置）：**
- Telegram：8 个账号（`neo`、`architect`、`link`、`morpheus`、`oracle`、`smith`、`theodore`、`trinity`）
- Feishu：7 个账号（`work`、`scribe`、`neo`、`link`、`morpheus`、`oracle`、`architect`，通过 `openclaw-lark` 插件 2026.4.7）

**Feishu账号与Agent绑定：**
| Feishu账号 | App ID | 绑定Agent | 说明 |
|------------|--------|-----------|------|
| work | cli_a93c20939cf8dbef | trinity | 工作中枢 |
| scribe | cli_a93e64a4c2785cb2 | theodore | 中文成文 |
| neo | cli_a95206bcacb85cb1 | neo | 系统守护 |
| link | cli_a93ba1f60ff85bb4 | link | 编程运维 |
| morpheus | cli_a951f94174f95bda | morpheus | 创业战略 |
| oracle | cli_a951fa0a74785bef | oracle | AI导师+生活 |
| architect | cli_a951faaa34b85bb3 | architect | 产品设计 |

**注意**：smith 无飞书账号，仅通过 Telegram 访问。

**模型路由（2026-04-06 实际配置）：**
- 主提供商：MiniMax（`minimax/MiniMax-M2.7`）
- 备用提供商：阿里云百炼 ModelStudio（`modelstudio/qwen3.5-plus`、`modelstudio/kimi-k2.5` 等）
- 所有智能体共享相同的主模型和备用链
- **注意**：不再使用 Google Gemini

**系统安全加固（2026-04-06 完成）：**
- SSH：禁用 root 登录、禁用密码认证（仅密钥登录）
- 防火墙：仅允许 SSH(22) + 已建立连接 + 本地回环（需优化为DROP策略）
- Swap：4GB swapfile 配置完成

**密钥审计状态（2026-04-12）：**
- plaintext：18 个（各Agent的 auth-profiles.json 存储API密钥）
- unresolved：27 个（models.json 中的 SecretRef 对象未解析）
- **说明**：plaintext 密钥存储在 Agent 目录的 auth-profiles.json 中，这是 OpenClaw 的正常运行机制；unresolved 问题可通过 `openclaw secrets reload` 解决

**系统资源状态（2026-04-12 体检）：**
- 磁盘：49G总容量，66%使用率 (17G可用)
- 内存：1.8G总容量，Gateway占用约721MB (40%)
- CPU：Gateway进程占用11.1%
- 统一搜索服务：运行正常 (端口18790)
- Swap：4GB (使用0B)

---

## 关键文件

### 运维文档
- `codex_handsoff.md`：权威部署手册，用于在新环境重建完整 OpenClaw 拓扑
- `AGENTS.md`：仓库级 AI 智能体操作规则（变更顺序、备份纪律、人机协作规范）
- `session_handoff.md`：生产变更日志和当前状态记录
- `docs/openclaw-secrets-configuration.md`：**密钥配置指南**（双层存储架构、SecretRef格式、排错经验）
- `QWEN.md`：**系统运维核心文档**（包含全量备份方法铁律）

### 备份与升级策略（铁律）
- **全量备份路径**：`~/mysibuddy_vault/backup` (远程) 和 `/Users/whoami2028/Workshop/MySiBuddy_Vault/backup` (本地)
- **备份脚本**：`~/mysibuddy_vault/backup/create_full_backup.sh`
- **升级脚本**：`~/mysibuddy_vault/backup/upgrade_openclaw.sh`
- **回滚脚本**：`~/mysibuddy_vault/backup/rollback_openclaw.sh`
- **备份频率**：每次重大变更前必须执行全量备份
- **验证步骤**：备份后必须验证备份完整性并下载到本地
- **服务停止**：升级前必须停止所有相关服务

### 防护脚本（`scripts/`）
- `safe_openclaw_validate.sh`：验证候选配置（JSON 语法 + 拓扑检查）
- `safe_openclaw_apply.sh`：唯一允许的生产发布路径（备份 → 验证 → 重启 → 冒烟测试 → 失败自动回滚）
- `safe_openclaw_smoke.sh`：快速健康检查（渠道状态 + 致命日志信号）
- `safe_openclaw_rollback.sh`：恢复已知良好的配置备份
- `lib_openclaw_guardrails.sh`：防护逻辑共享库
- `backup_openclaw_config.sh`：配置备份脚本（备份配置/记忆/系统文件到本地仓库）

### 飞书网盘操作脚本（`scripts/`）
- `feishu_create_folder.sh`：创建文件夹（重名检测、审计日志）
- `feishu_delete_folder.sh`：删除文件夹（软删除到回收站、受保护检查、--dry-run）
- `feishu_move_folder.sh`：移动文件夹（重名检测、受保护检查、--dry-run）
- `lib/feishu_drive_guardrails.sh`：飞书网盘安全策略共享库
- `update_agent_memory_feishu_ops.sh`：更新 Agent MEMORY.md 的脚本

### 配置文件（`config/`）
- `protected_folders.json`：受保护文件夹配置（Token、名称、回收站设置）

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

### 密钥管理

```bash
# 审计密钥配置状态
ssh admin@47.82.234.46 'openclaw secrets audit'

# 重新加载密钥配置
ssh admin@47.82.234.46 'openclaw secrets reload'

# 检查密钥文件权限
ssh admin@47.82.234.46 'ls -la /home/admin/.openclaw/runtime-secrets.json /home/admin/.openclaw/gateway.env'

# 检查 systemd 服务环境变量配置
ssh admin@47.82.234.46 'systemctl --user show openclaw-gateway | grep EnvironmentFile'

# 检查明文密钥泄露
ssh admin@47.82.234.46 'grep -r "sk-cp-\|sk-sp-\|AAG\|AIza" /home/admin/.openclaw/ --include="*.json" --exclude-dir=backup'

# Gateway 服务管理
ssh admin@47.82.234.46 'systemctl --user restart openclaw-gateway'
ssh admin@47.82.234.46 'journalctl --user -u openclaw-gateway -n 30 --no-pager'
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

## 职能边界（2026-04-11 重设计后）

| 职能域 | 主责Agent | 转交规则 |
|--------|-----------|----------|
| **公众号运营全流程** | theodore | 策略、选题、正文、标题、排版、发布、数据复盘 |
| **中文成文/研究** | theodore | 公众号正文、读书笔记、历史研究、哲学研究 |
| **纯生活学习安排** | theodore | 读书计划等 |
| **技术选型** | oracle | 创业中的技术选型决策 |
| **科技学习路径** | oracle | 学习路径设计、训练考核、前沿跟踪 |
| **创业战略** | morpheus | PMF、MVP、实验设计（技术选型→oracle） |
| **正式工作事务** | trinity | 不含公众号运营（公众号→theodore） |
| **生活财务事务** | oracle | 原life-hub职能合并入oracle |
| **编程与系统运维** | link | 编程、代码生成、CLI调用、系统维护 |
| **产品设计** | architect | PRD、产品设计、架构规划 |
| **挑战与批判性思维** | smith | 挑战决策、批判性分析 |
| **系统守护与全局统筹** | neo | 跨域统筹、审批决策、系统维护 |

---

## 配置约束

### 智能体拓扑（2026-04-11 重设计）
必须精确包含 8 个智能体：`neo`, `link`, `trinity`, `morpheus`, `oracle`, `smith`, `architect`, `theodore`

### 插件策略（2026-04-11 实际配置）
```json
{
  "plugins": {
    "allow": ["duckduckgo", "minimax", "openclaw-lark", "telegram", "openai", "qwen", "memory-wiki"],
    "deny": ["feishu"]
  }
}
```

### 绑定规则（2026-04-11 实际配置）
- 当前有 27 条 `bindings` 路由规则
- 包含直接对话路由和群组路由
- 账号到智能体的路由定义在顶层 `bindings`，而非智能体 prompt 文本中
- `neo` 的 `tools.agentToAgent.allow` 必须包含所有 8 个智能体

### 多智能体协作（2026-04-11 实际配置）
```json
{
  "tools": {
    "profile": "full",
    "sessions": { "visibility": "all" },
    "agentToAgent": {
      "enabled": true,
      "allow": ["neo", "link", "trinity", "morpheus", "oracle", "smith", "architect", "theodore"]
    },
    "web": {
      "search": {
        "provider": "unified_search",
        "enabled": true
      },
      "fetch": {
        "enabled": true
      }
    }
  }
}
```

### Sandbox 配置（2026-04-07 更新：工具权限收敛策略）

**所有 agents 移除沙盒限制**，通过工具权限控制实现安全隔离：

| Agent | 角色 | Sandbox | Exec 权限 | 说明 |
|-------|------|---------|-----------|------|
| `neo` | Guardian | off | ✅ 允许 | 系统守护者，需要系统级访问 |
| `link` | Operator | off | ✅ 允许 | 编程助手+运维，需要 CLI 访问 |
| `trinity` | Worker | off | ❌ 禁止 | 工作中枢 |
| `morpheus` | Strategist | off | ❌ 禁止 | 创业中枢 |
| `oracle` | Mentor | off | ❌ 禁止 | AI导师+生活中枢 |
| `smith` | Challenger | off | ❌ 禁止 | 挑战者 |
| `architect` | Designer | off | ❌ 禁止 | 产品设计 |
| `theodore` | Scribe | off | ❌ 禁止 | 中文成文 |

**配置示例**：
```json
{
  "id": "oracle",
  "sandbox": { "mode": "off" },
  "tools": { "deny": ["exec", "process"] }
}
```

**原因**: OpenClaw 安全限制阻止 sandboxed agent spawn unsandboxed subagent。详见 `docs/troubleshooting_sandbox_spawn.md`。

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
- **解决**：从现有智能体（如 `Chief-of-staff`）复制这两个文件

### 密钥存储双层机制（2026-04-07 发现）
- OpenClaw 使用**双层密钥解析**：进程启动时需要环境变量，运行时需要 SecretRef 解析
- **问题**：只配置 `runtime-secrets.json` 而不配置 `gateway.env`，会导致 Gateway 启动失败
- **错误日志**：`Environment variable "MODELSTUDIO_API_KEY" is missing or empty`
- **解决**：同时维护 `runtime-secrets.json` 和 `gateway.env`，并配置 systemd 的 `EnvironmentFile`

### SecretRef id 格式错误
- `openclaw.json` 中的 SecretRef 对象 `id` 字段必须以 `/` 开头（绝对 JSON 指针格式）
- **错误示例**：`"id": "OPENCLAW_GATEWAY_TOKEN"`（缺少 `/` 前缀）
- **正确示例**：`"id": "/OPENCLAW_GATEWAY_TOKEN"`
- **错误日志**：`File secret reference id must be an absolute JSON pointer`

### Sandbox Spawn 限制（2026-04-07 发现）
- **硬性约束**：sandboxed agent 不能 spawn unsandboxed subagent
- **错误日志**：`Sandboxed sessions cannot spawn unsandboxed subagents. Set a sandboxed target agent or use the same agent runtime.`
- **原因**：OpenClaw 安全设计，防止沙盒逃逸
- **解决方案**：将所有 agents 设为 unsandboxed，通过 `tools.deny` 禁止非编程 agents 的 exec 权限
- **详细记录**：`docs/troubleshooting_sandbox_spawn.md`

### 飞书 Drive API 端点差异（2026-04-08 发现）
- **错误端点**：`GET /open-apis/drive/v1/folders/{token}/children` 返回 404
- **正确端点**：`GET /open-apis/drive/v1/files?folder_token={token}`
- **响应字段差异**：返回 `data.files` 而非 `data.items`
- **元信息字段**：返回 `title` 而非 `name`，`doc_type` 而非 `type`

### 飞书创建文件夹参数位置（2026-04-08 发现）
- **错误**：`folder_token` 作为 Query 参数传递
- **正确**：`folder_token` 必须在 Body 中传递
- **根目录限制**：无法在根目录直接创建文件夹，必须指定父文件夹 token
- **详细记录**：`docs/troubleshooting-feishu-drive-api.md`

### 飞书 WebSocket 连接问题（2026-04-12 新发现）
- **错误**：`Request failed with status code 400` on ping endpoint
- **症状**：`ws unable to connect to the server after trying N times`
- **原因**：新创建的飞书应用缺少开放平台配置（事件订阅、权限）
- **解决**：在飞书开放平台为每个应用配置事件订阅和权限

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