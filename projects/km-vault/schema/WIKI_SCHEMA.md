# LLM Knowledge Vault - Wiki 命名与结构规范 (v1.0)
# 创建时间：2026-04-08
# 负责人：tech-mentor

## 目录结构

```
wiki/
├── index.md              # 知识图谱入口（自动维护）
├── .metadata.json        # 元数据索引（JSON 格式）
├── concepts/             # 概念定义
│   └── xxx.md           # 通用概念（如 "知识编译"）
├── entities/             # 实体页面
│   ├── people/          # 人物（如 "Karpathy.md"）
│   ├── companies/       # 公司（如 "OpenClaw.md"）
│   └── technologies/    # 技术（如 "LLM_RAG.md"）
├── qa/                   # 问答对（提问后生成）
│   └── Q20260408-001.md # 编号格式：Q+日期+序号
├── summary/              # 文档摘要（灌入后生成）
│   └── raw_YYYYMMDD.md
└── reports/              # 巡检报告
    ├── weekly_YYYY-MM-DD.md  # 每周巡检
    └── errors_YYYY-MM-DD.log # 错误日志
```

## 命名规范

### 概念页（concepts/）
- **命名**：`PascalCase.md`（如 `KnowledgeCompilation.md`）
- **内容结构**：
  ```markdown
  ## 概念定义
  [...] - 来源引用

  ## 核心特征
  1. 特征1
  2. 特征2

  ## vs 相关概念
  | 维度 | 概念A | 概念B |
  |------|-------|-------|
  | ...  | ...   | ...   |

  ## 参考资料
  - [[entities/Karpathy|Karpathy]] 的 LLM Wiki 系统
  ```

### 实体页（entities/）
- **People**：`entities/people/姓名.md`
- **Companies**：`entities/companies/公司名.md`
- **Technologies**：`entities/technologies/技术名.md`
- **内容结构**：
  ```markdown
  ## 基本信息
  - 名称：...
  - 类型：人物/公司/技术
  - 创建时间：2026-04-08
  - 来源：[[raw/xxx|原始文档]]

  ## 核心内容
  [...] - 提取关键信息

  ## 关联概念
  - [[concepts/xxx|xxx]]

  ## 事件时间线
  | 时间 | 事件 |
  |------|------|
  | 2024-XX | ... |
  ```

### 问答页（qa/）
- **命名**：`Q20260408-001.md`（问题编号）
- **内容结构**：
  ```markdown
  # Q20260408-001: [问题标题]

  ## 问题
  [...用户提问...]

  ## 回答
  [...LLM 综合回答...]

  ## 知识节点引用
  - [[concepts/xxx|xxx]]
  - [[entities/xxx|xxx]]

  ## 提问元数据
  - 时间：2026-04-08 07:15 UTC+8
  - 提问人：CC
  - 涉及 Agent：coder-hub
  ```

### 摘要页（summary/）
- **命名**：`raw_YYYYMMDD_HHMM.md`（灌入时间戳）
- **内容**：原始文档的结构化摘要

### 巡检报告（reports/）
- **命名**：`weekly_YYYY-MM-DD.md`
- **内容**：
  ```markdown
  # Weekly Report 2026-04-07

  ## 知识图谱状态
  - 实体总数：42
  - 概念总数：18
  - 新增页面：3

  ## 巡检问题
  - ⚠️ 断链：`wiki/concepts/RAG.md` → 无指向
  - ⚠️ 矛盾：`Karpathy` 实体页 vs `LLM_RAG` 概念页时间线不一致

  ## 养成建议
  - 补充 "知识编译" 的数学定义
  - 整理 "Obsidian 工具链" 的使用场景
  ```

## 格式规则

### Markdown 语法
- **标题层级**：最多 `###`（H3）
- **链接格式**：`[[namespace/path|显示名]]`
- **代码块**：```language （支持 python, bash, markdown）
- **表格**：使用标准 Markdown 表格（对齐）

### 图片嵌入
- **格式**：`![描述](../raw/images/xxx.png)`
- **来源**：图片存放在 `raw/images/`

### 元数据字段（YAML Front Matter）
```yaml
---
type: concept
last_modified: 2026-04-08T07:30:00+08:00
tags: ["llm", "wiki", "architecture"]
source: "raw/xxx.md"
---
```

## 权限矩阵

| 目录 | tech-mentor | coder-hub | work-hub |
|------|-------------|-----------|----------|
| wiki/ | r | **rw** | r |
| wiki/concepts/ | r | rw | r |
| wiki/entities/ | r | rw | r |
| wiki/qa/ | r | rw | r |
| wiki/reports/ | **rw** | r | r |

## 编译触发条件

### 智能触发
- raw/ 新增文件 → 立即编译（coder-hub）
- wiki/ 内部更新 → 检查关联页面是否需要更新

### 手动触发
- 用户问 "重新编译 raw/xxx.md"
- tech-mentor 说 "更新所有实体页"

## 崩溃恢复

- **页面损坏**：从 `wiki/.metadata.json` 恢复Last Good Version
- **目录结构变更**：tech-mentor 更新本规范 + 通知所有 Agent

## 最佳实践

1. **单一来源原则**：每个知识节点只来自一个 raw/ 文档
2. **反向链接**：每次编辑 wiki/ 页面，确保 raw/ 有对应引用
3. **定期巡检**：每周日 22:00 自动执行
4. **命名一致性**：所有实体页用英文命名（避免中文路径问题）

---

**最后更新**：2026-04-08  
**维护者**：tech-mentor  
**关联文件**：`schema/AGENTS.md`