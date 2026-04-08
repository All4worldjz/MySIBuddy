# CalDAV → 飞书日历 同步系统

## 系统概述

本系统实现从 **WPS CalDAV 日历** 自动同步事件到 **飞书日历**，通过定时任务每 10 分钟检测并同步新事件。

### 架构设计

```
┌─────────────────┐     CalDAV 协议      ┌─────────────────┐
│  WPS CalDAV     │ ←──────────────────→ │  Python 脚本     │
│  caldav.wps.cn  │     (Basic Auth)     │  caldav_sync.py  │
└─────────────────┘                      └────────┬────────┘
                                                  │
                                                  │ JSON
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

- ✅ **增量同步**：记录已同步事件 UID，避免重复
- ✅ **自动调度**：systemd timer 每 10 分钟触发
- ✅ **日志记录**：完整运行日志，便于排查
- ✅ **状态持久化**：同步状态保存到 JSON 文件
- ✅ **权限隔离**：CalDAV 读取 + 飞书写入分离

---

## 部署环境

| 项目 | 配置 |
|------|------|
| 服务器 | MySiBuddy (Ubuntu 24.04) |
| Python | 3.12+ |
| 依赖库 | caldav, icalendar |
| 调度器 | systemd timer |
| 日志路径 | `/home/admin/.openclaw/logs/caldav_sync.log` |

---

## 安装步骤

### 1. 安装依赖

```bash
pip3 install caldav icalendar --break-system-packages
```

### 2. 配置 CalDAV 凭据

编辑 `/home/admin/.openclaw/scripts/caldav_sync.py`：

```python
CALDAV_URL = "https://caldav.wps.cn"
CALDAV_USER = "u_H7q73bsRsFUyck"
CALDAV_PASS = "2HotzgGR5VDKiBqXwtYG50XbmZ"
```

### 3. 创建 systemd 服务

**服务文件**：`/etc/systemd/system/caldav-sync.service`

```ini
[Unit]
Description=CalDAV to Feishu Calendar Sync
After=network.target

[Service]
Type=oneshot
User=admin
WorkingDirectory=/home/admin/.openclaw/scripts
ExecStart=/usr/bin/python3 /home/admin/.openclaw/scripts/caldav_sync.py
StandardOutput=journal
StandardError=journal
```

**定时器文件**：`/etc/systemd/system/caldav-sync.timer`

```ini
[Unit]
Description=Run CalDAV sync every 10 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=10min
Unit=caldav-sync.service

[Install]
WantedBy=timers.target
```

### 4. 启用服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable caldav-sync.timer
sudo systemctl start caldav-sync.timer
sudo systemctl status caldav-sync.timer
```

### 5. 验证运行

```bash
# 查看日志
journalctl -u caldav-sync.service -n 20

# 或查看文件日志
tail -f /home/admin/.openclaw/logs/caldav_sync.log

# 手动触发测试
python3 /home/admin/.openclaw/scripts/caldav_sync.py
```

---

## 工作流程

### 同步流程

1. **触发**：systemd timer 每 10 分钟触发 `caldav-sync.service`
2. **读取状态**：加载 `caldav_sync_state.json`，获取上次同步时间
3. **拉取事件**：从 WPS CalDAV 获取增量事件（上次同步至今）
4. **过滤去重**：排除已同步的事件 UID
5. **输出待办**：保存待同步事件到 `caldav_events_pending.json`
6. **Agent 创建**：work-hub 通过 `feishu_calendar_event` 创建飞书日历事件
7. **更新状态**：标记已同步事件 UID，保存新同步时间

### 状态文件结构

```json
{
  "last_sync": "2026-04-08T15:52:45.790635",
  "synced_event_uids": [
    "000_788efc3f76108442fe6effc28f569f74",
    "000_113676e03367cf5b6839cde8bf86bff4"
  ],
  "synced_count": 11
}
```

---

## 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| CalDAV 连接失败 | 凭据错误/网络问题 | 检查用户名密码，测试 `curl -u user:pass https://caldav.wps.cn` |
| 飞书创建失败 | OAuth 过期 | 重新授权飞书应用日历权限 |
| 事件重复 | 状态文件丢失 | 手动删除 `caldav_sync_state.json` 重置 |
| systemd 不触发 | timer 未启用 | `sudo systemctl enable caldav-sync.timer` |

### 日志位置

- **系统日志**：`journalctl -u caldav-sync.service -f`
- **应用日志**：`/home/admin/.openclaw/logs/caldav_sync.log`
- **状态文件**：`/home/admin/.openclaw/data/caldav_sync_state.json`

---

## 安全注意事项

1. **凭据保护**：`caldav_sync.py` 包含明文密码，确保文件权限 `chmod 600`
2. **OAuth Token**：飞书用户授权需定期刷新
3. **日志脱敏**：生产环境建议隐藏敏感信息

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-08 | 初始版本，支持 WPS CalDAV → 飞书日历同步 |

---

## 联系方式

- 部署服务器：MySiBuddy (admin@47.82.234.46)
- Git 仓库：GitHub / MySiBuddy / dev 分支
