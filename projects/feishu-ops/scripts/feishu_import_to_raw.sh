#!/bin/bash
# feishu_import_to_raw.sh - 将飞书文档导入知识 vault 的 raw/ 目录
# 作者：tech-mentor
# 创建时间：2026-04-08

set -e

# 默认参数
TOKEN=""
URL=""
VAULT_TOKEN="QB50fa4HYlYPCRd5Q8Cck6MMnvf"
TITLE=""
OUTPUT_DIR="/home/admin/.openclaw/workspace-tech-mentor/KM_Vault/raw"

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    --vault_token)
      VAULT_TOKEN="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 --token <doc_token> [--vault_token <folder_token>] [--title <title>] [--output <dir>]"
      echo "       $0 --url <doc_url> [--vault_token <folder_token>] [--title <title>] [--output <dir>]"
      echo ""
      echo "Examples:"
      echo "  $0 --token UpSAdrgZ7oHGDTxNnwXcCkJbn9c"
      echo "  $0 --url https://pbrhmf5bin.feishu.cn/docx/UpSAdrgZ7oHGDTxNnwXcCkJbn9c --title 'Karpathy LLM Wiki'"
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# 验证参数
if [[ -z "$TOKEN" && -z "$URL" ]]; then
  echo "Error: Either --token or --url must be provided"
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  # 从 URL 提取 token
  TOKEN=$(echo "$URL" | grep -oP 'docx/\K[a-zA-Z0-9]+')
  if [[ -z "$TOKEN" ]]; then
    echo "Error: Could not extract token from URL: $URL"
    exit 1
  fi
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 构建飞书文档 ID
DOC_ID="docx/${TOKEN}"

echo "[INFO] 开始导入飞书文档: $DOC_ID"

# 获取文档内容
echo "[INFO] 调用 feishu_fetch_doc..."
MARKDOWN=$(feishu_fetch_doc --doc_id "$DOC_ID" 2>/dev/null | grep -o '"markdown":"[^"]*"' | sed 's/"markdown":"//;s/"$//')

if [[ -z "$MARKDOWN" ]]; then
  echo "Error: Failed to fetch document content"
  exit 1
fi

# 清理 Markdown（移除飞书剪存的元数据）
CLEANED_MARKDOWN=$(echo "$MARKDOWN" | sed -n '/^# /,$p')

# 设置文件名
if [[ -z "$TITLE" ]]; then
  # 从文档内容提取标题
  TITLE=$(echo "$CLEANED_MARKDOWN" | head -1 | sed 's/^# //;s/[^a-zA-Z0-9]/_/g' | cut -c1-50)
fi

TIMESTAMP=$(date +%Y%m%d_%H%M)
FILENAME="${TIMESTAMP}_${TITLE}.md"
FILEPATH="${OUTPUT_DIR}/${FILENAME}"

# 保存文件
echo "[INFO] 保存到: $FILEPATH"
echo "$CLEANED_MARKDOWN" > "$FILEPATH"

# 记录元数据
METADATA_FILE="${OUTPUT_DIR}/.metadata.json"

if [[ -f "$METADATA_FILE" ]]; then
  # 添加新条目到 JSON
  echo "[INFO] 更新元数据: $METADATA_FILE"
  # 简化：追加到文件（实际应使用 jq 处理 JSON）
  echo "{\"file\": \"$FILENAME\", \"imported_at\": \"$(date -Iseconds)\", \"source_url\": \"$URL\", \"source_token\": \"$TOKEN\", \"title\": \"$TITLE\", \"size\": $(stat -c%s "$FILEPATH\"}" >> "$METADATA_FILE"
else
  # 创建新 JSON
  echo "[INFO] 创建元数据: $METADATA_FILE"
  echo "[{\"file\": \"$FILENAME\", \"imported_at\": \"$(date -Iseconds)\", \"source_url\": \"$URL\", \"source_token\": \"$TOKEN\", \"title\": \"$TITLE\", \"size\": $(stat -c%s "$FILEPATH\")}]" > "$METADATA_FILE"
fi

# 触发编译
echo "[INFO] 触发 LLM 编译: coder-hub"

# 构建 sessions_spawn 命令
cat << EOF | bash
sessions_spawn({
  "agentId": "coder-hub",
  "message": "根据 schema/AGENTS.md 和 schema/WIKI_SCHEMA.md 规则，将 raw/$FILENAME 编译为 wiki 实体页/概念页",
  "model": "minimax/MiniMax-M2.7"
})
EOF

echo "[SUCCESS] 导入完成: $FILENAME"
echo "[INFO] 文件路径: $FILEPATH"
echo "[INFO] 可用 Obsidian 打开: $FILEPATH"
