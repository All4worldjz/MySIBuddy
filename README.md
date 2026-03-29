# MySiBuddy

`MySiBuddy` 是一套基于 OpenClaw 搭建的个人数字助理系统工程仓库，用来保存这次生产环境重建、配置固化、运维交接和后续扩展所需的模板、文档、脚本与执行记录。

当前仓库不只是一个脚手架，而是这套数字伙伴系统的配置与运维基线。

## 项目来龙去脉

这个项目的目标，是把一台干净系统上的 OpenClaw 生产环境，改造成一套最小化、稳定、可维护、安全的个人数字助理系统。

本次落地遵循的核心原则：

- 不过度设计
- 以可用、稳定、可审计为优先
- secrets 不进入主配置文件
- 多 agent 分域，但不新增多余前台入口
- 用 workspace memory 作为长期事实基础

在这一阶段，系统已经完成了第一版稳定结构重建、路由验证、模型认证整理、远端健康检查、风险收敛和本地仓库归档。

## 当前系统架构

当前生产架构保留 5 个 agent：

- `chief-of-staff`
- `work-hub`
- `venture-hub`
- `life-hub`
- `product-studio`

当前只保留 3 个前台 IM 入口：

- `Telegram chief` -> `chief-of-staff`
- `Telegram personal` -> 按群和私聊路由到 `venture-hub / life-hub`
- `Feishu work` -> `work-hub`

路由原则：

- `chief-of-staff` 负责总控、分诊、跨域统筹
- `work-hub` 处理正式工作
- `venture-hub` 处理创业准备和实验
- `life-hub` 处理生活事务
- `product-studio` 是后台 specialist，不作为前台入口直接暴露

## 设计要点

### 1. 清晰分域

系统采用 `work / venture / life` 三域结构，并用 `chief-of-staff` 作为默认总控和兜底入口。

这样做的好处是：

- 避免上下文污染
- 降低跨域信息串扰
- 让不同入口有更稳定的人格与职责边界

### 2. 最小前台入口

系统没有把所有 specialist 都暴露成独立 bot，而是只保留最小前台入口集合。

这样做的好处是：

- 使用成本更低
- 不会出现“到底该找哪个 bot”的持续负担
- specialist 能保持后台能力，而不是变成新的沟通噪音

### 3. 零明文 secrets 主配置

真实模型 key、Telegram token、Feishu secret 都没有写入 `openclaw.json`。

这样做的好处是：

- 更适合审计
- 更适合仓库保存配置模板
- 更容易做重建和迁移

### 4. 独立 workspace 与 agentDir

每个 agent 都有独立 workspace 和独立 agentDir。

这样做的好处是：

- 降低记忆和文件串扰
- 会话与角色边界更清楚
- 便于单 agent 排障

### 5. 先保证可用，再逐步收紧

这次实际运行里，有一个关键版本适配：

- 原设计希望保留 `sandbox=non-main`
- 但生产主机没有 Docker
- 所以最终 live 配置改为 `sandbox=off`

这是一个以可用性优先的现实适配，不是理想安全终态。

## 当前亮点

- 多 agent 自动路由已经打通并验证
- Telegram 与 Feishu 双通道入口同时在线
- Google / MiniMax 认证顺序已整理并验证
- MiniMax 已完成真实 provider 级验证，不只是 auth 存在
- `work-hub` 已修复“能力不足时空回”的问题
- 仓库已保存：
  - 重建脚本
  - 最终脱敏配置快照
  - 执行复盘
  - 通讯手册

## 当前能力边界

`work-hub` 已确认可用：

- 飞书消息收发
- 飞书文档
- 飞书知识库 wiki
- 飞书云盘 drive
- 飞书 bitable
- 工作分析与文本输出

`work-hub` 当前未直接接入：

- 飞书日历
- 飞书原生提醒 / tasks

当前替代方案：

- 定时任务 / 提醒优先走内置 `cron`
- 遇到未接入能力时，系统现在会明确说明边界，而不是沉默失败

## 通讯手册

### 入口分工

- `Telegram chief` -> `chief-of-staff`
  用途：总控、分诊、跨域统筹、边界管理。
  适合说：`这件事属于工作还是生活？帮我拆一下。`
  适合说：`这是跨域问题，你来统筹。`

