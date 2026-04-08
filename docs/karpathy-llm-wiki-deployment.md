# Karpathy LLM Wiki + Obsidian 完整部署方案

> **版本**: v2.0  
> **日期**: 2026-04-09  
> **状态**: 待实施  
> **设计依据**: Karpathy [LLM Knowledge Bases Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) + OpenClaw Memory Wiki 插件

---

## 一、核心设计理念

### 从 RAG 到持久化编译

| 维度 | 传统 RAG | Karpathy LLM Wiki |
|------|----------|-------------------|
| 知识存储 | 向量数据库（黑箱） | Markdown 文件（可见/可编辑） |
| 查询方式 | 每次检索原始文档 | 查询编译后的 Wiki |
| 知识更新 | 重新索引 | 增量更新 + 交叉引用 |
| 维护成本 | 高（人工整理） | 低（LLM 自动维护） |
| 工具链 | 专有框架 | Unix 工具链 + Obsidian + Git |

### 核心隐喻
- **Obsidian 是 IDE**
- **LLM 是程序员**
- **Wiki 是代码库**

---

## 二、完整架构设计

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          双层知识架构                                          │
│                                                                              │
│  第一层：飞书 KM-Vault（保留现有访问方式，用于团队协作/移动端快速访问）          │
│  https://pbrhmf5bin.feishu.cn/drive/folder/QB50fa4HYlYPCRd5Q8Cck6MMnvf        │
│  ├── schema/              ← AGENTS.md + WIKI_SCHEMA.md（Schema 配置）          │
│  ├── docs/                ← 操作手册（灌入流程等）                              │
│  └── vault_config.json    ← 凭证配置                                         │
│                                                                              │
│  第二层：本地 LLM Wiki（核心工作区，Obsidian + Git 同步）                       │
│  ~/.openclaw/wiki/main/                                                      │
│  ├── raw/                   ← 原始资料层（只读，LLM 不得修改）                  │
│  │   ├── articles/          ← 文章                                            │
│  │   ├── papers/            ← 论文                                            │
│  │   └── assets/            ← 图片/附件（Obsidian 固定附件路径）               │
│  ├── wiki/                  ← Wiki 层（LLM 自动创建和维护）                     │
│  │   ├── index.md           ← 内容导航目录                                    │
│  │   ├── log.md             ← 操作时间线日志（append-only）                    │
│  │   ├── entities/          ← 实体页（人物/组织/项目）                          │
│  │   ├── concepts/          ← 概念页（理论/主题）                               │
│  │   ├── sources/           ← 源文件摘要页                                    │
│  │   └── synthesis/         ← 查询分析/对比表/推导结论                          │
│  ├── AGENTS.md              ← Schema 配置（告诉 LLM 如何工作）                  │
│  └── .git/                  ← Git 版本控制（Obsidian Git 同步）                │
│                                                                              │
│  同步层：Obsidian Git                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  笔记本 Obsidian ← Git Pull/Push → 服务器 wiki vault                  │    │
│  │  手机 Obsidian   ← Git Pull/Push → 服务器 wiki vault                  │    │
│  │  配置：自动 Pull (5min) + 自动 Commit + 定时 Push                     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  第三层：Memory Wiki 插件（OpenClaw 内置）                                     │
│  - 自动编译 Wiki                                                              │
│  - 反链系统                                                                   │
│  - Claim/Evidence 溯源                                                        │
│  - 健康检查仪表盘                                                            │
│  - 与活跃记忆插件桥接                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、目录结构详解

### 1. raw/ 原始资料层

```
raw/
├── articles/
│   ├── 2026-04-09-karpathy-llm-wiki.md
│   ├── 2026-04-08-scaling-law-update.md
│   └── ...
├── papers/
│   ├── 2025-12-chinchilla-optimal.md
│   └── ...
└── assets/
    ├── karpathy-scaling-chart.png
    └── ...
```

**规则：**
- ✅ 人类手动灌入（拖拽文件、Web Clipper、脚本导入）
- ❌ LLM **只读**，不得修改
- 📎 图片/附件统一存放在 `assets/`，Obsidian 设置固定附件路径

### 2. wiki/ Wiki 层

