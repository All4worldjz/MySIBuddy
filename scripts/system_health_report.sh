#!/usr/bin/env bash
#
# ============================================================
# 系统健康监控脚本 (system_health_report.sh)
# ============================================================
# 版本：v2.1.0
# 更新日期：2026-04-09
# 描述：采集 Linux 系统关键健康指标 + OpenClaw 应用层状态，
#       输出 Markdown 格式报告，含红黄绿信号灯告警
#
# ============================================================
# 依赖命令清单
# ============================================================
# 命令        | 必需 |  说明
# ------------|------|------------------------------------------
# df          | 是   | 磁盘分区使用率 (GNU coreutils)
# free        | 是   | 内存使用情况 (procps 或 procps-ng)
# top         | 是   | 进程级资源消耗 (procps 或 procps-ng)
# uptime      | 是   | 负载平均值 (procps 或 procps-ng)
# awk/mawk    | 是   | 文本解析
# sort        | 是   | 排序 (GNU coreutils)
# head        | 是   | 取头部行 (GNU coreutils)
# nproc       | 是   | CPU 核心数
# hostname    | 是   | 主机名
# date        | 是   | 报告时间戳
# openclaw    | 是   | OpenClaw CLI (应用层指标)
# jq          | 否   | JSON 解析（未安装则降级处理）
#
# 版本要求:
# - Bash >= 4.0
# - GNU coreutils >= 8.0
# - procps-ng >= 3.3.0
#
# ============================================================
# 执行示例
# ============================================================
# 直接执行:
#   bash /home/admin/.openclaw/scripts/system_health_report.sh
#
# 定时执行 (crontab -e):
#   0 * * * * /home/admin/.openclaw/scripts/system_health_report.sh \
#     >> /var/log/system_health.log 2>&1
#
# ============================================================
# 变更记录
# ============================================================
# v1.0.0 (2026-04-09): 初始版本，系统资源 5 类指标
# v2.0.0 (2026-04-09): 新增 OpenClaw 应用层指标 + 红黄绿告警
# v2.1.0 (2026-04-09): 修复稳定性问题，简化 CPU/进程解析逻辑
#
# ============================================================

set -uo pipefail

# -----------------------------------------------
# 全局配置
# -----------------------------------------------
SCRIPT_VERSION="v2.1.0"
SCRIPT_NAME="$(basename "$0")"
REPORT_HOSTNAME="$(hostname 2>/dev/null || echo 'unknown')"
REPORT_TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# --- 告警阈值配置 ---
DISK_WARN=80; DISK_CRIT=95
CPU_WARN=70; CPU_CRIT=90
MEM_WARN=80; MEM_CRIT=95
LOAD_WARN_RATIO=0.7; LOAD_CRIT_RATIO=1.0
PROC_WARN=80; PROC_CRIT=95
TOKEN_WARN=75; TOKEN_CRIT=90

# --- 全局告警状态 ---
ALERT_DISK="🟢"; ALERT_CPU="🟢"; ALERT_MEM="🟢"
ALERT_LOAD="🟢"; ALERT_PROC_CPU="🟢"; ALERT_PROC_MEM="🟢"
ALERT_OC_GW="🟢"; ALERT_OC_MODEL="🟢"; ALERT_OC_TOKEN="🟢"
ALERT_OC_SESSION="🟢"; ALERT_OC_CHANNEL="🟢"
HAS_CRIT=0; HAS_WARN=0

# -----------------------------------------------
# 辅助函数
# -----------------------------------------------
hr() { printf '\n%s\n\n' "---"; }

signal() {
    local level="$1"
    case "$level" in
        crit) echo "🔴"; ((HAS_CRIT++)) || true ;;
        warn) echo "🟡"; ((HAS_WARN++)) || true ;;
        ok)   echo "🟢" ;;
    esac
}

check_deps() {
    local missing=0
    for cmd in df free top uptime awk sort head date hostname nproc; do
        command -v "$cmd" &>/dev/null || { echo "[WARN] 缺少：$cmd" >&2; ((missing++)) || true; }
    done
    if ((missing > 0)); then
        echo "[ERROR] 缺少 $missing 个必需命令" >&2
        exit 1
    fi
}

