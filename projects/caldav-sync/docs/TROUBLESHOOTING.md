# CalDAV 同步故障排查指南

## 🔍 快速诊断命令

```bash
# 1. 检查服务状态
sudo systemctl status caldav-sync.timer
sudo systemctl status caldav-sync.service

# 2. 查看最近日志
tail -50 /home/admin/.openclaw/logs/caldav_sync.log

# 3. 查看同步状态
cat /home/admin/.openclaw/data/caldav_sync_state.json | jq

# 4. 手动触发测试
python3 /home/admin/.openclaw/scripts/caldav_sync.py
```

---

## 🚨 常见问题

### 1. CalDAV 连接失败

**症状**:
```
ERROR CalDAV 获取失败：Connection refused
ERROR CalDAV 获取失败：401 Unauthorized
```

**诊断步骤**:

```bash
# 测试网络连通性
curl -v https://caldav.wps.cn

# 测试凭据 (替换实际用户名密码)
curl -u "YOUR_USER:YOUR_PASS" -X PROPFIND https://caldav.wps.cn/ -H "Depth: 1"

# 检查 Python caldav 库
python3 -c "import caldav; print(caldav.__version__)"
```

**解决方案**:
1. 验证 `caldav_sync.py` 中的 `CALDAV_USER` 和 `CALDAV_PASS` 正确
2. 检查服务器防火墙是否允许 outbound HTTPS (443)
3. 如果 WPS 密码变更,同步更新脚本

---

### 2. 事件未同步到飞书

**症状**:
- `caldav_events_pending.json` 有待同步事件
- 飞书日历中未创建对应事件

**诊断步骤**:

```bash
# 1. 检查待同步事件
cat /home/admin/.openclaw/data/caldav_events_pending.json | jq '.pending_events | length'

# 2. 查看 work-hub 是否消费
cat /home/admin/.openclaw/data/caldav_events_pending.json | jq '.pending_events[] | {summary, start_time}'

# 3. 检查 work-hub 日志
grep -i "caldav\|calendar_event" /home/admin/.openclaw/agents/work-hub/logs/*.log | tail -20
```

**解决方案**:

这是**两步流程**的问题:
1. ✅ `caldav_sync.py` 已成功输出待同步事件
2. ❌ work-hub 未消费 `caldav_events_pending.json`

**手动消费流程**:
```bash
# 1. 查看待同步事件
cat /home/admin/.openclaw/data/caldav_events_pending.json

# 2. 通过 OpenClaw 发送指令给 work-hub
# (在 Telegram 或飞书中向 work-hub 发送)
"请读取 /home/admin/.openclaw/data/caldav_events_pending.json 并创建飞书日历事件"
```

**自动化建议**:
- 可以添加 systemd service 依赖,在 `caldav_sync.py` 完成后自动触发 work-hub
- 或使用 OpenClaw `sessions_send` 工具自动推送

---

### 3. 事件重复创建

**症状**:
- 飞书日历中出现多个相同事件

**原因**:
- `caldav_sync_state.json` 状态文件丢失或损坏
- `synced_event_uids` 被清空

**解决方案**:

```bash
# 1. 备份当前状态
cp /home/admin/.openclaw/data/caldav_sync_state.json /tmp/caldav_state_backup_$(date +%Y%m%d_%H%M%S).json

# 2. 检查状态文件
cat /home/admin/.openclaw/data/caldav_sync_state.json | jq '.synced_event_uids | length'

# 3. 如果为空,重置状态 (会从 2026-04-01 重新同步)
echo '{"last_sync": "2026-04-01T00:00:00+08:00", "synced_event_uids": [], "synced_count": 0}' > /home/admin/.openclaw/data/caldav_sync_state.json

# 4. 手动触发一次同步
python3 /home/admin/.openclaw/scripts/caldav_sync.py
```

**防止重复创建**:
- work-hub 在创建飞书事件前,应先查询是否存在相同 UID 的事件
- 使用飞书事件的 `extra` 字段存储 CalDAV UID

---

### 4. systemd Timer 未触发

**症状**:
```bash
systemctl list-timers caldav-sync.timer
# 显示 "n/a" 或未列出
```

**诊断步骤**:

