# Session Handoff

Last updated: 2026-04-11 (Agent System Redesign v1.0)

## Current repo state

- Branch: `dev`
- Latest commit: `fe73543` - Merge branch 'dev' of github.com:All4worldjz/MySIBuddy into dev
- **新变更**：Agent System Redesign - 9 agents → 8 agents

---

## 2026-04-09: OpenClaw 升级至 2026.4.8 (重要里程碑)

### 升级概要

| 项目 | 升级前 | 升级后 |
|------|--------|--------|
| **OpenClaw 版本** | 2026.4.5 | **2026.4.8** |
| **Git commit** | 3e72c03 | **9ece252** |
| **升级方式** | - | `sudo npm install -g openclaw@2026.4.8` |
| **停机时间** | - | ~3 分钟 |

### 升级原因

v2026.4.8 修复了关键 bug：
- **Telegram/setup**: 修复 secrets 加载问题，解决启动时找不到 bot token 的 bug
- **Bundled Channels**: 修复 Feishu/Google/Matrix 等插件的打包加载问题
- **Slack/actions**: 修复 SecretRef-backed bot token 读取问题

### 升级流程（完整记录）

```bash
# Step 1: 创建备份目录
BACKUP_DIR=~/.openclaw/backups/pre-upgrade-20260409
mkdir -p $BACKUP_DIR

# Step 2: 备份关键文件
cp ~/.openclaw/openclaw.json $BACKUP_DIR/
cp ~/.openclaw/runtime-secrets.json $BACKUP_DIR/
cp ~/.openclaw/gateway.env $BACKUP_DIR/
cp ~/.config/systemd/user/openclaw-gateway.service $BACKUP_DIR/
cp -r ~/.openclaw/memory $BACKUP_DIR/
cp -r ~/.openclaw/extensions/openclaw-lark $BACKUP_DIR/

# Step 2.2: 备份 npm 包 (283MB)
sudo tar -czf $BACKUP_DIR/openclaw-npm-2026.4.5.tar.gz -C /usr/lib/node_modules openclaw

# Step 3: 停止所有 OpenClaw 服务
systemctl --user stop openclaw-gateway
systemctl --user stop search-service

# Step 3.5: 确认无进程运行
ps aux | grep openclaw  # 应无输出
ss -tlnp | grep 18789   # 应无输出

# Step 4: 升级 OpenClaw
sudo npm install -g openclaw@2026.4.8

# Step 5: 验证版本
cat /usr/lib/node_modules/openclaw/package.json | grep '"version"'
# 输出: "version": "2026.4.8"

# Step 6: 更新 systemd 服务文件
sed -i "s/v2026.4.5/v2026.4.8/g" ~/.config/systemd/user/openclaw-gateway.service
sed -i "s/OPENCLAW_SERVICE_VERSION=2026.4.5/OPENCLAW_SERVICE_VERSION=2026.4.8/g" ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload

# Step 7: 启动 Gateway
systemctl --user start openclaw-gateway
systemctl --user start search-service

# Step 8: 冒烟测试
systemctl --user is-active openclaw-gateway  # active
openclaw status --deep  # Channels OK
```

### 备份文件位置

```
~/.openclaw/backups/pre-upgrade-20260409/
├── gateway.env              # 环境变量
├── memory/                  # 记忆数据库 (44MB)
├── npm-list.json            # npm 依赖快照
├── openclaw-gateway.service # systemd 服务定义
├── openclaw.json            # 主配置文件 (23KB)
├── openclaw-lark/           # 飞书插件 (2026.4.1)
├── openclaw-npm-2026.4.5.tar.gz  # 完整 npm 包备份 (283MB)
├── runtime-secrets.json     # 密钥存储
└── version.txt              # 升级前版本记录
```

### 回滚命令（如需要）

```bash
# 停止服务
systemctl --user stop openclaw-gateway search-service

# 恢复 npm 包
sudo rm -rf /usr/lib/node_modules/openclaw
sudo tar -xzf ~/.openclaw/backups/pre-upgrade-20260409/openclaw-npm-2026.4.5.tar.gz -C /usr/lib/node_modules

# 恢复配置
cp ~/.openclaw/backups/pre-upgrade-20260409/openclaw-gateway.service ~/.config/systemd/user/
systemctl --user daemon-reload

# 启动服务
systemctl --user start openclaw-gateway search-service
```

