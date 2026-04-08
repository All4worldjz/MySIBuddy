#!/bin/bash
# post-deploy-check.sh - OpenClaw 部署后健康检查脚本
# 用法：./scripts/post-deploy-check.sh [server_ip] [user]

set -euo pipefail

SERVER_IP="${1:-}"
USER="${2:-admin}"

if [ -z "$SERVER_IP" ]; then
    echo "❌ 用法: $0 <server_ip> [user]"
    echo "示例: $0 47.82.234.46 admin"
    exit 1
fi

echo "========================================="
echo "OpenClaw 健康检查"
echo "服务器: $USER@$SERVER_IP"
echo "日期: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

# 检查 SSH 连接
echo "📡 检查 SSH 连接..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$USER@$SERVER_IP" "echo '✅ SSH 连接成功'" 2>/dev/null; then
    echo "❌ SSH 连接失败！"
    exit 1
fi
echo ""

# 检查系统负载
echo "💻 系统负载:"
ssh "$USER@$SERVER_IP" "uptime"
echo ""

# 检查内存
echo "🧠 内存使用:"
ssh "$USER@$SERVER_IP" "free -h | grep -E '(Mem|Swap)'"
echo ""

# 检查磁盘空间
echo "💾 磁盘空间:"
ssh "$USER@$SERVER_IP" "df -h / | tail -1"
echo ""

# 检查 OpenClaw 版本
echo "🔧 OpenClaw 版本:"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; openclaw --version 2>/dev/null || echo '❌ OpenClaw 未安装'"
echo ""

# 检查 Node.js 版本
echo "🟢 Node.js 版本:"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; node --version 2>/dev/null || echo '❌ Node.js 未安装'"
echo ""

# 检查 OpenClaw 状态
echo "📊 OpenClaw 状态:"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; openclaw status --deep 2>/dev/null || echo '❌ 无法获取状态'"
echo ""

# 检查渠道状态
echo "📡 渠道状态:"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; openclaw status --deep 2>/dev/null | grep -E '(Channel|ON|OK|bindings)' || echo '❌ 无法获取渠道状态'"
echo ""

# 检查 Gateway 服务
echo "🚀 Gateway 服务:"
ssh "$USER@$SERVER_IP" "systemctl --user is-active openclaw-gateway 2>/dev/null || echo '❌ Gateway 服务未运行'"
echo ""

# 检查密钥文件
echo "🔑 密钥文件:"
ssh "$USER@$SERVER_IP" "ls -la ~/.openclaw/runtime-secrets.json ~/.openclaw/gateway.env 2>/dev/null || echo '❌ 密钥文件不存在'"
echo ""

# 检查密钥是否配置（非空）
echo "🔐 密钥配置检查:"
ssh "$USER@$SERVER_IP" "grep -c 'YOUR_.*_HERE' ~/.openclaw/runtime-secrets.json 2>/dev/null && echo '⚠️  密钥文件包含占位符，需要填入真实密钥' || echo '✅ 密钥已配置'"
echo ""

# 检查最近日志
echo "📝 Gateway 最近日志:"
ssh "$USER@$SERVER_IP" "journalctl --user -u openclaw-gateway -n 20 --no-pager 2>/dev/null || echo '❌ 无法获取日志'"
echo ""

echo "========================================="
echo "✅ 健康检查完成！"
echo "========================================="
