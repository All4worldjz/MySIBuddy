# OpenClaw 运维脚本库

## 脚本清单

| 脚本 | 用途 | 版本 |
|-----|------|------|
| `system_health_report.sh` | 系统健康监控报告（每小时） | v2.1.0 |
| `system_health_alert.sh` | 系统健康异常告警（每 30 分钟） | v1.0.0 |
| `feishu_create_folder.sh` | 飞书文件夹创建 | v1.0 |
| `feishu_delete_folder.sh` | 飞书文件夹删除 | v1.0 |
| `feishu_move_folder.sh` | 飞书文件夹移动 | v1.0 |
| `backup_openclaw_config.sh` | OpenClaw 配置备份 | v1.0 |

---

## system_health_report.sh

### 用途
每小时自动采集系统健康指标，生成 Markdown 报告并发送给春哥（Telegram）。

### 监控指标
- **系统资源层**：磁盘、CPU、内存、负载、进程 TOP5
- **OpenClaw 应用层**：Gateway 状态、模型服务、Token 占用、会话数、频道连接

### 告警阈值
| 指标 | 🟡 警告 | 🔴 紧急 |
|-----|--------|--------|
| 磁盘使用率 | ≥80% | ≥95% |
| CPU 使用率 | ≥70% | ≥90% |
| 内存使用率 | ≥80% | ≥95% |
| 负载比 (负载/核数) | ≥0.7 | ≥1.0 |
| Token 上下文占用 | ≥75% | ≥90% |

### 依赖命令
```bash
df free ps uptime awk sort head date hostname nproc timeout openclaw
```

### 执行方式
```bash
# 手动执行
bash /home/admin/.openclaw/scripts/system_health_report.sh

# Cron 定时（每小时）
0 * * * * bash /home/admin/.openclaw/scripts/system_health_report.sh
```

### 输出示例
```markdown
# 🖥️ 系统健康 | MySiBuddy
🕐 2026-04-09 12:04 CST

### 告警汇总
**系统资源** → 全部 🟢
**OpenClaw** → 全部 🟢

**📀 磁盘**  🟢 /dev/vda3 49G 60% /
**🖥️ CPU**   🟢 总使用率：3% | 空闲：97%
**💾 内存**  🟢 1.4/3.4 GB (41.4%) | 可用：2.0 GB
```

---

## system_health_alert.sh

### 用途
每 30 分钟检查系统健康指标，超 🔴 阈值立即推送告警到 Telegram。

### 告警条件（去重 30 分钟）
| 指标 | 🔴 阈值 |
|-----|--------|
| 磁盘使用率 | ≥95% |
| 内存使用率 | ≥95% |
| 负载比 (负载/核数) | ≥1.0 |
| Gateway 状态 | stopped |

### 执行方式
```bash
# 手动执行
bash /home/admin/.openclaw/scripts/system_health_alert.sh

# Cron 定时（每 30 分钟）
*/30 * * * * bash /home/admin/.openclaw/scripts/system_health_alert.sh
```

### 输出
- 有告警：输出告警消息（由 Cron 转发到 Telegram）
- 无告警：输出"无紧急告警"（不推送）

---

## 工程规范

- ✅ 所有脚本必须含头部注释（依赖清单、版本要求、执行示例）
- ✅ 符合"可复制 × 可追溯 × 可迭代"铁律
- ✅ 变更后必须 Git commit + MEMORY.md 记录