### 升级后验证

| 检查项 | 状态 |
|--------|------|
| Gateway 运行 | ✅ active |
| Telegram 渠道 | ✅ ON/OK (3 账号) |
| 飞书渠道 | ✅ ON/OK (2 账号) |
| Cron 任务 | ✅ 全部正常 |
| 日志错误 | ✅ 无 error/warn |
| 插件兼容 | ✅ openclaw-lark 2026.4.1 兼容 |

### 同期修复问题

升级过程中一并修复了以下问题：

| 问题 | 操作 | 结果 |
|------|------|------|
| KM-Vault cron delivery 失败 | `accountId: work` → `mentor`, schedule `*/5` → `0 */12` | ✅ 状态变为 ok |
| delivery-queue 积压 | 清理 24 个失败 JSON 文件 | ✅ 已清理 |
| gateway.env 权限过宽 | `chmod 600` | ✅ 权限 600 |

### 版本差异 (2026.4.5 → 2026.4.8)

**v2026.4.8 修复内容：**
- Telegram/setup: secrets 加载修复
- Bundled Channels: 打包加载修复
- Agents/progress: planTool 选项修复
- Exec: host fallback 策略修复
- Slack: proxy 配置支持
- Network: DNS pinning 修复

**v2026.4.7 新功能（包含在 2026.4.8）：**
- `openclaw infer` 命令
- Media Generation 自动路由
- Memory Wiki 结构化知识管理
- Webhooks ingress
- Session checkpointing
- Gemma 4 支持

---

## 2026-04-08: 智能体别名全局同步与文档更新

- `GEMINI.md`: 架构表格新增 Alias 列
- `README.md`: 核心架构表格新增别名列
- `CLAUDE.md`: 架构描述同步别名
- `QWEN.md`: 核心架构与 Sandbox 配置表格同步别名

---

## 2026-04-08: 远端服务器中间备份文件清理与安全审计

### 中间备份清理
- **操作**: 清理远端服务器 `47.82.234.46` 全部中间备份文件 (~112 个，~587K)
- **删除范围**:
  - 所有 `.pre-*` 文件 (workspace 文档备份、主配置备份)
  - 所有 `.bak` 文件 (cron、主配置备份)
  - `backup/` 目录
  - `memory/backups/` 目录
  - workspace docs 下的备份目录 (`agents-config-backup-*`、`agents-memory-backup-*` 等)
  - `.tgz` 脚本备份
- **验证**: 残留 0 个备份文件

### 密钥安全审计
- **本地仓库**: ✅ 未发现真实明文密钥（所有匹配均为模板/文档/测试占位符）
- **远端服务器**: ✅ 符合双层密钥架构，文件权限 `600`，无泄露风险
  - `runtime-secrets.json` + `gateway.env` 正确配置
  - `openclaw.json` 使用 SecretRef 引用，无硬编码密钥
  - systemd 通过 `EnvironmentFiles` 加载

---

## 2026-04-08: OpenClaw 架构深度体检与安全审计确认

### 深度体检 (Health & Scan Report)
执行了全方位的底层探针 (`openclaw status --deep`, `docker stats`, `top`)，确认当前生产服务器 (`47.82.234.46`) 运行极为稳固：
1. **硬件开销极低**：内存充裕 (余 2.4GB)，磁盘占用 53%，网关响应 984ms。
2. **LLM 预加载高性价比**：主模型 MiniMax-M2.7 (205k) 结合系统强化的重度缓存机制，在 `work-hub` 等频繁访问节点持续保持 38% - 87% 的上下文预留率（Cache Hits），大幅降低流转成本。
3. **架构透明化完毕**：查明了 OpenClaw Daemon 底层借助了 Systemd User 模式维持进程，通过 SQLite 持久化本地日志和 Memory-vec 索引。

### 用户确决 (By-Design)
排查发现两处 `security audit` 的 WARN 级报告：
- **WARN 1**: 多用户下的 `groupPolicy="allowlist"` 风险 (`Potential multi-user setup detected`)
- **WARN 2**: 全局 tools (`openclaw-lark`) 与高容忍度配置 (`Extension plugin tools reachable`)

**结论**：鉴于系统目前已经通过“**全局 unsandbox (off) + 封印 exec 权限**”来解决 A2A (Agent-to-Agent) Spawn 路由失败的问题。在用户与我的充分讨论后，确决 **忽略并接受上述两个预警**。当前的基线是最适合业务流和功能拓扑的平衡版，不进行任何生产 JSON 修改。

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

