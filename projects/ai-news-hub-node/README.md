# AI News Hub — Node.js Version

## 概述

Node.js 版本的 AI News Hub，定时抓取 AI 领域论文和社区讨论，生成结构化摘要并推送。

**两种实现对比：**

| 实现 | 语言 | 位置 | 用途 |
|------|------|------|------|
| Python 版 | Python | `projects/ai-news-hub/` | 生产运行版 |
| Node.js 版 | Node.js | `projects/ai-news-hub-node/` | 轻量替代实现 |

## 快速开始

```bash
# 安装依赖
npm install

# 手动测试
node index.js

# 查看 SPEC.md 了解详细架构
```

## 技术栈

- Node.js（内置 `fetch`，无需外部依赖）
- 模型调用：通过 OpenClaw 工具接口
- 推送：Telegram Bot API

## 文件结构

```
ai-news-hub-node/
├── SPEC.md          # 详细设计规范
├── README.md        # 本文件
├── index.js         # 主入口
├── fetchers/         # 数据抓取
│   ├── arxiv.js
│   ├── hn.js
│   └── reddit.js
├── summarizer.js    # 摘要生成
├── formatter.js     # 输出格式化
└── pusher.js        # 推送模块
```
