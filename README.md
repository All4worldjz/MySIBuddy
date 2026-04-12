# MySiBuddy

`MySiBuddy` 是一个**控制平面仓库**，用于部署、加固和运维基于 OpenClaw 的个人智能体系统。这**不是**应用源代码仓库，而是生产环境的配置和运维仓库。

## 生产环境（2026-04-12 实际配置）

| 项目 | 值 |
|------|-----|
| 服务器 | `admin@47.82.234.46` |
| OpenClaw | `2026.4.9`（有更新 `2026.4.11` 可用） |
| Node.js | `24.13.0` |
| 智能体 | 8 个（neo, link, trinity, morpheus, oracle, smith, architect, theodore） |
| 渠道 | Telegram 8账号 + Feishu 7账号 |
| Bindings | 27条路由规则 |
| 系统资源 | 磁盘: 49G总容量，66%使用率 (17G可用) |
| 系统资源 | 内存: 1.8G总容量，Gateway占用约721MB (40%) |
| 系统资源 | CPU: Gateway进程占用11.1% |
| 统一搜索服务 | 运行正常 (端口18790) |

## 分支策略

- `main`：稳定基线，用于已验证的变更
- `dev`：活跃开发分支

## 项目结构

```
MySiBuddy/
├── QWEN.md                    # 项目概述、职能边界、配置约束
├── codex_handsoff.md          # 权威部署手册（重建系统必读）
├── AGENTS.md                  # 仓库级 AI 智能体操作规则
├── session_handoff.md         # 生产变更日志和当前状态
├── scripts/                   # 防护脚本
│   ├── safe_openclaw_validate.sh
│   ├── safe_openclaw_apply.sh
│   ├── safe_openclaw_smoke.sh
│   ├── safe_openclaw_rollback.sh
│   ├── backup_openclaw_config.sh
│   └── lib_openclaw_guardrails.sh
├── skills/                    # 可复用技能
│   ├── openclaw-plugin-channel-recovery/
│   └── backup-openclaw/
```

## 推荐入口

| 场景 | 文档 |
|------|------|
| 重建/迁移系统 | [`codex_handsoff.md`](codex_handsoff.md) |
| 了解项目架构 | [`QWEN.md`](QWEN.md) |
| AI 智能体操作规则 | [`AGENTS.md`](AGENTS.md) |
| 部署/排错 OpenClaw | [`skills/openclaw-plugin-channel-recovery/SKILL.md`](skills/openclaw-plugin-channel-recovery/SKILL.md) |
| 备份配置 | [`skills/backup-openclaw/SKILL.md`](skills/backup-openclaw/SKILL.md) |

## 核心架构

### 智能体拓扑（2026-04-11 重设计）

| Agent | 角色 | 渠道入口 | Exec 权限 | 备注 |
|-------|------|----------|-----------|------|
| `neo` | Guardian | Telegram neo | ✅ | 原 chief-of-staff |
| `link` | Operator | Telegram link, Feishu link | ✅ | 原 coder-hub + sysop |
| `trinity` | Worker | Telegram trinity, Feishu work | ❌ | 原 work-hub |
| `morpheus` | Strategist | Telegram morpheus | ❌ | 原 venture-hub |
| `oracle` | Mentor | Telegram oracle | ❌ | 原 tech-mentor + life-hub |
| `smith` | Challenger | Telegram smith | ❌ | 新建 |
| `architect` | Designer | Telegram architect | ❌ | 原 product-studio |
| `theodore` | Scribe | Telegram theodore, Feishu scribe | ❌ | 原 zh-scribe |

### 模型路由

| Provider | 用途 |
|----------|------|
| MiniMax (`MiniMax-M2.7`) | 主模型 |
| ModelStudio (`qwen3.5-plus`, `kimi-k2.5`) | 备用模型 |

### 安全配置（2026-04-11 实际状态）

| 措施 | 状态 |
|------|------|
| SSH root 登录 | 已禁用 |
| SSH 密码认证 | 已禁用（仅密钥） |
| 防火墙 | SSH(22) + 已建立连接 + 本地回环 |
| Swap | 4GB |
| Sandbox | 所有 agents 移除沙盒，通过工具权限控制安全 |
| Exec 权限 | 仅 neo 和 link 允许 |
| 统一搜索服务 | 运行中（端口18790） |
| Web搜索提供商 | unified_search（已配置并启用） |

## 运维命令

### 生产配置变更（必须使用防护脚本）

```bash
# 验证候选配置
scripts/safe_openclaw_validate.sh /tmp/openclaw.candidate.json

# 应用配置（备份 → 验证 → 重启 → 冒烟测试 → 失败回滚）
scripts/safe_openclaw_apply.sh /tmp/openclaw.candidate.json

# 快速健康检查
scripts/safe_openclaw_smoke.sh

# 回滚
scripts/safe_openclaw_rollback.sh /home/admin/.openclaw/openclaw.json.pre-apply-YYYYmmdd-HHMMSS
```

### 配置备份

```bash
# 备份全部（配置+记忆+系统文件）
./scripts/backup_openclaw_config.sh --all

# 预览模式
./scripts/backup_openclaw_config.sh --dry-run --all
```

### 远程执行

```bash
# 检查系统状态
ssh admin@47.82.234.46 'openclaw status --deep'

# 验证安全配置
ssh admin@47.82.234.46 'grep -E "^PermitRootLogin|^PasswordAuthentication" /etc/ssh/sshd_config'
ssh admin@47.82.234.46 'sudo iptables -L INPUT -n'
ssh admin@47.82.234.46 'free -h | grep Swap'
```

## 已知陷阱

### Sandbox Spawn 限制（2026-04-07 发现）
- **硬性约束**：sandboxed agent 不能 spawn unsandboxed subagent
- **解决**：所有 agents 移除沙盒，通过 `tools.deny` 禁止非编程 agents 的 exec 权限
- **详细记录**：`docs/troubleshooting_sandbox_spawn.md`

### 配置损坏事件（2026-04-01 历史）
- `config.apply` 曾覆盖 `openclaw.json` 为不完整对象
- **应对**：回滚到 `openclaw.json.pre-*` 备份，重启 gateway

### Feishu 重复账号问题
- 同一 Feishu 应用同时出现在顶层和 accounts 下会导致消息丢失
- **解决**：只保留明确的真实账号（`work`、`scribe`）

## 历史参考

- `RETROSPECTIVE_SEARCH_ARCH.md`：搜索架构设计记录
- `HANDOFF_SEARCH_FIX.md`：搜索修复历史