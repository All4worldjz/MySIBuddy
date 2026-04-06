# OpenClaw 配置备份技能

## 概述

此技能用于备份远程 OpenClaw 服务器的配置、记忆和系统文件到本地仓库。

## 备份内容

### 1. Agents 配置文件 (`--config`)

备份所有 agent 的 workspace 目录中的 md 文件：

| Agent | 目录 | 内容 |
|-------|------|------|
| chief-of-staff | workspace-chief/ | AGENTS.md, MEMORY.md, SOUL.md 等 |
| work-hub | workspace-work/ | AGENTS.md, MEMORY.md, SOUL.md 等 |
| venture-hub | workspace-venture/ | AGENTS.md, MEMORY.md, SOUL.md 等 |
| life-hub | workspace-life/ | AGENTS.md, MEMORY.md, SOUL.md 等 |
| product-studio | workspace-product/ | AGENTS.md, MEMORY.md, SOUL.md 等 |
| zh-scribe | workspace-zh-scribe/ | AGENTS.md, MEMORY.md, SOUL.md 等 |
| tech-mentor | workspace-tech-mentor/ | AGENTS.md, MEMORY.md, SOUL.md 等 |

**排除**：node_modules, .private, sessions, *.json, *.py

### 2. Agents 记忆文件 (`--memory`)

备份所有 agent 的 memory 目录：

```
workspace-{agent}/memory/*.md
```

### 3. 系统配置文件 (`--system`)

备份 OpenClaw 系统配置（JSON文件）：

