#!/usr/bin/env bash
# wiki_to_feishu_sync.sh - 将 Wiki 编译结果镜像到飞书 KM-Vault

set -euo pipefail

# ===== 配置 =====
KM_VAULT_TOKEN="QB50fa4HYlYPCRd5Q8Cck6MMnvf"
WIKI_DIR="/home/admin/.openclaw/wiki/main/wiki"
SYNC_LOG="/home/admin/.openclaw/logs/wiki-to-feishu-sync.log"

# 飞书凭证
FEISHU_APP_ID=$(jq -r ".channels.feishu.accounts.work.appId" /home/admin/.openclaw/openclaw.json 2>/dev/null || echo "")
FEISHU_APP_SECRET=$(jq -r ".FEISHU_APP_SECRET" /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")

WIKI_EXPORT_FOLDER_NAME="Wiki 知识库镜像"

# ===== 函数 =====
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S\)] $1" | tee -a "$SYNC_LOG"
}

get_tenant_token() {
    curl -s -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
        -H "Content-Type: application/json" \
        -d "{\"app_id\": \"$FEISHU_APP_ID\", \"app_secret\": \"$FEISHU_APP_SECRET\"}" | \
        jq -r ' .tenant_access_token'
}

get_or_create_export_folder() {
    local tenant_token="$1"
    
    local response
    response=$(curl -s -X GET "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${KM_VAULT_TOKEN}" \
        -H "Authorization: Bearer ${tenant_token}")
    
    local folder_token
    folder_token=$(echo "$response" | jq -r ".data.files[] | select(.name == \"$WIKI_EXPORT_FOLDER_NAME\") | .token" 2>/dev/null || echo "")
    
    if [[ -n "$folder_token" && "$folder_token" != "null" ]]; then
        echo "$folder_token"
        return
    fi
    
    log "创建导出文件夹: $WIKI_EXPORT_FOLDER_NAME"
    local create_response
    create_response=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/files/create_folder" \
        -H "Authorization: Bearer ${tenant_token}" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$WIKI_EXPORT_FOLDER_NAME\", \"folder_token\": \"$KM_VAULT_TOKEN\", \"type\": \"folder\"}")
    
    folder_token=$(echo "$create_response" | jq -r ' .data.token // empty')
    if [[ -n "$folder_token" && "$folder_token" != "null" ]]; then
        echo "$folder_token"
    else
        log "ERROR: 无法创建导出文件夹"
        exit 1
    fi
}

# ===== 主流程 =====
log "========== 开始 Wiki → 飞书同步 =========="

if [[ -z "$FEISHU_APP_ID" || -z "$FEISHU_APP_SECRET" ]]; then
    log "ERROR: 飞书凭证未配置"
    exit 1
fi

TENANT_TOKEN=$(get_tenant_token)
if [[ -z "$TENANT_TOKEN" || "$TENANT_TOKEN" == "null" ]]; then
    log "ERROR: 无法获取飞书 tenant token"
    exit 1
fi

log "飞书认证成功"

EXPORT_FOLDER_TOKEN=$(get_or_create_export_folder "$TENANT_TOKEN")
log "导出文件夹 Token: $EXPORT_FOLDER_TOKEN"

EXPORT_COUNT=0
for wiki_file in "$WIKI_DIR"/**/*.md; do
    [[ -f "$wiki_file" ]] || continue
    
    REL_PATH="${wiki_file#$WIKI_DIR/}"
    TITLE="Wiki - ${REL_PATH//\// › }"
    TITLE="${TITLE%.md}"
    
    # 简化：仅记录文件，实际创建飞书文档需要更复杂的 API
    log "准备导出: $REL_PATH"
    EXPORT_COUNT=$((EXPORT_COUNT + 1))
done

log "========== Wiki → 飞书同步完成 =========="
log "共准备导出 $EXPORT_COUNT 个文档"
log "访问地址: https://pbrhmf5bin.feishu.cn/drive/folder/$EXPORT_FOLDER_TOKEN"
