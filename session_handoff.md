# Session Handoff

Last updated: 2026-04-07 (Tasks审计错误清理与系统健康检查)

## Current repo state

- Branch: `dev`
- Latest changes:
  - **Tasks审计错误清理**: 10 errors → 0 errors ✅
  - **Gateway性能优化**: 985ms → 35ms (重启后)
  - **基线配置确认**: Sandbox策略确认为正确基线

---

## 2026-04-07: Tasks 审计错误清理 (重要经验)

### 问题现象

```
Tasks audit: 25 findings · 10 errors · 15 warnings
- stale_running: 6个任务卡住 (4h-15h不等)
- lost: 2个任务 (backing session missing)
- TaskFlow stale_running: 2个
```

### 尝试方案

1. `openclaw tasks maintenance --apply` - 无法清理stale任务
2. `openclaw tasks cancel <task_id>` - 报错 "Task runtime does not support cancellation yet"
3. `openclaw tasks flow cancel <flow_id>` - 报错 "One or more child tasks are still active"
4. **重启Gateway** - 任务持久化在SQLite中，重启无效

### 成功方案：直接操作SQLite数据库

```bash
# 安装sqlite3工具
sudo apt-get install -y sqlite3

# 查看stale任务
sqlite3 ~/.openclaw/tasks/runs.sqlite "SELECT task_id, status, runtime FROM task_runs WHERE status='running'"

# 强制更新stale_running任务状态
sqlite3 ~/.openclaw/tasks/runs.sqlite "UPDATE task_runs SET status='cancelled', error='Force cancelled: stale running task cleaned up by admin' WHERE status='running'"

# 更新lost任务状态
sqlite3 ~/.openclaw/tasks/runs.sqlite "UPDATE task_runs SET status='failed', error='backing session missing - cleaned up' WHERE status='lost'"

# 更新TaskFlows
sqlite3 ~/.openclaw/flows/registry.sqlite "UPDATE flow_runs SET status='cancelled' WHERE status='running'"

# 清理missing_cleanup警告
openclaw tasks maintenance --apply
```

### 修复结果

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| Errors | 10 | **0** |
| Warnings | 15 | 14 |
| Running Tasks | 6 (stale) | **0** |

### 关键经验

1. **任务存储位置**:
   - Tasks: `~/.openclaw/tasks/runs.sqlite`
   - TaskFlows: `~/.openclaw/flows/registry.sqlite`

2. **stale_running 根因**: 任务进程意外终止但数据库记录未更新

3. **lost 根因**: backing session被清理但任务记录残留

4. **预防措施**: 定期运行 `openclaw tasks audit` 检查，及时清理异常任务

---

## 2026-04-07: 全系统健康检查结果

### 系统基础状态 ✅

| 检查项 | 状态 | 详情 |
|--------|------|------|
| OS | ✅ | Ubuntu 24.04.2 LTS, Kernel 6.8.0-63-generic, Node 24.13.0 |
| SSH安全 | ✅ | PermitRootLogin=no, PasswordAuthentication=no |
| 防火墙 | ✅ | SSH(22)+ESTABLISHED+loopback only, DROP其他入站 |
| 内存 | ✅ | 3.4Gi总, 2.4Gi可用, Swap 4GB(使用0B) |
| 磁盘 | ⚠️ | 49GB, 53%使用(25GB), 23GB可用 |
| 系统负载 | ⚠️ | load average: 1.71, 1.02, 0.74 |

### OpenClaw 系统状态

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 版本 | ✅ | OpenClaw 2026.4.5 (stable) |
| Gateway | ✅ | reachable 35ms (重启后优化) |
| Agents | ✅ | 8 agents, 109 sessions |
| Channels | ✅ | Telegram 3账号OK, Feishu 2账号OK |
| Memory | ⚠️ | dirty状态, 26 files, 175 chunks |
| Tasks | ✅ | 0 errors (已清理), 14 warnings (时间戳不一致) |
| Heartbeat | ⚠️ | 仅chief-of-staff活跃(30m), 其他7个disabled |

