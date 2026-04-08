#!/bin/bash
# ============================================================================
# feishu_move_folder.sh - 飞书文件夹/文件移动脚本（带安全策略）
# ============================================================================
# 用法:
#   ./feishu_move_folder.sh --token <token> --dest <dest_token> [选项]
#
# 选项:
#   --token <token>       要移动的文件夹/文件 token (必填)
#   --type <type>         类型: folder 或 file (默认: folder)
#   --dest <token>        目标父文件夹 token (必填)
#   --name <new_name>     移动后的新名称（可选，保持原名则不指定）
#   --dry-run             预览模式
#   --force               跳过交互式确认
#
# 功能:
#   - 受保护文件夹检查（防止移动关键文件夹）
#   - 目标位置重名检测
#   - 源/目标验证
#   - 交互式确认 / --force 模式
#   - 审计日志记录
#
# 退出码:
#   0 - 移动成功
#   1 - 参数错误 / API 错误
#   2 - 源或目标不存在
#   3 - 受保护对象，拒绝移动
#   4 - 目标位置有重名
#   5 - 用户取消 / 超时
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

SOURCE_TOKEN=""
SOURCE_TYPE="folder"
DEST_TOKEN=""
NEW_NAME=""
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      SOURCE_TOKEN="$2"
      shift 2
      ;;
    --type)
      SOURCE_TYPE="$2"
      shift 2
      ;;
    --dest)
      DEST_TOKEN="$2"
      shift 2
      ;;
    --name)
      NEW_NAME="$2"
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
    --help|-h)
      echo "用法: $0 --token <token> [--type folder|file] --dest <dest_token> [--name <new_name>] [--dry-run] [--force]"
      echo ""
      echo "选项:"
      echo "  --token <token>       要移动的文件夹/文件 token"
      echo "  --type <type>         类型: folder 或 file (默认: folder)"
      echo "  --dest <token>        目标父文件夹 token"
      echo "  --name <new_name>     移动后的新名称（可选）"
      echo "  --dry-run             预览模式"
      echo "  --force               跳过交互式确认"
      echo ""
      echo "受保护的目标文件夹（允许移动到此位置）:"
      echo "  - CC文件柜 (RfSrf8oMYlMyQTdbW0ZcGSE1nNb)"
      echo "  - 小春文件柜 (Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd)"
      echo "  - 回收站 (软删除目标)"
      exit 0
      ;;
    *)
      echo "❌ 未知参数: $1"
      exit 1
      ;;
  esac
done

if [ -z "$SOURCE_TOKEN" ] || [ -z "$DEST_TOKEN" ]; then
  echo "❌ 错误: 必须指定 --token 和 --dest 参数"
  echo ""
  echo "用法: $0 --token <token> [--type folder|file] --dest <dest_token> [--name <new_name>] [--dry-run] [--force]"
  exit 1
fi

if [[ "$SOURCE_TYPE" != "folder" && "$SOURCE_TYPE" != "file" ]]; then
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
# 步骤1: 验证源对象存在性
# ============================================================================

echo "🔍 正在验证源对象..."
SRC_META_RESP=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/metas/batch_query" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"request_docs\":[{\"doc_token\":\"${SOURCE_TOKEN}\",\"doc_type\":\"${SOURCE_TYPE}\"}]}")

