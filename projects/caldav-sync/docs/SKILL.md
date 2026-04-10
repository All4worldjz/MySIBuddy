# CalDAV → 飞书日历 同步系统 - AI Coding 工具操作指南

> **适用工具**: Qwen Code, Claude Code, Gemini, Cursor, Copilot 等  
> **更新日期**: 2026-04-10  
> **版本**: v2.0

---

## 📋 快速上手

### 1. 了解项目结构

```
caldav-sync/
├── caldav_sync_full.py          # 主同步脚本 (当前使用)
├── caldav_sync.py               # 旧版脚本 (已废弃，保留参考)
├── feishu_oauth_setup.py        # OAuth 授权辅助脚本
├── export_feishu_token.js       # Token 导出脚本 (Node.js)
├── systemd/
│   ├── caldav-sync.service      # systemd 服务配置
│   └── caldav-sync.timer        # systemd 定时器 (每 10 分钟)
└── docs/
    ├── DESIGN_LOG.md            # 完整设计历程和排错历史
    ├── TROUBLESHOOTING.md       # 常见故障排查指南
    └── SKILL.md                 # 本文档
```

### 2. 核心架构

```
WPS CalDAV → caldav_sync_full.py → 飞书 Open API → CC 用户日历
                    ↓
              状态追踪 (UID 映射)
              Token 自动刷新 (v2 endpoint)
              完整增删改同步
```

### 3. 关键配置

```python
# caldav_sync_full.py
CALDAV_URL = "https://caldav.wps.cn"
CALDAV_USER = "u_tHmFYAfGi9zhrD"
CALDAV_PASS = "KAbrDeKq4xfdMXBDuUy5Y06aPM"

FEISHU_APP_ID = "cli_a93c20939cf8dbef"
FEISHU_USER_OPEN_ID = "ou_04405f4e9dbe76c2cf241402bc2096b7"
FEISHU_CALENDAR_ID = "feishu.cn_ymY7s23MqxLG33KkwElcuf@group.calendar.feishu.cn"
```

### 4. 部署位置

| 类型 | 路径 |
|------|------|
| **脚本部署目录** | `/home/admin/.openclaw/scripts/` |
| **工作目录** | `/home/admin/.openclaw/scripts/` (systemd WorkingDirectory) |
| **日志文件** | `/home/admin/.openclaw/logs/caldav_sync_full.log` |
| **状态文件** | `/home/admin/.openclaw/data/caldav_sync_state_v2.json` |
| **Token 存储** | `~/.local/share/openclaw-feishu-uat/*.enc` (AES-256-GCM 加密) |

**systemd 服务配置**:
```ini
[Service]
WorkingDirectory=/home/admin/.openclaw/scripts
ExecStart=/usr/bin/python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

> **注意**: 所有文件路径在脚本中使用**绝对路径**，不依赖工作目录。

---

## 🔧 常用操作

### 查看同步状态

```bash
# 统计信息
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq '{
  tracked: (.caldav_uids | length),
  synced: .synced_count,
  deleted: .deleted_count
}'

# 查看日志
tail -f /home/admin/.openclaw/logs/caldav_sync_full.log

# 检查 systemd 状态
sudo systemctl status caldav-sync.timer
```

### 手动触发同步

```bash
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

### 刷新 OAuth Token

```bash
# 方式 1: 重新 OAuth 授权 (推荐)
# 在飞书中向 work-hub 发送任意消息

# 方式 2: 导出 token
node /home/admin/.openclaw/scripts/export_feishu_token.js
```

### 重置同步状态