---

## 2026-04-11: Agent System Redesign v1.0 (重大架构变更)

### 概要

| 项目 | 变更前 | 变更后 |
|------|--------|--------|
| **Agent 数量** | 9 | **8** |
| **Agent 列表** | chief-of-staff, coder-hub, sysop, work-hub, venture-hub, tech-mentor, life-hub, product-studio, zh-scribe | **neo, link, trinity, morpheus, oracle, smith, architect, theodore** |
| **Community Spaces** | 无 | **5 个** (cc-office, council, commons, crucible, chapel) |
| **Feishu Folders** | 无 | **8 个** (MySiBuddy, communities, archives, + 5 spaces) |

### Agent 映射关系

| 旧 Agent | 新 Agent | 说明 |
|----------|----------|------|
| chief-of-staff | neo | 重命名 + Guardian 角色 |
| coder-hub + sysop | link | 合并 |
| work-hub | trinity | 重命名 |
| venture-hub | morpheus | 重命名 |
| tech-mentor + life-hub | oracle | 合并 |
| product-studio | architect | 重命名 |
| zh-scribe | theodore | 重命名 |
| (新) | smith | 新建 - Challenger |

### 新增 Feishu 文件夹

| 文件夹 | Token | 用途 |
|--------|-------|------|
| MySiBuddy | WpEWfi4rEltBxqd08B4c6JASnFf | 根目录 |
| communities | VAhJf9VDwl66mOdkvCLcTMGDnch | 社区空间 |
| archives | Q8ybfocG3loc6MdKDmzcFDrSnMg | 归档 |
| cc-office | F5NEfkat6lo1XBd4S9scNPRVn9f | CC 私人空间 |
| council | OXRSf4sQMlow5tdfhkicMyzpn0f | 决策议事厅 |
| commons | NNFuflvRmlyhdkd3PtqcChHSnag | 共享工作区 |
| crucible | SlrifKwYwlASXJdkvrjcyJSznWb | 挑战测试场 |
| chapel | V99oflFU8llnu2dSNFnc4qzjnuf | 反思智慧空间 |

### 新增 Cron Jobs (社区提醒)

| Job ID | 名称 | Owner | Schedule |
|--------|------|-------|----------|
| 3ee2f19b | Daily Chapel Reminder | neo | 每天 08:00 |
| 0a53f6d6 | Weekly Council Reminder | neo | 周日 20:00 |
| 92f901f0 | Weekly Crucible Reminder | neo | 周三 20:00 |
| 22843e8f | Weekly Commons Toast Reminder | neo | 周五 18:00 |
| cdea7c4a | Chapel Sabbath Reminder | neo | 周日 08:00 |
| 971927df | Monthly Retrospective Reminder | neo | 周五 20:00 |

### Cron Jobs Owner 变更

| Job | 原 Owner | 新 Owner | 状态 |
|-----|----------|----------|------|
| 情报雷达 (早报/晚报/突发) | chief-of-staff | oracle | ✅ ok |
| GPU/CPU/内存/硬盘/AIDC 建设情报 | work-hub | oracle | ✅ ok |
| 存储与 AI 推理硬件每日报价 | work-hub | morpheus | ✅ ok |
| 每日天气播报 | life-hub | trinity | ✅ ok |

### 遗产继承

| 遗产 | 接收方 |
|------|--------|
| 系统维护方法论 | link |
| English Coaching | neo + oracle |
| Intelligence Radar | oracle |
| KM-Vault | theodore + link |

### 已知问题

1. **KM-Vault Docker**: 容器未构建，脚本缺失
2. **系统健康 Jobs**: 部分缺失，需后续补充
3. **安全警告**: 多用户设置检测到，插件工具策略宽松

### 相关文件

- `founding-docs/execution-log.md`: 完整执行日志
- `founding-docs/design-docs/`: 设计文档 (MySiBuddy-Complete-Pack-Summary.md, MySiBuddy-Complete-Inheritance-Index.md 等)

### 回滚（如需要）

```bash
# 从备份恢复
./scripts/backup_openclaw_config.sh --restore --from docs/agents-config-backup-YYYYMMDD/
systemctl --user restart openclaw-gateway
```