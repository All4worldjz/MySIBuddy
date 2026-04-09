#!/bin/bash
# AI News Hub Cron 脚本 - 每天早上 8 点运行

cd /home/admin/ai-news-hub
export PATH="/home/admin/.gemini-cli/node_modules/.bin:$PATH"
export GEMINI_USE_FILE_KEYCHAIN=1

# 运行主程序
/usr/bin/python3 scheduler.py >> data/cron.log 2>&1

# 推送结果到 Telegram（通过 OpenClaw sessions_send）
if [ -f data/daily_$(date +%Y%m%d).txt ]; then
    echo "今日 AI Daily 已生成"
fi
