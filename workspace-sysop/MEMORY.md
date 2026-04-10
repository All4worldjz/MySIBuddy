# SysOP 运维知识库

## 系统信息
- **服务器**: 47.82.234.46 (阿里云)
- **OS**: Ubuntu Linux
- **OpenClaw 版本**: 2026.4.8
- **Node 版本**: 24.13.0

## 服务状态
- **Gateway**: systemd --user openclaw-gateway
- **配置路径**: /home/admin/.openclaw/openclaw.json
- **日志路径**: journalctl --user -u openclaw-gateway

## 安全配置
- SSH: 仅密钥认证，禁用 root 登录
- 防火墙: 仅允许 SSH(22) + 已建立连接 + 本地回环
- Swap: 4GB swapfile

## 备份策略
- 配置变更自动备份（pre-apply-*.json）
- 本地仓库备份（docs/ 目录）

## 常用运维命令
```bash
# 服务状态
systemctl --user status openclaw-gateway
openclaw status --deep

# 日志查看
journalctl --user -u openclaw-gateway -n 50 --no-pager

# 重启服务
systemctl --user restart openclaw-gateway

# 配置验证
openclaw validate /path/to/config.json

# 密钥管理
openclaw secrets audit
openclaw secrets reload
```

## 故障处理流程
1. 检查服务状态
2. 查看错误日志
3. 验证配置文件
4. 备份当前配置
5. 执行修复/回滚
6. 验证恢复结果
