# 第二大脑知识管理系统 · 技术设计方案

> **版本**：v0.1 Draft  
> **日期**：2026-04-09  
> **状态**：✅ 设计完成，待春哥确认后实施  

---

## 1. 背景与目标

### 1.1 使用习惯

```
微信看到文章 → 转给飞书 → 转成飞书文档 → 压入飞书网盘存储的 LLM Wiki
                                                    ↓ 调用 LLM 处理成 MD 文件
                                              手动存入本地 Obsidian
```

### 1.2 目标

| 目标 | 说明 |
|------|------|
| **自动化同步** | 飞书 Wiki 新增文档 → 自动同步到 Obsidian Vault |
| **多端联动** | 笔记本 + 手机 Obsidian 与飞书 Wiki 实时同步 |
| **语义查询** | OpenClaw IM 终端可随时查询知识库 |
| **Agent 调用** | Obsidian 内容可被 agent 读取用于推理 |
| **最小化占用** | OpenClaw 服务器不托管 vault，只做处理代理 |

---

## 2. 系统架构

### 2.1 数据流向

```
┌─────────────────────────────────────────────────────────┐
│                     微信文章                              │
│                        ↓                                 │
│                   飞书收藏/插件                          │
│                        ↓                                 │
│               飞书文档（多维表格）                       │
│                        ↓                                 │
│              LLM Wiki 知识库（飞书）                     │
│                        ↓ OpenClaw 定时同步                │
│            ┌──────────┴──────────┐                      │
│            ↓                     ↓                       │
│   ┌────────────────┐    ┌───────────────┐              │
│   │ LLM 处理管道    │    │ 临时缓存      │              │
│   │ (OpenClaw 内)  │    │ /tmp 中转     │              │
│   └───────┬────────┘    └───────↑───────┘              │
│           ↓                     │                         │
│   ┌───────────────┐    ┌──────┴───────┐               │
│   │ Obsidian Vault│←───│ GitHub Push  │               │
│   │ /home/admin/  │    │ Private Repo │               │
│   │ obsidian-vault│    └──────────────-┘               │
│   └───────┬───────┘                                     │
│           ↓ Git Sync                                    │
│   ┌───────┴────────┐                                    │
│   ↓               ↓                                    │
│ 笔记本         手机                                      │
│ Obsidian      Obsidian                                  │
│           ↓ OpenClaw IM 查询                            │
│   ┌────────────────────────┐                           │
│   │ ChromaDB 语义索引        │ ←── wiki_search          │
│   └────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心原则

1. **OpenClaw 不托管 vault**：服务器只做 LLM 处理代理，产物直接写 GitHub
2. **GitHub 为唯一真值**：所有设备通过 Git sync，零额外服务
3. **增量同步**：按时间戳增量，不拉全量
4. **最小化磁盘占用**：临时文件 TTL=24h，大型附件不中转

---

## 3. 存储策略

### 3.1 存储布局

```
/home/admin/obsidian-vault/          ← 主 vault（Git 管理，独立于 .openclaw/）
├── raw/                            ← 飞书导入的原始文章
├── wiki/                           ← 编译后的结构化知识
│   ├── 00-Inbox/                  ← 临时收件箱（待整理）
│   ├── 01-AI-Frontier/           ← AI 前沿思想领袖追踪
│   ├── 02-Tech-Arch/             ← 技术架构与系统设计
│   ├── 03-Leadership/             ← 团队管理与领导力
│   ├── 04-History-Phil/          ← 历史与哲学读书笔记
│   └── 05-Personal/              ← 个人思考与决策记录
├── _attachments/                   ← 本地附件（.gitignore 排除）
└── .scripts/                      ← 同步脚本（不在 vault 内）

/tmp/feishu-sync-cache/            ← 中转缓存（定期清理）
├── pending/                       ← 待同步文档
└── last_sync_timestamp           ← 增量同步标记

