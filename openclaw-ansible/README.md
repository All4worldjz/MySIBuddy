# OpenClaw Ansible 自动化部署

[![Ansible](https://img.shields.io/badge/Ansible-2.14+-EE0000?logo=ansible&logoColor=white)](https://www.ansible.com/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-2026.4.5-blue)](https://github.com/openclaw/openclaw)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green?logo=node.js)](https://nodejs.org/)

## 📋 项目简介

利用 Ansible Playbook 在新服务器/VPS 上**一键部署**完整的 OpenClaw 生产环境。

### 部署内容

- ✅ **OpenClaw 核心**：CLI + Gateway + 8 Agent 集群
- ✅ **通信渠道**：Telegram（3 账号）+ Feishu（2 账号，openclaw-lark 插件）
- ✅ **模型路由**：MiniMax 主模型 + 阿里云备用链
- ✅ **安全加固**：SSH 加固 + 防火墙 + Swap + fail2ban
- ✅ **运维工具**：健康检查 + 配置备份 + 日志诊断
- ✅ **跨平台支持**：Ubuntu 22.04/24.04、Debian 11/12、CentOS 9、Rocky/AlmaLinux 9

### 架构概览

```
8 Agent 集群：
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  chief-of-staff │    │    work-hub     │    │  venture-hub    │
│   (编排器)      │    │  (工作中枢)     │    │  (创业中枢)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    life-hub     │    │ product-studio  │    │    zh-scribe    │
│  (生活中枢)     │    │  (产品设计)     │    │  (中文成文)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
┌─────────────────┐    ┌─────────────────┐
│   tech-mentor   │    │   coder-hub     │
│   (AI导师)      │    │  (编程助手)     │
└─────────────────┘    └─────────────────┘

通信渠道：
Telegram: chief / personal / mentor
Feishu:   work / scribe (openclaw-lark 插件)
```

## 🚀 快速开始

### 前置要求

**控制节点（运行 Ansible 的机器）：**
```bash
# 安装 Ansible
pip install ansible>=2.14

# 或 macOS
brew install ansible
```

**目标服务器：**
- 全新的 Ubuntu/Debian/CentOS/Rocky 服务器
- root 或具有 sudo 权限的用户
- SSH 密钥认证已配置

### 部署步骤

#### 1. 准备主机清单

```bash
cd openclaw-ansible
cp inventory/hosts.ini.example inventory/hosts.ini
```

编辑 `inventory/hosts.ini`：
```ini
[openclaw]
47.82.234.46 ansible_user=admin ansible_ssh_private_key_file=~/.ssh/id_rsa
```

#### 2. 运行部署

```bash
# 完整部署（约 10-15 分钟）
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 分步部署（推荐首次使用）
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags "system-prep"
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags "nodejs"
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags "openclaw-core"
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags "security"
ansible-playbook playbooks/deploy-partial.yml -i inventory/hosts.ini --tags "agents,channels,secrets"
```

#### 3. 配置密钥（部署后必须）

```bash
# SSH 到服务器
ssh admin@<your-server-ip>

# 编辑密钥配置（填入真实密钥）
vim /home/admin/.openclaw/runtime-secrets.json
vim /home/admin/.openclaw/gateway.env

# 重启 Gateway
systemctl --user restart openclaw-gateway
```

#### 4. 验证部署

```bash
# 运行健康检查
ansible-playbook playbooks/post-deploy-check.yml -i inventory/hosts.ini

# 或 SSH 到服务器手动检查
ssh admin@<your-server-ip> 'openclaw status --deep'
```

## 📁 项目结构

```
openclaw-ansible/
├── ansible.cfg                  # Ansible 配置
├── inventory/
│   ├── hosts.ini                # 主机清单（部署前创建）
│   └── group_vars/
│       └── all.yml              # 全局变量
├── roles/
│   ├── system-prep/             # 系统准备
│   ├── nodejs/                  # Node.js 安装
│   ├── openclaw-core/           # OpenClaw 核心
│   ├── openclaw-agents/         # 8 Agent 配置
│   ├── openclaw-channels/       # Telegram/Feishu 渠道
│   ├── security-hardening/      # 安全加固
│   ├── secrets-templates/       # 密钥模板
│   └── post-deploy/             # 部署后验证
├── playbooks/
│   ├── deploy.yml               # 完整部署
│   ├── deploy-partial.yml       # 分步部署
│   └── post-deploy-check.yml    # 健康检查
├── templates/                   # Jinja2 模板
├── scripts/                     # 运维脚本
└── docs/                        # 文档
    ├── architecture.md
    ├── troubleshooting.md
    ├── security.md
    └── migration-guide.md
```

## 🔧 自定义配置

### 修改 Agent 配置

编辑 `inventory/group_vars/all.yml` 中的 `openclaw_agents` 变量：

```yaml
openclaw_agents:
  - id: chief-of-staff
    name: "Chief of Staff"
    model: "minimax/MiniMax-M2.7"
    prompt_file: "agents/chief-of-staff/AGENTS.md.j2"
    # ... 其他配置
```

### 修改渠道配置

编辑 `inventory/group_vars/all.yml` 中的 `openclaw_channels` 变量：

```yaml
openclaw_channels:
  telegram:
    - account: chief
      bot_token: "{{ vault_telegram_chief_token }}"
    # ...
```

### 使用 Ansible Vault 加密密钥

```bash
# 创建加密变量文件
ansible-vault create inventory/group_vars/all/vault.yml

# 编辑加密文件
ansible-vault edit inventory/group_vars/all/vault.yml

# 运行 playbook 时提供密码
ansible-playbook playbooks/deploy.yml --ask-vault-pass
```

## 🛡️ 安全说明

### 部署的安全加固内容

| 组件 | 配置 |
|------|------|
| **SSH** | 禁用 root 登录、禁用密码认证、仅密钥 |
| **防火墙** | UFW/firewalld，仅开放 22 端口 |
| **Swap** | 4GB swapfile |
| **fail2ban** | SSH 防爆破（5 次失败锁定 30 分钟） |
| **自动更新** | unattended-upgrades（安全更新） |

### 密钥管理

- 部署时生成**模板文件**（含占位符）
- 部署后**手动填入**真实密钥
- 密钥文件权限：`600`（仅 owner 可读写）
- 建议：使用 Ansible Vault 加密存储密钥

## 🐛 故障排除

### 常见问题

**Q: 部署失败，提示 "SSH connection refused"**
```bash
# 检查 SSH 配置
ssh -v admin@<server-ip>

# 确保 SSH 密钥已添加到目标服务器
ssh-copy-id admin@<server-ip>
```

**Q: OpenClaw Gateway 启动失败**
```bash
# 检查密钥配置
ssh admin@<server-ip> 'cat /home/admin/.openclaw/runtime-secrets.json'
ssh admin@<server-ip> 'cat /home/admin/.openclaw/gateway.env'

# 查看日志
ssh admin@<server-ip> 'journalctl --user -u openclaw-gateway -n 50'
```

**Q: 渠道状态显示 OFFLINE**
```bash
# 检查渠道配置
ssh admin@<server-ip> 'openclaw status --deep | grep -E "(Channel|ON|OK)"'

# 重启 Gateway
ssh admin@<server-ip> 'systemctl --user restart openclaw-gateway'
```

更多排错指南见：[docs/troubleshooting.md](docs/troubleshooting.md)

## 📚 文档

- [架构说明](docs/architecture.md)
- [安全加固详解](docs/security.md)
- [故障排除](docs/troubleshooting.md)
- [迁移指南](docs/migration-guide.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

### 本地测试

```bash
# 使用 Vagrant 测试
vagrant up
ansible-playbook playbooks/deploy.yml -i inventory/vagrant.ini

# 使用 Docker 测试
docker build -t openclaw-ansible-test .
docker run -d openclaw-ansible-test
```

## 📄 许可证

MIT License

## 🙏 致谢

- [OpenClaw](https://github.com/openclaw/openclaw) - 智能体平台
- [Ansible](https://www.ansible.com/) - 自动化工具

---

**维护者**: MySiBuddy 团队  
**最后更新**: 2026-04-08
