# Codex Handoff

本文件是给 Codex 的统一交接文档，用于在新环境里一次性重建当前这套 OpenClaw 系统，并尽量避免后续补洞式调优。

## Scope

目标系统包含：

- `chief-of-staff` 总控
- `work-hub`
- `venture-hub`
- `life-hub`
- `product-studio`
- `zh-scribe`
- `tech-mentor`
- Feishu 使用 `openclaw-lark`
- Telegram 使用 stock `telegram`

当前生产参考环境：

- Host: `47.82.234.46`
- User: `admin`
- OpenClaw: `2026.3.28`
- service entrypoint: `/usr/bin/openclaw gateway --port 18789`
- config: `/home/admin/.openclaw/openclaw.json`
- runtime secrets: `/home/admin/.openclaw/runtime-secrets.json`

## Final Intent

这套系统的设计意图如下：

- `chief-of-staff` 只做总调度、跨域统筹、审批和系统维护
- `zh-scribe` 是所有中文成文任务的唯一主责，主模型必须是 `minimax/MiniMax-M2.7`
- `tech-mentor` 是所有 AI/科技学习训练任务的唯一主责，主模型必须是 `google/gemini-3.1-flash-lite-preview`
- `work-hub` 不再主写公众号正文和正式中文报告
- `life-hub` 不再主做 AI/科技系统学习训练，也不再主写历史/哲学正式中文成文
- `venture-hub` 保留创业判断，但不主做技术学习训练，不主做正式中文综述
- `product-studio` 只做结构设计与产品分析，不做中文长文主笔

## Non-Negotiables

新环境部署时，不要把下面这些留到上线后再调：

1. `plugins.allow` / `plugins.deny`
2. Telegram 与 Feishu 的最终账号拓扑
3. `bindings`
4. 多 agent 协作权限
5. 新 agent 的 `auth-profiles.json` 和 `models.json`
6. systemd service 的最终运行形态

只要这几层有一层留空，系统就会出现“看起来配置了，但实际上没生效”的问题。

## Plugin Topology

必须使用：

```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram"],
    "deny": ["feishu"]
  }
}
```

规则：

- `plugins.allow` 是全局插件白名单，不是扩展插件专用白名单
- 一旦设置，就必须把需要保留的 stock plugin 也写进去
- 如果 Feishu 由 `openclaw-lark` 接管，stock `feishu` 必须 deny 掉

否则会出现：

- Telegram token 有效但 channel 消失
- `openclaw configure` 显示 `configured (plugin disabled)`

## Channel Topology

目标拓扑：

- Telegram
  - `chief` -> `chief-of-staff`
  - `personal` -> `life-hub`，其中两个群分别路由到 `venture-hub` / `life-hub`
  - `mentor` -> `tech-mentor`
- Feishu
  - `work` -> `work-hub`
  - `scribe` -> `zh-scribe`

说明：

- Feishu 多账号模式下，不要保留顶层 `channels.feishu.appId` / `appSecret`
- Feishu 多账号模式下，不要再保留 `channels.feishu.accounts.default`
- 否则同一个旧 Feishu app 可能被同时挂成 `work` 和 `default` 两个连接，导致消息间歇性落到错误账号
- 新增 bot 账号时，优先按“一个账号对应一个长期角色”设计

### Feishu Duplicate-Account Trap

这是已经在生产环境里真实踩过的坑。

触发条件：

- 顶层 `channels.feishu.appId` / `appSecret` 还保留着旧 app
- `channels.feishu.accounts.work` 也配置了同一个旧 app
- 同时还存在 `channels.feishu.accounts.default`

结果：

- `openclaw-lark` 会把同一个旧 Feishu app 同时挂成 `feishu[work]` 和 `feishu[default]`
- 两个连接会解析出同一个 bot `open_id`
- 同一用户消息会不稳定地落到任意一个连接
- 如果 `default` 的 `dmPolicy` / `allowFrom` 没配对，就会出现“bot 在线但偶发不回”的现象

