# Wiki Git 自动同步 Cron 任务配置

> **目的**: 每 15 分钟自动 Pull/Push，保持服务器与 GitHub 同步  
> **仓库**: git@github.com:All4worldjz/MySiBuddy-Wiki.git

---

## 任务设计

### 1. Wiki Git 自动同步（每 15 分钟）

**功能：**
- `git pull --rebase` 拉取最新内容
- `git add .` 添加更改
- `git commit -m "自动同步 Wiki"` 提交（如果有更改）
- `git push` 推送到 GitHub

**Schedule:** `*/15 * * * *`

**Agent:** `coder-hub`

### 2. Wiki 健康检查（每天 06:00）

**功能：**
- 执行 `openclaw wiki lint`
- 生成健康报告
- 通过 Telegram 通知

**Schedule:** `0 6 * * *`

**Agent:** `tech-mentor`

### 3. Wiki 自动编译（每 1 小时）

**功能：**
- 扫描 `raw/` 新文档
- 执行 `openclaw wiki ingest`（如有新文档）
- 执行 `openclaw wiki compile`
- Git 自动同步

**Schedule:** `0 * * * *`

**Agent:** `coder-hub`

---

## 实施步骤

### 方式 A：使用 OpenClaw Cron（推荐）

通过 `openclaw cron add` 命令添加任务。

### 方式 B：使用系统 Crontab

```bash
crontab -e

# 添加以下行
*/15 * * * * cd /home/admin/.openclaw/wiki/main && git pull --rebase origin main && git add . && git diff --cached --quiet || git commit -m "自动同步 Wiki" && git push origin main >> /home/admin/.openclaw/logs/wiki-git-sync.log 2>&1
0 * * * * cd /home/admin/.openclaw/wiki/main && openclaw wiki compile >> /home/admin/.openclaw/logs/wiki-compile.log 2>&1
```

---

**文档版本**: v1.0  
**最后更新**: 2026-04-09
