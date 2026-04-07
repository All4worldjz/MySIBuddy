#!/bin/bash
#
# OpenClaw 配置备份脚本
# 用途：备份远程服务器上的 OpenClaw 配置、记忆和系统文件到本地仓库
#
# 用法：
#   ./backup_openclaw_config.sh [选项]
#
# 选项：
#   --config     仅备份配置文件（AGENTS.md等）
#   --memory     仅备份记忆文件（memory目录）
#   --system     仅备份系统配置（JSON文件）
#   --all        备份全部（默认）
#   --dry-run    仅显示将执行的操作，不实际执行
#
# 示例：
#   ./backup_openclaw_config.sh --all
#   ./backup_openclaw_config.sh --config --memory
#

set -e

#===========================================
# 配置区域
#===========================================

REMOTE_HOST="admin@47.82.234.46"
REMOTE_BASE="/home/admin/.openclaw"
LOCAL_BASE="$(cd "$(dirname "$0")/.." && pwd)/docs"

# 备份目录名称（带日期）
BACKUP_DATE=$(date +%Y%m%d)
CONFIG_BACKUP_DIR="${LOCAL_BASE}/agents-config-backup-${BACKUP_DATE}"
MEMORY_BACKUP_DIR="${LOCAL_BASE}/agents-memory-backup-${BACKUP_DATE}"
SYSTEM_BACKUP_DIR="${LOCAL_BASE}/openclaw-config-backup-${BACKUP_DATE}"

# Agent列表
AGENTS="chief-of-staff work-hub venture-hub life-hub product-studio zh-scribe tech-mentor coder-hub"

# 获取workspace名称（去掉后缀）
get_workspace_name() {
    local agent="$1"
    case "$agent" in
        chief-of-staff) echo "chief" ;;
        zh-scribe) echo "zh-scribe" ;;
        tech-mentor) echo "tech-mentor" ;;
        coder-hub) echo "coder" ;;
        *) echo "${agent%-*}" ;;  # 去掉 -hub, -studio 等后缀
    esac
}

#===========================================
# 颜色输出
#===========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

#===========================================
# 参数解析
#===========================================

BACKUP_CONFIG=false
BACKUP_MEMORY=false
BACKUP_SYSTEM=false
DRY_RUN=false

if [ $# -eq 0 ]; then
    BACKUP_CONFIG=true
    BACKUP_MEMORY=true
    BACKUP_SYSTEM=true
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            BACKUP_CONFIG=true
            shift
            ;;
        --memory)
            BACKUP_MEMORY=true
            shift
            ;;
        --system)
            BACKUP_SYSTEM=true
            shift
            ;;
        --all)
            BACKUP_CONFIG=true
            BACKUP_MEMORY=true
            BACKUP_SYSTEM=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            head -20 "$0" | tail -18
            exit 0
            ;;
        *)
            log_error "未知选项: $1"
            exit 1
            ;;
    esac
done

#===========================================
# 功能函数
#===========================================

check_ssh_connection() {
    log_info "检查SSH连接..."
    if ssh -o ConnectTimeout=10 -o BatchMode=yes ${REMOTE_HOST} "echo 'SSH连接成功'" > /dev/null 2>&1; then
        log_success "SSH连接正常"
        return 0
    else
        log_error "无法连接到 ${REMOTE_HOST}"
        log_error "请确保SSH密钥已配置或正在运行SSH代理"
        return 1
    fi
}

