# CalDAV → 飞书日历 同步系统

## 📋 项目概述

本系统实现从 **WPS CalDAV 日历** 自动同步事件到 **飞书日历**,通过 systemd timer 每 10 分钟检测并同步新事件。

### 架构设计

```
┌─────────────────┐     CalDAV 协议      ┌─────────────────┐
│  WPS CalDAV     │ ←──────────────────→ │  Python 脚本     │
│  caldav.wps.cn  │     (Basic Auth)     │  caldav_sync.py  │
└─────────────────┘                      └────────┬────────┘
                                                  │
                                                  │ JSON (待同步事件)
                                                  ↓
                                         ┌─────────────────┐
                                         │  work-hub Agent │
                                         │  feishu_        │
                                         │  calendar_event │
                                         └────────┬────────┘
                                                  │
                                                  │ Feishu API
                                                  ↓
                                         ┌─────────────────┐
                                         │   飞书日历      │
                                         │   (用户 OAuth)   │
                                         └─────────────────┘
```

### 核心特性

- ✅ **增量同步**: 记录已同步事件 UID,避免重复创建
- ✅ **自动调度**: systemd timer 每 10 分钟触发
- ✅ **状态持久化**: 同步状态保存到 JSON 文件
- ✅ **完整日志**: 结构化日志,便于排查问题
- ✅ **权限隔离**: CalDAV 读取 + 飞书写入分离

---

## 🖥️ 部署环境

| 项目 | 配置 |
|------|------|
| 服务器 | MySiBuddy (Ubuntu 24.04) |
| Python | 3.12+ |
| 依赖库 | `caldav`, `icalendar` |
| 调度器 | systemd timer (`caldav-sync.timer`) |
| 日志路径 | `/home/admin/.openclaw/logs/caldav_sync.log` |
| 状态文件 | `/home/admin/.openclaw/data/caldav_sync_state.json` |
| 输出文件 | `/home/admin/.openclaw/data/caldav_events_pending.json` |

---

## 📁 目录结构

```
caldav-sync/
├── README.md                    # 本文件
├── .gitignore                   # 排除敏感凭据和数据文件
├── caldav_sync.py               # Python 同步脚本 (主程序)
├── caldav_sync.sh               # Shell 包装脚本 (连通性测试)
├── systemd/
│   ├── caldav-sync.service      # systemd 服务配置
│   └── caldav-sync.timer        # systemd 定时器配置
└── docs/
    └── TROUBLESHOOTING.md       # 故障排查指南
```

---

## 🚀 安装与部署

### 1. 安装依赖

```bash
pip3 install caldav icalendar --break-system-packages
```

### 2. 配置 CalDAV 凭据

**⚠️ 安全警告**: 当前版本凭据明文存储在 `caldav_sync.py` 中。

**临时方案**: 确保文件权限 `chmod 600 caldav_sync.py`

**长期方案**: 迁移到 OpenClaw SecretRef 或环境变量

编辑 `caldav_sync.py`:

```python
CALDAV_URL = "https://caldav.wps.cn"
CALDAV_USER = "u_H7q73bsRsFUyck"
CALDAV_PASS = "2HotzgGR5VDKiBqXwtYG50XbmZ"
```

### 3. 部署 systemd 服务

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
tail -f /home/admin/.openclaw/logs/caldav_sync.log
```

### 查看同步状态

```bash
# 查看已同步事件数
cat /home/admin/.openclaw/data/caldav_sync_state.json | jq '.synced_count'

# 查看上次同步时间
cat /home/admin/.openclaw/data/caldav_sync_state.json | jq '.last_sync'

# 查看待同步事件
cat /home/admin/.openclaw/data/caldav_events_pending.json | jq '.pending_events | length'
```

### 手动触发同步

```bash
# 方式 1: 直接运行 Python 脚本
python3 /home/admin/.openclaw/scripts/caldav_sync.py

