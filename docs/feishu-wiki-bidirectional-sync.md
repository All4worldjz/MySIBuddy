# 飞书 KM-Vault ↔ Wiki 双向同步方案

> **目的**: 保持飞书 KM-Vault 与本地 Wiki 的双向知识同步  
> **飞书 KM-Vault**: https://pbrhmf5bin.feishu.cn/drive/folder/QB50fa4HYlYPCRd5Q8Cck6MMnvf  
> **本地 Wiki**: `~/.openclaw/wiki/main`

---

## 一、同步架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    双向知识同步                                    │
│                                                                  │
│  飞书 KM-Vault                          本地 Wiki Vault          │
│  QB50fa4HYlYPCRd5Q8Cck6MMnvf    ↔     ~/.openclaw/wiki/main     │
│  ├── 团队协作文档                        ├── raw/articles/        │
│  ├── 业务资料                            ├── wiki/                │
│  └── 知识沉淀                            └── AGENTS.md            │
│                                                                  │
│  同步方向：                                                       │
│  1. 飞书 → Wiki（每 6 小时）                                     │
│     - 导出飞书新文档到 raw/articles/                              │
│     - 自动触发 Wiki 编译                                         │
│     - Git 自动同步到 GitHub                                      │
│                                                                  │
│  2. Wiki → 飞书（每天 03:00）                                    │
│     - 将 wiki/ 编译结果镜像到飞书                                 │
│     - 创建"Wiki 知识库镜像"文件夹                                 │
│     - 只读镜像，用于团队访问                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、同步脚本

### 1. 飞书 → Wiki 同步

**脚本路径**: `/home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh`

**功能**:
- 从飞书 KM-Vault 文件夹获取文档列表
- 下载文档内容为 Markdown
- 保存到 `raw/articles/` 目录
- 添加 Frontmatter（来源、同步时间等）
- 触发 `openclaw wiki compile`
- Git 提交并推送

**增量同步**:
- 记录上次同步时间
- 只下载修改时间晚于上次同步的文档
- 避免重复处理

**Cron 配置**:
```cron
# 每 6 小时执行一次
0 */6 * * * bash /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh
```

**日志路径**: `/home/admin/.openclaw/logs/feishu-to-wiki-sync.log`

### 2. Wiki → 飞书同步

**脚本路径**: `/home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh`

**功能**:
- 扫描 `wiki/` 目录下所有 Markdown 页面
- 在飞书创建"Wiki 知识库镜像"文件夹
- 将每个 Wiki 页面创建为飞书文档
- 保持目录结构与本地一致

**Cron 配置**:
```cron
# 每天凌晨 3:00 执行
0 3 * * * bash /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh
```

**日志路径**: `/home/admin/.openclaw/logs/wiki-to-feishu-sync.log`

---

## 三、工作流程

### 场景 1：团队成员在飞书创建文档

```
1. 团队成员在飞书 KM-Vault 创建/编辑文档
2. 等待最多 6 小时（或手动触发脚本）
3. 脚本自动：
   - 检测新文档
   - 下载为 Markdown
   - 保存到 raw/articles/
   - 触发 Wiki 编译
   - 更新 wiki/ 页面
   - Git 同步到 GitHub
4. 你的 Obsidian 自动拉取最新内容（15 分钟间隔）
```

### 场景 2：本地 Wiki 编译完成

```
1. LLM 自动编译 raw/ 中的文档
2. 生成 wiki/entities/、wiki/concepts/ 等页面
3. 每天 03:00 脚本将编译结果镜像到飞书
4. 团队成员可在飞书浏览 Wiki 知识库
```

### 场景 3：手动触发同步

```bash
# 飞书 → Wiki
bash /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh

# Wiki → 飞书
bash /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh

# 查看日志
tail -f /home/admin/.openclaw/logs/feishu-to-wiki-sync.log
tail -f /home/admin/.openclaw/logs/wiki-to-feishu-sync.log
```

---

## 四、配置说明

### 飞书凭证

脚本从 `runtime-secrets.json` 读取飞书凭证：

```json
{
  "lark": {
    "work": {
      "appId": "cli_xxx",
      "appSecret": "xxx"
    }
  }
}
```

### 同步配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| KM-Vault Token | `QB50fa4HYlYPCRd5Q8Cck6MMnvf` | 飞书知识库文件夹 |
| Wiki Raw 目录 | `~/.openclaw/wiki/main/raw/articles` | 原始资料层 |
| Wiki 目录 | `~/.openclaw/wiki/main/wiki` | 编译后的知识层 |
| 飞书同步频率 | 每 6 小时 | 可根据需要调整 |
| 飞书镜像频率 | 每天 03:00 | 建议低频，避免 API 限流 |

---

## 五、故障排查

### 问题 1：飞书认证失败

```bash
# 检查 runtime-secrets.json
cat /home/admin/.openclaw/runtime-secrets.json | jq '.lark.work'

# 手动获取 tenant token
curl -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d '{"app_id": "cli_xxx", "app_secret": "xxx"}'
```

### 问题 2：API 限流

飞书 API 有调用频率限制。如果遇到限流错误：

- 降低同步频率（如从每 6 小时改为每 12 小时）
- 添加指数退避重试逻辑
- 联系飞书管理员提升 API 配额

### 问题 3：文档下载为空

- 检查飞书应用是否有文档访问权限
- 确认文档类型为 `docx` 或 `doc`
- 检查日志中的错误信息

---

## 六、完整 Cron 任务列表

```bash
# 查看当前所有 cron 任务
crontab -l
```

**预期输出**:

```cron
# AI News Hub
0 8 * * * /home/admin/ai-news-hub/cron.sh

# Wiki Git 自动同步 - 每 15 分钟
*/15 * * * * cd /home/admin/.openclaw/wiki/main && git pull --rebase origin main >> /home/admin/.openclaw/logs/wiki-git-sync.log 2>&1 && git add . && git diff --cached --quiet || (git commit -m "自动同步 Wiki" && git push origin main >> /home/admin/.openclaw/logs/wiki-git-sync.log 2>&1)

# ===== Wiki 同步任务 =====
# 飞书 → Wiki（每 6 小时）
0 */6 * * * bash /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh
# Wiki → 飞书（每天 03:00）
0 3 * * * bash /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh
```

---

## 七、OpenClaw Cron 任务（可选）

除了系统 Cron，还可以使用 OpenClaw 内置的 cron 功能：

```bash
# 查看 OpenClaw cron 任务
openclaw cron list

# 添加飞书同步任务
openclaw cron add --name "飞书 → Wiki 同步" --schedule "0 */6 * * *" --agent coder-hub --command "bash /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh"

# 添加 Wiki 镜像任务
openclaw cron add --name "Wiki → 飞书镜像" --schedule "0 3 * * *" --agent coder-hub --command "bash /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh"
```

---

**文档版本**: v1.0  
**最后更新**: 2026-04-09  
**维护者**: tech-mentor (大师)
