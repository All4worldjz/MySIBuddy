#!/bin/bash
# run-all-cron-tasks.sh - 执行所有 OpenClaw Cron 任务并推送结果
# 用法: bash run-all-cron-tasks.sh [--dry-run]

set -uo pipefail

JOBS_FILE="/home/admin/.openclaw/cron/jobs.json"
LOG_DIR="/home/admin/.openclaw/logs/cron-exec"
REPORT_FILE="$LOG_DIR/exec-report-$(date +%Y%m%d_%H%M%S).md"
DRY_RUN="${1:-}"

mkdir -p "$LOG_DIR"

echo "============================================================"
echo "OpenClaw Cron 任务批量执行器"
echo "============================================================"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "日志目录: $LOG_DIR"
echo ""

# 读取 jobs.json
if ! command -v jq &>/dev/null; then
    echo "❌ 缺少 jq 命令，正在安装..."
    sudo dnf install -y jq 2>/dev/null || sudo yum install -y jq 2>/dev/null || pip3 install jq 2>/dev/null
fi

if [ ! -f "$JOBS_FILE" ]; then
    echo "❌ 找不到 $JOBS_FILE"
    exit 1
fi

# 获取任务数量
TOTAL_TASKS=$(jq '.jobs | length' "$JOBS_FILE")
echo "总计任务: $TOTAL_TASKS"
echo ""

# 初始化报告
cat > "$REPORT_FILE" << EOF
# OpenClaw Cron 任务执行报告

生成时间: $(date '+%Y-%m-%d %H:%M:%S %Z')

## 执行结果汇总

