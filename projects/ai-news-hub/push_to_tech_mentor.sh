#!/bin/bash
# 推送 AI Daily 到 tech-mentor

DAILY_FILE="/home/admin/ai-news-hub/data/daily_$(date +%Y%m%d).txt"

if [ ! -f "$DAILY_FILE" ]; then
    echo "错误: 未找到今日 AI Daily 文件"
    exit 1
fi

# 读取内容
CONTENT=$(cat "$DAILY_FILE")

# 使用 OpenClaw CLI 推送到 tech-mentor
# 注意: 需要在 OpenClaw 环境中执行
openclaw sessions send \
    --session-key "agent:tech-mentor:telegram:direct:8606756625" \
    --message "$CONTENT"

echo "已推送到 tech-mentor"
