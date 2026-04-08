#!/bin/bash
# 更新所有 Agent 的 MEMORY.md，添加飞书网盘操作规范

OPENCLAW_DIR="/home/admin/.openclaw"

# 飞书操作规范章节
FEISHU_OPS_SECTION='
---

## 飞书网盘安全操作规范（2026-04-08 强制执行）

> **详细文档**：`docs/feishu-drive-operations-guide.md`
> **配置文件**：`/home/admin/.openclaw/config/protected_folders.json`

### 🔒 受保护文件夹（禁止删除/移动）

| 名称 | Token | 说明 |
|------|-------|------|
| CC文件柜 | `RfSrf8oMYlMyQTdbW0ZcGSE1nNb` | CC个人文件柜 |
| 小春文件柜 | `Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd` | 共享工作目录 |
| 回收站 | `XcTHfLy7clpx51dBomLcvA7XnTf` | 软删除目标（30天自动清理） |
| 📁测试归档 | `TZa9f0KaQldDPXdDnX6cF3K7nme` | 测试文件夹存放处 |

### 📂 回收站机制

- **软删除**：文件移至回收站，30天后自动永久删除
- **恢复**：30天内可从飞书回收站恢复
- **永久删除**：`--permanent` 参数，不可恢复

### 🛠️ 操作脚本

**创建文件夹**：
```bash
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "<名称>" "<父token>"
```

**删除文件夹**：
```bash
# 预览（推荐先执行）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --dry-run

# 软删除到回收站
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --force

# 永久删除（不可恢复）
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --permanent --force
```

**移动文件夹**：
```bash
# 预览
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token <token> --dest <目标token> --dry-run

# 执行移动
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token <token> --dest <目标token> --force

# 移动并重命名
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token <token> --dest <目标token> --name "新名称" --force
```

### ⚠️ 强制规则

1. **删除操作必须上报**：任何删除操作必须上报 chief-of-staff → CC 批准
2. **先预览再执行**：删除/移动前必须先 `--dry-run` 确认
3. **禁止使用 upload**：`feishu_drive_file upload` 的 folder_token 参数有 bug
4. **受保护文件夹不可删除**：脚本会自动拒绝，需先修改配置

### 📝 审计日志

所有操作记录：`/home/admin/.openclaw/logs/feishu_drive_operations.log`
'

# Agent workspace 目录列表
WORKSPACES=(
    "workspace-chief"
    "workspace-work"
    "workspace-venture"
    "workspace-life"
    "workspace-product"
    "workspace-zh-scribe"
    "workspace-tech-mentor"
    "workspace-coder"
)

echo "📝 开始更新所有 Agent 的 MEMORY.md..."
echo ""

for ws in "${WORKSPACES[@]}"; do
    MEMORY_FILE="${OPENCLAW_DIR}/${ws}/MEMORY.md"
    
    if [ -f "$MEMORY_FILE" ]; then
        # 检查是否已有飞书操作规范章节
        if grep -q "飞书网盘安全操作规范" "$MEMORY_FILE"; then
            echo "⏭️  ${ws}/MEMORY.md 已包含规范，跳过"
        else
            # 备份原文件
            cp "$MEMORY_FILE" "${MEMORY_FILE}.bak-$(date +%Y%m%d%H%M%S)"
            
            # 添加规范章节
            echo "$FEISHU_OPS_SECTION" >> "$MEMORY_FILE"
            echo "✅ ${ws}/MEMORY.md 已更新"
        fi
    else
        echo "⚠️  ${ws}/MEMORY.md 不存在，跳过"
    fi
done

echo ""
echo "✅ 更新完成！"