```
wiki/
├── index.md           # 内容导航（按类别列出所有页面，含一行摘要）
├── log.md             # 操作日志（append-only，格式：## [日期] 操作 | 标题）
├── entities/
│   ├── karpathy.md
│   ├── scaling-law.md
│   └── ...
├── concepts/
│   ├── llm-reasoning.md
│   ├── emergent-abilities.md
│   └── ...
├── sources/
│   ├── karpathy-llm-wiki.md      # 原始文章的摘要 + 关键提取
│   └── ...
└── synthesis/
    ├── karpathy-vs-rag-comparison.md
    └── ...
```

**页面格式示例（entities/karpathy.md）：**

```markdown
---
title: Andrej Karpathy
tags: [人物, AI研究者, Tesla, OpenAI]
created: 2026-04-09
updated: 2026-04-09
sources: [karpathy-llm-wiki, scaling-law-update]
aliases: [Karpathy]
---

# Andrej Karpathy

## 核心观点
- LLM 应用于知识编译而非代码生成 [[concepts/llm-knowledge-compilation]]
- Scaling law 在 2026 年仍然有效，但出现边际效应递减 [[concepts/scaling-law]]

## 近期活动
- 2026-04-05: 开源 LLM Knowledge Bases Gist

## Related
- [[entities/scaling-law]]
- [[concepts/llm-reasoning]]
- [[sources/karpathy-llm-wiki]]
```

### 3. AGENTS.md Schema 配置

```markdown
# LLM Wiki Schema

## 目录约定
- `raw/`：原始资料（文章/论文/图片），**只读**，LLM 不得修改
- `wiki/`：LLM 生成与维护的知识库（Markdown）
  - `index.md`：内容导航目录
  - `log.md`：操作时间线日志
  - `entities/`：实体页（人物、组织、项目）
  - `concepts/`：概念页（理论、主题）
  - `sources/`：源文件摘要
  - `synthesis/`：查询分析、对比表、推导结论

## 页面格式
- 使用 YAML Frontmatter：
  ```yaml
  ---
  title: 页面标题
  tags: [标签1, 标签2]
  created: 2026-04-09
  updated: 2026-04-09
  sources: [source-1, source-2]
  aliases: [别名1, 别名2]  # 可选
  ---
  ```
- 引用格式：`[来源](../sources/xxx.md)`
- 交叉引用：使用 `[[wikilink]]` 格式

## 工作流指令

### Ingest（灌入）
1. 读取 `raw/` 中的新源
2. 提炼要点，生成 `sources/xxx.md` 摘要
3. 更新 `wiki/index.md`
4. 更新相关 `entities/` 和 `concepts/` 页（通常 10-15 页）
5. 追加记录到 `wiki/log.md`

### Query（查询）
1. 读取 `wiki/index.md` 定位相关页
2. 深入阅读具体页面
3. 综合生成带引用的答案
4. **将高质量分析写入 `wiki/synthesis/xxx.md`**

### Lint（巡检）
1. 扫描矛盾声明
2. 检查过期结论
3. 发现孤立页
4. 补充缺失交叉引用
5. 建议新调查方向

## 权限约束
- ❌ 严禁修改 `raw/` 目录
- ✅ 所有写入必须附带来源引用
- ✅ 保持 `index.md` 和 `log.md` 更新
- ✅ 使用 `[[wikilink]]` 格式创建反链
```

---

## 四、Obsidian Git 同步配置

### 1. 服务器端初始化 Git 仓库

```bash
# 在服务器上执行
cd ~/.openclaw/wiki/main

# 初始化 Git
git init
git add .
git commit -m "Initial LLM Wiki vault"

# 创建远程仓库（GitHub 私有仓库）
# 假设你已有仓库：git@github.com:yourusername/MySiBuddy-Wiki.git
git remote add origin git@github.com:yourusername/MySiBuddy-Wiki.git
git push -u origin main
```

### 2. 笔记本/手机端 Obsidian 配置

#### 步骤 1：克隆仓库

```bash
# 在笔记本上
cd ~/Documents/Obsidian
git clone git@github.com:yourusername/MySiBuddy-Wiki.git
```

#### 步骤 2：打开 Obsidian Vault

