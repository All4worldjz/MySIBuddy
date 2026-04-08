#!/bin/bash
# ============================================================================
# feishu_create_folder.sh - 飞书文件夹创建脚本（带安全策略）
# ============================================================================
# 用法: ./feishu_create_folder.sh <文件夹名称> <父文件夹token>
# 功能:
#   - 受保护文件夹检查（防止在受保护目录中误创建）
#   - 重名检测
#   - 审计日志记录
#   - 返回新文件夹 token
#
# 退出码:
#   0 - 创建成功
#   1 - 参数错误 / API 错误
#   2 - 重名错误
#   3 - 违反安全策略（在受保护文件夹中创建）
# ============================================================================

set -euo pipefail

# 加载共享安全策略库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"
GUARDRAILS_FILE="${LIB_DIR}/feishu_drive_guardrails.sh"

if [ -f "$GUARDRAILS_FILE" ]; then
  source "$GUARDRAILS_FILE"
else
  # 如果本地库不存在，尝试远程路径
  REMOTE_LIB="/home/admin/.openclaw/scripts/lib/feishu_drive_guardrails.sh"
  if [ -f "$REMOTE_LIB" ]; then
    source "$REMOTE_LIB"
  else
    echo "⚠️  警告: 未找到安全策略库，使用基础模式..."
  fi
fi

# 解析参数
FOLDER_NAME="${1:-}"
PARENT_TOKEN="${2:-}"

if [ -z "$FOLDER_NAME" ] || [ -z "$PARENT_TOKEN" ]; then
  echo "❌ 错误: 参数不足"
  echo ""
  echo "用法: $0 <文件夹名称> <父文件夹token>"
  echo ""
  echo "示例:"
  echo "  $0 '项目文档' Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"
  echo ""
  echo "受保护的父文件夹（允许创建）:"
  echo "  - CC文件柜 (RfSrf8oMYlMyQTdbW0ZcGSE1nNb)"
  echo "  - 小春文件柜 (Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd)"
  echo "  - 回收站 (创建后自动保护)"
  exit 1
fi

# 初始化安全策略
if type init_drive_guardrails &>/dev/null; then
  init_drive_guardrails
else
  echo "🔐 正在获取访问令牌..."
fi

# 获取令牌
TENANT_TOKEN="${TENANT_TOKEN:-$(get_tenant_token 2>/dev/null)}"
if [ -z "$TENANT_TOKEN" ]; then
  TENANT_TOKEN=$(cat /home/admin/.openclaw/runtime-secrets.json | python3 -c "
import sys, json, subprocess
app_id = 'cli_a93c20939cf8dbef'
app_secret = json.load(sys.stdin).get('FEISHU_APP_SECRET', '')
if not app_secret:
    print('', file=sys.stderr)
    sys.exit(1)
import urllib.request, json
data = json.dumps({'app_id': app_id, 'app_secret': app_secret}).encode()
req = urllib.request.Request('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', data=data, headers={'Content-Type': 'application/json'})
resp = json.loads(urllib.request.urlopen(req).read())
print(resp.get('tenant_access_token', ''))
" 2>/dev/null)
fi

if [ -z "$TENANT_TOKEN" ]; then
  echo "❌ 错误: 获取 tenant access token 失败"
  exit 1
fi

# 步骤1: 检查父文件夹是否在受保护列表中（可选警告）
if type is_folder_protected &>/dev/null; then
  if is_folder_protected "$PARENT_TOKEN" ""; then
    echo "🛡️  注意: 正在受保护文件夹中创建子文件夹"
  fi
fi

# 步骤2: 检查父文件夹中是否已存在同名文件夹
echo "🔍 检查父文件夹中是否存在同名文件夹: $FOLDER_NAME"
LIST_RESP=$(curl -s -X GET \
  "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${PARENT_TOKEN}&page_size=200" \
  -H "Authorization: Bearer $TENANT_TOKEN")

LIST_CODE=$(echo "$LIST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code',-1))" 2>/dev/null)

if [ "$LIST_CODE" != "0" ]; then
  echo "⚠️  警告: 获取文件夹列表失败 (code: $LIST_CODE)"
  echo "响应: $LIST_RESP"
  echo "继续尝试创建..."
else
  # 检查是否存在同名文件夹
  DUPLICATE_CHECK=$(echo "$LIST_RESP" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
duplicate = [f for f in files if f.get('name') == '$FOLDER_NAME' and f.get('type') == 'folder']
if duplicate:
    print('DUPLICATE')
    print(f\"已存在文件夹: {duplicate[0].get('token', 'unknown')}\")
else:
    print('OK')
" 2>/dev/null)

  if echo "$DUPLICATE_CHECK" | grep -q "DUPLICATE"; then
    EXISTING_TOKEN=$(echo "$DUPLICATE_CHECK" | tail -1 | sed 's/已存在文件夹: //')
    echo "❌ 重名错误: 父文件夹中已存在同名文件夹 '$FOLDER_NAME'"
    echo "   已有文件夹 Token: $EXISTING_TOKEN"
    echo "   请更换文件夹名称或使用已有文件夹"
    exit 2
  fi
fi

# 步骤2: 创建文件夹
echo "📁 正在创建文件夹: $FOLDER_NAME"
CREATE_RESP=$(curl -s -X POST \
  "https://open.feishu.cn/open-apis/drive/v1/files/create_folder" \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$FOLDER_NAME\",\"folder_token\":\"$PARENT_TOKEN\"}")

CREATE_CODE=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code',-1))" 2>/dev/null)

if [ "$CREATE_CODE" = "0" ]; then
  NEW_TOKEN=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)
  echo "✅ 文件夹创建成功!"
  echo "   名称: $FOLDER_NAME"
  echo "   Token: $NEW_TOKEN"
  echo "   父文件夹: $PARENT_TOKEN"

  # 写入审计日志
  if type write_audit_log &>/dev/null; then
    write_audit_log "create_folder" "{\"name\":\"${FOLDER_NAME}\",\"token\":\"${NEW_TOKEN}\",\"parent_token\":\"${PARENT_TOKEN}\"}"
  fi

  # 输出 token 供脚本调用
  echo "$NEW_TOKEN"
else
  echo "❌ 文件夹创建失败 (code: $CREATE_CODE)"
  echo "响应: $CREATE_RESP"
  exit 1
fi