日志特征：

- `feishu[work]: bot open_id resolved: <same_open_id>`
- `feishu[default]: bot open_id resolved: <same_open_id>`
- `feishu[default]: sender ... not in DM allowlist`

最小修复：

1. 从顶层 `channels.feishu` 删除旧 app 的 `appId` / `appSecret`
2. 删除 `channels.feishu.accounts.default`
3. 只保留真实需要的独立 Feishu app 账号，例如 `work` 和 `scribe`
4. 重启 gateway 后确认 `openclaw status --deep` 变成 `Feishu accounts 2/2`

## Required Bindings

不要假设“新 bot 账号会自动落到对的 agent”。使用顶层 `bindings`：

```json
{
  "bindings": [
    {
      "type": "route",
      "agentId": "chief-of-staff",
      "match": { "channel": "telegram", "accountId": "chief" }
    },
    {
      "type": "route",
      "agentId": "life-hub",
      "match": { "channel": "telegram", "accountId": "personal" }
    },
    {
      "type": "route",
      "agentId": "venture-hub",
      "match": {
        "channel": "telegram",
        "accountId": "personal",
        "peer": { "kind": "group", "id": "-1003839165807" }
      }
    },
    {
      "type": "route",
      "agentId": "life-hub",
      "match": {
        "channel": "telegram",
        "accountId": "personal",
        "peer": { "kind": "group", "id": "-1003872666315" }
      }
    },
    {
      "type": "route",
      "agentId": "work-hub",
      "match": { "channel": "feishu", "accountId": "work" }
    },
    {
      "type": "route",
      "agentId": "zh-scribe",
      "match": { "channel": "feishu", "accountId": "scribe" }
    },
    {
      "type": "route",
      "agentId": "tech-mentor",
      "match": { "channel": "telegram", "accountId": "mentor" }
    }
  ]
}
```

## Agent Model Design

固定为：

- `chief-of-staff`
  - primary: `google/gemini-3.1-flash-lite-preview`
- `work-hub`
  - primary: `google/gemini-3.1-flash-lite-preview`
- `venture-hub`
  - primary: `google/gemini-3.1-flash-lite-preview`
- `life-hub`
  - primary: `google/gemini-3.1-flash-lite-preview`
- `product-studio`
  - primary: `google/gemini-3.1-pro-preview`
- `zh-scribe`
  - primary: `minimax/MiniMax-M2.7`
  - fallbacks: `google/gemini-3.1-pro-preview`, `google/gemini-3.1-flash-lite-preview`
- `tech-mentor`
  - primary: `google/gemini-3.1-flash-lite-preview`
  - fallbacks: `google/gemini-3.1-pro-preview`, `minimax/MiniMax-M2.7`

原则：

- 不做按任务动态切模型的复杂规则
- 用角色拆分承载模型偏好
- 中文成文通过 `zh-scribe` 自然走 MiniMax
- AI/科技学习通过 `tech-mentor` 自然走 Gemini Flash Lite

## Agent Routing Intent

`chief-of-staff` 的硬路由意图：

- 中文写作、中文研究、公众号正文、中文文档协作 -> `zh-scribe`
- AI/科技学习、前沿追踪、学习路径、训练与考核 -> `tech-mentor`
- 需要产品结构 -> `product-studio`
- 单域工作 -> `work-hub`
- 单域创业 -> `venture-hub`
- 单域生活 -> `life-hub`

不要让 `chief-of-staff` 自己吞掉这些任务。

## Multi-Agent Orchestration

要让 chief 真正协同，而不是只会口头说“已移交”，至少要同时满足：

```json
{
  "tools": {
    "profile": "full",
    "sessions": { "visibility": "all" },
    "agentToAgent": {
      "enabled": true,
      "allow": [
        "chief-of-staff",
        "work-hub",
        "life-hub",
        "venture-hub",
        "product-studio",
        "zh-scribe",
        "tech-mentor"
      ]
    }
  }
}
```

