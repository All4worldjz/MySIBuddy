# 快速开始指南

## 5 分钟部署 OpenClaw

### 前置条件

✅ 控制节点（你的电脑）：
```bash
# 安装 Ansible
pip install ansible>=2.14

# 或 macOS
brew install ansible
```

✅ 目标服务器最低要求：
- **CPU**: 2 核心以上
- **内存**: 4GB 以上
- **存储**: 50GB 以上
- **系统**: Ubuntu 22.04/24.04, Debian 11/12, CentOS 9, Rocky/AlmaLinux 9
- SSH 密钥认证已配置

---

### 步骤 1: 配置主机清单 (1 分钟)

```bash
cd openclaw-ansible
cp inventory/hosts.ini.example inventory/hosts.ini
```

编辑 `inventory/hosts.ini`:
```ini
[openclaw]
47.82.234.46 ansible_user=admin ansible_ssh_private_key_file=~/.ssh/id_rsa
```

---

### 步骤 2: 运行部署 (10-15 分钟)

```bash
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini
```

**部署自动执行以下检查：**
- ✅ CPU/内存/磁盘资源验证
- ✅ 操作系统兼容性检查
- ✅ 现有环境检测（避免覆盖）
- ✅ SSH 密钥认证验证

**部署内容：**
- ✅ 系统准备（包更新、依赖安装）
- ✅ Node.js 24.x
- ✅ OpenClaw 2026.4.5
- ✅ 8 Agent 集群配置
- ✅ Telegram/Feishu 渠道
- ✅ 安全加固（SSH/防火墙/swap/fail2ban）
- ✅ 密钥模板生成

---

### 步骤 3: 配置密钥 (2 分钟)

```bash
# SSH 到服务器
ssh admin@47.82.234.46

# 编辑密钥配置（填入真实密钥）
vim ~/.openclaw/runtime-secrets.json
vim ~/.openclaw/gateway.env

# 重启 Gateway
systemctl --user restart openclaw-gateway
```

**需要的密钥：**
- MiniMax API Key
- 阿里云百炼 API Key
- Telegram Bot Tokens (3 个)
- 飞书 App ID/Secret (2 个)
- OpenClaw Gateway Token（自定义）

---

### 步骤 4: 验证部署 (1 分钟)

```bash
# 运行健康检查
ansible-playbook playbooks/post-deploy-check.yml -i inventory/hosts.ini

# 或手动检查
ssh admin@47.82.234.46 'openclaw status --deep'
```

**预期输出：**
```
✅ OpenClaw 版本: 2026.4.5
✅ 8 Agent 在线
✅ Telegram 渠道: ON
✅ Feishu 渠道: ON
✅ Gateway: active (running)
```

---

## 分步部署（推荐首次使用）

```bash
# 1. 系统准备
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags system-prep

# 2. 安装 Node.js
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags nodejs

# 3. 安装 OpenClaw
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags openclaw

# 4. 安全加固
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags security

# 5. 配置 Agent 和渠道
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags agents,channels,secrets

# 6. 健康检查
ansible-playbook playbooks/post-deploy-check.yml -i inventory/hosts.ini
```

---

## 常用命令

### 部署相关

```bash
# 完整部署
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 仅更新 Agent 配置
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags agents

# 仅更新渠道配置
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags channels

# 仅更新主配置
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags config
```

### 健康检查

```bash
# 运行诊断脚本
./scripts/diagnose.sh 47.82.234.46 admin

# 运行健康检查
./scripts/post-deploy-check.sh 47.82.234.46 admin

# 备份配置
./scripts/backup-config.sh 47.82.234.46 admin
```

### 远程服务器命令

```bash
# 检查状态
ssh admin@47.82.234.46 'openclaw status --deep'

# 查看日志
ssh admin@47.82.234.46 'journalctl --user -u openclaw-gateway -f'

# 重启服务
ssh admin@47.82.234.46 'systemctl --user restart openclaw-gateway'

# 审计密钥
ssh admin@47.82.234.46 'openclaw secrets audit'
```

---

## 自定义配置

### 修改 Agent 配置

编辑 `inventory/group_vars/all.yml`:

```yaml
openclaw_agents:
  - id: chief-of-staff
    model: "modelstudio/qwen3.5-plus"  # 更改模型
    # ... 其他配置
```

### 修改渠道配置

```yaml
openclaw_channels:
  telegram:
    - account: "chief"
      bot_token_ref: "/TELEGRAM_CHIEF_BOT_TOKEN"
      # ... 其他配置
```

### 使用 Ansible Vault 加密密钥

```bash
# 创建加密变量文件
ansible-vault create inventory/group_vars/all/vault.yml

# 编辑加密文件
ansible-vault edit inventory/group_vars/all/vault.yml

# 运行 playbook
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --ask-vault-pass
```

---

## 故障排除

### 部署失败

```bash
# 检查 SSH 连接
ssh admin@47.82.234.46

# 查看 Ansible 详细输出
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini -vvv
```

### Gateway 启动失败

```bash
# 检查密钥配置
ssh admin@47.82.234.46 'cat ~/.openclaw/runtime-secrets.json'
ssh admin@47.82.234.46 'cat ~/.openclaw/gateway.env'

# 查看日志
ssh admin@47.82.234.46 'journalctl --user -u openclaw-gateway -n 50'
```

### 渠道 OFFLINE

```bash
# 检查渠道状态
ssh admin@47.82.234.46 'openclaw status --deep | grep -E "(Channel|ON|OK)"'

# 重启 Gateway
ssh admin@47.82.234.46 'systemctl --user restart openclaw-gateway'
```

更多排错见：[docs/troubleshooting.md](docs/troubleshooting.md)

---

## 下一步

部署完成后：

1. ✅ **配置 Agent 提示词**: 编辑 `~/.openclaw/agents/<id>/AGENTS.md`
2. ✅ **配置 Telegram Bot**: 在 @BotFather 设置 webhook 和菜单
3. ✅ **配置飞书应用**: 在飞书开放平台设置回调 URL
4. ✅ **配置备份策略**: 定期运行 `./scripts/backup-config.sh`
5. ✅ **配置监控告警**: 设置日志监控和告警规则

---

## 获取帮助

- 📖 [完整文档](README.md)
- 🏗️ [架构说明](docs/architecture.md)
- 🐛 [故障排除](docs/troubleshooting.md)
- 🔒 [安全加固](docs/security.md)
- 🔄 [迁移指南](docs/migration-guide.md)

---

**祝部署顺利！** 🎉