SRC_META_CODE=$(echo "$SRC_META_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

if [ "$SRC_META_CODE" != "0" ]; then
  echo "❌ 错误: 源对象不存在或无权访问 (code: ${SRC_META_CODE})"
  echo "   Token: ${SOURCE_TOKEN}"
  exit 2
fi

# 解析源对象信息
SRC_INFO=$(echo "$SRC_META_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
metas = data.get('data', {}).get('metas', [])
if not metas:
    print('ERROR')
    sys.exit(1)
meta = metas[0]
print(f'SRC_NAME={meta.get(\"title\", meta.get(\"name\", \"Unknown\"))}')
print(f'SRC_TYPE={meta.get(\"doc_type\", meta.get(\"type\", \"unknown\"))}')
print(f'SRC_PARENT={meta.get(\"parent_token\", \"Unknown\")}')
" 2>/dev/null)

if echo "$SRC_INFO" | grep -q "ERROR"; then
  echo "❌ 错误: 无法解析源对象信息"
  exit 2
fi

eval "$SRC_INFO"

echo "✅ 源对象已验证:"
echo "   名称: ${SRC_NAME}"
echo "   类型: ${SRC_TYPE}"
echo "   Token: ${SOURCE_TOKEN}"
echo "   当前父目录: ${SRC_PARENT}"

# ============================================================================
# 步骤2: 验证目标文件夹存在性
# ============================================================================

echo ""
echo "🔍 正在验证目标文件夹..."
DEST_META_RESP=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/metas/batch_query" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"request_docs\":[{\"doc_token\":\"${DEST_TOKEN}\",\"doc_type\":\"folder\"}]}")

DEST_META_CODE=$(echo "$DEST_META_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

if [ "$DEST_META_CODE" != "0" ]; then
  echo "❌ 错误: 目标文件夹不存在或无权访问 (code: ${DEST_META_CODE})"
  echo "   Token: ${DEST_TOKEN}"
  exit 2
fi

DEST_INFO=$(echo "$DEST_META_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
metas = data.get('data', {}).get('metas', [])
if not metas:
    print('ERROR')
    sys.exit(1)
meta = metas[0]
print(f'DEST_NAME={meta.get(\"title\", meta.get(\"name\", \"Unknown\"))}')
" 2>/dev/null)

if echo "$DEST_INFO" | grep -q "ERROR"; then
  echo "❌ 错误: 无法解析目标文件夹信息"
  exit 2
fi

eval "$DEST_INFO"

echo "✅ 目标文件夹已验证:"
echo "   名称: ${DEST_NAME}"
echo "   Token: ${DEST_TOKEN}"

# ============================================================================
# 步骤3: 受保护对象检查
# ============================================================================

if type is_folder_protected &>/dev/null; then
  echo ""
  echo "🛡️  检查受保护列表..."

  # 检查源对象
  if is_folder_protected "$SOURCE_TOKEN" "$SRC_NAME"; then
    echo "❌ 拒绝移动: 源对象 '${SRC_NAME}' 在受保护列表中"
    echo "   Token: ${SOURCE_TOKEN}"
    echo "   如需移动，请先从配置文件中移除保护: ${PROTECTED_CONFIG}"
    exit 3
  fi

  # 检查目标文件夹（允许移动到受保护文件夹，但给出提示）
  if is_folder_protected "$DEST_TOKEN" "$DEST_NAME"; then
    echo "   ⚠️  注意: 目标文件夹 '${DEST_NAME}' 在受保护列表中"
  fi

  echo "   ✅ 源对象不在受保护列表中"
fi

# ============================================================================
# 步骤4: 目标位置重名检测
# ============================================================================

echo ""
echo "🔍 检查目标位置是否已有同名对象..."

TARGET_NAME="${NEW_NAME:-$SRC_NAME}"

DEST_LIST_RESP=$(curl -s "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${DEST_TOKEN}&page_size=200" \
  -H "Authorization: Bearer $TENANT_TOKEN")

DUPLICATE_CHECK=$(echo "$DEST_LIST_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
target_name = '${TARGET_NAME}'
duplicates = [f for f in files if f.get('name') == target_name]
if duplicates:
    print('DUPLICATE')
    for d in duplicates:
        icon = '📁' if d.get('type') == 'folder' else '📄'
        print(f'{icon} {d.get(\"name\")} (token: {d.get(\"token\")}, type: {d.get(\"type\")})')
else:
    print('OK')
" 2>/dev/null)

if echo "$DUPLICATE_CHECK" | grep -q "DUPLICATE"; then
  echo "❌ 重名错误: 目标文件夹中已存在同名对象 '${TARGET_NAME}'"
  echo ""
  echo "已存在的对象:"
  echo "$DUPLICATE_CHECK" | grep -v "^DUPLICATE$"
  echo ""
  echo "建议:"
  echo "  1. 使用 --name 参数指定新名称"
  echo "  2. 删除或移动现有对象"
  echo "  3. 选择其他目标文件夹"
  exit 4
fi

echo "   ✅ 目标位置无重名"

# ============================================================================
# 步骤5: 显示移动预览
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 移动操作预览"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 源对象: ${SRC_NAME}"
echo "📂 类型: ${SRC_TYPE}"
echo "🔑 Token: ${SOURCE_TOKEN}"
echo "📍 当前父目录: ${SRC_PARENT}"
echo ""
echo "📁 目标文件夹: ${DEST_NAME}"
echo "🔑 Token: ${DEST_TOKEN}"

if [ -n "$NEW_NAME" ]; then
  echo "🏷️  新名称: ${NEW_NAME}"
else
  echo "🏷️  名称: 保持不变 (${SRC_NAME})"
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
  echo "⚠️  即将移动对象及其所有子内容（如果是文件夹）"
  echo ""
  echo "如需继续，请输入 \"确认移动\"（60秒超时）:"

  read -t 60 -r CONFIRM_INPUT || {
    echo ""
    echo "⏰ 超时，操作已取消"
    exit 5
  }

  if [ "$CONFIRM_INPUT" != "确认移动" ]; then
    echo "❌ 输入不匹配，操作已取消"
    exit 5
  fi
fi

# ============================================================================
# 步骤8: 执行移动
# ============================================================================

echo ""
echo "⏳ 正在执行移动..."

MOVE_URL="https://open.feishu.cn/open-apis/drive/v1/files/${SOURCE_TOKEN}/move?type=${SOURCE_TYPE}"

# 构建请求体
MOVE_BODY="{\"folder_token\":\"${DEST_TOKEN}\"}"
if [ -n "$NEW_NAME" ]; then
  MOVE_BODY="{\"folder_token\":\"${DEST_TOKEN}\",\"name\":\"${NEW_NAME}\"}"
fi

MOVE_RESP=$(curl -s -X POST "$MOVE_URL" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$MOVE_BODY")

MOVE_CODE=$(echo "$MOVE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

if [ "$MOVE_CODE" != "0" ]; then
  echo "❌ 移动失败 (code: ${MOVE_CODE})"
  echo "   响应: ${MOVE_RESP}"
  exit 1
fi

# 解析响应
MOVED_INFO=$(echo "$MOVE_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
d = data.get('data', {})
print(f'NEW_NAME={d.get(\"name\", \"Unknown\")}')
print(f'NEW_URL={d.get(\"url\", \"\")}')
" 2>/dev/null)

eval "$MOVED_INFO"

echo "✅ 移动成功!"
echo "   名称: ${NEW_NAME:-$SRC_NAME}"
echo "   新父目录: ${DEST_NAME}"
echo "   URL: ${NEW_URL}"

# ============================================================================
# 步骤9: 审计日志
# ============================================================================

if type write_audit_log &>/dev/null; then
  write_audit_log "move" "{\"source_name\":\"${SRC_NAME}\",\"source_token\":\"${SOURCE_TOKEN}\",\"source_parent\":\"${SRC_PARENT}\",\"dest_name\":\"${DEST_NAME}\",\"dest_token\":\"${DEST_TOKEN}\",\"new_name\":\"${NEW_NAME:-$SRC_NAME}\",\"type\":\"${SRC_TYPE}\"}"
fi

echo ""
echo "📝 审计日志: ${AUDIT_LOG_FILE}"
echo ""
echo "✅ 操作完成"
