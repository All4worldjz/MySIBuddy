#!/bin/bash
# diagnose.sh - OpenClaw 故障诊断脚本
# 用法：./scripts/diagnose.sh [server_ip] [user]

set -euo pipefail

SERVER_IP="${1:-}"
USER="${2:-admin}"

if [ -z "$SERVER_IP" ]; then
    echo "❌ 用法: $0 <server_ip> [user]"
    echo "示例: $0 47.82.234.46 admin"
    exit 1
fi

echo "========================================="
echo "OpenClaw 故障诊断工具"
echo "服务器: $USER@$SERVER_IP"
echo "日期: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

# 1. 检查 SSH 连接
echo "🔍 1. SSH 连接检查"
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$USER@$SERVER_IP" "echo '✅ 连接正常'" 2>/dev/null; then
    echo "✅ SSH 连接正常"
else
    echo "❌ SSH 连接失败！"
    echo "   请检查："
    echo "   - SSH 密钥是否正确配置"
    echo "   - 服务器 IP 是否正确"
    echo "   - 防火墙是否允许 SSH 连接"
    exit 1
fi
echo ""

# 2. 检查系统资源
echo "🔍 2. 系统资源检查"
ssh "$USER@$SERVER_IP" "echo '  - CPU 负载:'; uptime; echo '  - 内存使用:'; free -h | grep -E '(Mem|Swap)'; echo '  - 磁盘空间:'; df -h / | tail -1"
echo ""

# 3. 检查 Node.js
echo "🔍 3. Node.js 检查"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; node --version 2>/dev/null && npm --version 2>/dev/null || echo '❌ Node.js 未安装'"
echo ""

# 4. 检查 OpenClaw
echo "🔍 4. OpenClaw 检查"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; openclaw --version 2>/dev/null || echo '❌ OpenClaw 未安装'"
echo ""

# 5. 检查配置文件
echo "🔍 5. 配置文件检查"
ssh "$USER@$SERVER_IP" "echo '  - openclaw.json:'; [ -f ~/.openclaw/openclaw.json ] && echo '✅ 存在' || echo '❌ 不存在'; echo '  - runtime-secrets.json:'; [ -f ~/.openclaw/runtime-secrets.json ] && echo '✅ 存在' || echo '❌ 不存在'; echo '  - gateway.env:'; [ -f ~/.openclaw/gateway.env ] && echo '✅ 存在' || echo '❌ 不存在'"
echo ""

# 6. 检查密钥配置
echo "🔍 6. 密钥配置检查"
ssh "$USER@$SERVER_IP" "if [ -f ~/.openclaw/runtime-secrets.json ]; then PLACEHOLDER_COUNT=\$(grep -c 'YOUR_.*_HERE' ~/.openclaw/runtime-secrets.json 2>/dev/null || echo '0'); if [ \$PLACEHOLDER_COUNT -gt 0 ]; then echo \"⚠️  发现 \$PLACEHOLDER_COUNT 个占位符，需要填入真实密钥\"; else echo '✅ 密钥已配置（无占位符）'; fi; else echo '❌ 密钥文件不存在'; fi"
echo ""

# 7. 检查 Gateway 服务
echo "🔍 7. Gateway 服务检查"
ssh "$USER@$SERVER_IP" "echo '  - 服务状态:'; systemctl --user is-active openclaw-gateway 2>/dev/null || echo '❌ 服务未运行'; echo '  - 最近日志:'; journalctl --user -u openclaw-gateway -n 10 --no-pager 2>/dev/null | tail -5"
echo ""

# 8. 检查渠道配置
echo "🔍 8. 渠道配置检查"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; openclaw status --deep 2>/dev/null | grep -E '(Channel|ON|OK|bindings)' | head -10 || echo '❌ 无法获取渠道状态'"
echo ""

# 9. 检查 Agent 拓扑
echo "🔍 9. Agent 拓扑检查"
ssh "$USER@$SERVER_IP" "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"; if [ -f ~/.openclaw/openclaw.json ]; then echo '  - Agent 数量:'; cat ~/.openclaw/openclaw.json | jq '.agents | length' 2>/dev/null || echo '❌ 无法解析'; echo '  - Agent 列表:'; cat ~/.openclaw/openclaw.json | jq -r '.agents | keys[]' 2>/dev/null | sed 's/^/    - /' || echo '❌ 无法解析'; else echo '❌ openclaw.json 不存在'; fi"
echo ""

# 10. 检查防火墙
echo "🔍 10. 防火墙检查"
ssh "$USER@$SERVER_IP" "echo '  - UFW 状态:'; sudo ufw status 2>/dev/null | head -5 || echo '  UFW 未启用'; echo '  - firewalld 状态:'; sudo systemctl is-active firewalld 2>/dev/null || echo '  firewalld 未启用'"
echo ""

# 11. 检查 SSH 安全配置
echo "🔍 11. SSH 安全配置检查"
ssh "$USER@$SERVER_IP" "echo '  - Root 登录:'; grep '^PermitRootLogin' /etc/ssh/sshd_config 2>/dev/null || echo '  未配置'; echo '  - 密码认证:'; grep '^PasswordAuthentication' /etc/ssh/sshd_config 2>/dev/null || echo '  未配置'"
echo ""

# 12. 常见问题诊断
echo "🔍 12. 常见问题诊断"
ssh "$USER@$SERVER_IP" "
echo '  - 检查明文密钥泄露:';
if grep -r 'sk-cp-\|sk-sp-\|AAG\|AIza' ~/.openclaw/ --include='*.json' --exclude-dir=backup 2>/dev/null; then
    echo '    ⚠️  发现可能的明文密钥！';
else
    echo '    ✅ 未发现明显明文密钥';
fi;
echo '  - 检查 SecretRef 格式:';
if grep -r '\"id\": \"[A-Z]' ~/.openclaw/openclaw.json 2>/dev/null; then
    echo '    ⚠️  发现 SecretRef id 可能缺少 / 前缀';
else
    echo '    ✅ SecretRef 格式正确';
fi
"
echo ""

echo "========================================="
echo "✅ 诊断完成！"
echo ""
echo "💡 常见问题解决："
echo "   - Gateway 启动失败 → 检查密钥配置和 systemd 服务"
echo "   - 渠道 OFFLINE → 检查 bot token 和网络连接"
echo "   - Agent 不响应 → 检查 bindings 配置和模型路由"
echo "   - 密钥加载失败 → 检查 SecretRef id 格式（必须以 / 开头）"
echo "========================================="
