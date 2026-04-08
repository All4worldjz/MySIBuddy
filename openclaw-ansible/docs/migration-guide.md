# 迁移指南

## 概述

本指南说明如何从现有 OpenClaw 环境迁移到 Ansible 自动化部署的新环境。

## 迁移场景

### 场景 1: 全新部署

**适用情况**: 新服务器，无现有配置

**步骤**:
```bash
# 1. 准备主机清单
cd openclaw-ansible
cp inventory/hosts.ini.example inventory/hosts.ini
vim inventory/hosts.ini

# 2. 运行部署
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 3. 配置密钥
ssh admin@<new-server>
vim ~/.openclaw/runtime-secrets.json
vim ~/.openclaw/gateway.env

# 4. 验证
openclaw status --deep
```

---

### 场景 2: 从现有服务器迁移

**适用情况**: 从 `47.82.234.46` 迁移到新服务器

#### 步骤 1: 备份现有配置

```bash
# 在现有服务器上
ssh admin@47.82.234.46

# 备份配置
cd ~/.openclaw
tar czf ~/openclaw-backup-$(date +%Y%m%d).tar.gz \
    openclaw.json \
    runtime-secrets.json \
    gateway.env \
    agents/ \
    channels/ \
    telegram/ \
    feishu/

# 下载备份
scp admin@47.82.234.46:~/openclaw-backup-*.tar.gz ./
```

#### 步骤 2: 部署新服务器

```bash
# 在新服务器上运行部署
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini
```

#### 步骤 3: 迁移配置

```bash
# 上传备份到新服务器
scp openclaw-backup-*.tar.gz admin@<new-server>:~/

# 解压并应用
ssh admin@<new-server>
tar xzf ~/openclaw-backup-*.tar.gz -C ~/.openclaw/

# 设置正确权限
chmod 600 ~/.openclaw/runtime-secrets.json
chmod 600 ~/.openclaw/gateway.env
chown -R admin:admin ~/.openclaw

# 重启 Gateway
systemctl --user restart openclaw-gateway

# 验证
openclaw status --deep
```

---

### 场景 3: 部分迁移（仅迁移某些组件）

#### 仅迁移 Agent 配置

```bash
# 1. 从旧服务器下载 Agent 配置
ssh admin@47.82.234.46
cd ~/.openclaw/agents
tar czf ~/agents-backup.tar.gz */

# 2. 上传到新服务器
scp ~/agents-backup.tar.gz admin@<new-server>:~/

# 3. 解压并应用
ssh admin@<new-server>
tar xzf ~/agents-backup.tar.gz -C ~/.openclaw/agents/

# 4. 重启 Gateway
systemctl --user restart openclaw-gateway
```

#### 仅迁移渠道配置

```bash
# 1. 从旧服务器下载渠道配置
ssh admin@47.82.234.46
cd ~/.openclaw
tar czf ~/channels-backup.tar.gz telegram/ feishu/

# 2. 上传到新服务器
scp ~/channels-backup.tar.gz admin@<new-server>:~/

# 3. 解压并应用
ssh admin@<new-server>
tar xzf ~/channels-backup.tar.gz -C ~/.openclaw/

# 4. 重启 Gateway
systemctl --user restart openclaw-gateway
```

---

### 场景 4: 从其他部署方式迁移

#### 从手动部署迁移

**步骤**:

1. **备份现有配置**
   ```bash
   ssh admin@<server>
   cp -r ~/.openclaw ~/.openclaw.backup.$(date +%Y%m%d)
   ```

2. **运行 Ansible 部署**
   ```bash
   ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini --tags agents,channels,config
   ```

3. **对比配置差异**
   ```bash
   ssh admin@<server>
   diff -r ~/.openclaw.backup.*/agents ~/.openclaw/agents
   diff -r ~/.openclaw.backup.*/channels ~/.openclaw/channels
   ```

4. **恢复自定义配置**
   ```bash
   # 如果有自定义的 AGENTS.md、SOUL.md 等
   cp ~/.openclaw.backup.*/agents/*/AGENTS.md ~/.openclaw/agents/*/
   ```

5. **验证**
   ```bash
   openclaw status --deep
   ```

---

## 迁移检查清单

### 迁移前

- [ ] 备份现有服务器所有配置
- [ ] 记录当前运行的版本和配置
- [ ] 测试新服务器 SSH 连接
- [ ] 确认新服务器系统要求（内存、磁盘、网络）

### 迁移中

- [ ] 运行 Ansible 部署
- [ ] 上传备份配置
- [ ] 应用配置（注意权限）
- [ ] 重启 Gateway 服务

### 迁移后

- [ ] 验证 `openclaw status --deep`
- [ ] 验证所有渠道在线（Telegram/Feishu）
- [ ] 测试每个 Agent 响应
- [ ] 检查日志无错误
- [ ] 测试 inbound 消息路由
- [ ] 确认密钥配置正确

---

## 迁移工具

### 自动化迁移脚本

```bash
# 使用项目提供的迁移脚本
./scripts/migrate-from-server.sh 47.82.234.46 admin <new-server>
```

