# 知识库结构与分类体系

> **版本**：v0.1  
> **日期**：2026-04-09  
> **状态**：待实施  

---

## 1. 目录结构总览

```
obsidian-vault/
├── raw/                    # 飞书导入的原始文章（LLM 处理前）
│   └── {feishu_token}.md
│
├── wiki/                   # 编译后的结构化知识
│   ├── 00-Inbox/          # 临时收件箱（待整理）
│   ├── 01-AI-Frontier/    # AI 前沿与思想领袖追踪
│   ├── 02-Tech-Arch/      # 技术架构与系统设计
│   ├── 03-Leadership/     # 团队管理与领导力
│   ├── 04-History-Phil/   # 历史与哲学
│   ├── 05-Venture/        # 创业战略
│   └── 06-Personal/       # 个人思考
│
├── _attachments/          # 本地附件（.gitignore 排除）
└── .scripts/              # 同步脚本
```

---

## 2. 分类定义

### 00-Inbox（收件箱）

**用途**：临时存放待整理的原始文章

**规则**：
- LLM 处理前的原始内容放此处
- 每周至少整理一次
- 整理后移入对应分类目录

---

### 01-AI-Frontier（AI 前沿）

**用途**：AI 与技术领域的前沿追踪

**子目录**：
```
01-AI-Frontier/
├── People/                # 思想领袖笔记
│   ├── Hinton/           # Geoffrey Hinton
│   ├── LeCun/            # Yann LeCun
│   ├── Karpathy/         # Andrej Karpathy
│   ├── Fei-Fei-Li/       # 李飞飞
│   └── ...
├── Papers/               # 论文笔记
│   ├── Attention/        # Transformer/Attention 机制
│   ├── LLMs/            # 大语言模型
│   └── Robotics/        # 机器人
├── Trends/               # 技术趋势
└── Tools/                # AI 工具实践
```

**核心人物标签**（与 USER.md 一致）：
- 必须关注：Hinton / LeCun / Bengio / Fei-Fei Li / Ng / Karpathy / Fridman / Bostrom / Russell / Tegmark / Harari / Musk
- 思维框架：第一性原理
- 明确排除：汤晓鸥 / 余凯 / 张亚勤

---

### 02-Tech-Arch（技术架构）

**用途**：技术架构与系统设计研究

**子目录**：
```
02-Tech-Arch/
├── OpenClaw/             # OpenClaw 系统架构
├── Claude-Code/          # Claude Code 源码研究
├── Cloud-Native/         # 云原生技术
│   ├── Kubernetes/
│   ├── Docker/
│   └── OpenStack/
├── Database/            # 数据库技术
└── DevOps/              # DevOps 工具链
```

---

### 03-Leadership（领导力）

**用途**：团队管理与领导力经验

**子目录**：
```
03-Leadership/
├── RedHat-Experiences/   # 红帽经验复盘
├── IBM-Experiences/      # IBM 经验复盘
├──金山云-Experiences/    # 金山云经验
├── Team-Building/        # 团队建设
└── Strategy/            # 战略思维
```

---

### 04-History-Phil（历史与哲学）

**用途**：历史典籍与哲学思考

**子目录**：
```
04-History-Phil/
├── 资治通鉴/            # 读书笔记
├── 史记/               # 读书笔记
├── 哲学/               # 哲学思考
└── Sci-Fi/             # 科幻作品思考
```

---

### 05-Venture（创业战略）

**用途**：创业探索与产品思考

**子目录**：
```
05-Venture/
├── Product/             # 产品思考
├── Market/             # 市场分析
└── OpenSource/         # 开源战略
```

---

### 06-Personal（个人）

**用途**：个人思考与决策记录

**子目录**：
```
06-Personal/
├── Decisions/          # 重大决策记录
├── Reflections/         # 反思与复盘
└── Goals/              # 目标追踪
```

---

## 3. Frontmatter 元数据规范

### 必需字段

```yaml
---
title: "文章标题"
feishu_token: "doc_xxx"              # 飞书文档 token
source_type: "article|doc|book|video" # 来源类型
tags: [AI, 架构]                     # 标签
created: 2026-04-09                  # 创建日期
synced_at: 2026-04-09T13:30:00+08:00 # 同步时间戳
status: inbox|processed|archived     # 处理状态
---
```

### 可选字段

```yaml
source_url: "https://..."             # 原始链接
author: "作者名"                       # 作者
aliases: ["别名1", "别名2"]            # 同义标题
summary: "250字以内的摘要"             # 摘要
cite: "引用来源"                       # 引用
related: ["相关文档1", "相关文档2"]    # 相关文档
```

---

## 4. WikiLink 规范

### 基本格式

```markdown
[[文档标题]]              # 链接到同目录文档
[[目录/文档标题]]         # 链接到子目录文档
[[01-AI-Frontier/People/Hinton]]  # 绝对路径链接
```

### 别名使用

```markdown
[[Hinton|Geoffrey Hinton]]  # 显示为 "Geoffrey Hinton"，链接到 Hinton
```

---

## 5. LLM 处理 Prompt 模板

```
# 角色
你是一个知识整理专家，负责将网络文章转化为结构化的 Obsidian Markdown 笔记。

# 输入
- 原始文章内容
- 源标题
- 源链接

# 输出要求
1. 保留核心论点，去除广告和冗余内容
2. 提取关键概念，建立与现有知识库的 wikilink
3. 添加结构化摘要（250字以内）
4. 保留原文关键引用
5. 生成 tags 和 aliases

# 元数据要求
按照 Obsidian frontmatter 规范输出，包含：
- title, source_url, source_type
- tags（从内容中提取 3-5 个）
- created（今天日期）
- synced_at（今天时间戳）
- status（默认 processed）
- summary（250字以内摘要）
- related（相关文档，可选）
```

---

## 6. 状态流转

```
inbox → processed → archived
  ↑         ↓
  └── 重新整理 ←┘
```

- **inbox**：刚同步的原始文章
- **processed**：已整理，建立了结构
- **archived**：归档，不再活跃

---

_最后更新：2026-04-09 by chief-of-staff_
