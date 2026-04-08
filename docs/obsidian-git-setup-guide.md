# Obsidian Git 同步配置指南

> **目的**: 在笔记本和手机端使用 Obsidian 浏览和编辑 LLM Wiki，自动与服务器同步  
> **仓库**: https://github.com/All4worldjz/MySiBuddy-Wiki  
> **服务器路径**: `~/.openclaw/wiki/main`

---

## 一、笔记本端配置（macOS/Windows/Linux）

### 步骤 1：克隆仓库

```bash
# 选择你喜欢的 Obsidian vault 存放位置
cd ~/Documents/Obsidian  # 或你选择的其他位置

# 克隆仓库
git clone git@github.com:All4worldjz/MySiBuddy-Wiki.git

# 验证
cd MySiBuddy-Wiki
ls -la
# 应该看到：AGENTS.md, raw/, wiki/
```

**如果没有配置 SSH 密钥：**

```bash
# 使用 HTTPS + Token 方式
git clone https://github.com/All4worldjz/MySiBuddy-Wiki.git
# 会提示输入用户名和密码（Token）
```

### 步骤 2：打开 Obsidian Vault

1. 打开 Obsidian
2. 点击 **Open folder as vault**
3. 选择 `~/Documents/Obsidian/MySiBuddy-Wiki` 文件夹
4. 点击 **Open**

### 步骤 3：安装 Obsidian Git 插件

1. 打开 **设置**（⌘, 或 Ctrl+,）
2. 左侧导航栏点击 **第三方插件**
3. 点击 **浏览**
4. 搜索 `Obsidian Git`
5. 点击 **Install**
6. 安装完成后，返回插件列表，**启用** 该插件

### 步骤 4：配置 Obsidian Git

打开 Obsidian Git 插件设置，配置如下：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **Commit message** | `{{date}} 自动同步` | 提交信息格式 |
| **Commit message on merge** | `{{date}} 合并同步` | 合并时提交信息 |
| **Auto save interval** | `5` 分钟 | 自动保存间隔 |
| **Auto pull interval** | `5` 分钟 | 自动拉取间隔 |
| **Auto commit after change** | ✅ 开启 | 文件变化后自动提交 |
| **Auto push** | ✅ 开启 | 自动推送（建议 15 分钟） |
| **Push on backup** | ✅ 开启 | 备份时推送 |
| **Pull before push** | ✅ 开启 | 推送前先拉取，避免冲突 |
| **Disable push** | ❌ 关闭 | 允许推送 |
| **Line Wrap** | ✅ 开启 | 自动换行 |
| **Show branch status bar** | ✅ 开启 | 底部状态栏显示分支状态 |
| **reloadUIAutomatically** | ✅ 开启 | 自动刷新 UI |

**或者手动编辑配置文件：**

打开 `.obsidian/plugins/obsidian-git/data.json`，粘贴以下内容：

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
  "refreshSourceControlViewAutomatically": true,
  "reloadUIAutomatically": true
}
```

### 步骤 5：配置 Obsidian 附件路径

1. 打开 **设置** → **文件与链接**
2. 配置以下项：

| 配置项 | 值 |
|--------|-----|
| **附件默认存放路径** | `raw/assets` |
| **附件格式** | `与笔记相同目录` |
| **自动更新内部链接** | ✅ 开启 |
| **使用 [[Wikilinks]]** | ✅ 开启 |

### 步骤 6：测试同步

```bash
# 在终端中
cd ~/Documents/Obsidian/MySiBuddy-Wiki

# 手动拉取最新内容
git pull

# 查看状态
git status