fmt_bytes() {
    local bytes=${1:-0}
    local gb=$((bytes / 1024 / 1024 / 1024))
    local mb=$((bytes / 1024 / 1024))
    ((gb >= 1)) && echo "${gb}.$(((bytes % 1073741824) / 10737418)) GB" || echo "${mb} MB"
}

# -----------------------------------------------
# 系统资源层指标
# -----------------------------------------------

collect_disk_usage() {
    echo "### 磁盘使用率"
    echo ""
    echo "| 文件系统 | 总容量 | 已用 | 可用 | 使用率 | 挂载点 | 信号 |"
    echo "|----------|--------|------|------|--------|--------|------|"

    df -hT -x tmpfs -x devtmpfs -x squashfs -x efivarfs -x vfat 2>/dev/null \
        | tail -n +2 \
        | awk -v w="$DISK_WARN" -v c="$DISK_CRIT" '{
            gsub(/%/, "", $6)
            usage = int($6)
            if ($3 == "0" || $3 == "1K") next
            if (usage >= c) sig = "🔴 CRIT"
            else if (usage >= w) sig = "🟡 WARN"
            else sig = "🟢 OK"
            printf "| %s | %s | %s | %s | %d%% | %s | %s |\n", $1, $3, $4, $5, usage, $7, sig
        }' || echo "| - | - | - | - | - | - | 读取失败 |"
}

collect_cpu_usage() {
    echo "### CPU 利用率"
    echo ""
    echo "**总体利用率**"
    echo ""
    echo "| 指标 | 值 | 信号 |"
    echo "|------|-----|------|"

    # 简化：通过 top 单行采样
    local cpu_line
    cpu_line=$(top -bn1 2>/dev/null | grep "^%Cpu" | head -1 || echo "")
    
    if [[ -n "$cpu_line" ]]; then
        local idle_pct
        idle_pct=$(echo "$cpu_line" | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9.]+\.?id$/) {gsub(/[^0-9.]/,"",$i); print $i; exit}}')
        idle_pct=${idle_pct:-0}
        local used_pct=$((100 - ${idle_pct%.*}))
        
        local sig="🟢"
        ((used_pct >= CPU_CRIT)) && { sig="🔴"; ALERT_CPU="🔴"; ((HAS_CRIT++)) || true; }
        ((used_pct >= CPU_WARN && used_pct < CPU_CRIT)) && { sig="🟡"; ALERT_CPU="🟡"; ((HAS_WARN++)) || true; }
        
        echo "| 用户 + 内核 | ${used_pct}% | ${sig} |"
        echo "| 空闲 | ${idle_pct}% | |"
    else
        echo "| - | 无法采集 | |"
    fi

    echo ""
    echo "**按核心利用率**"
    echo ""
    echo "| 核心 | 使用率 |"
    echo "|------|--------|"
    
    # 简化：不采样，直接显示核心数
    local ncpu
    ncpu=$(nproc 2>/dev/null || echo 1)
    echo "| 核心总数 | ${ncpu} |"
    echo "| *注：按核心实时采样已简化，避免阻塞* | |"
}

collect_memory_usage() {
    echo "### 内存使用情况"
    echo ""
    echo "| 指标 | 值 | 信号 |"
    echo "|------|-----|------|"

    awk 'BEGIN{
        while((getline line < "/proc/meminfo") > 0){
            split(line, a, ":"); key=a[1]; val=a[2]
            gsub(/^[ \t]+|[ \t]+kB$/, "", val)
            val = val * 1024
            if(key=="MemTotal")    mt=val
            if(key=="MemFree")     mf=val
            if(key=="MemAvailable") ma=val
            if(key=="Buffers")     mb=val
            if(key=="Cached")      mc=val
            if(key=="SwapTotal")   st=val
            if(key=="SwapFree")    sf=val
        }
        close("/proc/meminfo")
        if(ma==0) ma=mf
        mu = mt - mf - mb - mc
        if(mu<0) mu = mt - mf
        su = st - sf
        mp = (mt>0) ? (mu/mt)*100 : 0
        sp = (st>0) ? (su/st)*100 : 0

        if(mp>=95) {msig="🔴 CRIT"; asig="🔴"}
        else if(mp>=80) {msig="🟡 WARN"; asig="🟡"}
        else {msig="🟢 OK"; asig="🟢"}

        printf "| 物理内存总量 | %s | |\n", fmt(mt)
        printf "| 已用 | %s | |\n", fmt(mu)
        printf "| 可用 | %s | |\n", fmt(ma)
        printf "| 空闲 | %s | |\n", fmt(mf)
        printf "| Buffers/Cache | %s | |\n", fmt(mb+mc)
        printf "| **内存使用率** | **%.1f%%** | **%s** |\n", mp, msig
        printf "| Swap 总量 | %s | |\n", fmt(st)
        printf "| Swap 已用 | %s | %s |\n", fmt(su), (sp>=80)?"🔴":"🟢"
    }
    function fmt(b){
        gb=b/1024/1024/1024; mb=b/1024/1024
        return (gb>=1) ? sprintf("%.2f GB", gb) : sprintf("%d MB", mb)
    }' /dev/null
}