~/.openclaw/wiki/main/raw/         ← OpenClaw wiki 只写镜像（供内部读取）
```

### 3.2 存储分配

| 内容 | 存储位置 | TTL/说明 |
|------|----------|---------|
| Obsidian vault 主库 | `/home/admin/obsidian-vault/` | Git 持久化 |
| 飞书原始文档缓存 | `/tmp/feishu-sync-cache/pending/` | 24h 临时 |
| OpenClaw wiki 镜像 | `~/.openclaw/wiki/main/raw/` | 只写 |
| 大型附件/二进制 | 不中转，仅保留飞书 CDN URL | - |
| ChromaDB 索引 | `~/.openclaw/wiki/vector/` | KB 级元数据 |

### 3.3 磁盘占用预估

| 项目 | 大小 | 说明 |
|------|------|------|
| Obsidian vault（初期） | ~50-200 MB | 随时间增长，主要为 .md 文件 |
| /tmp 缓存 | < 100 MB | 临时，24h 清理 |
| OpenClaw wiki 镜像 | < 50 MB | 只写结构化摘要 |
| ChromaDB 索引 | < 5 MB | 仅为向量+摘要 |

**结论**：完全满足中转服务器磁盘限制要求。

---

## 4. 技术选型

### 4.1 技术栈

| 层次 | 选型 | 替代方案 |
|------|------|---------|
| 同步中枢 | GitHub private repo | Gitea 自建（备选） |
| 移动端同步 | Obsidian Git 插件 | iCloud（跨平台弱） |
| LLM 处理 | OpenClaw 内置模型 | Gemini/Qwen CLI |
| 语义索引 | ChromaDB（本地） | 暂无（轻量优先） |
| 飞书 API | feishu_fetch_doc 等工具 | 飞书开放平台 API |
| 冲突处理 | Git 3-way merge | LLM 辅助裁定 |

### 4.2 工具链

```
飞书 Wiki ──[feishu_wiki_space_node]──→ 节点列表
        ──[feishu_fetch_doc]────────→ 文档内容
        ──[LLM 处理]────────────────→ Markdown
        ──[git write]───────────────→ GitHub Push

OpenClaw ──[wiki_search]────────────→ ChromaDB 语义检索
        ──[exec/cat]────────────────→ 读取 vault 文件
```

---

## 5. 知识库结构

### 5.1 目录分类体系

```
wiki/
├── 00-Inbox/              # 临时收件箱，LLM 处理前的原始文章
├── 01-AI-Frontier/        # AI 前沿与思想领袖追踪
│   ├── People/            # 思想领袖笔记（Hinton/LeCun/Karpathy 等）
│   ├── Papers/            # 论文笔记
│   └── Trends/            # 技术趋势
├── 02-Tech-Arch/          # 技术架构与系统设计
│   ├── OpenClaw/          # OpenClaw 系统架构
│   ├── Claude-Code/        # Claude Code 源码研究
│   └── Cloud-Native/       # 云原生技术（K8s/Docker/OpenStack）
├── 03-Leadership/         # 团队管理与领导力
│   ├── RedHat-Experiences/ # 红帽经验复盘
│   └── IBM-Experiences/    # IBM 经验复盘
├── 04-History-Phil/       # 历史与哲学
│   ├── 资治通鉴/           # 读书笔记
│   ├── 史记/              # 读书笔记
│   └── Philosophy/         # 哲学思考
├── 05-Venture/            # 创业战略与探索
│   ├── Product/           # 产品思考
│   └── Market/            # 市场分析
└── 06-Personal/          # 个人思考与决策
```

### 5.2 Frontmatter 元数据规范

```yaml
---
title: "文章标题"
feishu_token: "doc_xxx"              # 飞书文档 token
feishu_type: "wiki_node"              # 节点类型
source_url: "https://..."             # 原始链接
source_type: "article|doc|book|video" # 来源类型
tags: [AI, 架构, 第二大脑]            # 标签（与目录对应）
created: 2026-04-09                  # 首次创建时间
synced_at: 2026-04-09T13:30:00+08:00 # 最近同步时间
status: inbox|processed|archived     # 处理状态
aliases: ["别名1", "别名2"]           # 同义标题
---

正文内容...
```

### 5.3 LLM 处理 Prompt 模板

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
```

---

## 6. 同步脚本设计

### 6.1 sync_feishu_to_obsidian.py 核心逻辑

