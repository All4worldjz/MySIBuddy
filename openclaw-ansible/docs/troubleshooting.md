# 故障排除指南

## 常见问题

### 1. 部署失败

#### SSH 连接失败

**症状**:
```
fatal: [47.82.234.46]: UNREACHABLE! => {"changed": false, "unreachable": true}
```

**解决**:
```bash
# 1. 检查 SSH 密钥
ssh -i ~/.ssh/id_rsa admin@47.82.234.46

# 2. 如果密钥未配置，添加到目标服务器
ssh-copy-id admin@47.82.234.46

# 3. 检查防火墙是否允许 SSH
ssh -v admin@47.82.234.46
```

#### 权限不足

**症状**:
```
FAILED! => {"msg": "Missing sudo password"}
```

**解决**:
```bash
# 确保用户在 sudoers 中
ssh admin@47.82.234.46 "sudo -l"

# 如果需要密码，添加变量
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --ask-become-pass
```

---

### 2. Node.js 安装失败

#### nvm 安装失败

**症状**:
```
fatal: [host]: FAILED! => {"msg": "nvm not found"}
```

**解决**:
```bash
# 1. SSH 到服务器手动安装
ssh admin@47.82.234.46

# 2. 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# 3. 安装 Node.js
nvm install 24
nvm alias default 24

# 4. 验证
node --version
```

#### NodeSource 源不可达

**症状**:
```
fatal: [host]: FAILED! => {"msg": "Failed to connect to deb.nodesource.com"}
```

**解决**:
```bash
# 检查网络
curl -I https://deb.nodesource.com

# 如果不可达，切换到 nvm 方法
# 编辑 inventory/group_vars/all.yml
nodejs_install_method: "nvm"
```

---

### 3. OpenClaw 安装失败

#### npm 安装失败

**症状**:
```
npm ERR! code EACCES
npm ERR! syscall access
```

**解决**:
```bash
# 1. 确保使用 nvm 安装的 Node.js
ssh admin@47.82.234.46
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 2. 检查 npm 全局路径
npm config get prefix

# 3. 重新安装
npm install -g openclaw@2026.4.5
```

#### 插件安装失败

**症状**:
```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/openclaw-lark
```

**解决**:
```bash
# 检查插件名称是否正确
npm search openclaw

# 如果插件不存在，可能需要从源码安装
git clone <plugin-repo>
cd openclaw-lark
npm link
```

---

### 4. Gateway 启动失败

#### 密钥未配置

**症状**:
```
Environment variable "MODELSTUDIO_API_KEY" is missing or empty
```

**解决**:
```bash
# 1. 编辑密钥配置
ssh admin@47.82.234.46
vim ~/.openclaw/runtime-secrets.json
vim ~/.openclaw/gateway.env

# 2. 填入真实密钥（替换 YOUR_*_HERE 占位符）

# 3. 重启 Gateway
systemctl --user restart openclaw-gateway

# 4. 验证
openclaw secrets audit
```

#### SecretRef 格式错误

**症状**:
```
File secret reference id must be an absolute JSON pointer
```

**解决**:
```bash
# 1. 检查 openclaw.json 中的 SecretRef
cat ~/.openclaw/openclaw.json | jq '.models.primary.apiKeyRef'

# 2. 确保 id 以 / 开头
# ❌ 错误: "id": "OPENCLAW_GATEWAY_TOKEN"
# ✅ 正确: "id": "/OPENCLAW_GATEWAY_TOKEN"

# 3. 修正配置
vim ~/.openclaw/openclaw.json

# 4. 重启 Gateway
systemctl --user restart openclaw-gateway
```

#### 服务未找到

**症状**:
```
Failed to get unit file state: No such file or directory
```