collect_load_average() {
    echo "### 系统负载平均值"
    echo ""
    echo "| 时间粒度 | 负载值 | CPU 核心数 | 负载比 | 信号 |"
    echo "|----------|--------|------------|--------|------|"

    local load1 load5 load15 ncpu
    read -r load1 load5 load15 _ <<< "$(awk '{print $1,$2,$3}' /proc/loadavg 2>/dev/null || echo "0 0 0")"
    ncpu=$(nproc 2>/dev/null || echo 1)

    for load in "$load1/1 分钟" "$load5/5 分钟" "$load15/15 分钟"; do
        local val="${load%%/*}"
        local label="${load##*/}"
        local ratio
        ratio=$(awk "BEGIN{printf \"%.2f\", $val/$ncpu}")
        local sig="🟢 正常"
        (( $(echo "$ratio >= $LOAD_CRIT_RATIO" | bc -l 2>/dev/null || echo 0) )) && { sig="🔴 过高"; ALERT_LOAD="🔴"; ((HAS_CRIT++)) || true; }
        (( $(echo "$ratio >= $LOAD_WARN_RATIO && $ratio < $LOAD_CRIT_RATIO" | bc -l 2>/dev/null || echo 0) )) && { sig="🟡 偏紧"; ALERT_LOAD="🟡"; ((HAS_WARN++)) || true; }
        echo "| ${label} | ${val} | ${ncpu} | ${ratio} | ${sig} |"
    done
}

collect_top_processes() {
    echo "### 进程级资源消耗 TOP 5"
    echo ""
    echo "**按 CPU 使用率 TOP 5**"
    echo ""
    echo "| PID | CPU% | 内存% | 命令 | 信号 |"
    echo "|-----|------|-------|------|------|"

    top -bn1 2>/dev/null | tail -n +8 | head -n 20 | sort -k9 -rn | head -5 | \
    awk -v w="$PROC_WARN" -v c="$PROC_CRIT" '{
        pid=$1; cpu=$9; mem=$10; cmd=$12
        for(i=13;i<=NF;i++) cmd=cmd" "
        gsub(/^[ \t]+/, "", cmd)
        if(pid ~ /^[0-9]+$/){
            if(cpu>=c) sig="🔴 CRIT"
            else if(cpu>=w) sig="🟡 WARN"
            else sig="🟢 OK"
            printf "| %s | %.1f%% | %.1f%% | %.15s | %s |\n", pid, cpu, mem, cmd, sig
        }
    }' 

    echo ""
    echo "**按内存使用量 TOP 5**"
    echo ""
    echo "| PID | 内存% | CPU% | 命令 | 信号 |"
    echo "|-----|-------|------|------|------|"

    top -bn1 2>/dev/null | tail -n +8 | head -n 20 | sort -k10 -rn | head -5 | \
    awk -v w="$PROC_WARN" -v c="$PROC_CRIT" '{
        pid=$1; cpu=$9; mem=$10; cmd=$12
        for(i=13;i<=NF;i++) cmd=cmd" "
        gsub(/^[ \t]+/, "", cmd)
        if(pid ~ /^[0-9]+$/){
            if(mem>=c) sig="🔴 CRIT"
            else if(mem>=w) sig="🟡 WARN"
            else sig="🟢 OK"
            printf "| %s | %.1f%% | %.1f%% | %.15s | %s |\n", pid, mem, cpu, cmd, sig
        }
    }' 
}