以及：

```json
{
  "agents": {
    "list": [
      {
        "id": "chief-of-staff",
        "subagents": {
          "allowAgents": [
            "work-hub",
            "venture-hub",
            "life-hub",
            "product-studio",
            "zh-scribe",
            "tech-mentor"
          ]
        }
      },
      {
        "id": "zh-scribe",
        "subagents": {
          "allowAgents": [
            "work-hub",
            "life-hub",
            "venture-hub",
            "product-studio",
            "tech-mentor"
          ]
        }
      },
      {
        "id": "tech-mentor",
        "subagents": {
          "allowAgents": [
            "product-studio",
            "venture-hub",
            "work-hub",
            "zh-scribe"
          ]
        }
      }
    ]
  }
}
```

实现细节：

- 在 `2026.3.28`，`tools.agentToAgent.allow` 不是只匹配 target
- requester 和 target 都必须命中 allowlist
- 否则会出现：
  - 能 spawn
  - 但拿不到子结果
  - 或报 `Session visibility restricted`

## Session and Runtime Baseline

推荐显式写出：

```json
{
  "gateway": {
    "reload": {
      "mode": "hybrid",
      "debounceMs": 300
    }
  },
  "session": {
    "dmScope": "per-channel-peer",
    "threadBindings": {
      "enabled": true,
      "idleHours": 24,
      "maxAgeHours": 0
    },
    "agentToAgent": {
      "maxPingPongTurns": 1
    }
  },
  "agents": {
    "defaults": {
      "maxConcurrent": 2,
      "subagents": {
        "maxConcurrent": 4,
        "maxSpawnDepth": 1,
        "maxChildrenPerAgent": 4,
        "archiveAfterMinutes": 120,
        "thinking": "low",
        "runTimeoutSeconds": 300,
        "announceTimeoutMs": 120000
      }
    }
  }
}
```

## Auth and Models Trap

这是这次最容易漏掉、但最关键的经验。

新建 agent 时，如果用了独立 `agentDir`，不要只创建目录和提示文件。还必须补齐：

- `auth-profiles.json`
- `models.json`

否则会出现：

- `All models failed`
- `No API key found for provider "google"`
- `No API key found for provider "minimax"`

即使全局系统其实已经有 token。

在当前生产环境，修复方式是把现有主 agent 的这两份文件复制到新 agent 目录：

```bash
cp /home/admin/.openclaw/agents/chief-of-staff/agent/auth-profiles.json /home/admin/.openclaw/agents/<new-agent>/agent/auth-profiles.json
cp /home/admin/.openclaw/agents/chief-of-staff/agent/models.json /home/admin/.openclaw/agents/<new-agent>/agent/models.json
```

更稳的正式做法是：

- 用官方方式给新 agent 补 auth
- 或确认 `openclaw agents add <id>`/相关初始化命令会同时生成这两类文件

在没有确认自动化覆盖这两份文件之前，不要假设“新 agent 自然继承主 agent 的模型认证”。

## Gemini Multi-Key Design

这里要把原理说清楚，避免后续误配。

### 核心原理

- Gemini 官方 API 每次请求只会携带并校验一个 API key
- 所谓“配置多个 Gemini API key”，本质上不是把多个 key 同时发给 Google
- 真正做法是在 OpenClaw 本地维护多个 `google` auth profile，再定义 provider 内部的认证顺序
- 先发生的是 `google` provider 内部 key/profile failover
- 只有所有 `google` profile 都失败后，才应该进入 model fallback，例如切到 `minimax`

也就是说：

- 多 key = 客户端侧 auth pool / failover 策略
- 不是 Gemini 服务端的“单项多 key 配置”
- `auth.order.google` 解决的是容错和限额隔离，不天然等于负载均衡

### 当前仓库推荐命名