**解决**:
```bash
# 1. 检查服务文件是否存在
ls -la ~/.config/systemd/user/openclaw-gateway.service

# 2. 如果不存在，重新运行 playbook
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags config

# 3. 或手动创建服务文件
# 参考 templates/openclaw-gateway.service.j2

# 4. 重新加载 systemd
systemctl --user daemon-reload

# 5. 启动服务
systemctl --user start openclaw-gateway
```

---

### 5. 渠道 OFFLINE

#### Telegram Bot 不响应

**症状**:
- 发送消息到 Bot 无响应
- `openclaw status --deep` 显示 Telegram 渠道 OFFLINE

**解决**:
```bash
# 1. 检查 Bot Token 是否正确
cat ~/.openclaw/runtime-secrets.json | grep TELEGRAM

# 2. 检查网络连通性
curl -s https://api.telegram.org/bot<TOKEN>/getMe

# 3. 检查防火墙出站规则
sudo ufw status

# 4. 重启 Gateway
systemctl --user restart openclaw-gateway

# 5. 查看日志
journalctl --user -u openclaw-gateway -f
```

#### Feishu 消息丢失

**症状**:
- 发送到飞书应用的消息无响应
- 日志显示 `Unknown channel`

**解决**:
```bash
# 1. 检查飞书配置
cat ~/.openclaw/feishu/work/account.json
cat ~/.openclaw/feishu/scribe/account.json

# 2. 确保顶层 channels.feishu 没有 appId/appSecret
cat ~/.openclaw/openclaw.json | jq '.channels.feishu'

# 3. 检查 openclaw-lark 插件是否安装
openclaw plugins list | grep lark

# 4. 确保飞书应用回调 URL 正确配置
# URL: https://<your-server>/api/feishu/webhook
```

---

### 6. Agent 不响应

#### 模型路由错误

**症状**:
```
Authentication error: Invalid API key
```

**解决**:
```bash
# 1. 检查模型配置
cat ~/.openclaw/openclaw.json | jq '.models'

# 2. 检查 auth-profiles.json
cat ~/.openclaw/agents/<agent-id>/auth-profiles.json

# 3. 检查 models.json
cat ~/.openclaw/agents/<agent-id>/models.json

# 4. 确保密钥已配置
openclaw secrets audit
```

#### Agent 找不到

**症状**:
```
Agent <id> not found
```

**解决**:
```bash
# 1. 检查 Agent 目录
ls -la ~/.openclaw/agents/

# 2. 检查 openclaw.json 中的 agents 配置
cat ~/.openclaw/openclaw.json | jq '.agents | keys'

# 3. 确保所有必需文件存在
ls -la ~/.openclaw/agents/<agent-id>/
# 应该包含: AGENTS.md, SOUL.md, MEMORY.md, auth-profiles.json, models.json
```

---

### 7. 配置损坏

#### 配置被覆盖

**症状**:
- `channels` 或 `bindings` 消失
- 所有机器人停止响应

**解决**:
```bash
# 1. 检查备份
ls -la ~/.openclaw/openclaw.json.pre-*

# 2. 回滚到最近的备份
cp ~/.openclaw/openclaw.json.pre-<timestamp> ~/.openclaw/openclaw.json

# 3. 验证配置
cat ~/.openclaw/openclaw.json | jq '.channels, .bindings'

# 4. 重启 Gateway
systemctl --user restart openclaw-gateway
```

**预防**:
- 不要手动编辑 openclaw.json（使用 Ansible 模板）
- 使用 `scripts/safe_openclaw_validate.sh` 验证配置
- 使用 `scripts/safe_openclaw_apply.sh` 应用变更

---

### 8. 安全问题

#### SSH 暴力破解

**症状**:
```
journalctl -u sshd | grep "Failed password"
```

**解决**:
```bash
# 1. 检查 fail2ban 状态
sudo fail2ban-client status sshd

# 2. 查看被封禁的 IP
sudo fail2ban-client status sshd | grep "Banned IP"

# 3. 确保 SSH 加固已启用
grep -E "^PermitRootLogin|^PasswordAuthentication" /etc/ssh/sshd_config
# 应该显示:
# PermitRootLogin no
# PasswordAuthentication no
```

