#!/bin/bash
# feishu_knowledge_vault_sync.sh - 同步知识 vault 到飞书指定文件夹（用于备份/恢复）
# 作者：tech-mentor
# 创建时间：2026-04-08

set -e

# 默认参数
VAULT_DIR="/home/admin/.openclaw/workspace-tech-mentor/KM_Vault"
TARGET_FOLDER_TOKEN="QB50fa4HYlYPCRd5Q8Cck6MMnvf"
DRY_RUN=false
VERBOSE=false

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --vault_dir)
      VAULT_DIR="$2"
      shift 2
      ;;
    --target_token)
      TARGET_FOLDER_TOKEN="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--vault_dir <dir>] [--target_token <folder_token>] [--dry-run] [-v]"
      echo ""
      echo "Examples:"
      echo "  $0 --target_token QB50fa4HYlYPCRd5Q8Cck6MMnvf"
      echo "  $0 --dry-run --verbose"
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# 验证目录
if [[ ! -d "$VAULT_DIR" ]]; then
  echo "Error: Vault directory not found: $VAULT_DIR"
  exit 1
fi

echo "[INFO] Knowledge Vault Sync"
echo "[INFO] Source: $VAULT_DIR"
echo "[INFO] Target:飞书文件夹 token=$TARGET_FOLDER_TOKEN"
echo "[INFO] Mode: $([ "$DRY_RUN" = true ] && echo 'DRY-RUN' || echo 'LIVE')"

# 同步单个文件
sync_file() {
  local LOCAL_PATH="$1"
  local RELATIVE_PATH="${LOCAL_PATH#$VAULT_DIR/}"
  local FILENAME=$(basename "$LOCAL_PATH")
  
  echo "[SYNC] $RELATIVE_PATH"
  
  if [[ "$DRY_RUN" = true ]]; then
    echo "  [DRY-RUN] Would upload to飞书: $FILENAME"
    return 0
  fi
  
  # 上传到飞书
  feishu_drive_file upload \
    --file_path "$LOCAL_PATH" \
    --folder_token "$TARGET_FOLDER_TOKEN" \
    --name "$FILENAME" \
    --type "$(echo "$FILENAME" | grep -oP '\.[^.]+$' | sed 's/^\.//' | tr '[:upper:]' '[:lower:]')" \
    2>/dev/null || {
    echo "[ERROR] Failed to upload: $LOCAL_PATH"
    return 1
  }
}

# 同步目录
sync_dir() {
  local DIR_PATH="$1"
  
  for item in "$DIR_PATH"/*; do
    if [[ -d "$item" ]]; then
      # 递归同步子目录
      sync_dir "$item"
    elif [[ -f "$item" ]]; then
      # 同步文件（跳过隐藏文件和二进制）
      local FILENAME=$(basename "$item")
      
      # 跳过隐藏文件
      if [[ "$FILENAME" == .* ]]; then
        continue
      fi
      
      # 跳过较大的二进制文件（>10MB）
      local SIZE=$(stat -c%s "$item" 2>/dev/null || echo 0)
      if [[ $SIZE -gt 10485760 ]]; then
        echo "[SKIP] Large file (>${SIZE} bytes): $FILENAME"
        continue
      fi
      
      # 同步文件
      if [[ "$VERBOSE" = true ]]; then
        sync_file "$item"
      else
        # 简化输出
        local REL_PATH="${item#$VAULT_DIR/}"
        echo "[SYNC] $REL_PATH"
        
        if [[ "$DRY_RUN" != true ]]; then
          feishu_drive_file upload \
            --file_path "$item" \
            --folder_token "$TARGET_FOLDER_TOKEN" \
            --name "$FILENAME" \
            --type "$(echo "$FILENAME" | grep -oP '\.[^.]+$' | sed 's/^\.//' | tr '[:upper:]' '[:lower:]')" \
            2>/dev/null || echo "[ERROR] Upload failed: $FILENAME"
        fi
      fi
    fi
  done
}

# 同步核心目录
echo ""
echo "[INFO] 同步 raw/ 目录..."
sync_dir "$VAULT_DIR/raw" 2>/dev/null || echo "[WARN] raw/ directory empty or not found"

echo ""
echo "[INFO] 同步 wiki/ 目录..."
sync_dir "$VAULT_DIR/wiki" 2>/dev/null || echo "[WARN] wiki/ directory empty or not found"

echo ""
echo "[INFO] 同步 schema/ 目录..."
sync_dir "$VAULT_DIR/schema" 2>/dev/null || echo "[WARN] schema/ directory empty or not found"

echo ""
echo "[INFO] 同步 docs/ 目录..."
sync_dir "$VAULT_DIR/docs" 2>/dev/null || echo "[WARN] docs/ directory empty or not found"

echo ""
echo "[SUCCESS] 同步完成"
echo "[INFO] 目标位置: 飞书文件夹 token=$TARGET_FOLDER_TOKEN"

# 显示飞书链接
if [[ "$DRY_RUN" != true ]]; then
  echo "[INFO] 飞书链接: https://pbrhmf5bin.feishu.cn/drive/folder/$TARGET_FOLDER_TOKEN"
fi
