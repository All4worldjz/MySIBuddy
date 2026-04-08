# 飞书网盘操作规范（2026-04-08）

> **适用范围：** 所有 Agent（chief-of-staff、work-hub、venture-hub、life-hub、product-studio、zh-scribe、tech-mentor、coder-hub）
> **强制执行：** 所有飞书网盘操作必须严格遵守本规范

---

## 一、受保护文件夹清单

### 🔒 绝对保护（禁止删除/移动）

| 名称 | Token | 说明 |
|------|-------|------|
| **CC文件柜** | `RfSrf8oMYlMyQTdbW0ZcGSE1nNb` | CC个人文件柜，包含战略、AI研究、个人事务等 |
| **小春文件柜** | `Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd` | chief-of-staff、work-hub、zh-scribe 共享工作目录 |
| **回收站** | `XcTHfLy7clpx51dBomLcvA7XnTf` | 软删除目标，位于CC文件柜下 |
| **📁测试归档** | `TZa9f0KaQldDPXdDnX6cF3K7nme` | 测试性质文件夹存放处 |

### ⚠️ 操作约束

- **创建**：允许在受保护文件夹内创建子文件夹（会显示警告提示）
- **移动**：禁止移动受保护文件夹本身；移动到受保护文件夹会显示警告
- **删除**：**绝对禁止**删除受保护文件夹，脚本会拒绝执行

---

## 二、回收站机制

### 回收站信息

- **名称**：回收站
- **Token**：`XcTHfLy7clpx51dBomLcvA7XnTf`
- **位置**：CC文件柜下
- **自动清理**：30天后飞书系统自动永久删除

### 软删除流程

```
删除操作 → 移动到回收站 → 30天保留期 → 自动永久删除
```

- 软删除的文件可在回收站中恢复
- 永久删除（`--permanent`）不可恢复

---

## 三、脚本使用指南

### 3.1 创建文件夹脚本

**脚本路径**：`/home/admin/.openclaw/scripts/feishu_create_folder.sh`

**用法**：
```bash
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "<文件夹名>" "<父文件夹token>"
```

**功能**：
- ✅ 重名检测（重名时拒绝创建）
- ✅ 受保护文件夹警告
- ✅ 审计日志记录
- ✅ 返回新文件夹 token

**示例**：
```bash
# 在小春文件柜下创建"项目文档"
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "项目文档" "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"

# 在测试归档下创建"测试2026"
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "测试2026" "TZa9f0KaQldDPXdDnX6cF3K7nme"
```

**退出码**：
| 码 | 含义 |
|----|------|
| 0 | 创建成功 |
| 1 | 参数错误/API错误 |
| 2 | 重名错误 |
| 3 | 违反安全策略 |

---

### 3.2 删除文件夹脚本

**脚本路径**：`/home/admin/.openclaw/scripts/feishu_delete_folder.sh`

**用法**：
```bash
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> [选项]
```

**选项**：
| 选项 | 说明 |
|------|------|
| `--token <token>` | 要删除的文件夹/文件 token（必填） |
| `--type <folder\|file>` | 类型，默认 folder |
| `--dry-run` | 预览模式，不实际执行 |
| `--force` | 跳过交互式确认 |
| `--permanent` | 永久删除（跳过回收站，不可恢复） |

**功能**：
- ✅ 受保护文件夹检查（拒绝删除受保护对象）
- ✅ 软删除优先（默认移至回收站）
- ✅ 内容清单显示（级联删除警告）
- ✅ 交互式确认（非 --force 模式）
- ✅ 审计日志记录

**示例**：
```bash
# 预览删除（推荐先执行）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token "xxx" --type folder --dry-run

# 软删除到回收站（需交互确认）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token "xxx" --type folder

# 软删除（跳过确认，用于脚本调用）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token "xxx" --type folder --force

# 永久删除（不可恢复，需交互确认）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token "xxx" --type folder --permanent
```

**退出码**：
| 码 | 含义 |
|----|------|
| 0 | 操作成功 |
| 1 | 参数错误/API错误 |
| 2 | 目标不存在 |
| 3 | 受保护对象，拒绝删除 |
| 4 | 需要确认但未提供 --force |
| 5 | 用户取消/超时 |
| 6 | 无法定位回收站 |

**⚠️ 重要提示**：
- 删除文件夹会**级联删除**所有子内容
- 软删除后30天内可从回收站恢复
- 永久删除不可恢复，需谨慎操作

---

### 3.3 移动文件夹脚本

**脚本路径**：`/home/admin/.openclaw/scripts/feishu_move_folder.sh`

**用法**：
```bash
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token <token> --dest <dest_token> [选项]
```

**选项**：
| 选项 | 说明 |
|------|------|
| `--token <token>` | 要移动的文件夹/文件 token（必填） |
| `--type <folder\|file>` | 类型，默认 folder |
| `--dest <token>` | 目标父文件夹 token（必填） |
| `--name <新名称>` | 移动后重命名（可选） |
| `--dry-run` | 预览模式 |
| `--force` | 跳过交互式确认 |

**功能**：
- ✅ 受保护文件夹检查（禁止移动受保护对象）
- ✅ 目标位置重名检测
- ✅ 源/目标验证
- ✅ 交互式确认
- ✅ 审计日志记录

**示例**：
```bash
# 预览移动
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token "xxx" --dest "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd" --dry-run

# 移动到小春文件柜
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token "xxx" --type folder --dest "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd" --force

# 移动并重命名
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token "xxx" --dest "TZa9f0KaQldDPXdDnX6cF3K7nme" --name "新名称" --force
```

**退出码**：
| 码 | 含义 |
|----|------|
| 0 | 移动成功 |
| 1 | 参数错误/API错误 |
| 2 | 源或目标不存在 |
| 3 | 受保护对象，拒绝移动 |
| 4 | 目标位置有重名 |
| 5 | 用户取消/超时 |

---

## 四、审批流程

### 需要审批的操作

1. **删除受保护文件夹**：禁止删除，需先从配置中移除保护
2. **永久删除（--permanent）**：建议向 CC 确认
3. **批量删除/移动**：建议向 chief-of-staff 报告

### 审批流程

```
Agent 提出请求 → chief-of-staff 审核 → CC 批准 → 执行操作
```

### 审计日志

所有操作记录在：`/home/admin/.openclaw/logs/feishu_drive_operations.log`

---

## 五、配置文件位置

| 文件 | 路径 |
|------|------|
| 受保护文件夹配置 | `/home/admin/.openclaw/config/protected_folders.json` |
| 安全策略库 | `/home/admin/.openclaw/scripts/lib/feishu_drive_guardrails.sh` |
| 审计日志 | `/home/admin/.openclaw/logs/feishu_drive_operations.log` |

---

## 六、快速参考

### 常用文件夹 Token

```
CC文件柜:      RfSrf8oMYlMyQTdbW0ZcGSE1nNb
小春文件柜:    Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd
测试归档:      TZa9f0KaQldDPXdDnX6cF3K7nme
回收站:        XcTHfLy7clpx51dBomLcvA7XnTf
```

### 快捷命令

```bash
# 创建文件夹
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "名称" "父token"

# 预览删除
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token "xxx" --dry-run

# 预览移动
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token "xxx" --dest "父token" --dry-run
```

---

**文档版本**：1.0.0
**更新日期**：2026-04-08
**维护者**：chief-of-staff