#### 密钥泄露

**症状**:
- 在配置文件中找到明文密钥
- 日志中暴露 API 密钥

**解决**:
```bash
# 1. 检查明文密钥
grep -r "sk-cp-\|sk-sp-\|AAG\|AIza" ~/.openclaw/ --include="*.json" --exclude-dir=backup

# 2. 立即轮换密钥
# - 在 Telegram @BotFather 重新生成 Bot Token
# - 在 MiniMax/阿里云控制台重新生成 API Key
# - 更新 runtime-secrets.json 和 gateway.env

# 3. 设置正确的文件权限
chmod 600 ~/.openclaw/runtime-secrets.json
chmod 600 ~/.openclaw/gateway.env

# 4. 检查日志是否泄露密钥
journalctl --user -u openclaw-gateway | grep -E "sk-|AAG|AIza"
```

---

## 诊断工具

### 内置诊断脚本

```bash
# 运行完整诊断
./scripts/diagnose.sh 47.82.234.46 admin
```

### 手动诊断命令

```bash
# 系统状态
ssh admin@47.82.234.46 "uptime && free -h && df -h /"

# OpenClaw 状态
ssh admin@47.82.234.46 "openclaw status --deep"

# 渠道状态
ssh admin@47.82.234.46 "openclaw status --deep | grep -E '(Channel|ON|OK)'"

# 服务状态
ssh admin@47.82.234.46 "systemctl --user status openclaw-gateway"

# 最近日志
ssh admin@47.82.234.46 "journalctl --user -u openclaw-gateway -n 50 --no-pager"

# 密钥检查
ssh admin@47.82.234.46 "openclaw secrets audit"

# 配置验证
ssh admin@47.82.234.46 "cat ~/.openclaw/openclaw.json | jq '.'"
```

### 日志分析

```bash
# 查看 Gateway 日志
ssh admin@47.82.234.46 "journalctl --user -u openclaw-gateway -f"

# 查看错误日志
ssh admin@47.82.234.46 "journalctl --user -u openclaw-gateway --priority=err"

# 查看密钥加载日志
ssh admin@47.82.234.46 "journalctl --user -u openclaw-gateway | grep -E 'secret|key|token'"
```

---

## 恢复流程

### 完全恢复（从零开始）

```bash
# 1. 确保服务器可访问
ssh admin@47.82.234.46

# 2. 清理旧配置（谨慎操作！）
ssh admin@47.82.234.46 "rm -rf ~/.openclaw"

# 3. 重新部署
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 4. 配置密钥
ssh admin@47.82.234.46
vim ~/.openclaw/runtime-secrets.json
vim ~/.openclaw/gateway.env

# 5. 重启 Gateway
systemctl --user restart openclaw-gateway

# 6. 验证
openclaw status --deep
```

### 部分恢复（保留配置）

```bash
# 1. 备份当前配置
ssh admin@47.82.234.46 "cp -r ~/.openclaw ~/.openclaw.backup.$(date +%Y%m%d)"

# 2. 重新运行特定角色
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags agents
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags channels

# 3. 重启 Gateway
ssh admin@47.82.234.46 "systemctl --user restart openclaw-gateway"

# 4. 验证
openclaw status --deep
```

---

## 获取帮助

### 文档资源

- [README](../README.md)
- [架构说明](architecture.md)
- [安全加固](security.md)
- [迁移指南](migration-guide.md)

### OpenClaw 官方文档

- OpenClaw GitHub: https://github.com/openclaw/openclaw
- OpenClaw CLI 帮助: `openclaw --help`
- OpenClaw 状态: `openclaw status --deep`

### 社区支持

- 提交 Issue: https://github.com/your-org/openclaw-ansible/issues
- 讨论区: https://github.com/your-org/openclaw-ansible/discussions

---

**最后更新**: 2026-04-08
