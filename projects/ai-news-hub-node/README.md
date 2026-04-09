# AI News Hub — Node.js Version

## 概述

Node.js 版本的 AI News Hub，定时抓取 AI 领域论文和社区讨论，生成结构化摘要并推送。

**两种实现对比：**

| 实现 | 语言 | 位置 | 用途 |
|------|------|------|------|
| Python 版 | Python | `projects/ai-news-hub/` | 生产运行版 |
| Node.js 版 | Node.js | `projects/ai-news-hub-node/` | 轻量替代实现 |

## 依赖说明

**本项目无外部 npm 依赖**，使用 Node.js 内置模块（`fetch`, `fs`, `path`, `crypto`）和 OpenClaw 工具接口。

```bash
# 安装（空操作，保留此文件以便未来扩展）
npm install
```

若需要添加 npm 依赖，请在 `package.json` 的 `dependencies` 中声明，示例：

```json
{
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

## 快速开始

```bash
# 手动测试（依赖 OpenClaw 工具接口）
node index.js

# 查看 SPEC.md 了解详细架构
```

## 技术栈

- Node.js 内置模块（`fetch`, `fs`, `path`）
- 模型调用：通过 OpenClaw 工具接口
- 推送：Telegram Bot API

## 文件结构

```
ai-news-hub-node/
├── SPEC.md          # 详细设计规范
├── README.md        # 本文件
├── package.json    # 依赖声明（扩展用）
├── index.js         # 主入口
├── fetchers/         # 数据抓取
│   ├── arxiv.js
│   ├── hn.js
│   └── reddit.js
├── summarizer.js    # 摘要生成
├── formatter.js     # 输出格式化
└── pusher.js        # 推送模块
```

## 工程铁律合规性

- ✅ **依赖确定性**：无外部依赖，内置模块不需声明
- ✅ **可复制**：纯 Node.js，无需额外运行时配置
- ✅ **可追溯**：Git 版本控制，SPEC.md 完整
- ✅ **可迭代**：架构清晰，支持扩展数据源