### 手动迁移命令

```bash
# 1. 完整备份旧服务器
ssh admin@47.82.234.46 "cd ~/.openclaw && tar czf - ." > openclaw-full-backup.tar.gz

# 2. 部署新服务器
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 3. 恢复配置
cat openclaw-full-backup.tar.gz | ssh admin@<new-server> "cd ~/.openclaw && tar xzf -"

# 4. 修复权限
ssh admin@<new-server> "chown -R admin:admin ~/.openclaw && chmod 600 ~/.openclaw/runtime-secrets.json ~/.openclaw/gateway.env"

# 5. 重启服务
ssh admin@<new-server> "systemctl --user restart openclaw-gateway"

# 6. 验证
ssh admin@<new-server> "openclaw status --deep"
```

---

## 常见问题

### Q: 迁移后 Agent 不响应

**A**: 检查以下几点：

1. **配置是否正确加载**
   ```bash
   ssh admin@<new-server> "cat ~/.openclaw/openclaw.json | jq '.agents | keys'"
   ```

2. **密钥是否配置**
   ```bash
   ssh admin@<new-server> "openclaw secrets audit"
   ```

3. **渠道是否在线**
   ```bash
   ssh admin@<new-server> "openclaw status --deep | grep -E '(Channel|ON|OK)'"
   ```

### Q: 迁移后渠道 OFFLINE

**A**: 检查以下几点：

1. **Bot Token 是否正确**
   ```bash
   ssh admin@<new-server> "cat ~/.openclaw/runtime-secrets.json | grep TELEGRAM"
   ```

2. **网络连通性**
   ```bash
   ssh admin@<new-server> "curl -s https://api.telegram.org"
   ssh admin@<new-server> "curl -s https://open.feishu.cn"
   ```

3. **防火墙规则**
   ```bash
   ssh admin@<new-server> "sudo ufw status"
   ```

### Q: 迁移后配置丢失

**A**: 检查以下几点：

1. **备份是否存在**
   ```bash
   ssh admin@<new-server> "ls -la ~/.openclaw.backup.*"
   ```

2. **Ansible 是否覆盖配置**
   ```bash
   # 检查 openclaw.json
   ssh admin@<new-server> "cat ~/.openclaw/openclaw.json | jq '.channels, .bindings'"
   ```

3. **恢复备份**
   ```bash
   ssh admin@<new-server>
   rm -rf ~/.openclaw
   cp -r ~/.openclaw.backup.<timestamp> ~/.openclaw
   systemctl --user restart openclaw-gateway
   ```

---

## 回滚流程

### 如果迁移失败

```bash
# 1. 停止新服务器 Gateway
ssh admin@<new-server> "systemctl --user stop openclaw-gateway"

# 2. 恢复旧服务器配置（如果修改过）
ssh admin@47.82.234.46
cp -r ~/.openclaw.backup.<timestamp> ~/.openclaw
systemctl --user restart openclaw-gateway

# 3. 验证旧服务器
openclaw status --deep
```

### 如果新服务器配置损坏

```bash
# 1. 停止 Gateway
ssh admin@<new-server> "systemctl --user stop openclaw-gateway"

# 2. 清理配置
ssh admin@<new-server> "rm -rf ~/.openclaw"

# 3. 重新部署
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 4. 重新配置密钥
ssh admin@<new-server>
vim ~/.openclaw/runtime-secrets.json
vim ~/.openclaw/gateway.env
systemctl --user restart openclaw-gateway
```

---

## 迁移最佳实践

### 1. 分阶段迁移

1. **第一阶段**: 部署基础环境（Node.js、OpenClaw CLI）
2. **第二阶段**: 部署 Agent 配置
3. **第三阶段**: 部署渠道配置
4. **第四阶段**: 验证并切换流量

### 2. 并行运行

- 在迁移期间，保持旧服务器运行
- 新服务器验证通过后再切换 DNS/流量
- 保留旧服务器作为备份至少 7 天

### 3. 测试计划

- **功能测试**: 每个 Agent 响应测试
- **集成测试**: 渠道消息路由测试
- **性能测试**: 响应时间、并发测试
- **安全测试**: 密钥、权限、网络测试

### 4. 文档更新

- 记录所有配置变更
- 更新运维文档
- 通知相关人员

---

## 附录

### 迁移命令速查

```bash
# 备份
ssh admin@<old-server> "cd ~/.openclaw && tar czf - ." > backup.tar.gz

# 部署
ansible-playbook playbooks/deploy.yml -i inventory/hosts.ini

# 恢复
cat backup.tar.gz | ssh admin@<new-server> "cd ~/.openclaw && tar xzf -"

# 验证
ssh admin@<new-server> "openclaw status --deep"
```

### 迁移时间估算

| 步骤 | 预计时间 |
|------|----------|
| 备份旧服务器 | 5-10 分钟 |
| 部署新服务器 | 10-15 分钟 |
| 迁移配置 | 5-10 分钟 |
| 验证测试 | 15-30 分钟 |
| **总计** | **35-65 分钟** |

---

**最后更新**: 2026-04-08