- 打开 Obsidian
- 选择 "Open folder as vault"
- 选择 `~/Documents/Obsidian/MySiBuddy-Wiki`

#### 步骤 3：安装 Obsidian Git 插件

1. 设置 → 第三方插件 → 浏览
2. 搜索 "Obsidian Git"
3. 安装并启用

#### 步骤 4：配置 Obsidian Git

**插件设置：**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **Commit message** | `{{date}} 自动同步` | 提交信息格式 |
| **Commit message on merge** | `{{date}} 合并同步` | 合并时提交信息 |
| **Auto save interval** | `5` 分钟 | 自动保存间隔 |
| **Auto pull interval** | `5` 分钟 | 自动拉取间隔 |
| **Auto commit after change** | ✅ 开启 | 文件变化后自动提交 |
| **Auto push** | ✅ 开启 | 自动推送（建议 15 分钟） |
| **Push on backup** | ✅ 开启 | 备份时推送 |
| **Pull before push** | ✅ 开启 | 推送前先拉取 |
| **Disable push** | ❌ 关闭 | 允许推送 |
| **Line Wrap** | ✅ 开启 | 自动换行 |
| **Show branch status bar** | ✅ 开启 | 显示分支状态 |
| **Custom commit message** | 留空 | 使用默认格式 |
| **Vault backup folder** | 留空 | 备份整个 vault |
| **Update submodules** | ❌ 关闭 | 无子模块 |
| **GPG Signing** | 按需 | 签名提交 |

**高级设置（.obsidian/plugins/obsidian-git/data.json）：**

```json
{
  "commitMessage": "{{date}} 自动同步",
  "autoSaveInterval": 5,
  "autoPullInterval": 5,
  "autoCommitAfterChange": true,
  "autoPush": true,
  "pushOnBackup": true,
  "pullBeforePush": true,
  "disablePush": false,
  "lineWrap": true,
  "showBranchStatusBar": true,
  "customMessageOnAutoBackup": false,
  "autoCommitMessage": "Obsidian 自动同步",
  "refreshSourceControlViewAutomatically": true,
  "reloadUIAutomatically": true
}
```

#### 步骤 5：配置 Obsidian 附件路径

**设置 → 文件与链接：**

| 配置项 | 值 |
|--------|-----|
| **附件默认存放路径** | `raw/assets` |
| **附件格式** | `与笔记相同目录` |
| **自动更新内部链接** | ✅ 开启 |

---

## 五、Memory Wiki 插件配置

### 1. 更新 openclaw.json 插件配置

**变更内容：**

```json
{
  "plugins": {
    "allow": [
      "duckduckgo",
      "minimax",
      "openclaw-lark",
      "telegram",
      "openai",
      "qwen",
      "memory-wiki"
    ],
    "deny": ["feishu"],
    "slots": {
      "contextEngine": "legacy",
      "memory": "memory-core"
    },
    "entries": {
      "duckduckgo": { "enabled": true },
      "minimax": { "enabled": true },
      "openclaw-lark": { "enabled": true },
      "telegram": { "enabled": true },
      "qwen": { "enabled": true },
      "memory-wiki": {
        "enabled": true,
        "config": {
          "vaultMode": "isolated",
          "vault": {
            "path": "~/.openclaw/wiki/main",
            "renderMode": "obsidian"
          },
          "obsidian": {
            "enabled": true,
            "useOfficialCli": false,
            "vaultName": "MySiBuddy Wiki",
            "openAfterWrites": false
          },
          "ingest": {
            "autoCompile": true,
            "maxConcurrentJobs": 1,
            "allowUrlIngest": true
          },
          "search": {
            "backend": "shared",
            "corpus": "wiki"
          },
          "render": {
            "preserveHumanBlocks": true,
            "createBacklinks": true,
            "createDashboards": true
          },
          "context": {
            "includeCompiledDigestPrompt": false
          }
        }
      }
    }
  }
}
```

### 2. CLI 命令参考