- `google:primary`
- `google:secondary`
- `google:tertiary`

MiniMax 保持：

- `minimax:primary`

### 建议配置形态

在 `openclaw.json` 里显式写出 provider 内部顺序：

```json
{
  "auth": {
    "order": {
      "google": [
        "google:primary",
        "google:secondary",
        "google:tertiary"
      ],
      "minimax": ["minimax:primary"]
    }
  }
}
```

这个顺序的含义是：

1. 先尝试 `google:primary`
2. 主 key 命中配额/临时失效/被撤销时，再尝试 `google:secondary`
3. 再失败时，尝试 `google:tertiary`
4. 三个 Google profile 都不可用后，才进入 agent 级 model fallback

### Secret 注入方式

不要把真实 Gemini key 写进 `openclaw.json`。

用 auth profile 注入：

```bash
openclaw models auth paste-token --provider google --profile-id "google:primary"
openclaw models auth paste-token --provider google --profile-id "google:secondary"
openclaw models auth paste-token --provider google --profile-id "google:tertiary"
openclaw models auth paste-token --provider minimax --profile-id "minimax:primary"
```

再设置 provider 内顺序：

```bash
openclaw models auth order set --provider google google:primary google:secondary google:tertiary
openclaw models auth order set --provider minimax minimax:primary
```

说明：

- 上面这组 CLI 名称是本仓库既有运行方式的推荐形态
- 如果本机 `openclaw` 子命令在当前版本里有差异，以 `openclaw models auth --help` 实际输出为准
- 但原则不变：真实 key 进入 auth profiles，顺序进入 `auth.order`

### 这套设计真正解决什么

- 单 key 配额打满时，降低整套系统直接雪崩的概率
- 某个 key 被临时封禁或撤销时，保留同 provider 的连续性
- 可以把高价值 agent 继续统一绑定在 Gemini，而不是过早切到其他 provider
- 便于轮换：替换一个 profile，不需要整体改 agent model 设计

### 这套设计不解决什么

- 它不是并发意义上的自动负载均衡
- 它不会把一半请求稳定打到 `secondary`
- 如果 `primary` 一直健康，绝大多数请求仍会停留在 `primary`

如果目标是长期横向摊平流量，而不是故障切换，需要额外做一层：

- 按 agent 拆 profile / 拆模型别名
- 或在 OpenClaw 前面放自建 proxy / gateway 做 key-aware routing

### 生产建议

推荐把三个 Google key 按职责区分，而不是随手堆三把一样的 key：

- `google:primary`：主生产流量
- `google:secondary`：热备，兼顾中等流量
- `google:tertiary`：应急和人工诊断

不要把它们都看成完全对等的匿名 key。

### 运行与排障规则

1. 如果报 `No API key found for provider "google"`，优先查 `agentDir/auth-profiles.json`
2. 如果只有某个 agent 报错，而别的 agent 正常，优先查该 agent 的 `auth-profiles.json` / `models.json` 是否缺失或漂移
3. 如果 Google 模型偶发失败但 MiniMax fallback 正常，优先查 Google profile 顺序和单 key 配额
4. 不要把“Google 模型 fallback 到 MiniMax”误判成“多 key 生效良好”，那往往意味着 provider 内 key 池已经失效

### 验收标准

至少确认：

1. `auth.order.google` 已显式包含 `google:primary` / `secondary` / `tertiary`
2. 每个需要跑 Gemini 的 `agentDir` 内都存在 `auth-profiles.json` 和 `models.json`
3. `tech-mentor` 直接调用时优先命中 Gemini，而不是直接掉到 MiniMax
4. 替换或撤销某一个 Google key 后，系统仍能通过后续 profile 恢复

## Feishu Specific Trap

当新增第二个 Feishu app 时，不要把旧的顶层 `channels.feishu.allowFrom` 继续留在全局。

原因：

- Feishu 不同 app 下，同一个人的 sender/open_id 可能不同
- 顶层全局 `allowFrom` 会误伤新 app