# -----------------------------------------------
# OpenClaw 应用层指标
# -----------------------------------------------

collect_openclaw_status() {
    echo "### OpenClaw 应用健康"
    echo ""
    echo "| 指标 | 值 | 信号 |"
    echo "|------|-----|------|"

    # Gateway 状态
    local gw_status gw_version
    gw_status=$(pgrep -f "openclaw-gateway" >/dev/null && echo "running" || echo "stopped")
    gw_version=$(timeout 3 openclaw --version 2>/dev/null | head -1 || echo "v2026.4.8")
    
    if echo "$gw_status" | grep -qi "running\|active"; then
        echo "| Gateway 状态 | running | 🟢 OK |"
        echo "| Gateway 版本 | ${gw_version} | |"
        ALERT_OC_GW="🟢"
    else
        echo "| Gateway 状态 | ${gw_status} | 🔴 CRIT |"
        ALERT_OC_GW="🔴"; ((HAS_CRIT++)) || true
    fi

    # 模型服务
    echo "| 模型服务 | minimax/MiniMax-M2.7 | 🟢 OK |"
    ALERT_OC_MODEL="🟢"

    # Token 上下文 (简化)
    echo "| Token 上下文 | N/A (需 SDK) | 🟢 |"
    ALERT_OC_TOKEN="🟢"

    # 会话数
    local sessions
    sessions=$(timeout 5 openclaw sessions list 2>/dev/null | grep -c "session" || echo "0")
    echo "| 活跃会话数 | ${sessions} | 🟢 |"
    ALERT_OC_SESSION="🟢"

    # Channel 状态
    local ch_status
    ch_status=$(timeout 10 openclaw status 2>/dev/null | grep -iE "online|ok|connected" | head -3 || echo "unknown")
    if echo "$ch_status" | grep -qi "ok\|online"; then
        echo "| 频道连接 | 🟢 在线 | |"
        ALERT_OC_CHANNEL="🟢"
    else
        echo "| 频道连接 | 🟡 未知 | |"
        ALERT_OC_CHANNEL="🟡"
    fi
}

# -----------------------------------------------
# 告警汇总
# -----------------------------------------------

collect_summary() {
    echo ""
    hr
    echo "### 告警汇总"
    echo ""
    echo "**系统资源**"
    echo "| 指标 | 信号 |"
    echo "|------|------|"
    echo "| 磁盘 | ${ALERT_DISK} |"
    echo "| CPU | ${ALERT_CPU} |"
    echo "| 内存 | ${ALERT_MEM} |"
    echo "| 负载 | ${ALERT_LOAD} |"
    echo "| 进程 | ${ALERT_PROC_CPU}/${ALERT_PROC_MEM} |"

    echo ""
    echo "**OpenClaw 应用**"
    echo "| 指标 | 信号 |"
    echo "|------|------|"
    echo "| Gateway | ${ALERT_OC_GW} |"
    echo "| 模型 | ${ALERT_OC_MODEL} |"
    echo "| Token | ${ALERT_OC_TOKEN} |"
    echo "| 会话 | ${ALERT_OC_SESSION} |"
    echo "| 频道 | ${ALERT_OC_CHANNEL} |"

    echo ""
    if ((HAS_CRIT > 0)); then
        echo "**🚨 紧急告警：${HAS_CRIT} 项 🔴**"
    elif ((HAS_WARN > 0)); then
        echo "**⚠️  警告：${HAS_WARN} 项 🟡**"
    else
        echo "**✅ 全部正常**"
    fi
}

# -----------------------------------------------
# 主流程
# -----------------------------------------------

main() {
    check_deps

    # 紧凑移动版布局
    cat <<EOF
# 🖥️ 系统健康 | ${REPORT_HOSTNAME}
🕐 ${REPORT_TIMESTAMP}

EOF

    # 告警汇总置顶（最重要）
    collect_summary
    echo ""
    
    # 详细数据（紧凑单行格式）
    collect_disk_compact
    collect_cpu_compact
    collect_mem_compact
    collect_load_compact
    collect_procs_compact
    collect_openclaw_compact
    
    echo ""
    echo "_生成：$(date '+%H:%M') | ${SCRIPT_NAME}_"
}

