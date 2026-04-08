# 测试指南

## 测试方案对比

| 方案 | 覆盖度 | 时间 | 资源 | 适合场景 |
|------|--------|------|------|----------|
| **Vagrant** | 100% | 15-25 分钟 | 4GB RAM / 15GB 磁盘 | 完整端到端测试 |
| **Docker** | ~60% | 5-8 分钟 | 1GB RAM / 3GB 磁盘 | 快速验证文件生成 |

---

## 方案 A: Vagrant（完整测试）

### 前置要求

```bash
# 安装 VirtualBox
# https://www.virtualbox.org/wiki/Downloads

# 安装 Vagrant
brew install vagrant  # macOS
# 或从 https://www.vagrantup.com/downloads 下载

# 验证安装
vagrant --version
vboxmanage --version
```

### 快速启动

```bash
cd openclaw-ansible

# 1. 启动 VM（首次约 5-10 分钟下载镜像）
vagrant up --provider=virtualbox

# 2. 确认 SSH 连接
vagrant ssh

# 3. 从本机运行完整部署
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini

# 4. 分步测试（推荐首次使用）
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini --tags preflight
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini --tags system-prep
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini --tags nodejs
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini --tags openclaw
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini --tags security
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini --tags agents,channels,secrets,config

# 5. 验证部署
vagrant ssh -c "openclaw status --deep"
vagrant ssh -c "openclaw secrets audit"
vagrant ssh -c "systemctl --user status openclaw-gateway"

# 6. 清理环境
vagrant destroy -f
```

### 调试技巧

```bash
# 查看详细输出
ansible-playbook playbooks/deploy.yml -i test/vagrant/inventory.ini -vvv

# 检查 VM 状态
vagrant status

# 重新 provision（不重启 VM）
vagrant provision

# SSH 到 VM 手动检查
vagrant ssh

# 查看 VM 资源使用
vagrant ssh -c "free -h && df -h / && uptime"
```

---

## 方案 B: Docker（快速验证）

### 前置要求

```bash
# 安装 Docker
# https://docs.docker.com/get-docker/

# 验证安装
docker --version
docker compose version
```

### 快速启动

```bash
cd openclaw-ansible/test/docker

# 1. 启动容器（首次约 2-3 分钟拉取镜像）
docker compose up -d

# 2. 进入容器
docker compose exec openclaw-test bash

# 3. 在容器内运行部署（跳过不兼容的角色）
ansible-playbook /ansible/playbooks/deploy.yml \
  -i /ansible/test/docker/inventory.ini \
  -c local \
  --tags preflight,system-prep,nodejs,openclaw,agents,channels,secrets,config

# 4. 分步验证
# 检查文件生成
ls -la /home/root/.openclaw/
cat /home/root/.openclaw/openclaw.json | jq '.agents | keys'
cat /home/root/.openclaw/agents/chief-of-staff/AGENTS.md

# 5. 清理环境
docker compose down -v
docker compose rm -f
```

### 容器内可测试的角色

| 角色 | 可测试 | 说明 |
|------|--------|------|
| `preflight-check` | ✅ | 资源阈值已调低 |
| `system-prep` | ✅ | apt 包安装可用 |
| `nodejs` | ✅ | nvm 安装正常 |
| `openclaw-core` | ✅ | npm install 可用 |
| `openclaw-agents` | ✅ | 纯文件操作 |
| `openclaw-channels` | ✅ | 纯文件操作 |
| `secrets-templates` | ✅ | 纯文件操作 |
| `openclaw-config` | ✅ | JSON 生成和验证 |
| `security-hardening` | ❌ | SSH 加固/fail2ban/NTP 不兼容 |
| `post-deploy` | ⚠️  部分 | systemd 验证会失败 |

### 容器内不可测试的功能

- ❌ `systemctl --user`（systemd user session 不可用）
- ❌ `loginctl enable-linger`（systemd-logind 不存在）
- ❌ UFW 防火墙（需要内核 netfilter 模块）
- ❌ fail2ban（需要 iptables）
- ❌ chrony NTP（容器时钟由宿主机管理）

---

## 测试检查清单

### 预检检查

- [ ] 内存检查通过（显示实际内存）
- [ ] CPU 核心检查通过
- [ ] 磁盘空间检查通过
- [ ] 操作系统兼容性通过
- [ ] 现有环境检测正确

### 系统准备

- [ ] 系统包安装成功
- [ ] 时区配置正确
- [ ] admin 用户创建成功
- [ ] .openclaw 目录结构正确

### Node.js

- [ ] nvm 安装成功
- [ ] Node.js 24.x 安装成功
- [ ] npm 版本正确

### OpenClaw

- [ ] OpenClaw CLI 安装成功
- [ ] 插件安装成功（openclaw-lark 等）
- [ ] 版本正确

### 安全加固（仅 Vagrant）

- [ ] SSH 加固成功（root 禁用、密码认证禁用）
- [ ] UFW 防火墙启用
- [ ] Swap 配置正确
- [ ] fail2ban 运行中
- [ ] loginctl linger 已启用
- [ ] chrony NTP 运行中

### Agent 配置

- [ ] 8 个 Agent 目录创建成功
- [ ] AGENTS.md 文件生成（仅初次）
- [ ] SOUL.md 文件生成（仅初次）
- [ ] auth-profiles.json 存在
- [ ] models.json 存在

### 渠道配置

- [ ] Telegram 渠道配置生成
- [ ] Feishu 渠道配置生成

### 密钥模板

- [ ] runtime-secrets.json 生成
- [ ] gateway.env 生成
- [ ] 文件权限为 600
- [ ] 包含占位符（YOUR_*_HERE）

### 主配置

- [ ] openclaw.json 生成
- [ ] JSON 语法验证通过
- [ ] channels 字段存在
- [ ] bindings 字段存在
- [ ] agents 字段存在
- [ ] 备份文件创建成功

### 部署验证（仅 Vagrant）

- [ ] systemd 服务部署成功
- [ ] 服务已启用（开机自启）
- [ ] 密钥占位符检测警告显示

---

## 常见问题

### Vagrant 相关

**Q: VirtualBox 在 Apple Silicon 上不可用**

A: 改用 Parallels 或 UTM：
```bash
# 使用 Parallels
brew install --cask parallels
vagrant plugin install vagrant-parallels
vagrant up --provider=parallels

# 或使用 test/docker 方案
```

**Q: VM 启动后 SSH 连接超时**

A: 检查网络和 SSH 配置：
```bash
vagrant reload
vagrant ssh
```

**Q: 部署失败，包安装超时**

A: 可能是网络问题，重试或更换镜像源：
```bash
vagrant ssh
sudo apt-get update --fix-missing
exit
vagrant provision
```

### Docker 相关

**Q: 容器启动后立即退出**

A: 检查日志：
```bash
docker compose logs
```

**Q: Ansible 报 "Failed to find required executable"**

A: 容器缺少某些包，手动安装：
```bash
docker compose exec openclaw-test bash
apt-get install -y ansible python3-apt
```

**Q: systemd 相关任务失败**

A: 这是预期行为，容器不支持完整 systemd。使用 `--skip-tags security` 跳过。

---

## 清理命令

```bash
# Vagrant
vagrant destroy -f
rm -rf .vagrant/

# Docker
docker compose down -v
docker compose rm -f
docker system prune -f  # 清理所有未使用的镜像
```

---

**最后更新**: 2026-04-08