# 手动推送
git push
```

**在 Obsidian 中：**
1. 打开命令面板（⌘/Ctrl + P）
2. 输入 `Git: Pull` 执行拉取
3. 输入 `Git: Push` 执行推送
4. 输入 `Git: Commit all changes` 提交更改

---

## 二、手机端配置

### iOS（iPhone/iPad）

#### 方案 A：使用 Working Copy（推荐）

1. **安装 Working Copy**（App Store，付费）
2. **克隆仓库：**
   - 打开 Working Copy
   - 点击 **+** → **Clone**
   - URL: `git@github.com:All4worldjz/MySiBuddy-Wiki.git`
   - 认证：选择 SSH 密钥或 HTTPS Token
3. **在 Obsidian 中打开：**
   - 打开 Obsidian
   - 点击 **Open folder as vault**
   - 选择 Working Copy 中的 `MySiBuddy-Wiki` 文件夹
4. **安装 Obsidian Git 插件**（与笔记本相同步骤）
5. **配置自动同步**（与笔记本相同配置）

#### 方案 B：使用 iCloud 同步（简单但有限制）

1. **在笔记本上配置 iCloud 同步：**
   ```bash
   # 将仓库移动到 iCloud Drive
   mv ~/Documents/Obsidian/MySiBuddy-Wiki ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/
   ```
2. **在手机上：**
   - 打开 Obsidian
   - 选择 iCloud 中的 `MySiBuddy-Wiki` 文件夹
3. **注意：** iCloud 同步可能与 Git 冲突，建议仅用于浏览，编辑后手动在笔记本上 commit/push

### Android

#### 方案 A：使用 MGit + Obsidian

1. **安装 MGit**（F-Droid 或 Google Play）
2. **克隆仓库：**
   - 打开 MGit
   - 点击 **+** → **Clone**
   - URL: `git@github.com:All4worldjz/MySiBuddy-Wiki.git`
   - 选择本地存储路径
3. **在 Obsidian 中打开：**
   - 打开 Obsidian
   - 选择 MGit 克隆的文件夹
4. **安装 Obsidian Git 插件**（如果 Android 版支持）

#### 方案 B：使用文件夹同步

1. 使用 **Syncthing** 或 **Resilio Sync** 同步文件夹到手机
2. 在 Obsidian 中打开同步的文件夹
3. 注意：此方式不直接使用 Git，需要手动同步

---

## 三、日常工作流

### 场景 1：在笔记本上浏览 Wiki

```
1. 打开 Obsidian
2. 等待自动 Pull（5 分钟间隔）
3. 浏览 wiki/index.md
4. 点击 [[wikilink]] 跳转页面
5. 使用 Graph View 查看知识图谱
```

### 场景 2：在手机端查询

```
1. 打开 Obsidian Mobile
2. 等待自动同步
3. 搜索关键词
4. 浏览相关页面（离线可用）
```

### 场景 3：手动添加原始文档

```
1. 在笔记本上，将新文章保存到 raw/articles/
2. Obsidian Git 自动 commit & push
3. 服务器自动 pull（通过 cron 或手动）
4. LLM 自动编译到 wiki/
```

---

## 四、故障排查

### 问题 1：Git Pull/Push 失败

```bash
# 检查 SSH 连接
ssh -T git@github.com

# 检查远程仓库
git remote -v

# 强制拉取（谨慎使用）
git fetch --all
git reset --hard origin/main
```

### 问题 2：Obsidian Git 插件不工作

1. 检查插件是否启用
2. 检查配置文件 `.obsidian/plugins/obsidian-git/data.json`
3. 重启 Obsidian
4. 查看控制台日志（开发者工具）

### 问题 3：同步冲突

```bash
# 查看冲突文件
git status

# 手动解决冲突
# 编辑冲突文件，删除冲突标记，保存

# 标记为已解决
git add <冲突文件>
git commit -m "解决同步冲突"
git push
```

### 问题 4：附件未显示

1. 检查 **设置** → **文件与链接** → **附件默认存放路径** 是否为 `raw/assets`
2. 检查 `raw/assets/` 目录是否存在
3. 重新链接附件

---

## 五、推荐 Obsidian 插件

### 核心插件

| 插件 | 用途 | 安装 |
|------|------|------|
| **Obsidian Git** | 自动同步 | 必装 |
| **Dataview** | 基于 Frontmatter 动态查询 | 推荐 |
| **Templates** | 页面模板 | 推荐 |
| **QuickAdd** | 快速灌入文档 | 可选 |

### 主题

| 主题 | 特点 |
|------|------|
| **Minimal** | 简洁现代 |
| **Things** | 美观大方 |

### CSS 片段（可选）

创建 `.obsidian/snippets/wiki-enhancements.css`：

```css
/* 高亮 Wikilink */
.internal-link {
  color: #7c3aed;
  text-decoration: none;
}

/* Frontmatter 美化 */
.frontmatter-container {
  background: var(--background-secondary);
  border-radius: 8px;
  padding: 12px;
}
```

然后在 **设置** → **外观** → **CSS 代码片段** 中启用。

---

## 六、服务器端 Git 自动同步配置（可选）

如果你希望服务器自动 Pull 最新内容：

```bash
# 在服务器上创建 cron 任务
crontab -e

# 添加以下行（每 5 分钟 pull 一次）
*/5 * * * * cd /home/admin/.openclaw/wiki/main && git pull --rebase origin main >> /home/admin/.openclaw/logs/wiki-git-sync.log 2>&1
```

**或者使用 OpenClaw cron 任务（推荐）：**

后续会通过 OpenClaw 配置自动同步任务。

---

**文档版本**: v1.0  
**最后更新**: 2026-04-09  
**维护者**: tech-mentor (大师)