```bash
# 初始化 Wiki
openclaw wiki init

# 查看状态
openclaw wiki status

# 灌入文档
openclaw wiki ingest ~/.openclaw/wiki/main/raw/articles/xxx.md

# 编译 Wiki
openclaw wiki compile

# 搜索知识
openclaw wiki search "Karpathy scaling law"

# 获取页面
openclaw wiki get entities/karpathy

# 健康检查
openclaw wiki lint

# Git 同步（手动）
cd ~/.openclaw/wiki/main && git add . && git commit -m "Wiki 更新" && git push
```

---

## 六、Cron 任务重新设计

### 现有 KM-Vault Cron 任务

| ID | 名称 | 频率 | 状态 |
|----|------|------|------|
| `d0f38e1a` | KM-Vault 每日备份 | 每天 03:00 | idle |
| `3b340869` | KM-Vault 飞书入库触发 | 每 12 小时 | ok |
| `1db28b74` | KM-Vault raw 目录扫描与编译 | 每 12 小时 | ok |
| `a15b2f2c` | KM-Vault 每周系统巡检 | 每周日 22:00 | idle |

### 新 Cron 任务设计

| 任务 | 频率 | Agent | 说明 |
|------|------|-------|------|
| **Wiki 自动编译** | 每 1 小时 | coder-hub | 扫描 `raw/` 新文档，触发 `wiki ingest` + `wiki compile` |
| **Wiki 健康检查** | 每天 06:00 | tech-mentor | 执行 `wiki lint`，生成报告 |
| **Wiki Git 同步** | 每 15 分钟 | coder-hub | `git pull` → `git add` → `git commit` → `git push` |
| **飞书 → Wiki 同步** | 每 6 小时 | coder-hub | 从飞书 KM-Vault 导出新文档到 `raw/` |
| **Wiki → 飞书 镜像** | 每天 03:00 | coder-hub | 将 `wiki/` 编译结果镜像到飞书（只读） |
| **每周知识巡检** | 每周日 22:00 | tech-mentor | 全面 Lint + 矛盾检测 + 过期页面标记 |

---

## 七、实施步骤

### 阶段 1：初始化 Wiki Vault（15 分钟）

```bash
# 1. 备份当前配置
ssh admin@47.82.234.46 'cp -r /home/admin/.openclaw/openclaw.json /home/admin/.openclaw/openclaw.json.pre-wiki-20260409'

# 2. 创建目录结构
ssh admin@47.82.234.46 'mkdir -p ~/.openclaw/wiki/main/{raw/{articles,papers,assets},wiki/{entities,concepts,sources,synthesis}}'

# 3. 创建 AGENTS.md
ssh admin@47.82.234.46 'cat > ~/.openclaw/wiki/main/AGENTS.md << "EOFAGENTS"
# LLM Wiki Schema

## 目录约定
- `raw/`：原始资料（文章/论文/图片），**只读**，LLM 不得修改
- `wiki/`：LLM 生成与维护的知识库（Markdown）
  - `index.md`：内容导航目录
  - `log.md`：操作时间线日志
  - `entities/`：实体页（人物、组织、项目）
  - `concepts/`：概念页（理论、主题）
  - `sources/`：源文件摘要
  - `synthesis/`：查询分析、对比表、推导结论

## 页面格式
- 使用 YAML Frontmatter
- 引用格式：`[来源](../sources/xxx.md)`
- 交叉引用：使用 `[[wikilink]]` 格式

## 工作流指令
### Ingest（灌入）
1. 读取 `raw/` 中的新源
2. 提炼要点，生成 `sources/xxx.md` 摘要
3. 更新 `wiki/index.md`
4. 更新相关 `entities/` 和 `concepts/` 页
5. 追加记录到 `wiki/log.md`

### Query（查询）
1. 读取 `wiki/index.md` 定位相关页
2. 深入阅读具体页面
3. 综合生成带引用的答案
4. 将高质量分析写入 `wiki/synthesis/xxx.md`

### Lint（巡检）
1. 扫描矛盾声明
2. 检查过期结论
3. 发现孤立页
4. 补充缺失交叉引用
5. 建议新调查方向

## 权限约束
- ❌ 严禁修改 `raw/` 目录
- ✅ 所有写入必须附带来源引用
- ✅ 保持 `index.md` 和 `log.md` 更新
EOFAGENTS'

# 4. 创建初始 index.md 和 log.md
ssh admin@47.82.234.46 'cat > ~/.openclaw/wiki/main/wiki/index.md << "EOF"
# Wiki 索引

## Entities
_暂无实体页面_

## Concepts
_暂无概念页_

## Sources
_暂无源摘要_

## Synthesis
_暂无综合分析_
EOF'

ssh admin@47.82.234.46 'touch ~/.openclaw/wiki/main/wiki/log.md'
```

