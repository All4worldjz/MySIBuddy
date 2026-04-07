# Session Handoff

Last updated: 2026-04-07 (Sandbox Spawn 限制排查与安全策略调整)

## Current repo state

- Branch: `dev`
- Latest changes:
  - **Sandbox 策略调整**: 移除所有 agents 的沙盒限制，改用工具权限收敛策略
  - **安全模型**: 仅 `chief-of-staff` 和 `coder-hub` 保留 exec 权限，其他 6 个 Hub agents 禁止 exec/process
  - **排错记录**: 新增 `docs/troubleshooting_sandbox_spawn.md` 记录 Sandbox Spawn 限制问题

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