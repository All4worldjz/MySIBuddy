#!/bin/bash
# ============================================================================
# feishu_drive_guardrails.sh - 飞书网盘安全策略共享库
# ============================================================================
# 用途：为所有飞书网盘操作脚本提供统一的安全检查和配置读取
# 包含：受保护文件夹列表、回收站管理、审计日志、权限验证
#
# 使用方式：在其他脚本中 source 此文件
#   source /home/admin/.openclaw/scripts/lib/feishu_drive_guardrails.sh
# ============================================================================

set -euo pipefail

# ============================================================================
# 1. 基础配置
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="/home/admin/.openclaw"
PROTECTED_CONFIG="${OPENCLAW_DIR}/config/protected_folders.json"
AUDIT_LOG_DIR="${OPENCLAW_DIR}/logs"
AUDIT_LOG_FILE="${AUDIT_LOG_DIR}/feishu_drive_operations.log"

# ============================================================================
# 2. 受保护文件夹配置（从 JSON 读取）
# ============================================================================

# 加载受保护文件夹列表
load_protected_folders() {
  if [ ! -f "$PROTECTED_CONFIG" ]; then
    echo "⚠️  警告: 未找到配置文件 ${PROTECTED_CONFIG}"
    echo "   使用默认保护列表..."
    # 默认保护列表
    DEFAULT_PROTECTED_TOKENS="RfSrf8oMYlMyQTdbW0ZcGSE1nNb,Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"
    DEFAULT_PROTECTED_NAMES="CC文件柜,小春文件柜,回收站,📁测试归档"
    echo "$DEFAULT_PROTECTED_TOKENS" | tr ',' '\n'
    echo "$DEFAULT_PROTECTED_NAMES" | tr ',' '\n'
    return 1
  fi

  # 从 JSON 读取受保护的 tokens
  PROTECTED_TOKENS=$(python3 -c "
import json
with open('${PROTECTED_CONFIG}') as f:
    config = json.load(f)
for token in config.get('protected_tokens', []):
    print(token)
" 2>/dev/null)

  # 从 JSON 读取受保护的名称
  PROTECTED_NAMES=$(python3 -c "
import json
with open('${PROTECTED_CONFIG}') as f:
    config = json.load(f)
for name in config.get('protected_names', []):
    print(name)
" 2>/dev/null)

  # 读取回收站配置
  RECYCLE_BIN_TOKEN=$(python3 -c "
import json
with open('${PROTECTED_CONFIG}') as f:
    config = json.load(f)
print(config.get('folders', {}).get('recycle_bin', {}).get('token', ''))
" 2>/dev/null)

  RECYCLE_BIN_NAME=$(python3 -c "
import json
with open('${PROTECTED_CONFIG}') as f:
    config = json.load(f)
print(config.get('folders', {}).get('recycle_bin', {}).get('name', '回收站'))
" 2>/dev/null)

  RECYCLE_BIN_PARENT_TOKEN=$(python3 -c "
import json
with open('${PROTECTED_CONFIG}') as f:
    config = json.load(f)
print(config.get('folders', {}).get('recycle_bin', {}).get('parent_token', 'RfSrf8oMYlMyQTdbW0ZcGSE1nNb'))
" 2>/dev/null)

  AUTO_CLEANUP_DAYS=$(python3 -c "
import json
with open('${PROTECTED_CONFIG}') as f:
    config = json.load(f)
print(config.get('deletion_policy', {}).get('auto_cleanup_days', 30))
" 2>/dev/null)
}

# ============================================================================
# 3. 受保护文件夹检查
# ============================================================================

# 检查文件夹是否在保护列表中
# 参数: $1=folder_token, $2=folder_name (可选)
# 返回: 0=受保护, 1=不受保护
is_folder_protected() {
  local token="$1"
  local name="${2:-}"

  # 检查 token
  if echo "$PROTECTED_TOKENS" | grep -q "$token"; then
    return 0
  fi

  # 检查名称
  if [ -n "$name" ] && echo "$PROTECTED_NAMES" | grep -q "$name"; then
    return 0
  fi

  return 1
}

# ============================================================================
# 4. 回收站管理
# ============================================================================

# 确保回收站文件夹存在
# 参数: $1=TENANT_TOKEN
# 返回: 回收站 token（通过 RECYCLE_BIN_TOKEN 变量）
ensure_recycle_bin_exists() {
  local tenant_token="$1"

  # 如果已有 token，验证是否仍然有效
  if [ -n "$RECYCLE_BIN_TOKEN" ]; then
    local check_resp
    check_resp=$(curl -s "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${RECYCLE_BIN_TOKEN}&page_size=1" \
      -H "Authorization: Bearer $tenant_token")

    local check_code
    check_code=$(echo "$check_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

    if [ "$check_code" = "0" ]; then
      echo "✅ 回收站已存在 (token: ${RECYCLE_BIN_TOKEN})"
      return 0
    else
      echo "⚠️  回收站 token 失效，尝试重新定位或创建..."
    fi
  fi

  # 尝试查找现有的回收站文件夹（在配置的父目录下查找）
  echo "🔍 正在查找回收站文件夹..."
  
  # 使用配置文件中的 parent_token，如果没有则使用 CC文件柜
  local recycle_parent_token="${RECYCLE_BIN_PARENT_TOKEN:-RfSrf8oMYlMyQTdbW0ZcGSE1nNb}"
  
  local root_files
  root_files=$(curl -s "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${recycle_parent_token}&page_size=200" \
    -H "Authorization: Bearer $tenant_token")

  local existing_token
  existing_token=$(echo "$root_files" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
for f in files:
    if f.get('name') == '${RECYCLE_BIN_NAME}' and f.get('type') == 'folder':
        print(f.get('token', ''))
        break
" 2>/dev/null)

  if [ -n "$existing_token" ]; then
    echo "✅ 找到现有回收站 (token: ${existing_token})"
    RECYCLE_BIN_TOKEN="$existing_token"
    update_recycle_bin_token "$existing_token"
    return 0
  fi

  # 创建回收站（使用配置的 parent_token）
  echo "📁 正在创建回收站文件夹..."
  local create_resp
  create_resp=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/files/create_folder" \
    -H "Authorization: Bearer $tenant_token" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${RECYCLE_BIN_NAME}\",\"folder_token\":\"${recycle_parent_token}\"}")

  local create_code
  create_code=$(echo "$create_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',-1))" 2>/dev/null)

  if [ "$create_code" = "0" ]; then
    RECYCLE_BIN_TOKEN=$(echo "$create_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null)
    echo "✅ 回收站创建成功 (token: ${RECYCLE_BIN_TOKEN})"
    update_recycle_bin_token "$RECYCLE_BIN_TOKEN"
    return 0
  else
    echo "❌ 回收站创建失败 (code: ${create_code})"
    echo "   响应: ${create_resp}"
    return 1
  fi
}

# 更新配置文件中的回收站 token
update_recycle_bin_token() {
  local new_token="$1"

  python3 -c "
import json
config_path = '${PROTECTED_CONFIG}'
with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)
config['folders']['recycle_bin']['token'] = '${new_token}'
config['folders']['recycle_bin']['status'] = 'active'
config['folders']['recycle_bin']['activated_at'] = '$(date -Iseconds)'
config['updated_at'] = '$(date -Iseconds)'
if '${new_token}' not in config['protected_tokens']:
    config['protected_tokens'].append('${new_token}')
if '${RECYCLE_BIN_NAME}' not in config['protected_names']:
    config['protected_names'].append('${RECYCLE_BIN_NAME}')
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, ensure_ascii=False, indent=2)
" 2>/dev/null

  echo "   📝 已更新配置文件: ${PROTECTED_CONFIG}"
}

# ============================================================================
# 5. 审计日志
# ============================================================================

# 写入审计日志
# 参数: $1=action, $2=details_json
write_audit_log() {
  local action="$1"
  local details_json="$2"
  local timestamp
  timestamp=$(date -Iseconds)

  # 确保日志目录存在
  mkdir -p "$AUDIT_LOG_DIR"

  # 写入 JSON 格式日志
  local log_entry
  log_entry=$(python3 -c "
import json, sys
entry = {
    'timestamp': '${timestamp}',
    'action': '${action}',
    'details': json.loads('${details_json}'),
    'operator': 'system',
    'version': '1.0.0'
}
print(json.dumps(entry, ensure_ascii=False))
" 2>/dev/null)

  echo "$log_entry" >> "$AUDIT_LOG_FILE"
  echo "   📝 审计日志已记录: ${AUDIT_LOG_FILE}"
}

# ============================================================================
# 6. 令牌获取辅助函数
# ============================================================================

# 获取 tenant access token
get_tenant_token() {
  local app_id="cli_a93c20939cf8dbef"
  local app_secret
  app_secret=$(cat /home/admin/.openclaw/runtime-secrets.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('FEISHU_APP_SECRET',''))" 2>/dev/null)

  if [ -z "$app_secret" ]; then
    echo "❌ 错误: 无法获取 FEISHU_APP_SECRET" >&2
    return 1
  fi

  local token_resp
  token_resp=$(curl -s -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
    -H "Content-Type: application/json" \
    -d "{\"app_id\":\"${app_id}\",\"app_secret\":\"${app_secret}\"}")

  local token
  token=$(echo "$token_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tenant_access_token',''))" 2>/dev/null)

  if [ -z "$token" ]; then
    echo "❌ 错误: 获取 tenant access token 失败" >&2
    echo "   响应: ${token_resp}" >&2
    return 1
  fi

  echo "$token"
}

# ============================================================================
# 7. 初始化检查
# ============================================================================

# 初始化所有配置（应在脚本开头调用）
init_drive_guardrails() {
  echo "🛡️  加载飞书网盘安全策略..."

  load_protected_folders

  echo "   ✅ 受保护文件夹: $(echo "$PROTECTED_TOKENS" | wc -l) 个 tokens, $(echo "$PROTECTED_NAMES" | wc -l) 个 names"
  echo "   ✅ 回收站: ${RECYCLE_BIN_NAME:-未配置} (${RECYCLE_BIN_TOKEN:-待创建})"
  echo "   ✅ 审计日志: ${AUDIT_LOG_FILE}"
  echo ""
}

# ============================================================================
# 8. 导出函数和变量
# ============================================================================

export -f load_protected_folders
export -f is_folder_protected
export -f ensure_recycle_bin_exists
export -f update_recycle_bin_token
export -f write_audit_log
export -f get_tenant_token
export -f init_drive_guardrails

export PROTECTED_TOKENS
export PROTECTED_NAMES
export RECYCLE_BIN_TOKEN
export RECYCLE_BIN_NAME
export RECYCLE_BIN_PARENT_TOKEN
export AUTO_CLEANUP_DAYS
export PROTECTED_CONFIG
export AUDIT_LOG_FILE
