# CODEX_HANDOFF.md

## 任务目标

你现在接管的是一台干净操作系统上的 OpenClaw 生产环境。  
目标是把它改造成一套**最小化、稳定、可维护、安全**的个人数字助理系统。

本次只做第一阶段稳定版，不做过度设计。

---

## 一、总原则

### 1. 设计原则
- 不过度设计
- 最实用优先
- 稳定优先于炫技
- 可审计优先于黑盒自动化
- 明确边界优先于“聪明猜测”
- 所有 secrets 不进入 `openclaw.json`

### 2. 明确不做的事
- 不使用 mem0
- 不使用 LCM
- 不使用 WhatsApp
- 不新增多余 agent
- 不新增多余前台 bot
- 不把 specialist 暴露成前台 bot
- 不把真实 API key / bot token / app secret 写入主配置文件

### 3. 安全原则
- 任何修改前先完整备份 `~/.openclaw`
- 所有真实 secrets 由人类手工注入
- 模型 API key 使用 OpenClaw auth profiles
- 如果本地版本支持 SecretRef 或更安全的 runtime secrets 机制，可采用，但不得把 secrets 明文写入 `openclaw.json`
- 如果发现当前 OpenClaw 版本与预期文档存在差异，优先适配本机版本，并在最终报告中说明差异

---

## 二、目标架构

### 1. Agent 设计

第一阶段只保留这 5 个 agent：

1. `chief-of-staff`
2. `work-hub`
3. `venture-hub`
4. `life-hub`
5. `product-studio`

### 2. 前台入口设计

只保留 3 个前台 IM 入口：

1. **Feishu work account**
   - 对应工作域前台入口
   - 路由到 `work-hub`

2. **Telegram chief account**
   - 对应总控数字参谋长
   - 路由到 `chief-of-staff`

3. **Telegram personal account**
   - 对应个人域入口
   - 通过不同群分流：
     - 创业群 -> `venture-hub`
     - 生活群 -> `life-hub`
     - 其余默认 -> `life-hub`

### 3. 默认 agent
- `chief-of-staff` 必须是 default agent
- 它是所有未命中更具体 binding 的最终兜底

### 4. Session 与隔离
- `session.dmScope = per-channel-peer`
- 每个 agent 必须有独立 workspace
- 每个 agent 必须有独立 `agentDir`
- 不允许跨 agent 复用 workspace / agentDir

### 5. Memory 设计
- Markdown workspace memory 是 source of truth
- 使用默认 `memory-core`
- 不启用 mem0
- 不启用 LCM
- `MEMORY.md` 保持简洁，只写 durable facts

---

## 三、模型设计

### 1. 主模型分配

#### chief-of-staff
- primary: `google/gemini-3.1-flash-lite-preview`
- fallback: `minimax/MiniMax-M2.7`

#### work-hub
- primary: `google/gemini-3.1-flash-lite-preview`
- fallbacks:
  1. `google/gemini-3.1-pro-preview`
  2. `minimax/MiniMax-M2.7`

#### venture-hub
- primary: `google/gemini-3.1-flash-lite-preview`
- fallbacks:
  1. `google/gemini-3.1-pro-preview`
  2. `minimax/MiniMax-M2.7`

#### life-hub
- primary: `google/gemini-3.1-flash-lite-preview`
- fallback: `minimax/MiniMax-M2.7`

#### product-studio
- primary: `google/gemini-3.1-pro-preview`
- fallbacks:
  1. `google/gemini-3.1-flash-lite-preview`
  2. `minimax/MiniMax-M2.7`

### 2. Gemini key 设计

生产推荐值：

- `google:primary`
- `google:secondary`
- `google:tertiary`

MiniMax：

- `minimax:primary`

### 3. 认证顺序
provider 内部 auth 顺序必须是：

- google:
  1. `google:primary`
  2. `google:secondary`
  3. `google:tertiary`

- minimax:
  1. `minimax:primary`

### 4. 容错原则
- provider 内 auth profile failover 必须先于 model fallback
- Google 内部 key/profile 先轮换
- 全部 Google profile 不可用后，再进入 model fallback
- MiniMax 仅作为低成本保底/补位路线

---

## 四、Secrets 处理原则

### 1. 绝对禁止
- 绝不把真实 API key 写入 `openclaw.json`
- 绝不把真实 Telegram bot token 写入 `openclaw.json`
- 绝不把真实 Feishu app secret 写入 `openclaw.json`

### 2. 允许做法
- 模型 API key：由人类手工执行 `openclaw models auth paste-token`
- 其他 secrets：由人类采用本机安全方式手工注入
- 你可以准备占位符、模板、命令、目录和最终校验，但不应接触真实值

### 3. 人类将提供的 secrets
人类会手工准备并注入以下值：

- `GOOGLE_API_KEY_PRIMARY`
- `GOOGLE_API_KEY_SECONDARY`
- `GOOGLE_API_KEY_TERTIARY`
- `MINIMAX_API_KEY`
- `TELEGRAM_BOT_TOKEN_CHIEF`
- `TELEGRAM_BOT_TOKEN_PERSONAL`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `TELEGRAM_VENTURE_GROUP_ID`
- `TELEGRAM_LIFE_GROUP_ID`

---

## 五、你的执行步骤

### 第 1 步：检查本机 OpenClaw 版本与安装形态
你必须先检查：

- `openclaw --version`
- `openclaw status`
- 当前 CLI 子命令是否与预期一致
- 当前有效配置路径
- 当前实际运行方式（systemd / 前台 / 其他）

### 第 2 步：修改前完整备份
备份 `~/.openclaw` 到带时间戳目录。

### 第 3 步：检查当前状态
你需要检查：

- 当前 agents
- 当前 bindings
- 当前 channels
- 当前 plugins
- 当前 models
- 当前 auth 配置可见性
- 当前是否存在额外插件依赖

### 第 4 步：按目标架构重建配置
创建或更新：

- `openclaw.json`
- 5 个 agent 的 workspace
- 最小 `SOUL.md`
- 最小 `AGENTS.md`
- 最小 `MEMORY.md`

### 第 5 步：不要写入真实 secrets
只保留：
- 非敏感结构
- 占位信息
- 运行步骤说明

### 第 6 步：准备人类手工注入命令
你要输出准确的手工命令，供人类执行：

```bash
openclaw models auth paste-token --provider google --profile-id "google:primary"
openclaw models auth paste-token --provider google --profile-id "google:secondary"
openclaw models auth paste-token --provider google --profile-id "google:tertiary"
openclaw models auth paste-token --provider minimax --profile-id "minimax:primary"

openclaw models auth order set --provider google google:primary google:secondary google:tertiary
openclaw models auth order set --provider minimax minimax:primary