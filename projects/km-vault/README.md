# Knowledge Vault - README
# Knowledge Management System based on Karpathy LLM Wiki Design

## 📋 项目概述

本项目基于 [Karpathy]() 的 "LLM Knowledge Bases" 设计原理，为 OpenClaw 构建一个用户友好的知识管理系统。

### 核心设计原则

1. **知识即文件系统** - 用 Markdown 目录树替代向量数据库
2. **一次编译，持续保鲜** - LLM 主动整理知识而非仅检索
3. **Schema 驱动** - AGENTS.md 定义 Agent 行为规范
4. **灌入即编译** - 新文档上传后自动触发 LLM 处理

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────┐
│              Docker Container                    │
│  ┌────────────────────────────────────────────┐ │
│  │  Knowledge Compiler Agent                  │ │
│  │  - raw/ → 灌入原始文档（只读）             │ │
│  │  - wiki/ → 自动生成/更新的 Markdown       │ │
│  │  - schema/ → 指令配置（AGENTS.md 等）     │ │
│  └────────────────────────────────────────────┘ │
│                    │                              │
│                  API                            │
│                    ▼                              │
│  ┌────────────────────────────────────────────┐ │
│  │  飞书 My_KM_Vault                          │ │
│  │  - raw/, wiki/, schema/, docs/             │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## 📁 目录结构

```
KM_Vault/
├── Dockerfile              # Docker 镜像配置
├── docker_build.sh         # 构建脚本
├── .env.example            # 环境变量模板
├── .github/
│   └── workflows/
│       └── km-vault.yml    # CI/CD 配置
├── raw/                    # 原始文档（等待编译）
├── wiki/                   # 编译后的知识库
│   ├── concepts/          # 概念定义
│   ├── entities/          # 实体页面
│   ├── qa/                #问答对
│   ├── summary/           # 文档摘要
│   └── reports/           # 巡检报告
├── schema/                 # Agent 指令配置
│   ├── AGENTS.md          # Agent 分工定义
│   └── WIKI_SCHEMA.md     # 知识命名规范
└── docs/                   # 系统文档
    └── 灌入流程.md         # 使用指南
```

## 🚀 快速开始

### 1. 构建 Docker 镜像

```bash
cd /home/admin/.openclaw/workspace-tech-mentor/KM_Vault
bash docker_build.sh
```

### 2. 运行容器

```bash
docker run -d \
  --name km-vault-runner \
  -v "/home/admin/.openclaw/workspace-tech-mentor/KM_Vault":"/app/vault" \
  km-vault:latest
```

### 3. 添加新知识

通过飞书上传文档到 `My_KM_Vault/raw/` 目录（或直接上传 Markdown 文件），编译器每 5 分钟自动扫描并处理。

## ⚙️ 配置文件

### .env (环境变量)
```bash
FEISHU_VAULT_FOLDER_TOKEN=QB50fa4HYlYPCRd5Q8Cck6MMnvf
LLM_MODEL=minimax/MiniMax-M2.7
```

### AGENTS.md (Agent 分工)
定义 tech-mentor、coder-hub、work-hub、life-hub 的权限和职责。

### WIKI_SCHEMA.md (知识规范)
定义 wiki/ 目录的命名、结构、格式规则。

## 🔄 工作流程

### 灌入流程
1. 用户上传文档到 `raw/`（飞书或 CLI）
2. Docker cron 每 5 分钟扫描新文件
3. 调用 `coder-hub` 编译为 `wiki/` 结构化知识
4. 生成 `wiki/.metadata.json` 记录元数据

### 提问流程
1. 用户提问："关于 Karpathy LLM Wiki 的设计原理"
2. `coder-hub` 检索 `wiki/` 相关页面
3. LLM 综合生成回答
4. 优质回答 → 生成 `wiki/qa/Q20260408-001.md`

### 巡检流程
1. 每周日 22:00 自动执行
2. 检查断链、矛盾、缺失
3. 生成 `wiki/reports/weekly_YYYY-MM-DD.md`

## 🔧 工具链

| 工具 | 用途 |
|------|------|
| Obsidian | 人类编辑/查看（飞书 native editor） |
| qmd | 本地 Markdown 搜索（BM25+向量） |
| Dataview | 动态表格查询（memory_search 替代） |
| Marp | PPT 生成（从 wiki/ 抽取） |

## 📊 磁盘空间估算

| 环境 | 最小 | 最大 |
|------|------|------|
| Docker 卷 | 2.5GB | 4.5GB |
| 飞书云盘 | 0.7GB | 2.5GB |
| **总计** | **3.2GB** | **7GB** |

## 🛡️ 安全约束

1. **raw/ 禁止写入**（除上传者）
2. **wiki/ 禁止手动编辑**（必须通过编译流程）
3. **schema/ 仅 tech-mentor 可写**
4. **所有操作必须记录权限申请**

## 📊 文件夹链接

📁 **My_KM_Vault** - https://pbrhmf5bin.feishu.cn/drive/folder/QB50fa4HYlYPCRd5Q8Cck6MMnvf

## 🔗 相关链接

- [Karpathy LLM Knowledge Bases](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [OpenClaw 官方文档](https://docs.openclaw.ai)
- [技术选型文档](KM_Vault/.github/docs/技术选型.md)

## 📝 维护者

- **tech-mentor** - 知识体系设计
- **coder-hub** - 编译执行
- **work-hub** - 知识应用
- **life-hub** - 个人知识处理

---

最后更新: 2026-04-08  
版本: v1.0