### 阶段 2：启用 Memory Wiki 插件（10 分钟）

```bash
# 应用新插件配置
scripts/safe_openclaw_validate.sh /tmp/openclaw-wiki-config.json
scripts/safe_openclaw_apply.sh /tmp/openclaw-wiki-config.json

# 验证
ssh admin@47.82.234.46 'openclaw wiki status'
ssh admin@47.82.234.46 'openclaw status --deep | grep -E "Plugin|Wiki"'
```

### 阶段 3：初始化 Git 仓库（10 分钟）

```bash
# 在服务器上
ssh admin@47.82.234.46 'cd ~/.openclaw/wiki/main && git init && git add . && git commit -m "Initial LLM Wiki vault"'

# 创建 GitHub 私有仓库（手动）
# https://github.com/new → MySiBuddy-Wiki（私有）

# 添加远程仓库
ssh admin@47.82.234.46 'cd ~/.openclaw/wiki/main && git remote add origin git@github.com:yourusername/MySiBuddy-Wiki.git && git push -u origin main'
```

### 阶段 4：配置 Obsidian（20 分钟）

**笔记本端：**

```bash
# 克隆仓库
cd ~/Documents/Obsidian
git clone git@github.com:yourusername/MySiBuddy-Wiki.git

# 打开 Obsidian → 选择该文件夹为 Vault
# 安装 Obsidian Git 插件
# 配置自动同步（见上文配置表）
# 配置附件路径为 raw/assets
```

**手机端：**

1. 安装 Obsidian for iOS/Android
2. 使用 iCloud/Working Copy (iOS) 或文件夹同步 (Android)
3. 克隆 GitHub 仓库
4. 安装 Obsidian Git 插件（如果支持）
5. 配置自动同步

### 阶段 5：迁移现有内容（30 分钟）

```bash
# 从飞书导出文档到 raw/
# 使用现有的 feishu 脚本或手动导出

# 灌入首批文档
ssh admin@47.82.234.46 'openclaw wiki ingest ~/.openclaw/wiki/main/raw/articles/'
ssh admin@47.82.234.46 'openclaw wiki compile'
ssh admin@47.82.234.46 'openclaw wiki lint'
```

### 阶段 6：配置 Cron 任务（15 分钟）

```bash
# 创建新的 Cron 任务
ssh admin@47.82.234.46 'openclaw cron add ...'

# 验证
ssh admin@47.82.234.46 'openclaw cron list'
```

---

## 八、日常工作流

### 场景 1：灌入新文档

```
1. 你在笔记本 Obsidian 中
2. 将新文章保存到 raw/articles/2026-04-09-xxx.md
3. Obsidian Git 自动 commit & push
4. 服务器自动 pull（5 分钟后）
5. Cron 触发 wiki ingest + wiki compile（1 小时后）
6. LLM 自动更新 wiki/ 中的相关页面
7. Git 自动同步回你的笔记本
8. Obsidian 中查看更新
```

### 场景 2：查询知识

```
1. 在 Telegram/Feishu 中提问："Karpathy 对 scaling law 的最新观点？"
2. Agent 调用 wiki_search "scaling law Karpathy"
3. 返回带引用的结构化答案
4. 高质量回答自动归档到 wiki/synthesis/
```

### 场景 3：移动端浏览

```
1. 打开手机 Obsidian
2. 自动 pull 最新内容（5 分钟间隔）
3. 浏览 wiki/index.md 查看所有页面
4. 点击 [[wikilink]] 跳转相关页面
5. Graph View 查看知识图谱
6. 离线可用（Git 已缓存）
```

### 场景 4：定期巡检

```
1. Cron 每周日 22:00 触发 wiki lint
2. 生成 reports/ 仪表盘：
   - contradictions.md（矛盾声明）
   - stale-pages.md（过期页面）
   - open-questions.md（未解决问题）
3. tech-mentor 审查报告
4. 通过 Telegram 通知你
```

