#!/bin/bash
# CalDAV → 飞书日历 同步脚本（简化版）
# 运行：bash /home/admin/.openclaw/scripts/caldav_sync.sh
# 说明：从 WPS CalDAV 获取事件，通过 work-hub agent 写入飞书日历

set -e

CALDAV_USER="u_H7q73bsRsFUyck"
CALDAV_PASS="2HotzgGR5VDKiBqXwtYG50XbmZ"
STATE_FILE="/home/admin/.openclaw/data/caldav_sync_state.json"
OUTPUT_FILE="/home/admin/.openclaw/data/caldav_events_pending.json"

mkdir -p /home/admin/.openclaw/data

echo "=== CalDAV 同步开始 ==="

# 使用 curl 从 CalDAV 获取事件（简化处理）
# 实际应该用 caldav 库，这里用 curl 测试连通性
RESPONSE=$(curl -s -u "$CALDAV_USER:$CALDAV_PASS" -X PROPFIND https://caldav.wps.cn/ -H "Depth: 1" --max-time 30 2>/dev/null || echo "ERROR")

if [[ "$RESPONSE" == *"ERROR"* ]] || [[ "$RESPONSE" == *"401"* ]]; then
    echo "❌ CalDAV 连接失败"
    exit 1
fi

echo "✅ CalDAV 连接成功"

# 调用 Python 脚本解析并输出事件
python3 /home/admin/.openclaw/scripts/caldav_parse.py

echo "=== 同步完成 ==="
