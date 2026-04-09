# CalDAV → 飞书日历 同步系统

## 📋 项目概述

本系统实现从 **WPS CalDAV 日历** 自动同步事件到 **飞书日历**,通过 systemd timer 每 10 分钟检测并同步新事件。

### ✅ 核心功能

- ✅ **完整同步**: 直接调用飞书 Open API 创建/更新/删除事件 (不依赖 work-hub)
- ✅ **增量同步**: 记录已同步事件 UID,避免重复创建
- ✅ **删除同步**: CalDAV 删除的事件,飞书日历也自动删除
- ✅ **自动调度**: systemd timer 每 10 分钟触发
- ✅ **状态持久化**: 同步状态保存到 JSON 文件,支持断点续传
- ✅ **完整日志**: 结构化日志,便于排查问题
- ✅ **权限隔离**: CalDAV 读取 + 飞书写入分离

---

## 🖥️ 架构设计

```
┌─────────────────┐     CalDAV 协议      ┌──────────────────────┐
│  WPS CalDAV     │ ←──────────────────→ │  caldav_sync_full.py │
│  caldav.wps.cn  │     (Basic Auth)     │  (完整同步脚本)       │
└─────────────────┘                      └──────────┬───────────┘
                                                    │
                                                    │ 飞书 Open API
                                                    │ (直接调用,不依赖 Agent)
                                                    ↓
                                         ┌──────────────────────┐
                                         │   飞书日历           │
                                         │   (金牛主日历)       │
                                         └──────────────────────┘
```

### 同步逻辑

1. **新增事件**: CalDAV 有新事件 → 飞书创建对应事件
2. **更新事件**: CalDAV 事件修改 (DTSTAMP 变更) → 飞书更新对应事件
3. **删除事件**: CalDAV 删除事件 → 飞书删除对应事件
4. **增量同步**: 记录 CalDAV UID → 飞书 Event ID 映射,避免重复

---

## 📁 目录结构

```
caldav-sync/
├── README.md                      # 本文件
├── .gitignore                     # 排除敏感凭据和数据文件
├── caldav_sync.py                 # Python 同步脚本 (旧版,仅输出 JSON)
├── caldav_sync_full.py            # Python 完整同步脚本 (✅ 当前使用)
├── caldav_sync.sh                 # Shell 包装脚本 (连通性测试)
├── requirements.txt               # Python 依赖
├── systemd/
│   ├── caldav-sync.service        # systemd 服务配置
│   └── caldav-sync.timer          # systemd 定时器配置
└── docs/
    ├── TROUBLESHOOTING.md         # 故障排查指南
    └── REGRESSION_TEST_REPORT.md  # 回归测试报告
```

---

## 🚀 部署指南

### 1. 安装依赖

```bash
pip3 install caldav icalendar requests --break-system-packages
```

### 2. 部署 systemd 服务

```bash
# 复制服务文件
sudo cp systemd/caldav-sync.service /etc/systemd/system/
sudo cp systemd/caldav-sync.timer /etc/systemd/system/

# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启用并启动定时器
sudo systemctl enable caldav-sync.timer
sudo systemctl start caldav-sync.timer

# 验证状态
sudo systemctl status caldav-sync.timer
```

### 3. 手动测试

```bash
# 手动触发一次同步
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py

# 查看同步状态
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq

# 查看日志
tail -f /home/admin/.openclaw/logs/caldav_sync_full.log
```

---

## 📊 运行状态监控

### 查看服务状态

```bash
# 查看 timer 状态
sudo systemctl status caldav-sync.timer

# 查看下次触发时间
systemctl list-timers caldav-sync.timer

# 查看服务日志
journalctl -u caldav-sync.service -n 50

# 查看应用日志
tail -f /home/admin/.openclaw/logs/caldav_sync_full.log
```

### 查看同步状态

```bash
# 查看统计信息
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq '{
  synced: .synced_count,
  deleted: .deleted_count,
  tracked: (.caldav_uids | length),
  last_sync: .last_sync
}'

# 查看已追踪的事件映射
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq '.caldav_uids'
```

---

## 🔄 状态文件结构

**文件路径**: `/home/admin/.openclaw/data/caldav_sync_state_v2.json`

```json
{
  "last_sync": "2026-04-10T00:35:54.812000",
  "caldav_uids": {
    "000_bfc82b33c03c693ebd0d496ea21f5521": {
      "feishu_event_id": "event_123456",
      "summary": "周例会",
      "updated": "2026-04-10T00:00:00+08:00"
    }
  },
  "synced_count": 14,
  "deleted_count": 0
}
```

**字段说明**:
- `last_sync`: 上次同步时间
- `caldav_uids`: CalDAV UID → 飞书 Event ID 映射表
- `synced_count`: 累计创建的事件数
- `deleted_count`: 累计删除的事件数

---

## 🛠️ 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| CalDAV 连接失败 | 凭据错误/网络问题 | 检查用户名密码,测试连通性 |
| 飞书创建失败 | 令牌过期/权限不足 | 检查 FEISHU_APP_SECRET,重新授权 |
| 事件重复创建 | 状态文件丢失 | 删除 `caldav_sync_state_v2.json` 重置 |
| systemd 不触发 | timer 未启用 | `sudo systemctl enable caldav-sync.timer` |

### 重置同步状态

```bash
# 备份当前状态
cp /home/admin/.openclaw/data/caldav_sync_state_v2.json /tmp/caldav_state_backup.json

# 重置 (会重新同步所有事件)
rm /home/admin/.openclaw/data/caldav_sync_state_v2.json

# 手动触发一次同步
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

---

## 🔒 安全注意事项

1. **凭据保护**: CalDAV 密码和飞书密钥存储在脚本和 runtime-secrets.json 中
2. **文件权限**: 确保脚本权限 `chmod 600`
3. **日志脱敏**: 生产环境建议隐藏敏感信息
4. **Git 安全**: 切勿将含凭据的文件提交到 Git

---

## 📝 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-08 | 初始版本 (仅输出 JSON,不创建飞书事件) |
| v2.0 | 2026-04-10 | 完整同步版本,直接调用飞书 API,支持增删改 |

---

## 🔗 相关链接

- **WPS CalDAV 文档**: https://caldav.wps.cn
- **飞书日历 API**: https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event/create
- **OpenClaw 配置**: `/home/admin/.openclaw/openclaw.json`

---

## 👥 维护者

- **运维**: 监控同步状态和日志
- **开发**: caldav-sync 项目组

---

最后更新: 2026-04-10  
版本: v2.0