create_backup_dirs() {
    local dirs=()
    
    if [ "$BACKUP_CONFIG" = true ]; then
        dirs+=("$CONFIG_BACKUP_DIR")
        for agent in $AGENTS; do
            dirs+=("$CONFIG_BACKUP_DIR/$agent")
        done
    fi
    
    if [ "$BACKUP_MEMORY" = true ]; then
        dirs+=("$MEMORY_BACKUP_DIR")
        for agent in $AGENTS; do
            dirs+=("$MEMORY_BACKUP_DIR/$agent")
        done
    fi
    
    if [ "$BACKUP_SYSTEM" = true ]; then
        dirs+=("$SYSTEM_BACKUP_DIR")
        dirs+=("$SYSTEM_BACKUP_DIR/agents")
        dirs+=("$SYSTEM_BACKUP_DIR/devices")
        dirs+=("$SYSTEM_BACKUP_DIR/identity")
        dirs+=("$SYSTEM_BACKUP_DIR/cron")
        dirs+=("$SYSTEM_BACKUP_DIR/extensions")
        dirs+=("$SYSTEM_BACKUP_DIR/shared-auth")
        dirs+=("$SYSTEM_BACKUP_DIR/telegram")
        dirs+=("$SYSTEM_BACKUP_DIR/feishu")
        dirs+=("$SYSTEM_BACKUP_DIR/logs")
    fi
    
    for dir in "${dirs[@]}"; do
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] mkdir -p $dir"
        else
            mkdir -p "$dir"
        fi
    done
}

backup_config() {
    log_info "开始备份 Agents 配置文件..."

    local total_files=0

    for agent in $AGENTS; do
        local workspace=$(get_workspace_name "$agent")
        log_info "  备份 $agent (workspace-$workspace) ..."

        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] rsync -avz --exclude='node_modules' --exclude='.private' --exclude='sessions' --exclude='*.json' --exclude='*.py' ${REMOTE_HOST}:${REMOTE_BASE}/workspace-${workspace}/ ${CONFIG_BACKUP_DIR}/${agent}/"
            continue
        fi

        # 使用rsync同步，排除node_modules、sessions、json文件
        rsync -avz \
            --exclude='node_modules' \
            --exclude='.private' \
            --exclude='sessions' \
            --exclude='*.json' \
            --exclude='*.py' \
            --exclude='package.json' \
            --exclude='package-lock.json' \
            --exclude='tsconfig.json' \
            "${REMOTE_HOST}:${REMOTE_BASE}/workspace-${workspace}/" \
            "${CONFIG_BACKUP_DIR}/${agent}/" 2>/dev/null

        local count=$(find "${CONFIG_BACKUP_DIR}/${agent}" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        total_files=$((total_files + count))
    done

    # 创建README
    if [ "$DRY_RUN" = false ]; then
        create_config_readme
    fi

    log_success "配置备份完成: ${total_files} 个 md 文件"
}

backup_memory() {
    log_info "开始备份 Agents 记忆文件..."

    local total_files=0

    for agent in $AGENTS; do
        local workspace=$(get_workspace_name "$agent")
        
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] rsync -avz ${REMOTE_HOST}:${REMOTE_BASE}/workspace-${workspace}/memory/ ${MEMORY_BACKUP_DIR}/${agent}/"
            continue
        fi

        rsync -avz \
            "${REMOTE_HOST}:${REMOTE_BASE}/workspace-${workspace}/memory/" \
            "${MEMORY_BACKUP_DIR}/${agent}/" 2>/dev/null

        local count=$(find "${MEMORY_BACKUP_DIR}/${agent}" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        total_files=$((total_files + count))
    done

    # 创建README
    if [ "$DRY_RUN" = false ]; then
        create_memory_readme
    fi

    log_success "记忆备份完成: ${total_files} 个 md 文件"
}