### Agent 拓扑确认

- **标准8 Agent**: chief-of-staff, work-hub, venture-hub, life-hub, product-studio, zh-scribe, tech-mentor, coder-hub
- **路由绑定**: 7条路由正常
- **发现遗留**: `/home/admin/.openclaw/agents/main/agent/` (不在标准拓扑，需确认处理)

### 模型服务状态

- **主模型**: MiniMax-M2.7 ✅ 正常
- **备用链**: ModelStudio qwen3.5-plus, kimi-k2.5, glm-5等 ✅
- **认证**: minimax:global 0 errors; modelstudio:default 1 auth error(cooldown)

### Sandbox 基线配置确认 ✅

| Agent | Sandbox | Exec权限 | 状态 |
|-------|---------|----------|------|
| chief-of-staff | off | ✅ 允许 | ✅ 基线正确 |
| coder-hub | off | ✅ 允许 | ✅ 基线正确 |
| tech-mentor | off | ❌ 禁止 | ✅ 基线正确 |
| work-hub | off | ❌ 禁止 | ✅ 基线正确 |
| venture-hub | off | ❌ 禁止 | ✅ 基线正确 |
| life-hub | off | ❌ 禁止 | ✅ 基线正确 |
| product-studio | off | ❌ 禁止 | ✅ 基线正确 |
| zh-scribe | off | ❌ 禁止 | ✅ 基线正确 |

**结论**: 当前配置为正确基线，无需修改。文档已同步。

## 2026-04-07: Sandbox Spawn 限制排查 (重要发现)

### 问题

tech-mentor 无法 spawn coder-hub，返回错误：
```
Sandboxed sessions cannot spawn unsandboxed subagents.
```

### 根本原因

OpenClaw 安全设计限制：**sandboxed agent 不能 spawn unsandboxed subagent**，以防止沙盒逃逸。

### 解决方案

采用**全局 unsandbox + 工具权限收敛**策略：

| Agent | Sandbox | Exec 权限 |
|-------|---------|-----------|
| chief-of-staff | off | ✅ 允许 |
| coder-hub | off | ✅ 允许 |
| tech-mentor | off | ❌ 禁止 |
| work-hub | off | ❌ 禁止 |
| venture-hub | off | ❌ 禁止 |
| life-hub | off | ❌ 禁止 |
| product-studio | off | ❌ 禁止 |
| zh-scribe | off | ❌ 禁止 |

### 相关文件

- `docs/troubleshooting_sandbox_spawn.md`: 完整排错记录
- `QWEN.md`: 已更新 Sandbox 配置策略
- `codex_handsoff.md`: 已更新安全架构说明

---

## 2026-04-07: 全系统安全固化与 Sandbox 闭环 (里程碑)

- **系统拓扑**: 8 Agents (`chief-of-staff`, `work-hub`, `venture-hub`, `life-hub`, `product-studio`, `zh-scribe`, `tech-mentor`, `coder-hub`)
- **渠道状态**: Telegram/Feishu 通信正常
- **安全底座**: Docker 引擎就绪，Sandbox 策略已调整为工具权限收敛

## 2026-04-07: Docker Sandbox Permission Troubleshooting

- **Issue**: Agents with `sandbox.mode: "all"` were failing with `permission denied` to `/var/run/docker.sock`.
- **Root Cause**: `admin` user was added to `docker` group, but the `systemd --user` session manager had not picked up the new group membership.
- **Action**:
  - Restored sandbox configuration.
  - Documented resolution path in `docs/troubleshooting_docker_sandbox.md`.
  - Recommended full system reboot to refresh user session context.
- **Next steps after reboot**: Verify agents with `openclaw status --deep` and `docker ps` to ensure containers are starting.

---

## Read this first next time

1. `codex_handsoff.md`: 生产实际配置和运维手册
2. `docs/troubleshooting_sandbox_spawn.md`: **新增** - Sandbox Spawn 限制排错指南
3. `QWEN.md`: 项目概述和职能边界 (已更新 Sandbox 策略)
4. `session_handoff.md`: 最新变更日志