- `Feishu work` -> `work-hub`
  用途：正式工作事务。
  适合说：产品、营销、客户、团队、工作文档、飞书知识库、云盘、bitable。
  适合说：`帮我整理这周客户跟进。`
  适合说：`基于飞书文档输出一个方案摘要。`

- `Telegram personal` 生活群 / 私聊默认 -> `life-hub`
  用途：生活、理财、学习、个人事务。
  适合说：`帮我安排这周个人待办。`
  适合说：`帮我做一个学习计划。`

- `Telegram personal` 创业群 -> `venture-hub`
  用途：创业准备、MVP、PMF、实验设计。
  适合说：`这个 AI 创业方向值不值得做？`
  适合说：`给我设计一个 MVP 验证方案。`

- `product-studio`
  不是前台入口。
  需要由你当前对话中的 agent 建议或内部调用。
  用途：产品设计、PRD、复杂方案、边界梳理。

### 怎么协作最有效

- 给清楚上下文：目标、约束、截止时间、你要的产出格式。
- 一次只给一个主任务，避免把多个域混在一句里。
- 跨域问题先发给 `chief-of-staff`，不要自己硬分。
- 工作问题尽量走 `Feishu work`，这样边界最干净。
- 创业问题放创业群，生活问题放生活群或 personal 私聊。
- 要结果时直接说明：
  - `给我结论`
  - `给我三步行动`
  - `输出成表格`
  - `帮我写成消息/文档`

### 推荐话术模板

- 给 `chief-of-staff`
  `我现在有一个跨工作和生活的决策，请你先分域，再给我推进顺序。`

- 给 `work-hub`
  `这是工作任务。背景是___，目标是___，约束是___，请输出可执行方案。`

- 给 `venture-hub`
  `这是创业探索。请按 PMF / MVP / 风险 / 下一步实验来回答。`

- 给 `life-hub`
  `这是生活事务。请给我低摩擦、可执行的安排。`

### 什么时候找谁

- 不确定找谁：找 `chief-of-staff`
- 正式工作：找 `work-hub`
- 创业探索：找 `venture-hub`
- 生活管理：找 `life-hub`
- 复杂产品方案：先找 `chief-of-staff` 或 `work-hub`，再让它调用 `product-studio`

### 当前最稳的协作顺序

1. `chief-of-staff` 先分域
2. 具体任务再下发到 `work-hub / venture-hub / life-hub`
3. 复杂产品问题再让它转 `product-studio`

当前这套系统里，工作入口优先用飞书，个人与创业入口优先用 Telegram。

完整独立文档见：
[communication_manual.md](docs/communication_manual.md)

## 仓库结构

- `docs/`
  保存 handoff、执行复盘、配置模板、通讯手册和运行说明

- `docs/openclaw_execution_dump/`
  保存这次远端重建的脱敏快照、脚本副本和执行记录

- `scripts/`
  保存可复用的重建和辅助脚本

- `config/`
  保存配置模板或后续配置固化文件

- `src/`
  预留给未来功能扩展

## 当前仓库中最重要的文件

- [docs/codex_handoff.md](docs/codex_handoff.md)
- [docs/CODEX_PROMPT.md](docs/CODEX_PROMPT.md)
- [docs/USER.md](docs/USER.md)
- [docs/openclaw.json.template](docs/openclaw.json.template)
- [docs/communication_manual.md](docs/communication_manual.md)
- [docs/system_full_snapshot.md](docs/system_full_snapshot.md)
- [docs/OpenClaw_个人数字人体系设计文档_V1.md](docs/OpenClaw_个人数字人体系设计文档_V1.md)
- [docs/openclaw_execution_dump/execution_report.md](docs/openclaw_execution_dump/execution_report.md)
- [scripts/bootstrap_openclaw_rebuild.sh](scripts/bootstrap_openclaw_rebuild.sh)

## 当前已知限制

- 飞书 calendar / tasks 还没正式接入
- ClawHub 搜索在本次操作中遇到过 `429`
- live 系统为了可用性关闭了 sandbox
- 仍有 3 条非阻塞安全告警

## 后续建议

建议按以下顺序推进：

1. 接入 Feishu calendar / tasks
2. 把 `cron` 做成正式提醒工作流
3. 收紧安全边界，尤其是 sandbox 和工具暴露面