backup_system() {
    log_info "开始备份 OpenClaw 系统配置..."
    
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] scp ${REMOTE_HOST}:${REMOTE_BASE}/openclaw.json ${SYSTEM_BACKUP_DIR}/"
        echo "[DRY-RUN] ... 以及其他系统配置文件"
        return
    fi
    
    # 主配置
    scp "${REMOTE_HOST}:${REMOTE_BASE}/openclaw.json" "${SYSTEM_BACKUP_DIR}/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/exec-approvals.json" "${SYSTEM_BACKUP_DIR}/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/update-check.json" "${SYSTEM_BACKUP_DIR}/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/subagents/runs.json" "${SYSTEM_BACKUP_DIR}/subagents-runs.json" 2>/dev/null
    
    # Agents配置
    for agent in $AGENTS; do
        mkdir -p "${SYSTEM_BACKUP_DIR}/agents/${agent}"
        scp "${REMOTE_HOST}:${REMOTE_BASE}/agents/${agent}/agent/auth-profiles.json" \
            "${SYSTEM_BACKUP_DIR}/agents/${agent}/" 2>/dev/null
        scp "${REMOTE_HOST}:${REMOTE_BASE}/agents/${agent}/agent/models.json" \
            "${SYSTEM_BACKUP_DIR}/agents/${agent}/" 2>/dev/null
    done
    
    # 设备配置
    scp "${REMOTE_HOST}:${REMOTE_BASE}/devices/paired.json" "${SYSTEM_BACKUP_DIR}/devices/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/devices/pending.json" "${SYSTEM_BACKUP_DIR}/devices/" 2>/dev/null
    
    # 身份配置
    scp "${REMOTE_HOST}:${REMOTE_BASE}/identity/device.json" "${SYSTEM_BACKUP_DIR}/identity/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/identity/device-auth.json" "${SYSTEM_BACKUP_DIR}/identity/" 2>/dev/null
    
    # 定时任务
    scp "${REMOTE_HOST}:${REMOTE_BASE}/cron/jobs.json" "${SYSTEM_BACKUP_DIR}/cron/" 2>/dev/null
    
    # 共享认证
    scp "${REMOTE_HOST}:${REMOTE_BASE}/shared-auth/auth-profiles.shared.json" \
        "${SYSTEM_BACKUP_DIR}/shared-auth/" 2>/dev/null
    
    # Telegram配置（非敏感）
    scp "${REMOTE_HOST}:${REMOTE_BASE}/credentials/telegram-chief-allowFrom.json" \
        "${SYSTEM_BACKUP_DIR}/telegram/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/credentials/telegram-personal-allowFrom.json" \
        "${SYSTEM_BACKUP_DIR}/telegram/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/credentials/telegram-pairing.json" \
        "${SYSTEM_BACKUP_DIR}/telegram/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/telegram/update-offset-chief.json" \
        "${SYSTEM_BACKUP_DIR}/telegram/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/telegram/update-offset-personal.json" \
        "${SYSTEM_BACKUP_DIR}/telegram/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/telegram/update-offset-mentor.json" \
        "${SYSTEM_BACKUP_DIR}/telegram/" 2>/dev/null
    
    # 飞书配置（非敏感）
    scp "${REMOTE_HOST}:${REMOTE_BASE}/credentials/feishu-work-allowFrom.json" \
        "${SYSTEM_BACKUP_DIR}/feishu/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/credentials/feishu-scribe-allowFrom.json" \
        "${SYSTEM_BACKUP_DIR}/feishu/" 2>/dev/null
    scp "${REMOTE_HOST}:${REMOTE_BASE}/credentials/feishu-pairing.json" \
        "${SYSTEM_BACKUP_DIR}/feishu/" 2>/dev/null
    
    # 插件配置
    scp "${REMOTE_HOST}:${REMOTE_BASE}/extensions/openclaw-lark/openclaw.plugin.json" \
        "${SYSTEM_BACKUP_DIR}/extensions/" 2>/dev/null
    
    # 日志配置
    scp "${REMOTE_HOST}:${REMOTE_BASE}/logs/config-health.json" \
        "${SYSTEM_BACKUP_DIR}/logs/" 2>/dev/null
    
    # 创建README
    create_system_readme
    
    local count=$(find "${SYSTEM_BACKUP_DIR}" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
    log_success "系统配置备份完成: ${count} 个 json 文件"
}

create_config_readme() {
    cat > "${CONFIG_BACKUP_DIR}/README.md" << 'EOF'
# Agents 配置备份

## 备份来源

- **远程服务器**：`admin@47.82.234.46`
- **备份时间**：$(date '+%Y-%m-%d %H:%M:%S')
- **备份方式**：rsync 同步所有 workspace 目录

## 目录结构

```
agents-config-backup-YYYYMMDD/
├── chief-of-staff/
├── work-hub/
├── venture-hub/
├── life-hub/
├── product-studio/
├── zh-scribe/
├── tech-mentor/
└── README.md
```

## 恢复方法

恢复单个 agent 的配置：

```bash
scp -r docs/agents-config-backup-YYYYMMDD/work-hub/* \
    admin@47.82.234.46:/home/admin/.openclaw/workspace-work/
```
EOF
}

