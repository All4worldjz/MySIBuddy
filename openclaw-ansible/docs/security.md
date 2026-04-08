# 安全加固详解

## 概述

OpenClaw Ansible 部署包含多层安全加固，确保生产环境的安全性。

## 1. SSH 加固

### 配置项

| 配置 | 值 | 说明 |
|------|-----|------|
| `PermitRootLogin` | `no` | 禁用 root 登录 |
| `PasswordAuthentication` | `no` | 禁用密码认证 |
| `MaxAuthTries` | `3` | 最大认证尝试次数 |
| `ClientAliveInterval` | `300` | 客户端保活间隔（秒） |
| `ClientAliveCountMax` | `2` | 最大无响应次数 |
| `AllowTcpForwarding` | `no` | 禁用 TCP 转发 |

### 实施细节

```yaml
# inventory/group_vars/all.yml
security_hardening:
  ssh:
    disable_root_login: true
    disable_password_auth: true
    allow_tcp_forwarding: false
    max_auth_tries: 3
    client_alive_interval: 300
    client_alive_count_max: 2
```

### 验证命令

```bash
# 检查 SSH 配置
ssh admin@47.82.234.46 "grep -E '^PermitRootLogin|^PasswordAuthentication' /etc/ssh/sshd_config"

# 预期输出:
# PermitRootLogin no
# PasswordAuthentication no

# 测试 root 登录（应该失败）
ssh root@47.82.234.46
# 应该显示: Permission denied (publickey)

# 测试密码认证（应该不可用）
ssh -o PreferredAuthentications=password admin@47.82.234.46
# 应该直接失败，不提示输入密码
```

### 注意事项

⚠️ **重要**: 在禁用密码认证之前，确保：
1. SSH 密钥已正确配置
2. 可以通过密钥成功登录
3. 已备份 SSH 私钥

---

## 2. 防火墙配置

### Debian/Ubuntu (UFW)

```bash
# 启用的规则
sudo ufw status verbose

# 预期输出:
# Status: active
# Logging: on (low)
# Default: deny (incoming), allow (outgoing), deny (routed)
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW IN    Anywhere
```

### RHEL/CentOS/Rocky (firewalld)

```bash
# 查看活动区域
sudo firewall-cmd --get-active-zones

# 查看允许的服务
sudo firewall-cmd --list-all

# 预期输出:
# public (active)
#   target: default
#   interfaces: eth0
#   sources:
#   services: ssh
#   ports:
#   forward: no
```

### 验证命令

```bash
# 检查 SSH 端口是否开放
ssh admin@47.82.234.46 "sudo ufw status | grep 22"

# 检查其他端口（应该被拒绝）
ssh admin@47.82.234.46 "curl -s --connect-timeout 5 http://localhost:8080"
# 应该超时或被拒绝
```

---

## 3. Swap 配置

### 配置详情

| 参数 | 值 | 说明 |
|------|-----|------|
| 大小 | 4GB | 防止内存不足 |
| 位置 | /swapfile | 系统根目录 |
| 权限 | 600 | 仅 root 可读写 |

### 实施细节

```yaml
# inventory/group_vars/all.yml
security_hardening:
  swap:
    enabled: true
    size_gb: 4
    file_path: "/swapfile"
```

### 验证命令

```bash
# 检查 Swap 配置
ssh admin@47.82.234.46 "free -h | grep Swap"

# 预期输出:
# Swap:    4.0Gi   0B   4.0Gi

# 检查 Swap 文件权限
ssh admin@47.82.234.46 "ls -lh /swapfile"

# 预期输出:
# -rw------- 1 root root 4.0G ... /swapfile

# 检查 fstab 配置
ssh admin@47.82.234.46 "grep swap /etc/fstab"

# 预期输出:
# /swapfile none swap sw 0 0
```

---

## 4. fail2ban 配置

### 配置详情

| 参数 | 值 | 说明 |
|------|-----|------|
| `maxretry` | 5 | 最大失败次数 |
| `bantime` | 1800 | 封禁时间（30 分钟） |
| `findtime` | 600 | 统计时间窗口（10 分钟） |

### 配置文件

```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1800
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 1800
```

### 验证命令

```bash
# 检查 fail2ban 状态
ssh admin@47.82.234.46 "sudo fail2ban-client status sshd"

# 预期输出:
# Status for the jail: sshd
# |- Filter
# |  |- Currently failed: 0
# |  |- Total failed: 5
# |  `- File list: /var/log/auth.log
# `- Actions
#    |- Currently banned: 1
#    |- Total banned: 1
#    `- Banned IP list: 1.2.3.4

# 查看被封禁的 IP
ssh admin@47.82.234.46 "sudo fail2ban-client status sshd | grep 'Banned IP'"

# 手动解封 IP（如果是误封）
ssh admin@47.82.234.46 "sudo fail2ban-client set sshd unbanip 1.2.3.4"

# 查看日志
ssh admin@47.82.234.46 "sudo tail -f /var/log/fail2ban.log"
```

---

## 5. 自动安全更新

### Debian/Ubuntu (unattended-upgrades)

```bash
# 检查服务状态
ssh admin@47.82.234.46 "sudo systemctl status unattended-upgrades"

