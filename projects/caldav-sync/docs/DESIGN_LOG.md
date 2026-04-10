# CalDAV → 飞书日历 同步系统设计日志

**创建日期**: 2026-04-10  
**维护者**: AI Coding Team  
**版本**: v2.0

---

## 📋 设计历程

### v1.0: 初始版本 (已废弃)

**文件**: `caldav_sync.py`

**设计思路**:
- 从 WPS CalDAV 获取事件
- 输出 JSON 到 `caldav_events_pending.json`
- 依赖 work-hub agent 消费 JSON 并创建飞书事件

**致命缺陷**:
- ❌ 脚本只做了一半工作 (仅输出 JSON，从未创建飞书事件)
- ❌ work-hub 从未配置自动消费逻辑
- ❌ 无删除同步 (CalDAV 删除的事件，飞书上不会删除)
- ❌ 结果: 日历从未真正同步

---

### v2.0: 完整重写 (当前版本)

**文件**: `caldav_sync_full.py`

#### 核心设计决策

1. **直接调用飞书 Open API**
   - 不再依赖 work-hub agent
   - 脚本独立完成 读取 CalDAV → 创建/更新/删除飞书事件

2. **用户 OAuth 身份**
   - 使用 CC 用户的 user_access_token (非应用 tenant token)
   - 事件直接创建在用户日历上 (非应用日历 + 参会人)
   - 用户: CC Liu (`ou_04405f4e9dbe76c2cf241402bc2096b7`)
   - 日历 ID: `feishu.cn_ymY7s23MqxLG33KkwElcuf@group.calendar.feishu.cn`

3. **完整的增删改同步**
   - **新增**: CalDAV 新事件 → 飞书创建
   - **更新**: CalDAV 事件修改 (DTSTAMP 变更) → 飞书更新
   - **删除**: CalDAV 删除事件 → 飞书删除
   - **去重**: CalDAV UID → 飞书 Event ID 映射追踪

4. **自动 Token 刷新**
   - access_token 有效期 2 小时
   - 过期前自动使用 refresh_token 刷新
   - 使用飞书 v2 endpoint (`/authen/v2/oauth/token`)
   - 使用 `application/x-www-form-urlencoded` 格式

5. **静默运行**
   - 无任何 bot API 调用
   - 日志仅写入 systemd journal 和日志文件
   - 不向 IM 会话发送任何消息

---

## 🔑 关键配置

### CalDAV 配置

| 项目 | 值 |
|------|------|
| 服务器 | `https://caldav.wps.cn` |
| 用户名 | `u_tHmFYAfGi9zhrD` |
| 密码 | `KAbrDeKq4xfdMXBDuUy5Y06aPM` |

### 飞书配置

| 项目 | 值 |
|------|------|
| 应用 ID | `cli_a93c20939cf8dbef` |
| 应用密钥 | runtime-secrets.json 中的 `/FEISHU_APP_SECRET` |
| 用户 open_id | `ou_04405f4e9dbe76c2cf241402bc2096b7` |
| 日历 ID | `feishu.cn_ymY7s23MqxLG33KkwElcuf@group.calendar.feishu.cn` |

### 系统配置

| 项目 | 值 |
|------|------|
| **脚本部署目录** | `/home/admin/.openclaw/scripts/` |
| **工作目录** | `/home/admin/.openclaw/scripts/` (systemd WorkingDirectory) |
| 调度器 | systemd timer (`caldav-sync.timer`) |
| 执行频率 | 每 10 分钟 |
| 日志文件 | `/home/admin/.openclaw/logs/caldav_sync_full.log` |
| 状态文件 | `/home/admin/.openclaw/data/caldav_sync_state_v2.json` |
| Token 存储 | `~/.local/share/openclaw-feishu-uat/` (AES-256-GCM 加密) |