create_memory_readme() {
    cat > "${MEMORY_BACKUP_DIR}/README.md" << 'EOF'
# Agents Memory 备份

## 备份来源

- **远程服务器**：`admin@47.82.234.46`
- **备份时间**：$(date '+%Y-%m-%d %H:%M:%S')

## 恢复方法

恢复单个 agent 的记忆：

```bash
rsync -avz docs/agents-memory-backup-YYYYMMDD/work-hub/ \
    admin@47.82.234.46:/home/admin/.openclaw/workspace-work/memory/
```
EOF
}

create_system_readme() {
    cat > "${SYSTEM_BACKUP_DIR}/README.md" << 'EOF'
# OpenClaw 系统配置备份

## 备份来源

- **远程服务器**：`admin@47.82.234.46`
- **备份时间**：$(date '+%Y-%m-%d %H:%M:%S')

## 已排除的敏感文件

以下文件包含密钥，**未备份**：
- `credentials/lark.secrets.json`
- `runtime-secrets.json`

## 恢复方法

恢复主配置：

```bash
scp openclaw.json admin@47.82.234.46:/home/admin/.openclaw/openclaw.json
ssh admin@47.82.234.46 'openclaw restart'
```
EOF
}

print_summary() {
    echo ""
    echo "=========================================="
    echo "备份汇总"
    echo "=========================================="
    echo "备份日期: ${BACKUP_DATE}"
    echo ""
    
    if [ "$BACKUP_CONFIG" = true ] && [ -d "$CONFIG_BACKUP_DIR" ]; then
        local config_count=$(find "$CONFIG_BACKUP_DIR" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "配置备份: ${CONFIG_BACKUP_DIR}"
        echo "  - ${config_count} 个 md 文件"
    fi
    
    if [ "$BACKUP_MEMORY" = true ] && [ -d "$MEMORY_BACKUP_DIR" ]; then
        local memory_count=$(find "$MEMORY_BACKUP_DIR" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "记忆备份: ${MEMORY_BACKUP_DIR}"
        echo "  - ${memory_count} 个 md 文件"
    fi
    
    if [ "$BACKUP_SYSTEM" = true ] && [ -d "$SYSTEM_BACKUP_DIR" ]; then
        local system_count=$(find "$SYSTEM_BACKUP_DIR" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "系统配置: ${SYSTEM_BACKUP_DIR}"
        echo "  - ${system_count} 个 json 文件"
    fi
    
    echo ""
    echo "本地仓库: ${LOCAL_BASE}"
    echo "=========================================="
}

#===========================================
# 主流程
#===========================================

main() {
    echo ""
    echo "=========================================="
    echo " OpenClaw 配置备份工具"
    echo "=========================================="
    echo "远程服务器: ${REMOTE_HOST}"
    echo "本地目录:   ${LOCAL_BASE}"
    echo ""
    echo "备份选项:"
    [ "$BACKUP_CONFIG" = true ] && echo "  [x] 配置文件 (AGENTS.md等)"
    [ "$BACKUP_MEMORY" = true ] && echo "  [x] 记忆文件 (memory目录)"
    [ "$BACKUP_SYSTEM" = true ] && echo "  [x] 系统配置 (JSON文件)"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY-RUN 模式：仅显示将执行的操作"
    fi
    
    # 检查SSH连接
    if [ "$DRY_RUN" = false ]; then
        check_ssh_connection || exit 1
    fi
    
    # 创建备份目录
    create_backup_dirs
    
    # 执行备份
    if [ "$BACKUP_CONFIG" = true ]; then
        backup_config
    fi
    
    if [ "$BACKUP_MEMORY" = true ]; then
        backup_memory
    fi
    
    if [ "$BACKUP_SYSTEM" = true ]; then
        backup_system
    fi
    
    # 打印汇总
    if [ "$DRY_RUN" = false ]; then
        print_summary
    fi
    
    log_success "备份完成！"
}

main "$@"