| 类别 | 文件 | 说明 |
|------|------|------|
| 主配置 | openclaw.json | 完整7智能体拓扑 |
| 执行审批 | exec-approvals.json | exec 命令审批配置 |
| 定时任务 | cron/jobs.json | cron 任务配置 |
| 设备配对 | devices/paired.json | 已配对设备 |
| 身份认证 | identity/*.json | 设备身份配置 |
| Telegram | telegram/*.json | Telegram 渠道配置（非敏感） |
| 飞书 | feishu/*.json | 飞书渠道配置（非敏感） |
| Agents | agents/*/agent/*.json | 各 agent 的认证和模型配置 |

**排除**：包含密钥的敏感文件（lark.secrets.json, runtime-secrets.json）

## 使用方法

### 基本用法

```bash
# 备份全部（默认）
./scripts/backup_openclaw_config.sh

# 备份全部（显式指定）
./scripts/backup_openclaw_config.sh --all

# 仅备份配置文件
./scripts/backup_openclaw_config.sh --config

# 仅备份记忆文件
./scripts/backup_openclaw_config.sh --memory

# 仅备份系统配置
./scripts/backup_openclaw_config.sh --system

# 组合备份
./scripts/backup_openclaw_config.sh --config --memory

# 预览模式（不实际执行）
./scripts/backup_openclaw_config.sh --dry-run
```

### 通过 Codex 执行

向 Codex 发送以下指令：

```
执行 OpenClaw 配置备份
```

Codex 将：
1. 执行 `./scripts/backup_openclaw_config.sh --all`
2. 报告备份结果

## 备份输出

备份文件存放在 `docs/` 目录下：

```
docs/
├── agents-config-backup-YYYYMMDD/     # 配置文件备份
│   ├── chief-of-staff/
│   ├── work-hub/
│   ├── ...
│   └── README.md
├── agents-memory-backup-YYYYMMDD/     # 记忆文件备份
│   ├── chief-of-staff/
│   ├── work-hub/
│   ├── ...
│   └── README.md
└── openclaw-config-backup-YYYYMMDD/   # 系统配置备份
    ├── openclaw.json
    ├── agents/
    ├── telegram/
    ├── feishu/
    └── README.md
```

## 恢复方法

### 恢复配置文件

```bash
# 恢复单个 agent 的所有配置
scp -r docs/agents-config-backup-YYYYMMDD/work-hub/* \
    admin@47.82.234.46:/home/admin/.openclaw/workspace-work/

# 仅恢复 AGENTS.md
scp docs/agents-config-backup-YYYYMMDD/work-hub/AGENTS.md \
    admin@47.82.234.46:/home/admin/.openclaw/workspace-work/AGENTS.md
```

### 恢复记忆文件

```bash
rsync -avz docs/agents-memory-backup-YYYYMMDD/work-hub/ \
    admin@47.82.234.46:/home/admin/.openclaw/workspace-work/memory/
```

### 恢复系统配置

```bash
# 恢复主配置（需要重启）
scp docs/openclaw-config-backup-YYYYMMDD/openclaw.json \
    admin@47.82.234.46:/home/admin/.openclaw/openclaw.json
ssh admin@47.82.234.46 'openclaw restart'

# 恢复定时任务
scp docs/openclaw-config-backup-YYYYMMDD/cron/jobs.json \
    admin@47.82.234.46:/home/admin/.openclaw/cron/

# 恢复 agent 认证配置
scp docs/openclaw-config-backup-YYYYMMDD/agents/work-hub/auth-profiles.json \
    admin@47.82.234.46:/home/admin/.openclaw/agents/work-hub/agent/
scp docs/openclaw-config-backup-YYYYMMDD/agents/work-hub/models.json \
    admin@47.82.234.46:/home/admin/.openclaw/agents/work-hub/agent/
```

## 敏感文件处理

以下文件**不会**被备份，恢复时需要手动重新配置：

| 文件 | 内容 | 配置方法 |
|------|------|----------|
| `credentials/lark.secrets.json` | 飞书 AppSecret | `openclaw config set channels.feishu.accounts.work.appSecret "SECRET"` |
| `runtime-secrets.json` | 运行时密钥 | 环境变量或手动配置 |

## 前置条件

1. SSH 密钥已配置，可免密登录远程服务器
2. 本地仓库目录结构正确
3. 有足够的磁盘空间（约 1MB）

## 故障排除

### SSH 连接失败

```bash
# 检查 SSH 连接
ssh admin@47.82.234.46 'echo OK'

# 如果需要密码，配置 SSH 密钥
ssh-copy-id admin@47.82.234.46
```

### 权限不足

```bash
# 确保脚本有执行权限
chmod +x scripts/backup_openclaw_config.sh
```

### rsync 未安装

```bash
# macOS
brew install rsync

# Linux
sudo apt install rsync  # Debian/Ubuntu
sudo yum install rsync  # CentOS/RHEL
```

## 执行频率建议

| 备份类型 | 建议频率 | 原因 |
|----------|----------|------|
| 配置文件 | 每次重大变更后 | AGENTS.md 变更较少 |
| 记忆文件 | 每周 | 记忆持续积累 |
| 系统配置 | 每次配置变更后 | JSON 配置变更较少 |

## 示例输出

```
==========================================
 OpenClaw 配置备份工具
==========================================
远程服务器: admin@47.82.234.46
本地目录:   /Users/xxx/MySiBuddy/docs

备份选项:
  [x] 配置文件 (AGENTS.md等)
  [x] 记忆文件 (memory目录)
  [x] 系统配置 (JSON文件)

[INFO] 检查SSH连接...
[SUCCESS] SSH连接正常
[INFO] 开始备份 Agents 配置文件...
[INFO]   备份 chief-of-staff ...
[INFO]   备份 work-hub ...
...
[SUCCESS] 配置备份完成: 143 个 md 文件
[INFO] 开始备份 Agents 记忆文件...
[SUCCESS] 记忆备份完成: 52 个 md 文件
[INFO] 开始备份 OpenClaw 系统配置...
[SUCCESS] 系统配置备份完成: 34 个 json 文件

==========================================
备份汇总
==========================================
备份日期: 20260406

配置备份: docs/agents-config-backup-20260406
  - 143 个 md 文件
记忆备份: docs/agents-memory-backup-20260406
  - 52 个 md 文件
系统配置: docs/openclaw-config-backup-20260406
  - 34 个 json 文件

本地仓库: /Users/xxx/MySiBuddy/docs
==========================================
[SUCCESS] 备份完成！
```