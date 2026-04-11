#!/usr/bin/env bash
# feishu_to_wiki_sync.sh - 从飞书 KM-Vault 导出文档到 Wiki raw/ 目录
# 用途：定时将飞书网盘中的新文档导出到 Wiki 原始资料层
# 使用：bash /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh

set -euo pipefail

# ===== 配置 =====
KM_VAULT_TOKEN="QB50fa4HYlYPCRd5Q8Cck6MMnvf"
WIKI_RAW_DIR="/home/admin/.openclaw/wiki/main/raw/articles"
SYNC_LOG="/home/admin/.openclaw/logs/feishu-to-wiki-sync.log"
LAST_SYNC_FILE="/home/admin/.openclaw/wiki/main/.feishu-last-sync"

# 飞书凭证（从 runtime-secrets 读取）
FEISHU_APP_ID=$(jq -r '.lark.work.appId' /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")
FEISHU_APP_SECRET=$(jq -r '.lark.work.appSecret' /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")

# ===== 函数 =====
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$SYNC_LOG"
}

# 获取飞书 tenant_access_token
get_tenant_token() {
    local response
    response=$(curl -s -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
        -H "Content-Type: application/json" \
        -d "{\"app_id\": \"$FEISHU_APP_ID\", \"app_secret\": \"$FEISHU_APP_SECRET\"}")
    
    echo "$response" | jq -r '.tenant_access_token'
}

# 获取文件夹中的文件列表
get_folder_files() {
    local folder_token="$1"
    local tenant_token="$2"
    
    curl -s -X GET "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${folder_token}" \
        -H "Authorization: Bearer ${tenant_token}"
}

# 下载飞书文档内容为 Markdown
download_doc_as_markdown() {
    local doc_token="$1"
    local doc_type="$2"  # docx, doc, sheet, etc.
    local tenant_token="$3"
    local output_file="$4"
    
    if [[ "$doc_type" == "docx" ]]; then
        curl -s -X GET "https://open.feishu.cn/open-apis/docx/v1/documents/${doc_token}/raw_content" \
            -H "Authorization: Bearer ${tenant_token}" \
            -H "Content-Type: application/json" | \
            jq -r '.content // empty' > "$output_file" 2>/dev/null || true
    elif [[ "$doc_type" == "doc" ]]; then
        # 旧版文档
        curl -s -X GET "https://open.feishu.cn/open-apis/doc/v2/${doc_token}/content" \
            -H "Authorization: Bearer ${tenant_token}" | \
            jq -r '.content // empty' > "$output_file" 2>/dev/null || true
    fi
}

# ===== 主流程 =====
log "========== 开始飞书 → Wiki 同步 =========="

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

# 确保 raw 目录存在
mkdir -p "$WIKI_RAW_DIR"

# 获取上次同步时间（用于增量同步）
LAST_SYNC=""
if [[ -f "$LAST_SYNC_FILE" ]]; then
    LAST_SYNC=$(cat "$LAST_SYNC_FILE")
    log "上次同步时间: $LAST_SYNC"
fi

# 获取文件夹中的文件列表
log "正在获取 KM-Vault 文件列表..."
FILES_RESPONSE=$(get_folder_files "$KM_VAULT_TOKEN" "$TENANT_TOKEN")

# 解析文件列表
NEW_COUNT=0
UPDATED_COUNT=0
SKIPPED_COUNT=0

echo "$FILES_RESPONSE" | jq -c '.data.files[]? // empty' | while read -r file; do
    FILE_TOKEN=$(echo "$file" | jq -r '.token')
    FILE_NAME=$(echo "$file" | jq -r '.name')
    FILE_TYPE=$(echo "$file" | jq -r '.type')
    FILE_MODIFIED=$(echo "$file" | jq -r '.modified_time')
    
    # 只处理文档类型
    if [[ "$FILE_TYPE" != "docx" && "$FILE_TYPE" != "doc" ]]; then
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    # 生成文件名
    SAFE_NAME=$(echo "$FILE_NAME" | sed 's/[\/:*?"<>|]/_/g')
    OUTPUT_FILE="${WIKI_RAW_DIR}/${SAFE_NAME}.md"
    
    # 检查是否需要更新（文件修改时间晚于上次同步）
    if [[ -n "$LAST_SYNC" && -f "$OUTPUT_FILE" ]]; then
        FILE_MTIME=$(stat -c %Y "$OUTPUT_FILE" 2>/dev/null || echo 0)
        if [[ "$FILE_MODIFIED" -le "$LAST_SYNC" ]]; then
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            continue
        fi
    fi
    
    # 下载文档
    log "正在下载: $FILE_NAME ($FILE_TYPE)"
    download_doc_as_markdown "$FILE_TOKEN" "$FILE_TYPE" "$TENANT_TOKEN" "$OUTPUT_FILE"
    
    if [[ -s "$OUTPUT_FILE" ]]; then
        # 添加 Frontmatter
        TEMP_FILE=$(mktemp)
        cat > "$TEMP_FILE" << EOF
---
title: "$FILE_NAME"
source: feishu
source_token: "$FILE_TOKEN"
source_type: "$FILE_TYPE"
synced_at: $(date '+%Y-%m-%d %H:%M:%S')
---

EOF
        cat "$OUTPUT_FILE" >> "$TEMP_FILE"
        mv "$TEMP_FILE" "$OUTPUT_FILE"
        
        if [[ -f "$OUTPUT_FILE" ]]; then
            log "✅ 已下载: $FILE_NAME"
            NEW_COUNT=$((NEW_COUNT + 1))
        else
            log "❌ 下载失败: $FILE_NAME"
        fi
    else
        log "⚠️  空文档，跳过: $FILE_NAME"
        rm -f "$OUTPUT_FILE"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
done

# 记录本次同步时间
date +%s > "$LAST_SYNC_FILE"

log "========== 同步完成 =========="
log "新增: $NEW_COUNT | 更新: $UPDATED_COUNT | 跳过: $SKIPPED_COUNT"

# 触发 Wiki 编译
log "触发 Wiki 编译..."
cd /home/admin/.openclaw/wiki/main && openclaw wiki compile >> "$SYNC_LOG" 2>&1 || true

# Git 提交
log "Git 提交更改..."
cd /home/admin/.openclaw/wiki/main && \
    git add . && \
    (git diff --cached --quiet || git commit -m "飞书同步: 新增 $NEW_COUNT 个文档") && \
    git push origin main >> "$SYNC_LOG" 2>&1 || true

log "========== 飞书 → Wiki 同步结束 =========="