# 方式 2: 手动触发 systemd service
sudo systemctl start caldav-sync.service
```

---

## 🔄 工作流程

### 同步流程

1. **触发**: systemd timer 每 10 分钟触发 `caldav-sync.service`
2. **读取状态**: 加载 `caldav_sync_state.json`,获取上次同步时间
3. **拉取事件**: 从 WPS CalDAV 获取增量事件 (上次同步至今)
4. **过滤去重**: 排除已同步的事件 UID
5. **输出待办**: 保存待同步事件到 `caldav_events_pending.json`
6. **Agent 创建**: work-hub 通过 `feishu_calendar_event` 创建飞书日历事件
7. **更新状态**: 标记已同步事件 UID,保存新同步时间

### 状态文件结构

```json
{
  "last_sync": "2026-04-09T23:51:31.376905",
  "synced_event_uids": [
    "000_bfc82b33c03c693ebd0d496ea21f5521",
    "000_788efc3f76108442fe6effc28f569f74"
  ],
  "synced_count": 16
}
```

### 输出文件结构

```json
{
  "pending_events": [
    {
      "summary": "项目评审会议",
      "start_time": "2026-04-10T14:00:00+08:00",
      "end_time": "2026-04-10T15:00:00+08:00",
      "description": "讨论 Q2 计划",
      "location": "会议室 A",
      "uid": "000_abc123"
    }
  ],
  "synced_count": 16,
  "timestamp": "2026-04-09T23:51:31.376905"
}
```

---

## 🛠️ 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| CalDAV 连接失败 | 凭据错误/网络问题 | 检查用户名密码,测试 `curl -u user:pass https://caldav.wps.cn` |
| 飞书创建失败 | OAuth 过期 | 重新授权飞书应用日历权限 |
| 事件重复创建 | 状态文件丢失 | 手动删除 `caldav_sync_state.json` 重置 |
| systemd 不触发 | timer 未启用 | `sudo systemctl enable caldav-sync.timer` |
| iCal 解析警告 | WPS CalDAV 不标准 | 无害,`icalendar` 库自动修复 |

### 日志分析

```bash
# 查看最近错误
grep "ERROR" /home/admin/.openclaw/logs/caldav_sync.log | tail -20

# 查看同步统计
grep "待同步事件\|从 CalDAV 获取到" /home/admin/.openclaw/logs/caldav_sync.log | tail -10

# 实时监控
tail -f /home/admin/.openclaw/logs/caldav_sync.log
```

### 重置同步状态

```bash
# 备份当前状态
cp /home/admin/.openclaw/data/caldav_sync_state.json /tmp/caldav_state_backup.json

# 重置 (会从 2026-04-01 开始重新同步)
echo '{"last_sync": "2026-04-01T00:00:00+08:00", "synced_event_uids": [], "synced_count": 0}' > /home/admin/.openclaw/data/caldav_sync_state.json

# 手动触发一次同步
python3 /home/admin/.openclaw/scripts/caldav_sync.py
```

---

## 🔒 安全注意事项

1. **凭据保护**: `caldav_sync.py` 包含明文密码,确保文件权限 `chmod 600`
2. **OAuth Token**: 飞书用户授权需定期刷新
3. **日志脱敏**: 生产环境建议隐藏敏感信息
4. **Git 安全**: 切勿将含凭据的文件提交到 Git (已在 `.gitignore` 中排除)

---

## 📝 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-08 | 初始版本,支持 WPS CalDAV → 飞书日历同步 |
| v1.1 | 2026-04-09 | 迁移到 projects/caldav-sync,补充 systemd 配置和文档 |

---

## 🔗 相关链接

- **WPS CalDAV 文档**: https://caldav.wps.cn
- **飞书日历 API**: https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event/create
- **OpenClaw 配置**: `/home/admin/.openclaw/openclaw.json`

---

## 👥 维护者

- **work-hub (金牛)**: 飞书日历事件创建
- **运维**: 监控同步状态和日志

---

最后更新: 2026-04-09  
版本: v1.1