```bash
# 1. 检查 timer 是否启用
systemctl is-enabled caldav-sync.timer

# 2. 检查服务文件是否存在
ls -la /etc/systemd/system/caldav-sync.*

# 3. 重新加载 systemd 配置
sudo systemctl daemon-reload

# 4. 启用并启动 timer
sudo systemctl enable caldav-sync.timer
sudo systemctl start caldav-sync.timer

# 5. 验证状态
systemctl list-timers caldav-sync.timer
```

---

### 5. iCal 解析警告

**症状**:
```
WARNING Ical data was modified to avoid compatibility issues
(Your calendar server breaks the icalendar standard)
```

**原因**:
- WPS CalDAV 服务器返回的 iCal 数据不完全符合 RFC 5545 标准
- `icalendar` 库自动修复了格式问题 (通常是缺少 `DTSTAMP` 字段)

**影响**:
- ⚠️ **无害**,不影响功能
- 日志会被这些警告刷屏,影响查看

**解决方案**:

```python
# 在 caldav_sync.py 中降低日志级别
import logging
logging.getLogger('icalendar').setLevel(logging.ERROR)
```

---

## 📊 日志分析示例

### 正常同步日志

```
2026-04-09 23:51:26,797 INFO === CalDAV 同步开始 ===
2026-04-09 23:51:26,798 INFO 同步起始时间:2026-04-09 23:41:28.021804
2026-04-09 23:51:30,098 INFO 扫描日历:ab61ee56-dcee-8fc4-9598-9cf150bf73ac
2026-04-09 23:51:31,375 INFO 从 CalDAV 获取到 7 个事件
2026-04-09 23:51:31,376 INFO 待同步事件:0 个
2026-04-09 23:51:31,378 INFO 事件已保存到:/home/admin/.openclaw/data/caldav_events_pending.json
2026-04-09 23:51:31,378 INFO === 同步完成 ===
```

### 异常日志 (连接失败)

```
2026-04-09 23:51:26,797 INFO === CalDAV 同步开始 ===
2026-04-09 23:51:26,798 INFO 同步起始时间:2026-04-09 23:41:28.021804
2026-04-09 23:51:30,098 ERROR CalDAV 获取失败:Connection refused
2026-04-09 23:51:30,098 ERROR === 同步失败 ===
```

### 日志监控命令

```bash
# 实时监控
tail -f /home/admin/.openclaw/logs/caldav_sync.log

# 只看错误
grep "ERROR" /home/admin/.openclaw/logs/caldav_sync.log | tail -20

# 统计同步事件数
grep "待同步事件" /home/admin/.openclaw/logs/caldav_sync.log | tail -10

# 查看同步频率 (应该每 10 分钟一次)
grep "=== CalDAV 同步开始 ===" /home/admin/.openclaw/logs/caldav_sync.log | tail -20
```

---

## 🔄 重置同步状态

### 完全重置 (从零开始)

```bash
# 1. 停止 timer
sudo systemctl stop caldav-sync.timer

# 2. 备份当前状态
cp /home/admin/.openclaw/data/caldav_sync_state.json /tmp/caldav_state_final_backup.json

# 3. 清空状态文件
echo '{"last_sync": "2026-04-01T00:00:00+08:00", "synced_event_uids": [], "synced_count": 0}' > /home/admin/.openclaw/data/caldav_sync_state.json

# 4. 清空待同步事件
echo '{"pending_events": [], "synced_count": 0, "timestamp": "'$(date -Iseconds)'"}' > /home/admin/.openclaw/data/caldav_events_pending.json

# 5. 重启 timer
sudo systemctl start caldav-sync.timer

# 6. 手动触发一次测试
python3 /home/admin/.openclaw/scripts/caldav_sync.py

# 7. 检查结果
cat /home/admin/.openclaw/data/caldav_sync_state.json | jq
```

---

## 📞 获取帮助

如果以上步骤无法解决问题:

1. **收集诊断信息**:
   ```bash
   # 打包所有相关文件
   tar czf /tmp/caldav_diagnostic_$(date +%Y%m%d_%H%M%S).tar.gz \
     /home/admin/.openclaw/logs/caldav_sync.log \
     /home/admin/.openclaw/data/caldav_sync_state.json \
     /home/admin/.openclaw/data/caldav_events_pending.json \
     /etc/systemd/system/caldav-sync.* \
     /home/admin/.openclaw/scripts/caldav_sync.py
   ```

2. **联系维护者**:
   - work-hub (金牛): 飞书日历事件创建问题
   - 运维: 系统配置和网络问题

---

最后更新: 2026-04-09
