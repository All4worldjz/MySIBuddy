# AI News Hub — Specification

## 1. 目标
每天早上 8:00（Asia/Shanghai）自动抓取 AI 领域最新论文和社区讨论，生成结构化摘要并推送到 Telegram。

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI News Hub                              │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Scheduler  │──│   Fetcher    │──│    Summarizer    │  │
│  │  (cron 8am) │  │  arXiv/HN/Reddit│  │  (MiniMax-M2.7) │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                              │              │
│                                              ▼              │
│                                   ┌──────────────────┐      │
│                                   │   Formatter      │      │
│                                   │  (Telegram msg)  │      │
│                                   └──────────────────┘      │
│                                              │              │
│                                              ▼              │
│                                   ┌──────────────────┐      │
│                                   │    Pusher        │      │
│                                   │  (Telegram bot)  │      │
│                                   └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 3. Cron 配置

- **表达式**: `0 8 * * *` (每天 08:00 Asia/Shanghai)
- **OpenClaw cron name**: `ai-news-hub`
- **时区**: Asia/Shanghai (Asia/Shanghai, +08:00)

## 4. 数据源

### 4.1 arXiv
- **端点**: `https://export.arxiv.org/api/query`
- **类别**: `cs.AI`, `cs.LG`, `cs.CL`
- **数量**: 每天取最新 10-15 篇
- **过滤**: 仅取过去 24 小时内更新的论文（根据 `published` 字段）

### 4.2 Hacker News
- **端点**: HN Algolia API `https://hn.algolia.com/api/v1/search`
- **关键词**: `AI`, `machine learning`, `LLM`, `neural network`
- **数量**: 取最新 5 条相关帖

### 4.3 Reddit r/MachineLearning
- **端点**: Reddit JSON API `https://www.reddit.com/r/MachineLearning/hot.json`
- **数量**: 取最新 5 条

### 4.4 中文源（可选，如主数据源不足时补充）
- 机器之心 RSS: `https://jiqizhixin.com/rss`
- 量子位 RSS: `https://www.jiqizhixin.com/rss` （备用）

## 5. 摘要生成

### 5.1 模型
- **模型**: `minimax/MiniMax-M2.7`
- **温度**: 0.7
- **最大 Token**: 800

### 5.2 Prompt 模板

```markdown
你是一个专业的AI学术新闻摘要员。请为以下内容生成结构化摘要。

【来源类型】：{source_type}
【标题】：{title}
【链接】：{url}
【原始摘要】：{abstract}

请生成以下格式的摘要：

🔬 [论文] {title}
   背景：...
   核心：...
   意义：...

要求：
- 背景：说明这项研究解决的问题和动机（1-2句）
- 核心：简明扼要地说明核心方法和创新点（2-3句）
- 意义：说明对领域的影响和潜在应用（1-2句）
- 中文输出，语言简洁专业
```

## 6. 输出格式

```
📰 AI Daily | YYYY-MM-DD

🔬 [论文] 标题
   背景：...
   核心：...
   意义：...
   📎 链接

🔥 [讨论] 标题
   背景：...
   核心：...
   意义：...
   📎 链接
```

**注意**: Telegram 消息长度限制 4096 字符，超过时拆分为多条。

## 7. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 数据源超时 | 记录日志，继续其他数据源 |
| 摘要生成失败 | 使用原文摘要+原文链接 |
| Telegram 推送失败 | 重试 3 次，间隔 5s |
| 单条记录失败 | 跳过，继续处理其他记录 |

## 8. 文件结构

```
~/.openclaw/workspace-tech-mentor/
├── ai-news-hub/
│   ├── SPEC.md
│   ├── index.js          # 主入口
│   ├── fetchers/
│   │   ├── arxiv.js       # arXiv 抓取
│   │   ├── hn.js          # Hacker News 抓取
│   │   └── reddit.js      # Reddit 抓取
│   ├── summarizer.js     # MiniMax 摘要生成
│   ├── formatter.js      # 格式化输出
│   └── pusher.js         # Telegram 推送
└──
```

## 9. 依赖

- Node.js 内置模块: `fetch`, `fs`, `path`
- 无外部 npm 依赖（使用 OpenClaw 内置工具）

## 10. 验证方法

```bash
# 查看 cron 列表
openclaw cron list

# 手动触发测试
openclaw cron run ai-news-hub --dry

# 查看日志
openclaw logs ai-news-hub
```