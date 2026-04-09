# 存储策略详细说明

> **版本**：v0.1  
> **日期**：2026-04-09  
> **状态**：待实施  

---

## 1. 存储架构概览

```
┌─────────────────────────────────────────────────────────┐
│                  OpenClaw 服务器                         │
│              (/home/admin/.openclaw/)                    │
│                                                          │
│  ┌─────────────────┐    ┌─────────────────┐             │
│  │ wiki/main/raw/  │    │  /tmp 中转缓存  │             │
│  │ (只写镜像)      │    │ (临时, TTL=24h) │             │
│  └────────┬────────┘    └────────┬────────┘             │
│           │                      │                        │
│           │ 定期清理             │ 定期清理              │
│           ↓                      ↓                       │
│  ┌─────────────────────────────────────────┐           │
│  │     LLM 处理管道 (内存内)                │           │
│  └────────┬────────────────────────────────┘           │
│           ↓                                              │
│  ┌────────────────┐    ┌────────────────┐             │
│  │ GitHub Push    │    │ ChromaDB 索引   │             │
│  │ (直接写入)     │    │ (KB 级向量)     │             │
│  └───────┬────────┘    └────────────────┘             │
└──────────┼────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│               GitHub Private Repo                      │
│            (obsidian-vault)                            │
│                                                          │
│  ┌─────────────────────────────────────────┐           │
│  │ /home/admin/obsidian-vault/              │           │
│  │ ├── raw/ (原始文章)                      │           │
│  │ ├── wiki/ (结构化知识)                   │           │
│  │ └── _attachments/ (本地附件)             │           │
│  └─────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
           ↓ Git Sync
    ┌──────┴──────┐
    ↓             ↓
  笔记本       手机
 Obsidian    Obsidian
```

---

## 2. 存储分配详情

### 2.1 OpenClaw 服务器

| 内容 | 路径 | 大小预估 | TTL | 说明 |
|------|------|----------|-----|------|
| Wiki 只写镜像 | `~/.openclaw/wiki/main/raw/` | < 50 MB | 持久 | 供 OpenClaw 内部读取 |
| 临时缓存 | `/tmp/feishu-sync-cache/` | < 100 MB | 24h | 同步过程中转 |
| ChromaDB 索引 | `~/.openclaw/wiki/vector/` | < 5 MB | 持久 | 向量+摘要 |
| 同步脚本 | `~/.openclaw/scripts/` | < 50 KB | 持久 | 脚本文件 |

**磁盘占用合计**：< 160 MB

### 2.2 Obsidian Vault（GitHub）

| 内容 | 路径 | 大小预估 | 说明 |
|------|------|----------|------|
| 原始文章 | `raw/` | 随时间增长 | 飞书导入的 MD 文件 |
| 结构化知识 | `wiki/` | 随时间增长 | 整理后的笔记 |
| 本地附件 | `_attachments/` | .gitignore 排除 | 不同步到 Git |
| 脚本 | `.scripts/` | < 50 KB | 同步脚本 |

**磁盘占用合计**：随使用增长，预计初期 50-200 MB

### 2.3 设备本地

| 设备 | 路径 | 大小预估 | 说明 |
|------|------|----------|------|
| 笔记本 | 本地 Obsidian vault | 同 GitHub | Git sync |
| 手机 | 本地 Obsidian vault | 同 GitHub | Obsidian Git 插件 |

---

## 3. 文件流转规则

### 3.1 飞书文档同步流程

```
1. 飞书 Wiki 新增/更新文档
        ↓
2. OpenClaw cron 触发同步脚本
        ↓
3. feishu_fetch_doc 获取文档内容
        ↓
4. LLM 处理（内存内，不落盘）
        ↓
5. 生成带 frontmatter 的 Markdown
        ↓
6. 直接写入 vault/raw/{feishu_token}.md
        ↓
7. Git add + commit + push
        ↓
8. 更新 last_sync_timestamp
        ↓
9. 清理 /tmp 缓存（TTL 24h）
```

### 3.2 多端同步流程

```
1. 任何设备修改 vault
        ↓
2. Obsidian Git 插件检测变更
        ↓
3. 定时/手动 git push
        ↓
4. 其他设备 git pull
        ↓
5. Obsidian 刷新本地库
```

---

## 4. 增量同步策略

### 4.1 时间戳增量

```python
# 伪代码
last_sync = 读取 last_sync_timestamp

for node in fetch_wiki_nodes():
    if node.updated_at > last_sync:
        sync(node)
    else:
        skip(node)

更新 last_sync_timestamp
```

### 4.2 变更检测

```python
# 对比本地文件与飞书文档的 modified_at
local_mtime = os.path.getmtime(vault_file)
remote_modified = node.updated_at

if remote_modified > local_mtime:
    sync(node)  # 远程更新，更新本地
else:
    skip(node)
```

---

## 5. .gitignore 规则

```
# 附件（不跟踪大文件）
_attachments/

# 临时文件
tmp/
*.tmp
*.swp

# Obsidian 工作文件
.trash/

# 大型媒体文件
*.zip
*.tar.gz
*.pdf
*.mp4

# OS 临时文件
.DS_Store
Thumbs.db
```

---

## 6. 备份与恢复

### 6.1 备份策略

| 内容 | 备份方式 | 频率 |
|------|----------|------|
| Obsidian vault | GitHub 自动版本控制 | 每次 commit |
| OpenClaw 配置 | backup_openclaw_config.sh | 每周 |
| 临时缓存 | TTL=24h 自动清理 | 无需备份 |

### 6.2 恢复流程

```bash
# 恢复 Obsidian vault
git clone git@github.com:your-username/obsidian-vault.git
cd obsidian-vault
git checkout <commit-hash>  # 可选，恢复到特定版本
```

---

## 7. 磁盘监控

### 7.1 监控阈值

| 指标 | 警告阈值 | 紧急阈值 |
|------|----------|----------|
| /tmp 缓存 | > 50 MB | > 100 MB |
| OpenClaw wiki 镜像 | > 50 MB | > 80 MB |
| ChromaDB 索引 | > 10 MB | > 20 MB |

### 7.2 清理策略

```bash
# 清理 24h+ 的临时文件
find /tmp/feishu-sync-cache -mtime +1 -delete

# 清理 OpenClaw wiki 镜像（保留最近 7 天）
find ~/.openclaw/wiki/main/raw -mtime +7 -delete
```

---

_最后更新：2026-04-09 by chief-of-staff_