```python
#!/usr/bin/env python3
"""
sync_feishu_to_obsidian.py
飞书 LLM Wiki → Obsidian vault 单向同步（增量）

流程：
1. 读取 last_sync_timestamp
2. 调用飞书 API 获取知识库节点列表（过滤更新时间 > last_sync）
3. 对每个新/更新节点：
   - feishu_fetch_doc → LLM 处理 → 写入 vault/raw/
4. Git commit + push
5. 更新 last_sync_timestamp
"""

import os, json, subprocess
from datetime import datetime
from pathlib import Path

VAULT_RAW = Path("/home/admin/obsidian-vault/raw")
TMP_CACHE = Path("/tmp/feishu-sync-cache/pending")
LAST_SYNC_FILE = TMP_CACHE / "last_sync_timestamp"
WIKI_SPACE_ID = os.getenv("FEISHU_WIKI_SPACE_ID", "")

def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}")

def get_feishu_token():
    with open("/home/admin/.openclaw/runtime-secrets.json") as f:
        secrets = json.load(f)
    return secrets.get("FEISHU_APP_ID"), secrets.get("FEISHU_APP_SECRET")

def fetch_wiki_nodes(space_id, token):
    """递归获取知识库所有文档节点"""
    # 调用 feishu_wiki_space_node list API
    pass

def download_doc(doc_token) -> str:
    """下载单个飞书文档为 Markdown"""
    # 调用 feishu docx raw_content API
    pass

def process_with_llm(content: str, title: str) -> str:
    """调用 OpenClaw LLM 处理内容"""
    # 调用 Gemini/Qwen CLI
    pass

def main():
    VAULT_RAW.mkdir(parents=True, exist_ok=True)
    TMP_CACHE.mkdir(parents=True, exist_ok=True)
    
    log("🔄 开始飞书 → Obsidian 同步")
    app_id, app_secret = get_feishu_token()
    token = get_feishu_token()  # TODO: 实现 auth
    
    nodes = fetch_wiki_nodes(WIKI_SPACE_ID, token)
    new_count = 0
    
    for node in nodes:
        if node["type"] not in ("doc", "docx"):
            continue
        
        out_file = VAULT_RAW / f"{node['token']}.md"
        content = download_doc(node["token"])
        processed = process_with_llm(content, node["title"])
        
        frontmatter = f"""---
title: "{node['title']}"
feishu_token: "{node['token']}"
feishu_type: wiki_node
synced_at: {datetime.now().isoformat()}
---

{processed}
"""
        out_file.write_text(frontmatter, encoding="utf-8")
        new_count += 1
    
    LAST_SYNC_FILE.write_text(str(int(datetime.now().timestamp())))
    log(f"✅ 完成，新增/更新 {new_count} 篇")
    
    # Git commit + push
    os.chdir("/home/admin/obsidian-vault")
    subprocess.run(["git", "add", "raw/"], check=False)
    subprocess.run(["git", "commit", "-m", f"sync: {new_count} docs {datetime.now().date()}"], check=False)
    subprocess.run(["git", "push"], check=False)

if __name__ == "__main__":
    main()
```

### 6.2 自动化触发

| 触发方式 | 实现 | 频率 |
|----------|------|------|
| 定时同步 | cron job | 每天 05:00/12:00/21:00 |
| 手动触发 | `/sync-feishu-obsidian` 命令 | 按需 |
| 飞书事件 | 飞书 Webhook → OpenClaw | 可选增强 |

```bash
# crontab -e 示例
0 5,12,21 * * * /home/admin/obsidian-vault/.scripts/sync_to_feishu.sh >> /home/admin/logs/sync.log 2>&1
```

---

## 7. OpenClaw 访问协议

### 7.1 读取 Obsidian vault

**方案：直接文件系统读取（无额外服务）**

```bash
# OpenClaw 通过 exec 调用直接读取
cat /home/admin/obsidian-vault/wiki/*.md

# 或 thin wrapper
python3 ~/bin/read_obsidian_doc.py <rel_path>
```

**无需 Obsidian CLI，无需额外服务依赖。**

### 7.2 语义搜索（ChromaDB）

```
用户查询 → OpenClaw IM
    ↓
wiki_search 工具 → ChromaDB 向量检索
    ↓
返回文件路径 + 相关片段 + 行号
```

### 7.3 Obsidian 调用 Agent（可选）

**推荐方案：Git commit hook → webhook**

```
Obsidian 手动触发
    ↓
Git commit (含特定标记)
    ↓
OpenClaw webhook 接收
    ↓
解析 commit message，执行对应任务
```

**安全约束：禁止 Obsidian 插件直接持有 OpenClaw token。**

---

## 8. Git 同步方案

### 8.1 多端同步架构

