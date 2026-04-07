# Sandbox Spawn 限制排错记录

**日期**: 2026-04-07  
**问题**: tech-mentor 无法 spawn coder-hub  
**状态**: 已解决

---

## 问题现象

用户在 Telegram tech-mentor Bot 中发送：
```
调用 coder-hub，让他完成 vault-cli 的设计和开发
```

tech-mentor 返回：
```
由于当前环境限制无法直接 spawn coder-hub，让我直接为你完成这个任务。
```

## 排错过程

### 1. 初步假设（错误）

最初假设 tech-mentor 沙盒的 `/workspace` 挂载是只读的，导致无法写文件。

**修复尝试**: 为所有 sandboxed agents 添加 `workspaceAccess: "rw"`

**结果**: 沙盒挂载变为读写，但问题仍然存在。

### 2. 日志分析

检查 tech-mentor 会话日志，发现关键错误：

```json
{
  "status": "forbidden",
  "error": "Sandboxed sessions cannot spawn unsandboxed subagents. Set a sandboxed target agent or use the same agent runtime."
}
```

### 3. 根本原因

**OpenClaw 安全设计限制**: sandboxed agent 不能 spawn unsandboxed subagent，以防止沙盒逃逸。

当前配置：
- tech-mentor: `sandbox.mode = "all"` (受沙盒限制)
- coder-hub: `sandbox = null` (不受沙盒限制)

这是 OpenClaw 的**硬性安全约束**，无法通过配置绕过。

### 4. 模型误解

tech-mentor 尝试了多种方法但都失败：
- `sessions_list` + `sessions_send`: 需要先有 coder-hub 会话存在
- `sessions_spawn` with `runtime: "subagent"`: 仍然被安全限制阻止
- 自己执行任务: 受沙盒限制，无法访问 `/tmp` 等路径

模型误以为"当前环境限制"是某种临时问题，实际上是安全设计的硬约束。

---

## 解决方案

### 方案评估

| 方案 | 优点 | 缺点 |
|------|------|------|
| 将 coder-hub 改为 sandboxed | 保持隔离 | 沙盒内无 gemini CLI |
| 将 tech-mentor 改为 unsandboxed | 可 spawn coder-hub | 降低安全性 |
| 通过 chief-of-staff 中转 | 保持隔离 | 增加调用链复杂度 |
| 使用 agentToAgent 通信 | 保持隔离 | 需要预先创建会话 |

### 最终决策

采用**全局 unsandbox + 工具权限收敛**策略：

```json
{
  "agents": {
    "list": [
      {
        "id": "chief-of-staff",
        "sandbox": { "mode": "off" },
        "tools": { "deny": null }
      },
      {
        "id": "coder-hub",
        "sandbox": { "mode": "off" },
        "tools": { "deny": null }
      },
      {
        "id": "tech-mentor",
        "sandbox": { "mode": "off" },
        "tools": { "deny": ["exec", "process"] }
      },
      // ... 其他 5 个 Hub agents 同样配置
    ]
  }
}
```

**安全模型**：
- 所有 agents 移除沙盒限制
- 仅 `chief-of-staff` 和 `coder-hub` 保留 exec 权限
- 其他 6 个 Hub agents 通过 `tools.deny` 禁止 exec/process

### 安全性对比

| 方面 | 全沙盒化 | 无沙盒 + 限制 exec |
|------|----------|-------------------|
| 系统命令执行 | ❌ 沙盒内隔离 | ❌ 工具层面禁止 |
| 文件系统访问 | ✅ 隔离的 workspace | ⚠️ 可访问主机 workspace |
| Agent 间 spawn | ❌ 受限 | ✅ 自由调用 |
| 逃逸风险 | 低 | 中等 |

对于**个人使用场景**，这个折中方案是可接受的。

---

## 最终配置（2026-04-07）

| Agent | Sandbox | Exec 权限 | 说明 |
|-------|---------|-----------|------|
| chief-of-staff | off | ✅ 允许 | 编排器，需要系统级访问 |
| coder-hub | off | ✅ 允许 | 编程助手，需要 CLI 访问 |
| tech-mentor | off | ❌ 禁止 | AI导师，需 spawn coder-hub |
| work-hub | off | ❌ 禁止 | 工作中枢 |
| venture-hub | off | ❌ 禁止 | 创业中枢 |
| life-hub | off | ❌ 禁止 | 生活中枢 |
| product-studio | off | ❌ 禁止 | 产品设计 |
| zh-scribe | off | ❌ 禁止 | 中文成文 |

---

## 教训总结

1. **OpenClaw 沙盒限制是硬约束**: sandboxed agent 不能 spawn unsandboxed subagent
2. **模型可能误解错误原因**: 需要检查实际日志而非依赖模型解释
3. **安全设计需要在隔离与功能间平衡**: 全沙盒化会限制 Agent 间协作能力
4. **工具权限控制可作为沙盒的替代方案**: 通过 `tools.deny` 禁止危险操作

---

## 相关文档

- `QWEN.md`: 项目概述和 Sandbox 配置策略
- `codex_handsoff.md`: 部署手册
- `session_handoff.md`: 变更日志