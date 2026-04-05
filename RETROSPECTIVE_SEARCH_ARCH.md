# 智搜中枢与分层安全架构深度复盘 (2026-04-03)

## 1. 设计目的 (Design Objectives)
*   **情报中枢化**: 建立统一的 `unified_search` 入口，消除 Agent 对单一搜索引擎的依赖。
*   **成本与效果平衡**: 通过场景化路由（Scene Routing），实现通用搜索走 DDG（免费），深度/社媒搜索走 EXA/Tavily（付费但精准）。
*   **物理级安全**: 针对执行联网抓取任务的智能体开启 Docker 物理沙盒，防止 Prompt Injection 导致的宿主机沦陷。
*   **最小权限原则**: 收拢系统管理权与搜索权至 `chief-of-staff`，确保受限 Agent (Hubs) 无法窥探敏感元数据。

## 2. 最终架构细节 (Final Architecture)
### A. 逻辑分层
*   **Master (Chief)**: 运行在宿主机环境（非沙盒），拥有 `unified_search` 唯一权杖，负责采集与清洗情报。
*   **Worker (Hubs)**: 运行在 Docker 隔离环境，严禁直连网络，必须通过 `subagents` 向 Chief 发起情报委托。

### B. 智搜微服务 (Search Orchestrator Microservice)
*   **位置**: 宿主机常驻 Node.js 服务（端口 `18790`）。
*   **版本**: v5.0 (PROD V2)。
*   **特性**: 
    - 物理读取 `runtime-secrets.json`，规避 Shell 注入风险。
    - 自动将 API 返回的 JSON 转化为 Agent 可直读的 Markdown。
    - 内置场景识别：`CHINA_SOCIAL`, `GLOBAL_TRENDS`, `TECH_RESEARCH`, `GENERAL`。

## 3. 配置细节 (Configuration Details)
### `openclaw.json` 核心片段：
```json
{
  "agents": {
    "defaults": { "sandbox": { "mode": "all" } },
    "list": [
      { "id": "chief-of-staff", "sandbox": { "mode": "off" }, "tools": { "profile": "full", "alsoAllow": ["system-admin", "unified_search"] } },
      { "id": "venture-hub", "tools": { "fs": { "workspaceOnly": true } } }
    ]
  }
}
```
### 技能定义 (`SKILL.md`):
- 采用 `curl` 指令桥接宿主机端口，绕过了 OpenClaw 2026.4.2 针对沙盒容器内自定义脚本的物理屏蔽。

## 4. 配置过程记录
1.  **内核对齐**: 修复 Systemd ExecStart 路径，将 NVM 路径强制迁移至 `/usr/bin/openclaw`，实现 2026.4.2 版本统一。
2.  **沙盒遭遇战**: 尝试通过 Docker Bind Mounts 挂载脚本失败（安全引擎拦截）。
3.  **认知抢救**: 修复由于大规模 Prompt 追加导致的智能体认知丢失，通过“物理覆盖恢复”找回春哥身份与记忆。
4.  **微服务化**: 将搜索调度逻辑剥离至独立 HTTP 服务，实现“物理隔离 + 逻辑穿透”。
5.  **回归测试**: 验证了 Chief 在 `unified_search` 结果为空时，能自动 Failover 到原生 `web_search` 并找回 OpenAI 1220亿融资情报。

## 5. 踩坑与经验教训 (Lessons Learned)
*   **沙盒编译器限制**: OpenClaw 2026.4.x 的沙盒不会自动同步宿主机脚本。**教训：涉及物理二进制调用的自定义 Skill 必须微服务化。**
*   **模型认知定式**: MiniMax 在感知不到工具时会触发强制拒答。**教训：重导认知必须通过 SOUL.md 顶层重写，不能只在文末追加。**
*   **权限继承风险**: Docker 操作会改变物理文件的 UID/GID。**教训：每次大规模变更后必须物理核实文件权限（chmod 600/755）。**
*   **路径影子问题**: 存在 `/usr/bin` 与 `~/.nvm` 两个版本。**教训：`which openclaw` 并不代表正在运行的版本，必须通过 `journalctl` 检查服务启动项。**

## 6. 维护者声明
当前系统处于最高稳定态。严禁随意开启 Hub 智能体的 `sandbox: off` 开关。任何新工具应优先考虑通过 `chief-of-staff` 进行委托转发。
