#!/bin/bash
# ============================================================================
# feishu_delete_folder.sh - 飞书文件夹/文件删除脚本（带安全策略）
# ============================================================================
# 用法:
#   ./feishu_delete_folder.sh --token <token> --type <folder|file> [选项]
#
# 选项:
#   --token <token>       要删除的文件夹/文件 token (必填)
#   --type <type>         类型: folder 或 file (默认: folder)
#   --dry-run             预览模式，显示将执行的操作但不实际执行
#   --force               跳过交互式确认
#   --permanent           永久删除（跳过回收站，不可恢复）
#
# 功能:
#   - 受保护文件夹检查（防止误删关键文件夹）
#   - 软删除优先（移至回收站，30天后自动清理）
#   - 内容清单显示（级联删除警告）
#   - 交互式确认 / --force 模式
#   - 审计日志记录
#
# 退出码:
#   0 - 操作成功
#   1 - 参数错误 / API 错误
#   2 - 目标不存在
#   3 - 受保护对象，拒绝删除
#   4 - 需要确认但未提供 --force
#   5 - 用户取消 / 超时
#   6 - 无法定位回收站
# ============================================================================

set -euo pipefail

# 加载共享安全策略库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"
GUARDRAILS_FILE="${LIB_DIR}/feishu_drive_guardrails.sh"

if [ -f "$GUARDRAILS_FILE" ]; then
  source "$GUARDRAILS_FILE"
else
  REMOTE_LIB="/home/admin/.openclaw/scripts/lib/feishu_drive_guardrails.sh"
  if [ -f "$REMOTE_LIB" ]; then
    source "$REMOTE_LIB"
  else
    echo "⚠️  警告: 未找到安全策略库，使用基础模式..."
  fi
fi

# ============================================================================
# 参数解析
# ============================================================================

TARGET_TOKEN=""
TARGET_TYPE="folder"
DRY_RUN=false
FORCE=false
PERMANENT=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      TARGET_TOKEN="$2"
      shift 2
      ;;
    --type)
      TARGET_TYPE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --permanent)
      PERMANENT=true
      shift
      ;;
    --help|-h)
      echo "用法: $0 --token <token> [--type folder|file] [--dry-run] [--force] [--permanent]"
      echo ""
      echo "选项:"
      echo "  --token <token>       要删除的文件夹/文件 token"
      echo "  --type <type>         类型: folder 或 file (默认: folder)"
      echo "  --dry-run             预览模式"
      echo "  --force               跳过交互式确认"
      echo "  --permanent           永久删除（跳过回收站）"
      exit 0
      ;;
    *)
      echo "❌ 未知参数: $1"
      exit 1
      ;;
  esac
done

if [ -z "$TARGET_TOKEN" ]; then
  echo "❌ 错误: 必须指定 --token 参数"
  echo ""
  echo "用法: $0 --token <token> [--type folder|file] [--dry-run] [--force] [--permanent]"
  exit 1
fi

if [[ "$TARGET_TYPE" != "folder" && "$TARGET_TYPE" != "file" ]]; then
  echo "❌ 错误: --type 必须是 'folder' 或 'file'"
  exit 1
fi

# ============================================================================
# 初始化
# ============================================================================

if type init_drive_guardrails &>/dev/null; then
  init_drive_guardrails
fi

TENANT_TOKEN="${TENANT_TOKEN:-$(get_tenant_token 2>/dev/null)}"
if [ -z "$TENANT_TOKEN" ]; then
  echo "❌ 错误: 无法获取访问令牌"
  exit 1
fi

# ============================================================================
# 步骤1: 验证目标存在性
# ============================================================================

echo "🔍 正在验证目标对象..."
META_RESP=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/metas/batch_query" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"request_docs\":[{\"doc_token\":\"${TARGET_TOKEN}\",\"doc_type\":\"${TARGET_TYPE}\"}]}")