```bash
rm /home/admin/.openclaw/data/caldav_sync_state_v2.json
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

---

## ⚠️ 已知陷阱 (必读!)

### 1. Token 刷新必须使用 v2 endpoint

**错误方式**:
```python
# ❌ 错误: v1 endpoint + JSON 格式
requests.post(
    "https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token",
    json={"grant_type": "refresh_token", ...}
)
```

**正确方式**:
```python
# ✅ 正确: v2 endpoint + form-urlencoded
import urllib.parse
body = urllib.parse.urlencode({
    "grant_type": "refresh_token",
    "refresh_token": refresh_token,
    "client_id": app_id,
    "client_secret": app_secret
})
requests.post(
    "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    data=body
)
```

### 2. 日历 ID 不是 open_id 构造的

**错误假设**:
```python
# ❌ 错误: 用户日历 ID 不是 open_id@group.calendar.feishu.cn
calendar_id = f"{user_open_id}@group.calendar.feishu.cn"
```

**正确获取方式**:
```bash
# 通过 API 获取真实 calendar_id
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://open.feishu.cn/open-apis/calendar/v4/calendars
```

### 3. 飞书 API 时间格式

**错误方式**:
```python
# ❌ 错误: 使用 date_time 字段
{"start_time": {"date_time": "2026-04-10T14:00:00+08:00"}}
```

**正确方式**:
```python
# ✅ 正确: 使用 timestamp 字段 (Unix 秒)
{"start_time": {"timestamp": "1744264800", "timezone": "Asia/Shanghai"}}
```

### 4. iCal DTSTART/DTEND 可能是列表

**处理方式**:
```python
def get_dt(prop_value):
    if isinstance(prop_value, list):
        prop_value = prop_value[0]
    if hasattr(prop_value, 'dt'):
        dt = prop_value.dt
        if isinstance(dt, list):
            dt = dt[0]
        if hasattr(dt, 'isoformat'):
            return dt.isoformat()
    return None
```

### 5. 时区比较问题

**错误方式**:
```python
# ❌ 错误: 混合比较 naive 和 aware datetime
if datetime.now() < expires_at:  # expires_at 可能有时区
```

**正确方式**:
```python
# ✅ 正确: 统一时区
now = datetime.now()
if expires_at.tzinfo is not None:
    now = datetime.now(expires_at.tzinfo)
if now < expires_at:
    ...
```

---

## 🚀 升级路径

### 添加新功能

1. **阅读设计日志**: `docs/DESIGN_LOG.md` 了解历史决策
2. **修改主脚本**: `caldav_sync_full.py` (不要改旧版 `caldav_sync.py`)
3. **测试**: 手动运行脚本验证功能
4. **更新文档**: 同步更新 DESIGN_LOG.md 和 TROUBLESHOOTING.md
5. **提交**: `git commit` 并推送到 GitHub

### 修改配置

1. **CalDAV 凭据变更**: 更新 `caldav_sync_full.py` 顶部配置区
2. **飞书用户变更**: 更新 `FEISHU_USER_OPEN_ID` 和 `FEISHU_CALENDAR_ID`
3. **Token 过期**: 重新 OAuth 授权或运行 `export_feishu_token.js`

### 调试步骤

1. **查看日志**: `tail -f /home/admin/.openclaw/logs/caldav_sync_full.log`
2. **检查状态**: `cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq`
3. **手动运行**: `python3 /home/admin/.openclaw/scripts/caldav_sync_full.py`
4. **参考排错指南**: `docs/TROUBLESHOOTING.md`

---

## 📊 验证清单

修改后必须验证:

- [ ] `python3 -m py_compile caldav_sync_full.py` 语法检查通过
- [ ] 手动运行脚本无 ERROR
- [ ] 增量同步 0 重复 (运行两次，第二次应 0 新增)
- [ ] 飞书日历事件正确创建/更新/删除
- [ ] 日志文件正确记录 (无 stdout 输出)
- [ ] systemd timer 正常触发 (`systemctl list-timers`)

---

## 🔗 相关文档

- `README.md`: 项目概述和部署指南
- `docs/DESIGN_LOG.md`: 完整设计历程和排错历史
- `docs/TROUBLESHOOTING.md`: 常见故障排查指南

---

**维护者**: AI Coding Team  
**最后更新**: 2026-04-10