# 查看配置
ssh admin@47.82.234.46 "cat /etc/apt/apt.conf.d/50unattended-upgrades"

# 手动运行（测试）
ssh admin@47.82.234.46 "sudo unattended-upgrades --dry-run -d"
```

### RHEL/CentOS/Rocky (dnf-automatic)

```bash
# 检查定时器状态
ssh admin@47.82.234.46 "sudo systemctl status dnf-automatic.timer"

# 查看配置
ssh admin@47.82.234.46 "cat /etc/dnf/automatic.conf"

# 手动运行（测试）
ssh admin@47.82.234.46 "sudo dnf-automatic --download-only"
```

---

## 6. 文件权限加固

### 密钥文件

```bash
# 正确的权限
ssh admin@47.82.234.46 "ls -la ~/.openclaw/runtime-secrets.json ~/.openclaw/gateway.env"

# 预期输出:
# -rw------- 1 admin admin ... runtime-secrets.json
# -rw------- 1 admin admin ... gateway.env
```

### 配置目录

```bash
# 检查目录权限
ssh admin@47.82.234.46 "ls -la ~/.openclaw/"

# 预期:
# drwxr-xr-x ... .openclaw
# drwxr-xr-x ... agents
# drwxr-xr-x ... channels
```

---

## 7. systemd 服务加固

### 服务安全配置

```ini
# openclaw-gateway.service
[Service]
NoNewPrivileges=true          # 禁止提升权限
ProtectSystem=strict          # 严格保护系统目录
ProtectHome=true              # 保护 /home
ReadWritePaths=/home/admin/.openclaw  # 仅允许写入配置目录
```

### 验证命令

```bash
# 查看服务安全配置
ssh admin@47.82.234.46 "systemctl --user show openclaw-gateway | grep -E 'NoNewPrivileges|ProtectSystem|ProtectHome'"

# 预期输出:
# NoNewPrivileges=yes
# ProtectSystem=strict
# ProtectHome=yes
```

---

## 8. 审计和监控

### 密钥审计

```bash
# 审计密钥加载
ssh admin@47.82.234.46 "openclaw secrets audit"

# 检查明文密钥泄露
ssh admin@47.82.234.46 "grep -r 'sk-cp-\|sk-sp-\|AAG\|AIza' ~/.openclaw/ --include='*.json' --exclude-dir=backup"
```

### 日志审计

```bash
# 查看 Gateway 错误日志
ssh admin@47.82.234.46 "journalctl --user -u openclaw-gateway --priority=err --since '1 hour ago'"

# 查看 SSH 失败登录
ssh admin@47.82.234.46 "sudo grep 'Failed password' /var/log/auth.log | tail -20"
```

---

## 安全清单

部署后请确认以下项目：

- [ ] root 登录已禁用
- [ ] 密码认证已禁用
- [ ] 防火墙已启用
- [ ] 仅 SSH 端口开放
- [ ] Swap 已配置（4GB）
- [ ] fail2ban 已启用
- [ ] 自动更新已启用
- [ ] 密钥文件权限为 600
- [ ] systemd 服务加固已启用
- [ ] 无明文密钥泄露

---

## 自定义安全策略

### 禁用某些加固项

```yaml
# inventory/group_vars/all.yml
security_hardening:
  ssh:
    disable_root_login: true
    disable_password_auth: true
  
  firewall:
    enabled: false  # 禁用防火墙（不推荐）
  
  fail2ban:
    enabled: false  # 禁用 fail2ban（不推荐）
  
  swap:
    enabled: false  # 禁用 swap（如果服务器内存充足）
```

### 增强安全配置

```yaml
# inventory/group_vars/all.yml
security_hardening:
  ssh:
    max_auth_tries: 2  # 更严格的最大尝试次数
    client_alive_interval: 180  # 更短的保活间隔
  
  fail2ban:
    ssh_max_retries: 3  # 更少的失败次数
    ssh_ban_time: 3600  # 更长的封禁时间（1 小时）
    ssh_find_time: 1200  # 更长的统计窗口（20 分钟）
```

---

## 安全事件响应

### 发现未授权访问

```bash
# 1. 立即检查当前登录用户
ssh admin@47.82.234.46 "who"
ssh admin@47.82.234.46 "w"

# 2. 查看最近的 SSH 登录
ssh admin@47.82.234.46 "sudo grep 'Accepted' /var/log/auth.log | tail -20"

# 3. 检查是否有新创建的 SSH 密钥
ssh admin@47.82.234.46 "ls -la ~/.ssh/authorized_keys"

# 4. 如果发现异常，立即封禁 IP
ssh admin@47.82.234.46 "sudo ufw deny from <SUSPICIOUS_IP>"
```

### 密钥轮换

```bash
# 1. 生成新的 API 密钥（在提供商控制台）

# 2. 更新服务器配置
ssh admin@47.82.234.46
vim ~/.openclaw/runtime-secrets.json
vim ~/.openclaw/gateway.env

# 3. 重启 Gateway
systemctl --user restart openclaw-gateway

# 4. 验证
openclaw secrets audit
openclaw status --deep
```

---

**最后更新**: 2026-04-08