```
GitHub Private Repo
    ↑
    │ push/pull (自动/定时)
    │
────┴────
 Obsidian Git
    │
    ├── 笔记本 (手动+定时 push/pull)
    ├── 手机 (Obsidian Git 插件)
    └── VPS/OpenClaw (只运行同步脚本，不做编辑器)
```

### 8.2 冲突处理

| 场景 | 处理方式 |
|------|---------|
| 多设备同时编辑同一文件 | Git merge + LLM 给出 diff 摘要，用户决策 |
| 飞书更新 vs 本地修改 | 以时间戳为主，本地修改保留为 conflict 文件 |
| 强制解决方案 | `git pull --rebase` + 冲突标记文件提醒 |

### 8.3 .gitignore 规则

```
# 排除大文件
_attachments/
media/
*.zip
*.tar.gz

# 排除临时文件
tmp/
*.tmp

# 保留关键文件
!.gitignore
```

---

## 9. 风险评估

| 风险 | 等级 | 缓解方案 |
|------|------|----------|
| 飞书文档结构变更解析失败 | 中 | 固定模板 + LLM 容错兜底 |
| Git 冲突（多设备同时编辑） | 中 | `git pull --rebase` + 冲突提醒 |
| 微信文章格式混乱（图片/表格） | 中 | LLM 处理降级，保留截图，走飞书 CDN URL |
| Obsidian vault 过大导致 clone 慢 | 低 | .gitignore 排除 media，ChromaDB 独立索引 |
| GitHub 访问受限（墙/限速） | 低 | 备选 Gitea 自建，或改用 SSH + 缓存 |
| OpenClaw 服务器故障 | 低 | vault 在 GitHub 不丢数据，agent 只做处理层 |

---

## 10. MVP 验证步骤

### 第一阶段：基础设施（周末）

**Step 1：创建 Vault 骨架**
```bash
mkdir -p /home/admin/obsidian-vault/{raw,wiki/00-Inbox,_attachments,.scripts}
cd /home/admin/obsidian-vault
git init
git remote add origin git@github.com:your-username/obsidian-vault.git
echo "*.md text eol=lf" > .gitattributes
echo "_attachments/" >> .gitignore
echo "tmp/" >> .gitignore
git add .
git commit -m "chore: init obsidian vault scaffold"
git push -u origin main
```

**Step 2：验证飞书 API 读取**
```bash
# 测试获取 Wiki 节点
openclaw feishu wiki list --space-id YOUR_SPACE_ID
```

**Step 3：改造同步脚本**
- 将 `feishu_to_wiki_sync.py` 输出目标改为 `/home/admin/obsidian-vault/raw/`
- 增加 frontmatter 写入
- 增加 Git commit/push 步骤

### 第二阶段：链路验证（周末）

1. 手动跑一次完整链路：飞书文档 → `feishu_fetch_doc` → LLM 处理 → `git write` → push GitHub
2. 笔记本端 `git pull`，验证 Obsidian 显示正确
3. 手机端同步，验证多端一致
4. 测试 OpenClaw IM 查询（`wiki_search`）响应

### 第三阶段：自动化（工作日）

1. 配置 cron job 定时同步
2. 配置移动端 Obsidian Git 插件
3. ChromaDB 索引初始化
4. 文档记录和 Git commit

---

## 11. 与 MEMORY.md 的边界

| 内容类型 | 存储位置 | 说明 |
|----------|----------|------|
| 外部知识（文章/笔记/读书） | **Obsidian vault** | 第二大脑主库 |
| Agent 运行记忆（会话/决策/偏好） | **MEMORY.md** | Agent 内部状态 |
| 系统配置与实施日志 | **workspace-*/MEMORY.md** | 各 Agent 独立记忆 |
| 用户画像与长期偏好 | **.private/ccprofile.md** | 高度机密隔离区 |

**原则**：Obsidian 是春哥的"外部知识大脑"，MEMORY.md 是 Agent 的"内部工作记忆"，两者通过 OpenClaw 桥接但不混用。

---

## 12. 参考文档

- 飞书文档获取：`feishu_fetch_doc` 工具
- OpenClaw git 操作：标准 `exec` 工具
- Obsidian Git 插件：社区插件，支持定时 push/pull
- ChromaDB：[https://docs.trychroma.com/](https://docs.trychroma.com/)

---

_最后更新：2026-04-09 by chief-of-staff_