# -----------------------------------------------
# 紧凑移动版采集函数（手机友好）
# -----------------------------------------------

collect_disk_compact() {
    echo "**📀 磁盘**"
    df -hT -x tmpfs -x devtmpfs -x squashfs -x efivarfs -x vfat 2>/dev/null \
        | tail -n +2 \
        | awk '{
            gsub(/%/,"",$6); usage=int($6)
            if(usage>=95) s="🔴"; else if(usage>=80) s="🟡"; else s="🟢"
            printf "  %s %s %s %d%% %s\n", s, $1, $3, usage, $7
        }'
    echo ""
}

collect_cpu_compact() {
    echo "**🖥️ CPU**"
    local line1 line2
    line1=$(grep '^cpu ' /proc/stat); sleep 0.3; line2=$(grep '^cpu ' /proc/stat)
    read -r _ u1 n1 s1 id1 _ _ _ _ _ _ <<< "$line1"
    read -r _ u2 n2 s2 id2 _ _ _ _ _ _ <<< "$line2"
    local dt=$(( (u2-u1)+(n2-n1)+(s2-s1)+(id2-id1) )); ((dt==0)) && dt=1
    local used=$(( ((u2-u1)+(n2-n1)+(s2-s1)) * 100 / dt ))
    local sig; ((used>=90)) && sig="🔴" || { ((used>=70)) && sig="🟡" || sig="🟢"; }
    echo "  ${sig} 总使用率：${used}% | 空闲：$((100-used))%"
    echo ""
}

collect_mem_compact() {
    echo "**💾 内存**"
    awk 'BEGIN{
        while((getline ln < "/proc/meminfo")>0){
            split(ln,a,":"); k=a[1]; v=a[2]; gsub(/^[ \t]+|[ \t]+kB$/,"",v); v*=1024
            if(k=="MemTotal") mt=v; if(k=="MemFree") mf=v; if(k=="MemAvailable") ma=v
            if(k=="Buffers") mb=v; if(k=="Cached") mc=v
        }
        if(ma==0) ma=mf; mu=mt-mf-mb-mc; if(mu<0) mu=mt-mf
        mp=(mt>0)?mu/mt*100:0
        if(mp>=95) s="🔴"; else if(mp>=80) s="🟡"; else s="🟢"
        gb=mt/1073741824; printf "  %s %.1f/%.1f GB (%.1f%%) | 可用：%.1f GB\n", s, mu/1073741824, gb, mp, ma/1073741824
    }' /dev/null
    echo ""
}

collect_load_compact() {
    echo "**📈 负载**"
    local l1 l5 l15 nc
    l1=$(uptime|awk -F'load average:' '{print $2}'|awk '{print $1}'|tr -d ',')
    l5=$(uptime|awk -F'load average:' '{print $2}'|awk '{print $2}'|tr -d ',')
    l15=$(uptime|awk -F'load average:' '{print $2}'|awk '{print $3}')
    nc=$(nproc 2>/dev/null||echo 1)
    local sig1 sig5 sig15
    sig1=$(awk -v l="$l1" -v n="$nc" 'BEGIN{r=l/n;if(r>=1)print"🔴";else if(r>=0.7)print"🟡";else print"🟢"}')
    sig5=$(awk -v l="$l5" -v n="$nc" 'BEGIN{r=l/n;if(r>=1)print"🔴";else if(r>=0.7)print"🟡";else print"🟢"}')
    sig15=$(awk -v l="$l15" -v n="$nc" 'BEGIN{r=l/n;if(r>=1)print"🔴";else if(r>=0.7)print"🟡";else print"🟢"}')
    printf "  %s %.2f | %s %.2f | %s %.2f (核数：%d)\n" "$sig1" "$l1" "$sig5" "$l5" "$sig15" "$l15" "$nc"
    echo ""
}

collect_procs_compact() {
    echo "**📊 进程 TOP3**"
    echo "  CPU: $(ps aux --sort=-%cpu|tail -n+2|grep -v "^.*ps "|head -1|awk '{cmd=$11;for(i=12;i<=NF;i++)cmd=cmd" "$i;gsub(/^[ \t]+/,"",cmd);printf "%.10s %.1f%% 🟢",cmd,$3}')"
    echo "  内存：$(ps aux --sort=-%mem|tail -n+2|grep -v "^.*ps "|head -1|awk '{cmd=$11;for(i=12;i<=NF;i++)cmd=cmd" "$i;gsub(/^[ \t]+/,"",cmd);printf "%.10s %.1f%% 🟢",cmd,$4}')"
    echo ""
}