---

## 九、工具链完整清单

| 类别 | 工具 | 用途 | 状态 |
|------|------|------|------|
| **编辑器/查看器** | Obsidian | 实时浏览 Wiki、Graph View、版本历史 | ✅ 已使用 |
| **源获取** | Obsidian Web Clipper | 一键将网页转 Markdown 存入 raw/ | 📦 待安装 |
| **本地搜索** | qmd | 混合 BM25 + 向量检索 + LLM 重排 | 📦 待安装 |
| **可视化/查询** | Dataview | 基于 YAML Frontmatter 动态表格 | 📦 待安装 |
| **演示输出** | Marp | Wiki 内容转幻灯片 | 📦 可选 |
| **版本控制** | Git | 分支、回滚、协作、变更审计 | ✅ 已配置 |
| **同步** | Obsidian Git | 自动 Pull/Commit/Push | 📦 待配置 |
| **编译** | Memory Wiki 插件 | 自动编译、反链、健康检查 | 📦 待启用 |

---

## 十、飞书 KM-Vault 保留方案

### 当前飞书结构

```
https://pbrhmf5bin.feishu.cn/drive/folder/QB50fa4HYlYPCRd5Q8Cck6MMnvf
├── schema/
│   ├── AGENTS.md
│   └── WIKI_SCHEMA.md
├── docs/
│   └── 灌入流程.md
└── vault_config.json
```

### 保留策略

1. **只读镜像**：飞书作为 Wiki 的只读镜像，用于：
   - 团队成员访问（无 Obsidian 的用户）
   - 移动端快速浏览
   - 备份存储

2. **单向同步**：`wiki/` → 飞书（每天 03:00）
   - 将编译后的 Wiki 页面导出为飞书文档
   - 保持结构一致

3. **飞书 → raw/ 灌入**：
   - 用户在飞书中创建/编辑文档
   - Cron 每 6 小时扫描飞书新文档
   - 导出到 `raw/articles/` 触发编译

---

## 十一、风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Git 冲突 | 同步失败 | `pullBeforePush: true`，自动合并 |
| Wiki 编译错误 | 知识未更新 | Cron 失败告警 + 手动重试 |
| 飞书 API 限流 | 同步延迟 | 重试 + 指数退避 |
| Obsidian 插件冲突 | 同步中断 | 定期备份 `.obsidian/` 配置 |
| 知识矛盾 | 信息不一致 | `wiki lint` 自动检测 + 人工审查 |

---

## 十二、验收标准

- [ ] `openclaw wiki status` 返回正常状态
- [ ] `openclaw wiki ingest` 成功灌入测试文档
- [ ] `openclaw wiki compile` 成功编译
- [ ] `openclaw wiki lint` 无严重错误
- [ ] Git 仓库初始化并推送成功
- [ ] 笔记本 Obsidian 可以浏览并自动同步
- [ ] 手机 Obsidian 可以浏览并自动同步
- [ ] Cron 任务正常运行
- [ ] 飞书 KM-Vault 保持可访问

---

## 附录 A：Karpathy 原始 Gist 要点

1. **三层架构**：raw/（只读）→ wiki/（LLM 维护）→ AGENTS.md（Schema）
2. **核心操作**：Ingest（灌入）、Query（查询）、Lint（巡检）
3. **工具推荐**：Obsidian + Web Clipper + qmd + Dataview + Marp + Git
4. **关键理念**：知识持续积累，而非每次查询重新推导
5. **规模参考**：100 篇文章、40 万字，LLM 自己维护索引足够顺畅

## 附录 B：Obsidian 插件推荐配置

**核心插件：**
- Obsidian Git（同步）
- Dataview（动态查询）
- Templates（页面模板）
- QuickAdd（快速灌入）

**主题推荐：**
- Minimal（简洁）
- Things（美观）

**CSS 片段（可选）：**
- 高亮 `[[wikilink]]`
- 自定义 Frontmatter 显示

---

**文档版本**: v2.0  
**最后更新**: 2026-04-09  
**维护者**: tech-mentor (大师)  
**审批**: 待 CC 确认
