#!/usr/bin/env bash
#
# ============================================================
# 系统健康异常告警脚本 (system_health_alert.sh)
# ============================================================
# 版本：v1.0.0
# 日期：2026-04-09
# 用途：每 30 分钟检查系统健康，超阈值立即推送告警（Telegram）
#
# ============================================================
# 依赖命令
# ============================================================
# df free ps uptime awk grep timeout openclaw
#
# ============================================================
# 告警阈值（与 hourly 报告一致）
# ============================================================
# 磁盘≥95% 🔴 | CPU≥90% 🔴 | 内存≥95% 🔴 | 负载比≥1.0 🔴 | Token≥90% 🔴
#
# ============================================================
# 执行示例
# ============================================================
# */30 * * * * bash /home/admin/.openclaw/scripts/system_health_alert.sh
#
# ============================================================

set -euo pipefail

readonly VERSION="v1.0.0"
readonly ALERT_FILE="/tmp/last_health_alert.json"
readonly COOLDOWN_MIN=30  # 同一告警 30 分钟内不重复

# --- 检查依赖 ---
for cmd in df ps uptime awk grep timeout; do
    command -v "$cmd" &>/dev/null || { echo "缺少命令：$cmd"; exit 1; }
done

# --- 告警状态 ---
ALERTS=()

# --- 读取上次告警时间 ---
get_last_alert() {
    local key="$1"
    if [[ -f "$ALERT_FILE" ]]; then
        grep "\"$key\"" "$ALERT_FILE" 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "0"
    else
        echo "0"
    fi
}

# --- 写入告警时间 ---
set_alert() {
    local key="$1" ts="$2"
    mkdir -p "$(dirname "$ALERT_FILE")"
    if [[ -f "$ALERT_FILE" ]]; then
        # 更新已有 key 或追加
        if grep -q "\"$key\"" "$ALERT_FILE"; then
            sed -i "s/\"$key\":[0-9]*/\"$key\":$ts/" "$ALERT_FILE"
        else
            sed -i 's/}$/,"'"$key"'":'"$ts"'}' "$ALERT_FILE"
        fi
    else
        echo "{\"$key\":$ts}" > "$ALERT_FILE"
    fi
}

# --- 检查磁盘 ---
check_disk() {
    local crit_usage
    crit_usage=$(df -hT -x tmpfs -x devtmpfs -x squashfs -x efivarfs -x vfat 2>/dev/null \
        | tail -n +2 \
        | awk '{gsub(/%/,"",$6); if(int($6)>=95) print int($6)"% "$7}' \
        | head -1)
    
    if [[ -n "$crit_usage" ]]; then
        local last_alert
        last_alert=$(get_last_alert "disk_crit")
        local now
        now=$(date +%s)
        if ((now - last_alert > COOLDOWN_MIN * 60)); then
            ALERTS+=("🔴 磁盘紧急：${crit_usage}")
            set_alert "disk_crit" "$now"
        fi
    fi
}

# --- 检查内存 ---
check_mem() {
    local mem_pct
    mem_pct=$(awk 'BEGIN{
        while((getline ln < "/proc/meminfo")>0){
            split(ln,a,":"); k=a[1]; v=a[2]; gsub(/^[ \t]+|[ \t]+kB$/,"",v)
            if(k=="MemTotal") mt=v; if(k=="MemFree") mf=v; if(k=="MemAvailable") ma=v
            if(k=="Buffers") mb=v; if(k=="Cached") mc=v
        }
        if(ma==0) ma=mf; mu=mt-mf-mb-mc; if(mu<0) mu=mt-mf
        printf "%.0f", (mt>0) ? mu/mt*100 : 0
    }' /dev/null)
    
    if ((mem_pct >= 95)); then
        local last_alert
        last_alert=$(get_last_alert "mem_crit")
        local now
        now=$(date +%s)
        if ((now - last_alert > COOLDOWN_MIN * 60)); then
            ALERTS+=("🔴 内存紧急：${mem_pct}%")
            set_alert "mem_crit" "$now"
        fi
    fi
}

# --- 检查负载 ---
check_load() {
    local l1 nc ratio
    l1=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    nc=$(nproc 2>/dev/null || echo 1)
    ratio=$(awk "BEGIN {printf \"%.2f\", $l1/$nc}")
    
    if awk "BEGIN {exit !($l1/$nc >= 1.0)}"; then
        local last_alert
        last_alert=$(get_last_alert "load_crit")
        local now
        now=$(date +%s)
        if ((now - last_alert > COOLDOWN_MIN * 60)); then
            ALERTS+=("🔴 负载紧急：${ratio} (核数:${nc})")
            set_alert "load_crit" "$now"
        fi
    fi
}

# --- 检查 OpenClaw Gateway ---
check_gateway() {
    command -v openclaw &>/dev/null || return
    local gw_status
    gw_status=$(timeout 5 openclaw gateway status 2>/dev/null | grep -oi "running\|stopped" | head -1 || echo "")
    
    if [[ "$gw_status" == "stopped" ]]; then
        local last_alert
        last_alert=$(get_last_alert "gw_stopped")
        local now
        now=$(date +%s)
        if ((now - last_alert > COOLDOWN_MIN * 60)); then
            ALERTS+=("🔴 Gateway 已停止")
            set_alert "gw_stopped" "$now"
        fi
    fi
}

# --- 检查 Memory 系统 ---
check_memory() {
    command -v openclaw &>/dev/null || return
    
    local status
    status=$(timeout 5 openclaw status --deep 2>/dev/null || echo "")
    
    local mem_line
    mem_line=$(echo "$status" | grep -i "memory" | head -1 || echo "")
    
    if [[ -n "$mem_line" ]]; then
        # 检查 FTS 状态（全文搜索）
        local fts
        fts=$(echo "$mem_line" | grep -oP 'fts \K[a-z]+' || echo "unknown")
        
        if [[ "$fts" != "ready" ]]; then
            local last_alert
            last_alert=$(get_last_alert "mem_fts_not_ready")
            local now
            now=$(date +%s)
            if ((now - last_alert > COOLDOWN_MIN * 60)); then
                ALERTS+=("🔴 Memory FTS 不可用：${fts}")
                set_alert "mem_fts_not_ready" "$now"
            fi
        fi
        
        # 检查向量索引状态（警告级别）
        local vector
        vector=$(echo "$mem_line" | grep -oP 'vector \K[a-z]+' || echo "unknown")
        
        if [[ "$vector" != "ready" ]]; then
            local last_alert
            last_alert=$(get_last_alert "mem_vector_unknown")
            local now
            now=$(date +%s)
            if ((now - last_alert > COOLDOWN_MIN * 60)); then
                ALERTS+=("🟡 Memory 向量索引：${vector}（语义搜索可能不可用）")
                set_alert "mem_vector_unknown" "$now"
            fi
        fi
    fi
}

# --- 发送告警 ---
send_alerts() {
    if [[ ${#ALERTS[@]} -eq 0 ]]; then
        echo "无紧急告警"
        return
    fi
    
    local msg="🚨 **系统紧急告警**\n\n"
    for alert in "${ALERTS[@]}"; do
        msg+="${alert}\n"
    done
    msg+="\n_时间：$(date '+%Y-%m-%d %H:%M') | ${VERSION}_"
    
    # 使用 message 工具发送（通过 chief-of-staff）
    echo "$msg"
}

# --- 主流程 ---
main() {
    check_disk
    check_mem
    check_load
    check_gateway
    check_memory  # 新增：Memory 系统健康检查
    send_alerts
}

main "$@"
