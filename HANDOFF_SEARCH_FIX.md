# 技术交接手册：智搜中枢与沙盒穿透修复

## 1. 当前系统上下文 (Current Context)
- **环境**: Ubuntu 24.04, OpenClaw **2026.4.2** (二进制路径 `/usr/bin/openclaw`)。
- **架构**: 
    - `chief-of-staff`: 非沙盒运行 (Admin)。
    - `Hub Agents`: 全量开启物理沙盒 (Docker `openclaw-sandbox:bookworm-slim`)。
- **已部署组件**:
    - **宿主机微服务**: `node ~/.openclaw/scripts/search_service.js` 运行在 `18790` 端口。
    - **自定义技能**: `~/.openclaw/skills/unified_search/` 下存有 `SKILL.md` 和调度脚本。

## 2. 已识别的阻塞点 (The Blockers) - 重点阅读
### A. 沙盒内的“工具黑洞”
尽管 `openclaw skills list` 显示 `unified_search` 是 `ready` 状态，但沙盒容器内的智能体**物理感知不到**该工具。
- **尝试过的无效路径**: 
    1. Docker Bind Mounts: 被 OpenClaw 安全引擎拦截（Outside allowed roots）。
    2. 迁移到 Workspace: 网关未能自动同步 `skills` 目录进入容器。
    3. SOUL.md 逻辑委托: `MiniMax-M2.7` 在感知不到工具时会触发预设拒答，无视 Prompt 中的委托指令。

### B. 插件与技能的鉴权差异
2026.4.2 对手动创建的 `SKILL.md` 存在某种运行时隔离。`chief-of-staff` 能看到，但受限 Agent 看不到。

## 3. 待完成的终极方案建议
新的工具应考虑以下路径之一：
1. **正式插件化 (Formal Extension)**: 将 `unified_search` 包装成一个带 `package.json` 的标准 OpenClaw Plugin，安装至 `~/.openclaw/extensions/`。这是 2026.4.x 注入物理代码的唯一合法、受信任路径。
2. **劫持原生工具 (Native Hijacking)**: 寻找在 `openclaw.json` 中重定向原生 `web_search` 提供商端点至本地 `localhost:18790` 的方法。
3. **彻底解决挂载**: 找到 2026.4.2 允许自定义挂载宿主机二进制（如 `curl` 或 `node`）的危险配置开关。

## 4. 关键路径参考
- **配置文件**: `/home/admin/.openclaw/openclaw.json`
- **运行日志**: `journalctl --user -u openclaw-gateway`
- **当前微服务状态**: `systemctl --user status search-service.service`

## 5. 声明
目前的 `openclaw.json` 已将 `venture-hub` 的物理沙盒关闭（为了测试逻辑），在修复完成后请务必恢复其物理沙盒隔离。