META_CODE=$(echo "$META_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

if [ "$META_CODE" != "0" ]; then
  echo "❌ 错误: 目标不存在或无权访问 (code: ${META_CODE})"
  echo "   Token: ${TARGET_TOKEN}"
  echo "   类型: ${TARGET_TYPE}"
  exit 2
fi

# 解析元信息
TARGET_INFO=$(echo "$META_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
metas = data.get('data', {}).get('metas', [])
if not metas:
    print('ERROR')
    sys.exit(1)
meta = metas[0]
# 注意：metas API 返回的是 title 而不是 name
print(f'NAME={meta.get(\"title\", meta.get(\"name\", \"Unknown\"))}')
print(f'TYPE={meta.get(\"doc_type\", meta.get(\"type\", \"unknown\"))}')
# parent_token 可能不在 metas 中，设为 Unknown
print(f'PARENT={meta.get(\"parent_token\", \"Unknown\")}')
" 2>/dev/null)

if echo "$TARGET_INFO" | grep -q "ERROR"; then
  echo "❌ 错误: 无法解析目标对象信息"
  exit 2
fi

eval "$TARGET_INFO"

echo "✅ 目标已验证:"
echo "   名称: ${NAME}"
echo "   类型: ${TYPE}"
echo "   Token: ${TARGET_TOKEN}"

# ============================================================================
# 步骤2: 受保护对象检查
# ============================================================================

if type is_folder_protected &>/dev/null; then
  echo ""
  echo "🛡️  检查受保护列表..."
  if is_folder_protected "$TARGET_TOKEN" "$NAME"; then
    echo "❌ 拒绝删除: '${NAME}' 在受保护列表中"
    echo "   Token: ${TARGET_TOKEN}"
    echo "   如需删除，请先从配置文件中移除保护: ${PROTECTED_CONFIG}"
    exit 3
  fi
  echo "   ✅ 不在受保护列表中"
fi

# ============================================================================
# 步骤3: 列出内容（仅文件夹）
# ============================================================================

CONTENTS_SUMMARY=""
CONTENTS_DETAIL=""

if [ "$TARGET_TYPE" = "folder" ]; then
  echo ""
  echo "📂 正在列出文件夹内容..."

  LIST_RESP=$(curl -s "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${TARGET_TOKEN}&page_size=200" \
    -H "Authorization: Bearer $TENANT_TOKEN")

  CONTENTS_SUMMARY=$(echo "$LIST_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
file_count = sum(1 for f in files if f.get('type') != 'folder')
folder_count = sum(1 for f in files if f.get('type') == 'folder')
print(f'{file_count} 个文件, {folder_count} 个子文件夹')

if files:
    print()
    print('详细内容:')
    for f in files[:20]:  # 最多显示20个
        icon = '📁' if f.get('type') == 'folder' else '📄'
        print(f'  {icon} {f.get(\"name\")}')
    if len(files) > 20:
        print(f'  ... 还有 {len(files) - 20} 个项目')
" 2>/dev/null)
fi

# ============================================================================
# 步骤4: 确保回收站存在（非永久删除模式）
# ============================================================================

if [ "$PERMANENT" = false ]; then
  echo ""
  echo "🔄 正在检查回收站..."
  if type ensure_recycle_bin_exists &>/dev/null; then
    if ! ensure_recycle_bin_exists "$TENANT_TOKEN"; then
      echo "❌ 无法定位或创建回收站，操作中止"
      exit 6
    fi
  else
    echo "⚠️  警告: 无法加载回收站管理功能"
    RECYCLE_BIN_TOKEN=""
  fi
fi

# ============================================================================
# 步骤5: 显示删除预览
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$PERMANENT" = true ]; then
  echo "⚠️  永久删除预览（不可恢复）"
else
  echo "🔄 软删除预览（移至回收站）"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 目标: ${NAME}"
echo "📂 类型: ${TYPE}"
echo "🔑 Token: ${TARGET_TOKEN}"
echo "📍 父目录: ${PARENT}"

if [ -n "$CONTENTS_SUMMARY" ]; then
  echo ""
  echo "📦 包含内容: ${CONTENTS_SUMMARY}"
fi

echo ""
if [ "$PERMANENT" = true ]; then
  echo "🗑️  操作: 永久删除（不可恢复）"
  echo "⏰ 警告: 此操作无法撤销！"
else
  echo "🔄 操作: 移动到回收站 (${RECYCLE_BIN_NAME})"
  echo "⏰ 自动清理: ${AUTO_CLEANUP_DAYS:-30} 天后"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# 步骤6: Dry-run 模式
# ============================================================================

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "✅ 预览模式完成，未执行实际操作"
  exit 0
fi

# ============================================================================
# 步骤7: 交互式确认
# ============================================================================

if [ "$FORCE" = false ]; then
  echo ""
  echo "⚠️  此操作不可逆！"
  if [ "$PERMANENT" = true ]; then
    echo "   永久删除后将无法恢复！"
  fi
  echo ""
  echo "如需继续，请输入 \"确认删除\"（60秒超时）:"

  read -t 60 -r CONFIRM_INPUT || {
    echo ""
    echo "⏰ 超时，操作已取消"
    exit 5
  }

  if [ "$CONFIRM_INPUT" != "确认删除" ]; then
    echo "❌ 输入不匹配，操作已取消"
    exit 5
  fi
fi

# ============================================================================
# 步骤8: 执行删除
# ============================================================================

echo ""
echo "⏳ 正在执行删除..."

if [ "$PERMANENT" = true ]; then
  # 永久删除
  DELETE_RESP=$(curl -s -X DELETE "https://open.feishu.cn/open-apis/drive/v1/files/${TARGET_TOKEN}?type=${TARGET_TYPE}" \
    -H "Authorization: Bearer $TENANT_TOKEN")

  DELETE_CODE=$(echo "$DELETE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

  if [ "$DELETE_CODE" != "0" ]; then
    echo "❌ 删除失败 (code: ${DELETE_CODE})"
    echo "   响应: ${DELETE_RESP}"
    exit 1
  fi

  echo "✅ 永久删除成功!"

  # 审计日志
  if type write_audit_log &>/dev/null; then
    write_audit_log "permanent_delete" "{\"name\":\"${NAME}\",\"token\":\"${TARGET_TOKEN}\",\"type\":\"${TYPE}\",\"parent\":\"${PARENT}\",\"contents\":\"${CONTENTS_SUMMARY}\"}"
  fi

else
  # 软删除：移动到回收站
  if [ -z "$RECYCLE_BIN_TOKEN" ]; then
    echo "❌ 回收站 token 为空，无法执行软删除"
    exit 6
  fi

  MOVE_RESP=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/files/${TARGET_TOKEN}/move?type=${TARGET_TYPE}" \
    -H "Authorization: Bearer $TENANT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"folder_token\":\"${RECYCLE_BIN_TOKEN}\"}")

  MOVE_CODE=$(echo "$MOVE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

  if [ "$MOVE_CODE" != "0" ]; then
    echo "❌ 移动到回收站失败 (code: ${MOVE_CODE})"
    echo "   响应: ${MOVE_RESP}"
    exit 1
  fi

  echo "✅ 已移动到回收站!"
  echo "   回收站: ${RECYCLE_BIN_NAME} (${RECYCLE_BIN_TOKEN})"
  echo "   自动清理: ${AUTO_CLEANUP_DAYS:-30} 天后"

  # 审计日志
  if type write_audit_log &>/dev/null; then
    write_audit_log "soft_delete" "{\"name\":\"${NAME}\",\"token\":\"${TARGET_TOKEN}\",\"type\":\"${TYPE}\",\"parent\":\"${PARENT}\",\"recycle_bin\":\"${RECYCLE_BIN_TOKEN}\",\"auto_cleanup_days\":${AUTO_CLEANUP_DAYS:-30}}"
  fi
fi

echo ""
echo "📝 审计日志: ${AUDIT_LOG_FILE}"
echo ""
echo "✅ 操作完成"
