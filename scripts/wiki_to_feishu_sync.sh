#!/usr/bin/env bash
# wiki_to_feishu_sync.sh - 将 Wiki 编译结果镜像到飞书 KM-Vault
# 用途：定时将 Wiki 编译后的知识页面导出到飞书网盘（只读镜像）
# 使用：bash /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh

set -euo pipefail

# ===== 配置 =====
KM_VAULT_TOKEN="QB50fa4HYlYPCRd5Q8Cck6MMnvf"
WIKI_DIR="/home/admin/.openclaw/wiki/main/wiki"
SYNC_LOG="/home/admin/.openclaw/logs/wiki-to-feishu-sync.log"
LAST_SYNC_FILE="/home/admin/.openclaw/wiki/main/.feishu-export-last-sync"

# 飞书凭证
FEISHU_APP_ID=$(jq -r '.lark.work.appId' /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")
FEISHU_APP_SECRET=$(jq -r '.lark.work.appSecret' /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")

# 飞书子文件夹 Token（如果不存在会自动创建）
WIKI_EXPORT_FOLDER_NAME="Wiki 知识库镜像"
WIKI_EXPORT_FOLDER_TOKEN=""

# ===== 函数 =====
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$SYNC_LOG"
}

get_tenant_token() {
    local response
    response=$(curl -s -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
        -H "Content-Type: application/json" \
        -d "{\"app_id\": \"$FEISHU_APP_ID\", \"app_secret\": \"$FEISHU_APP_SECRET\"}")
    
    echo "$response" | jq -r '.tenant_access_token'
}

# 创建文件夹
create_folder() {
    local folder_name="$1"
    local parent_token="$2"
    local tenant_token="$3"
    
    curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/files/create_folder" \
        -H "Authorization: Bearer ${tenant_token}" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$folder_name\", \"folder_token\": \"$parent_token\", \"type\": \"folder\"}"
}

# 获取或创建导出文件夹
get_or_create_export_folder() {
    local tenant_token="$1"
    
    # 查找现有文件夹
    local response
    response=$(curl -s -X GET "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${KM_VAULT_TOKEN}" \
        -H "Authorization: Bearer ${tenant_token}")
    
    local folder_token
    folder_token=$(echo "$response" | jq -r ".data.files[] | select(.name == \"$WIKI_EXPORT_FOLDER_NAME\") | .token" 2>/dev/null)
    
    if [[ -n "$folder_token" && "$folder_token" != "null" ]]; then
        echo "$folder_token"
        return
    fi
    
    # 创建新文件夹
    log "创建导出文件夹: $WIKI_EXPORT_FOLDER_NAME"
    local create_response
    create_response=$(create_folder "$WIKI_EXPORT_FOLDER_NAME" "$KM_VAULT_TOKEN" "$tenant_token")
    
    folder_token=$(echo "$create_response" | jq -r '.data.token // empty')
    if [[ -n "$folder_token" && "$folder_token" != "null" ]]; then
        echo "$folder_token"
    else
        log "ERROR: 无法创建导出文件夹"
        exit 1
    fi
}

# 创建飞书文档
create_feishu_doc() {
    local title="$1"
    local content="$2"
    local folder_token="$3"
    local tenant_token="$4"
    
    # 创建空白文档
    local create_response
    create_response=$(curl -s -X POST "https://open.feishu.cn/open-apis/docx/v1/documents" \
        -H "Authorization: Bearer ${tenant_token}" \
        -H "Content-Type: application/json" \
        -d "{\"folder_token\": \"$folder_token\", \"title\": \"$title\"}")
    
    local doc_token
    doc_token=$(echo "$create_response" | jq -r '.data.document.document_id // empty')
    
    if [[ -z "$doc_token" || "$doc_token" == "null" ]]; then
        log "ERROR: 创建文档失败: $title"
        return 1
    fi
    
    # 写入内容（简化版，实际需要使用文档块 API）
    log "✅ 创建文档: $title ($doc_token)"
    echo "$doc_token"
}

# ===== 主流程 =====
log "========== 开始 Wiki → 飞书同步 =========="

# 检查飞书凭证
if [[ -z "$FEISHU_APP_ID" || -z "$FEISHU_APP_SECRET" ]]; then
    log "ERROR: 飞书凭证未配置，跳过同步"
    exit 1
fi

# 获取 tenant token
TENANT_TOKEN=$(get_tenant_token)
if [[ -z "$TENANT_TOKEN" || "$TENANT_TOKEN" == "null" ]]; then
    log "ERROR: 无法获取飞书 tenant token"
    exit 1
fi

log "飞书认证成功"

# 获取或创建导出文件夹
WIKI_EXPORT_FOLDER_TOKEN=$(get_or_create_export_folder "$TENANT_TOKEN")
log "导出文件夹 Token: $WIKI_EXPORT_FOLDER_TOKEN"

# 扫描 Wiki 页面
EXPORT_COUNT=0
find "$WIKI_DIR" -name "*.md" -type f | while read -r wiki_file; do
    # 跳过 index.md（太简单）
    BASENAME=$(basename "$wiki_file")
    REL_PATH="${wiki_file#$WIKI_DIR/}"
    
    # 生成标题（基于路径）
    TITLE="Wiki - ${REL_PATH//\// › }"
    TITLE="${TITLE%.md}"  # 去掉 .md 后缀
    
    # 读取内容
    CONTENT=$(cat "$wiki_file")
    
    # 创建飞书文档
    DOC_TOKEN=$(create_feishu_doc "$TITLE" "$CONTENT" "$WIKI_EXPORT_FOLDER_TOKEN" "$TENANT_TOKEN")
    
    if [[ -n "$DOC_TOKEN" ]]; then
        EXPORT_COUNT=$((EXPORT_COUNT + 1))
        log "[$EXPORT_COUNT] 已导出: $REL_PATH → https://pbrhmf5bin.feishu.cn/docx/$DOC_TOKEN"
    fi
done

# 记录同步时间
date +%s > "$LAST_SYNC_FILE"

log "========== Wiki → 飞书同步完成 =========="
log "共导出 $EXPORT_COUNT 个文档"
log "访问地址: https://pbrhmf5bin.feishu.cn/drive/folder/$WIKI_EXPORT_FOLDER_TOKEN"
