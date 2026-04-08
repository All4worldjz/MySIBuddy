# Session Handoff

Last updated: 2026-04-08 (智能体别名全局同步与文档更新)

## Current repo state

- Branch: `dev`
- Latest commit: `d4c5e41` - feat: 添加飞书网盘安全操作脚本和受保护文件夹配置
- **新变更**：全系统智能体别名（Alias）映射同步

---

## 2026-04-08: 智能体别名全局同步 (映射标准确立)

### 别名映射关系表

| Agent ID | 别名 (Alias) | 职能说明 |
| :--- | :--- | :--- |
| `chief-of-staff` | **小春** | 编排器 / 全局统筹 |
| `tech-mentor` | **大师** | AI 导师 / 技术专家 |
| `work-hub` | **金牛** | 工作中枢 / 职场事务 |
| `zh-scribe` | **水哥** | 中文成文 / 写作专家 |
| `life-hub` | **小机** | 生活中枢 / 个人事务 |
| `coder-hub` | **小码哥** | 编程助手 / CLI 工具 |

### 已更新文档

- `GEMINI.md`: 架构表格新增 Alias 列
- `README.md`: 核心架构表格新增别名列
- `CLAUDE.md`: 架构描述同步别名
- `QWEN.md`: 核心架构与 Sandbox 配置表格同步别名

---

## 2026-04-08: 飞书网盘安全操作脚本开发 (重要里程碑)
...
### 新增功能

| 脚本 | 功能 | 关键特性 |
|------|------|----------|
| `feishu_create_folder.sh` | 创建文件夹 | 重名检测、审计日志、受保护警告 |
| `feishu_delete_folder.sh` | 删除文件夹 | 软删除到回收站、受保护检查、交互确认、--dry-run |
| `feishu_move_folder.sh` | 移动文件夹 | 重名检测、受保护检查、交互确认、--dry-run |
| `lib/feishu_drive_guardrails.sh` | 安全策略库 | 配置读取、回收站管理、审计日志 |

### 受保护文件夹配置

```json
{
  "protected_tokens": [
    "RfSrf8oMYlMyQTdbW0ZcGSE1nNb",  // CC文件柜
    "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"   // 小春文件柜
  ],
  "protected_names": ["CC文件柜", "小春文件柜", "回收站", "📁测试归档"],
  "recycle_bin": {
    "token": "XcTHfLy7clpx51dBomLcvA7XnTf",
    "parent_token": "RfSrf8oMYlMyQTdbW0ZcGSE1nNb",
    "auto_cleanup_days": 30
  }
}
```

### 回收站机制

- **位置**：CC文件柜下
- **Token**：`XcTHfLy7clpx51dBomLcvA7XnTf`
- **自动清理**：飞书系统30天后自动永久删除
- **软删除流程**：删除 → 移至回收站 → 30天保留期 → 自动清理

### 使用示例

```bash
# 创建文件夹
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "项目文档" "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"

# 预览删除
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --dry-run

# 软删除（推荐）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --force

# 预览移动
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token <token> --dest <目标token> --dry-run
```

### 关键经验（详见 docs/troubleshooting-feishu-drive-api.md）

1. **API 端点差异**：
   - 错误：`/folders/{token}/children` (404)
   - 正确：`/files?folder_token={token}`

2. **创建文件夹参数**：`folder_token` 必须在 Body 中传递

3. **元信息字段差异**：返回 `title` 而非 `name`，`doc_type` 而非 `type`

4. **根目录限制**：无法在根目录直接创建文件夹，需指定父文件夹

### 已更新的 Agent MEMORY.md

| Agent | 状态 |
|-------|------|
| chief-of-staff | ✅ 已添加飞书网盘操作规范 |
| work-hub | ✅ 已添加 |
| venture-hub | ✅ 已添加 |
| life-hub | ✅ 已添加 |
| product-studio | ✅ 已添加 |
| zh-scribe | ✅ 已添加 |
| tech-mentor | ✅ 已添加 |
| coder-hub | ⚠️ MEMORY.md 不存在 |

### 审计日志位置

```
/home/admin/.openclaw/logs/feishu_drive_operations.log
```

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