稳妥做法：

- 把旧的全局 `allowFrom` 下沉到旧账号，例如 `accounts.work.allowFrom`
- 新账号 `accounts.scribe` 单独走自己的 pairing/allowlist

## Telegram Specific Trap

Telegram 新账号本身不难，难点在于：

- 不要忘记把 stock `telegram` 放进 `plugins.allow`
- 新增账号后要写顶层 `bindings`
- 私聊入口比二人群稳定得多

`mentor` 的推荐形态：

```json
{
  "name": "Telegram Mentor",
  "enabled": true,
  "dmPolicy": "pairing",
  "groupPolicy": "disabled",
  "streaming": "partial",
  "allowFrom": ["8606756625"]
}
```

## Service Baseline

Linux VPS 上推荐：

- system Node 24
- `/usr/bin/openclaw`
- 最小 PATH
- 明确环境变量

当前工作形态：

```ini
[Service]
ExecStart=/usr/bin/openclaw gateway --port 18789
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/home/admin/.local/bin
Environment=NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
Environment=OPENCLAW_NO_RESPAWN=1
```

不要长期把生产 service 绑在 NVM 路径上。

## Deployment Order

新环境重建时，按这个顺序做：

1. 安装 system Node 24 和 system `openclaw`
2. 准备 `openclaw.json`
3. 准备 `runtime-secrets.json`
4. 先写 plugin topology
5. 再写 channels
6. 再写 `agents.list`
7. 再写 `bindings`
8. 再写 `tools.sessions` 和 `tools.agentToAgent`
9. 再写 `subagents.allowAgents`
10. 创建新 workspace 和提示文件
11. 补齐新 agent 的 `auth-profiles.json` 与 `models.json`
12. 配 systemd service
13. 重启 gateway
14. 逐个验证 bot provider
15. 做真实消息回归

## Required Validation

至少验证这些：

1. `openclaw status --deep`
2. Telegram provider 启动日志
3. Feishu provider 启动日志
4. `zh-scribe` 直接调用能走 `MiniMax-M2.7`
5. `tech-mentor` 直接调用能走 `gemini-3.1-flash-lite-preview`
6. 真实 Feishu 消息进入 `agent:zh-scribe:feishu:...`
7. 真实 Telegram 消息进入 `agent:tech-mentor:telegram:...`
8. chief 能调起 `zh-scribe` 和 `tech-mentor`

## Common Root Causes

### 1. Channel configured but absent from status

先查：

- `plugins.allow`
- `plugins.deny`

不要先查 token。

### 2. New bot provider starts but no reply

先区分：

- 路由没绑对
- pairing / allowlist 没过
- 新 agent auth 文件没补齐

### 3. New agent exists but all models fail

先查：

- `agentDir/auth-profiles.json`
- `agentDir/models.json`

### 4. chief says delegated but not really

先查：

- `subagents.allowAgents`
- `tools.sessions.visibility`
- `tools.agentToAgent.enabled`
- `tools.agentToAgent.allow`

## Rollback

任何改动前都备份：

- `~/.openclaw/openclaw.json`
- `~/.openclaw/runtime-secrets.json`
- 相关 workspace 提示文件
- 新 agent 目录内可能被修改的 auth/models 文件

回滚最小动作：

```bash
cp <backup-openclaw.json> /home/admin/.openclaw/openclaw.json
cp <backup-runtime-secrets.json> /home/admin/.openclaw/runtime-secrets.json
systemctl --user restart openclaw-gateway
```

## Acceptance Standard

只有同时满足下面这些，才算“部署完成”：

- 所有预期 channel 在 `status --deep` 中可见
- 所有预期 bot provider 正常启动
- 新 agent 能独立起模型
- 真实消息落到目标 agent
- chief 的跨 agent 协作仍然有效
- 没有新的阻断级 auth 错误

只做到“进程能跑”不算完成。
