#!/bin/bash
# backup-config.sh - OpenClaw 配置备份脚本
# 用法：./scripts/backup-config.sh [server_ip] [user] [backup_dir]

set -euo pipefail

SERVER_IP="${1:-}"
USER="${2:-admin}"
BACKUP_DIR="${3:-./docs/backups}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

if [ -z "$SERVER_IP" ]; then
    echo "❌ 用法: $0 <server_ip> [user] [backup_dir]"
    echo "示例: $0 47.82.234.46 admin ./docs/backups"
    exit 1
fi

BACKUP_PATH="$BACKUP_DIR/$SERVER_IP/$TIMESTAMP"

echo "========================================="
echo "OpenClaw 配置备份"
echo "服务器: $USER@$SERVER_IP"
echo "备份目录: $BACKUP_PATH"
echo "========================================="
echo ""

# 创建备份目录
mkdir -p "$BACKUP_PATH"/{config,agents,channels,secrets}

# 备份主配置
echo "📦 备份主配置..."
ssh "$USER@$SERVER_IP" "cat ~/.openclaw/openclaw.json" > "$BACKUP_PATH/config/openclaw.json" 2>/dev/null || echo "⚠️  openclaw.json 不存在"

# 备份密钥（警告：包含敏感信息）
echo "🔑 备份密钥配置（警告：包含敏感信息）..."
ssh "$USER@$SERVER_IP" "cat ~/.openclaw/runtime-secrets.json" > "$BACKUP_PATH/secrets/runtime-secrets.json" 2>/dev/null || echo "⚠️  runtime-secrets.json 不存在"
ssh "$USER@$SERVER_IP" "cat ~/.openclaw/gateway.env" > "$BACKUP_PATH/secrets/gateway.env" 2>/dev/null || echo "⚠️  gateway.env 不存在"

# 备份 Agent 配置
echo "🤖 备份 Agent 配置..."
ssh "$USER@$SERVER_IP" "ls -1 ~/.openclaw/agents/" 2>/dev/null | while read -r agent; do
    echo "  - $agent"
    mkdir -p "$BACKUP_PATH/agents/$agent"
    ssh "$USER@$SERVER_IP" "cat ~/.openclaw/agents/$agent/AGENTS.md" > "$BACKUP_PATH/agents/$agent/AGENTS.md" 2>/dev/null || true
    ssh "$USER@$SERVER_IP" "cat ~/.openclaw/agents/$agent/SOUL.md" > "$BACKUP_PATH/agents/$agent/SOUL.md" 2>/dev/null || true
    ssh "$USER@$SERVER_IP" "cat ~/.openclaw/agents/$agent/MEMORY.md" > "$BACKUP_PATH/agents/$agent/MEMORY.md" 2>/dev/null || true
    ssh "$USER@$SERVER_IP" "cat ~/.openclaw/agents/$agent/auth-profiles.json" > "$BACKUP_PATH/agents/$agent/auth-profiles.json" 2>/dev/null || true
    ssh "$USER@$SERVER_IP" "cat ~/.openclaw/agents/$agent/models.json" > "$BACKUP_PATH/agents/$agent/models.json" 2>/dev/null || true
done

# 备份渠道配置
echo "📡 备份渠道配置..."
ssh "$USER@$SERVER_IP" "find ~/.openclaw/telegram -name '*.json' 2>/dev/null" | while read -r file; do
    if [ -n "$file" ]; then
        ssh "$USER@$SERVER_IP" "cat $file" > "$BACKUP_PATH/channels/$(basename $(dirname $file))_$(basename $file)" 2>/dev/null || true
    fi
done
ssh "$USER@$SERVER_IP" "find ~/.openclaw/feishu -name '*.json' 2>/dev/null" | while read -r file; do
    if [ -n "$file" ]; then
        ssh "$USER@$SERVER_IP" "cat $file" > "$BACKUP_PATH/channels/$(basename $(dirname $file))_$(basename $file)" 2>/dev/null || true
    fi
done

# 设置备份文件权限
chmod -R 600 "$BACKUP_PATH/secrets"

# 显示备份摘要
echo ""
echo "========================================="
echo "✅ 备份完成！"
echo "备份位置: $BACKUP_PATH"
echo ""
echo "备份摘要:"
find "$BACKUP_PATH" -type f | wc -l | xargs -I {} echo "  - 文件数量: {}"
du -sh "$BACKUP_PATH" | awk '{print "  - 总大小: " $1}'
echo "========================================="