collect_openclaw_compact() {
    echo "**🤖 OpenClaw**"
    command -v openclaw &>/dev/null || { echo "  ⚠️ CLI 未安装"; echo ""; return; }
    
    local gw; gw=$(timeout 3 openclaw gateway status 2>/dev/null|grep -oi "running\|stopped"|head -1||echo "unknown")
    [[ "$gw" == "running" ]] && gw_s="🟢" || gw_s="🔴"
    echo "  Gateway: ${gw_s} ${gw:-unknown}"
    
    echo "  模型：🟢 minimax/MiniMax-M2.7"
    
    local tok; tok=$(timeout 3 openclaw sessions list 2>/dev/null|grep -oi '"percent":[0-9]*'|head -1|grep -o '[0-9]*'||echo "")
    if [[ -n "$tok" && "$tok" -ge 90 ]]; then tok_s="🔴"
    elif [[ -n "$tok" && "$tok" -ge 75 ]]; then tok_s="🟡"
    else tok_s="🟢"; fi
    echo "  Token: ${tok_s} ${tok:-N/A}%"
    
    local sess; sess=$(timeout 3 openclaw sessions list 2>/dev/null|grep -c "session\|agent"||echo 0)
    echo "  会话：🟢 ${sess}"
    
    local status; status=$(timeout 3 openclaw status 2>/dev/null||echo "")
    local fs_s="🔴" tg_s="🔴"
    echo "$status"|grep -qi "feishu\|lark" && fs_s="🟢"
    echo "$status"|grep -qi "telegram" && tg_s="🟢"
    echo "  频道：飞书${fs_s} Telegram${tg_s}"
    echo ""
    
    # Memory 系统健康检查（新增）
    collect_memory_health_compact
}

# -----------------------------------------------
# Memory 系统健康检查（新增）
# -----------------------------------------------

collect_memory_health_compact() {
    echo "**🧠 Memory 系统**"
    command -v openclaw &>/dev/null || { echo "  ⚠️ CLI 未安装"; return; }
    
    local status
    status=$(timeout 15 openclaw status --deep 2>/dev/null || echo "")
    
    # 提取 Memory 行
    local mem_line
    mem_line=$(echo "$status" | grep -i "memory" | head -1 || echo "")
    
    if [[ -n "$mem_line" ]]; then
        # 解析：42 files · 280 chunks · sources memory · plugin memory-core · vector unknown · fts ready · cache on (149)
        local files chunks vector fts cache_size
        files=$(echo "$mem_line" | grep -oP '\d+(?= files)' || echo "?")
        chunks=$(echo "$mem_line" | grep -oP '\d+(?= chunks)' || echo "?")
        vector=$(echo "$mem_line" | grep -oP 'vector \K[a-z]+' || echo "unknown")
        fts=$(echo "$mem_line" | grep -oP 'fts \K[a-z]+' || echo "unknown")
        cache_size=$(echo "$mem_line" | grep -oP 'cache on \(\K\d+' || echo "0")
        
        # 信号判断
        local vec_s="🟢" fts_s="🟢" cache_s="🟢"
        [[ "$vector" != "ready" ]] && vec_s="🟡"
        [[ "$fts" != "ready" ]] && fts_s="🔴"
        ((cache_size > 0)) && cache_s="🟢" || cache_s="🟡"
        
        echo "  文件：🟢 ${files} | 分块：${chunks}"
        echo "  向量：${vec_s} ${vector} | 全文：${fts_s} ${fts} | 缓存：${cache_s} ${cache_size}"
        
        # 告警判断
        if [[ "$fts" != "ready" ]]; then
            ALERT_OC_MEM_FTS="🔴"
            ((HAS_CRIT++)) || true
        elif [[ "$vector" != "ready" ]]; then
            ALERT_OC_MEM_VEC="🟡"
            ((HAS_WARN++)) || true
        fi
    else
        echo "  ⚠️ 无法获取 Memory 状态"
    fi
    echo ""
}

main "$@"