**systemd 服务配置**:
```ini
[Service]
WorkingDirectory=/home/admin/.openclaw/scripts
ExecStart=/usr/bin/python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

---

## 🐛 排错历程

### 问题 1: 旧版脚本只做了一半工作

**症状**: 
- 脚本运行成功，但飞书日历无事件
- `caldav_events_pending.json` 有待同步事件，但从未被消费

**根因**: 
- `caldav_sync.py` 仅输出 JSON，无飞书 API 调用
- work-hub 从未配置自动消费逻辑

**解决**: 
- 重写 `caldav_sync_full.py`，直接调用飞书 Open API

---

### 问题 2: iCal 解析失败

**症状**: `'list' object has no attribute 'dt'`

**根因**: WPS CalDAV 返回的 DTSTART/DTEND 可能是列表 (重复事件)

**解决**: 添加列表处理逻辑，取第一个元素

---

### 问题 3: 飞书 API 时间格式错误

**症状**: `Both the start_time and end_time must be specified`

**根因**: 使用了错误的 `date_time` 字段，应该用 `timestamp`

**解决**: 将 ISO 8601 时间转换为 Unix 时间戳 (秒)

---

### 问题 4: 日历 ID 错误

**症状**: `invalid calendar_id` (code: 191001)

**根因**: 用户日历 ID 不是 `open_id@group.calendar.feishu.cn`

**解决**: 通过 `/calendar/v4/calendars` API 获取真实 calendar_id:
```
feishu.cn_ymY7s23MqxLG33KkwElcuf@group.calendar.feishu.cn
```

---

### 问题 5: Token 刷新失败 (致命缺陷)

**症状**: `code: 20014, message: The app access token passed is invalid`

**根因**: 
- ❌ 使用了错误的端点: `/authen/v1/oidc/refresh_access_token`
- ❌ 使用了错误的格式: `application/json`

**解决**: 
- ✅ 使用正确的端点: `/authen/v2/oauth/token`
- ✅ 使用正确的格式: `application/x-www-form-urlencoded`
- ✅ 参考 openclaw-lark 的 uat-client.js 实现

**关键发现**: 飞书 v2 token endpoint 返回 `token_type` 表示成功，而非 `code: 0`

---

### 问题 6: 时区比较错误

**症状**: `can't compare offset-naive and offset-aware datetimes`

**根因**: `datetime.now()` 无时区，`expires_at` 有时区

**解决**: 比较前统一时区
```python
now = datetime.now()
if expires_at.tzinfo is not None:
    now = datetime.now(expires_at.tzinfo)
```

---

## 📈 测试结果

| 测试项 | 状态 | 结果 |
|--------|------|------|
| systemd Timer | ✅ | enabled + active |
| Python 依赖 | ✅ | caldav 3.1.0, icalendar 7.0.3, requests 2.32.5 |
| CalDAV 认证 | ✅ | 1 个日历，认证成功 |
| 飞书 OAuth Token | ✅ | CC Liu, token 有效 |
| 首次同步 | ✅ | 15 个事件全部创建 |
| 增量同步 | ✅ | 0 新增, 正确去重 |
| Token 自动刷新 | ✅ | 使用 v2 endpoint, form-urlencoded |
| 输出隔离 | ✅ | 无 bot 调用，仅写系统和文件 |

---

## 🔄 同步流程

```
WPS CalDAV (caldav.wps.cn)
    ↓ (CalDAV 协议, Basic Auth)
caldav_sync_full.py (完整同步脚本)
    ↓ (飞书 Open API, user_access_token)
    ↓ (v2 endpoint + form-urlencoded 刷新 token)
飞书用户日历 (CC Liu)
    ✅ 新增事件
    ✅ 更新事件 (DTSTAMP 变更)
    ✅ 删除事件 (CalDAV 中不存在)
```

---

## 📝 后续升级建议

1. **双向同步**: 飞书 → WPS CalDAV (需要处理冲突解决)
2. **监控告警**: 同步失败时发送邮件/短信通知
3. **多日历支持**: 支持同步多个 CalDAV 日历
4. **Token 健康检查**: 定期检查 token 有效性，提前预警过期
5. **性能优化**: 批量创建/更新事件，减少 API 调用次数

---

最后更新: 2026-04-10