| # | 任务名称 | Agent | 状态 | 渠道 | 推送状态 |
|---|----------|-------|------|------|----------|
EOF

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# 逐个执行任务
for i in $(seq 0 $((TOTAL_TASKS - 1))); do
    JOB_NAME=$(jq -r ".jobs[$i].name" "$JOBS_FILE")
    AGENT_ID=$(jq -r ".jobs[$i].agentId" "$JOBS_FILE")
    ENABLED=$(jq -r ".jobs[$i].enabled" "$JOBS_FILE")
    DELIVERY_CHANNEL=$(jq -r ".jobs[$i].delivery.channel // \"none\"" "$JOBS_FILE")
    DELIVERY_MODE=$(jq -r ".jobs[$i].delivery.mode // \"announce\"" "$JOBS_FILE")
    DELIVERY_TO=$(jq -r ".jobs[$i].delivery.to // \"\"" "$JOBS_FILE")
    PAYLOAD_MESSAGE=$(jq -r ".jobs[$i].payload.message // \"\"" "$JOBS_FILE")
    TIMEOUT=$(jq -r ".jobs[$i].payload.timeoutSeconds // 120" "$JOBS_FILE")
    SCHEDULE_KIND=$(jq -r ".jobs[$i].schedule.kind" "$JOBS_FILE")
    SCHEDULE_EXPR=$(jq -r ".jobs[$i].schedule.expr // \"\"" "$JOBS_FILE")

    # 跳过禁用的任务
    if [ "$ENABLED" = "false" ]; then
        echo "[$((i+1))/$TOTAL_TASKS] ⏭️  跳过（已禁用）: $JOB_NAME"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        echo "| $((i+1)) | $JOB_NAME (禁用) | $AGENT_ID | ⏭️ 跳过 | - | - |" >> "$REPORT_FILE"
        continue
    fi

    # 跳过 delivery.mode=none 的任务（仅记录日志）
    if [ "$DELIVERY_MODE" = "none" ]; then
        echo "[$((i+1))/$TOTAL_TASKS] 📝 仅日志: $JOB_NAME"
        
        # 提取命令并执行
        CMD=$(echo "$PAYLOAD_MESSAGE" | grep -oP '(?<=bash|python3|cd ).*' | head -1)
        if [ -n "$CMD" ]; then
            FULL_CMD=$(echo "$PAYLOAD_MESSAGE" | grep -A5 -E '^(bash|python3|cd)' | tr '\n' ' ')
            if [ "$DRY_RUN" = "--dry-run" ]; then
                echo "  [DRY RUN] 将执行: $FULL_CMD"
            else
                echo "  正在执行..."
                LOG_FILE="$LOG_DIR/${JOB_NAME// /_}-$(date +%H%M%S).log"
                eval "$FULL_CMD" > "$LOG_FILE" 2>&1 &
                PID=$!
                
                # 等待完成或超时
                WAITED=0
                while kill -0 $PID 2>/dev/null; do
                    if [ $WAITED -ge $TIMEOUT ]; then
                        kill $PID 2>/dev/null
                        echo "  ⏱️  超时 (${TIMEOUT}s)"
                        break
                    fi
                    sleep 1
                    WAITED=$((WAITED + 1))
                done
                
                wait $PID 2>/dev/null
                EXIT_CODE=$?
                
                if [ $EXIT_CODE -eq 0 ]; then
                    echo "  ✅ 完成"
                    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                    echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ✅ 成功 | 仅日志 | 📝 |" >> "$REPORT_FILE"
                else
                    echo "  ❌ 失败 (退出码: $EXIT_CODE)"
                    FAIL_COUNT=$((FAIL_COUNT + 1))
                    echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ❌ 失败 | 仅日志 | 📝 |" >> "$REPORT_FILE"
                fi
            fi
        else
            echo "  ⚠️  无法提取命令"
            SKIP_COUNT=$((SKIP_COUNT + 1))
            echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ⚠️ 无法提取 | 仅日志 | - |" >> "$REPORT_FILE"
        fi
        continue
    fi

    # 执行需要推送的任务
    echo "[$((i+1))/$TOTAL_TASKS] 🚀 执行: $JOB_NAME"
    echo "  Agent: $AGENT_ID"
    echo "  渠道: $DELIVERY_CHANNEL"
    echo "  超时: ${TIMEOUT}s"

    if [ "$DRY_RUN" = "--dry-run" ]; then
        echo "  [DRY RUN] 跳过执行"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ⏭️ DRY RUN | $DELIVERY_CHANNEL | - |" >> "$REPORT_FILE"
        continue
    fi

    # 通过 openclaw 执行任务（使用 agentTurn 方式）
    LOG_FILE="$LOG_DIR/${JOB_NAME// /_}-$(date +%H%M%S).log"
    
    # 使用 openclaw message 工具发送执行请求
    # 注意：实际执行由 OpenClaw Gateway 调度
    # 这里我们直接触发 cron 任务的执行
    
    # 方式 1: 使用 openclaw cron run（如果支持）
    # 方式 2: 直接执行脚本并推送结果
    
    # 提取主要命令
    MAIN_CMD=$(echo "$PAYLOAD_MESSAGE" | grep -E '^(bash|python3|cd|openclaw)' | head -1)
    
    if [ -n "$MAIN_CMD" ]; then
        FULL_CMD=$(echo "$PAYLOAD_MESSAGE" | grep -A10 -E '^(bash|python3|cd|openclaw)' | tr '\n' '; ')
        
        echo "  正在执行: $MAIN_CMD"
        (eval "$FULL_CMD") > "$LOG_FILE" 2>&1 &
        PID=$!
        
        # 等待完成或超时
        WAITED=0
        while kill -0 $PID 2>/dev/null; do
            if [ $WAITED -ge $TIMEOUT ]; then
                kill $PID 2>/dev/null
                echo "  ⏱️  超时 (${TIMEOUT}s)"
                echo "⏱️  执行超时 (${TIMEOUT}s)" >> "$LOG_FILE"
                break
            fi
            sleep 2
            WAITED=$((WAITED + 2))
            if [ $((WAITED % 10)) -eq 0 ]; then
                echo "  等待中... ${WAITED}s/${TIMEOUT}s"
            fi
        done
        
        wait $PID 2>/dev/null
        EXIT_CODE=$?
        
        # 分析执行结果
        if [ $EXIT_CODE -eq 0 ]; then
            echo "  ✅ 执行成功"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            
            # 推送结果到指定渠道
            if [ "$DELIVERY_CHANNEL" = "telegram" ] && [ -n "$DELIVERY_TO" ]; then
                echo "  📤 推送结果到 Telegram: $DELIVERY_TO"
                # 使用 message 工具推送
                RESULT_MSG="✅ 任务执行成功\n\n任务: $JOB_NAME\nAgent: $AGENT_ID\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n退出码: 0\n\n日志: 已保存到 $LOG_DIR"
                echo "$RESULT_MSG" | openclaw message send --to "$DELIVERY_TO" --channel telegram 2>/dev/null || true
                echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ✅ 成功 | Telegram | 📤 已推送 |" >> "$REPORT_FILE"
            elif [ "$DELIVERY_CHANNEL" = "feishu" ] && [ -n "$DELIVERY_TO" ]; then
                echo "  📤 推送结果到飞书: $DELIVERY_TO"
                RESULT_MSG="✅ 任务执行成功\n\n任务: $JOB_NAME\nAgent: $AGENT_ID\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n退出码: 0"
                echo "$RESULT_MSG" | openclaw message send --to "$DELIVERY_TO" --channel feishu 2>/dev/null || true
                echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ✅ 成功 | Feishu | 📤 已推送 |" >> "$REPORT_FILE"
            else
                echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ✅ 成功 | $DELIVERY_CHANNEL | 📝 |" >> "$REPORT_FILE"
            fi
        else
            echo "  ❌ 执行失败 (退出码: $EXIT_CODE)"
            FAIL_COUNT=$((FAIL_COUNT + 1))
            
            # 推送错误到指定渠道
            if [ "$DELIVERY_CHANNEL" = "telegram" ] && [ -n "$DELIVERY_TO" ]; then
                echo "  🚨 推送错误到 Telegram: $DELIVERY_TO"
                ERROR_MSG="❌ 任务执行失败\n\n任务: $JOB_NAME\nAgent: $AGENT_ID\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n退出码: $EXIT_CODE\n\n请检查日志: $LOG_FILE"
                echo "$ERROR_MSG" | openclaw message send --to "$DELIVERY_TO" --channel telegram 2>/dev/null || true
                echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ❌ 失败 | Telegram | 🚨 已推送 |" >> "$REPORT_FILE"
            elif [ "$DELIVERY_CHANNEL" = "feishu" ] && [ -n "$DELIVERY_TO" ]; then
                echo "  🚨 推送错误到飞书: $DELIVERY_TO"
                ERROR_MSG="❌ 任务执行失败\n\n任务: $JOB_NAME\nAgent: $AGENT_ID\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n退出码: $EXIT_CODE"
                echo "$ERROR_MSG" | openclaw message send --to "$DELIVERY_TO" --channel feishu 2>/dev/null || true
                echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ❌ 失败 | Feishu | 🚨 已推送 |" >> "$REPORT_FILE"
            else
                echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ❌ 失败 | $DELIVERY_CHANNEL | 📝 |" >> "$REPORT_FILE"
            fi
        fi
    else
        echo "  ⚠️  无法提取命令"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        echo "| $((i+1)) | $JOB_NAME | $AGENT_ID | ⚠️ 无法提取 | $DELIVERY_CHANNEL | - |" >> "$REPORT_FILE"
    fi

    echo ""
done

# 生成汇总报告
cat >> "$REPORT_FILE" << EOF

## 统计

- 总计任务: $TOTAL_TASKS
- 成功: $SUCCESS_COUNT
- 失败: $FAIL_COUNT
- 跳过: $SKIP_COUNT

## 日志位置

所有日志保存在: \`$LOG_DIR/\`

---

报告生成时间: $(date '+%Y-%m-%d %H:%M:%S %Z')
EOF

echo ""
echo "============================================================"
echo "执行完成"
echo "============================================================"
echo "总计: $TOTAL_TASKS | 成功: $SUCCESS_COUNT | 失败: $FAIL_COUNT | 跳过: $SKIP_COUNT"
echo ""
echo "报告已保存: $REPORT_FILE"
echo "日志目录: $LOG_DIR"
