# 🧠 第二大脑知识管理系统（Second Brain Project）

> 飞书 LLM Wiki × Obsidian 联动系统设计与实施记录

## 📌 项目概述

**目标**：打通飞书 LLM Wiki 知识库与 Obsidian Vault，形成春哥的"第二大脑"，支持：
- 微信文章 → 飞书 → LLM Wiki（LLM 处理成 MD）→ Obsidian 自动同步
- OpenClaw IM 终端随时查询管理
- 笔记本 + 手机端 Obsidian 多端联动
- Agent 可调用 Obsidian 内容进行推理

**设计状态**：✅ 第一阶段设计完成（2026-04-09），周末继续实施

---

## 📊 当前进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| 0 | 需求分析与方案设计 | ✅ 完成 |
| 1 | Obsidian Vault 骨架创建 | ⏳ 待春哥确认 |
| 2 | 同步脚本开发 | ⏳ 待启动 |
| 3 | MVP 链路验证 | ⏳ 待启动 |
| 4 | 多端同步配置 | ⏳ 待启动 |
| 5 | ChromaDB 语义索引 | ⏳ 待启动 |

---

## 🏗️ 核心架构

```
微信文章 → 飞书收藏 → 飞书文档 → LLM Wiki 知识库
                                    ↓ (OpenClaw 定时同步)
                               临时处理 → GitHub Private Repo
                                    ↓ (Git 同步)
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
              笔记本 Obsidian                  手机 Obsidian
                    ↓                               ↓
              OpenClaw IM ←── 语义索引 ←── ChromaDB
```

---

## 📁 目录结构

```
second-brain/
├── docs/
│   ├── README.md              # 本文件
│   ├── DESIGN.md             # 完整技术设计方案
│   ├── STORAGE.md            # 存储策略详细说明
│   ├── KNOWLEDGE_SCHEMA.md   # 知识库结构与分类体系
│   └── PROGRESS.md           # 实施进度追踪
├── scripts/
│   ├── sync_feishu_to_obsidian.py  # 飞书→Obsidian 同步脚本
│   └── setup_vault.sh              # Vault 初始化脚本
└── vault-scaffold/                  # 初始 Vault 骨架（待生成）
```

---

## 🔑 关键设计决策

1. **存储分离**：Obsidian vault 独立于 OpenClaw 目录（`/home/admin/obsidian-vault/`）
2. **Git 唯一真值**：GitHub private repo 作为 vault 的唯一 truth-of-record
3. **增量同步**：按时间戳增量同步，不拉全量，避免磁盘膨胀
4. **最小化中转**：OpenClaw 只做 LLM 处理代理，产物直接写 Git，不在服务器留存

---

## ⚠️ 待春哥确认

1. GitHub 仓库：使用 `MySIBuddy` 的 `obsidian-vault` 分支，还是新建独立 private repo？
2. 飞书 Wiki Space ID：当前 LLM Wiki 的 Space ID（用于同步脚本配置）
3. 同步频率：每天 3 次（05:00/12:00/21:00）是否合适？
4. 移动端插件：是否已安装 Obsidian Git 插件？

---

## 📅 实施计划（周末启动）

**第一阶段（MVP）**：
1. 创建 Vault 骨架 + Git 初始化
2. 改造 `feishu_to_wiki_sync.py` 输出到 vault
3. 验证完整链路
4. 配置多端同步

**第二阶段（增强）**：
1. ChromaDB 语义索引
2. 冲突处理机制
3. OpenClaw IM 查询优化

---

_最后更新：2026-04-09 by chief-of-staff_
