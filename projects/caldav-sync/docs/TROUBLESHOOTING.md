# CalDAV → 飞书日历 排错指南

**目标读者**: AI Coding 工具 (Qwen, Claude, Gemini, Cursor 等)  
**更新日期**: 2026-04-10

---

## 🔍 快速诊断命令

```bash
# 1. 检查服务状态
sudo systemctl status caldav-sync.timer
systemctl list-timers caldav-sync.timer

# 2. 查看最近日志
tail -50 /home/admin/.openclaw/logs/caldav_sync_full.log
journalctl -u caldav-sync.service -n 30

# 3. 检查同步状态
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq

# 4. 手动触发同步
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

---

## 🚨 常见故障

### 1. 同步完全失败

**症状**: 飞书日历无事件，日志显示错误

**排查步骤**:

```bash
# 步骤 1: 检查 CalDAV 连通性
python3 -c "
import caldav
c = caldav.DAVClient(
    url='https://caldav.wps.cn',
    username='u_tHmFYAfGi9zhrD',
    password='KAbrDeKq4xfdMXBDuUy5Y06aPM'
)
print('日历数:', len(c.principal().calendars()))
"

# 步骤 2: 检查飞书 Token 是否有效
node -e "
const fs=require('fs'), crypto=require('crypto');
const d=fs.readFileSync(process.env.HOME+'/.local/share/openclaw-feishu-uat/cli_a93c20939cf8dbef_ou_04405f4e9dbe76c2cf241402bc2096b7.enc');
const k=fs.readFileSync(process.env.HOME+'/.local/share/openclaw-feishu-uat/master.key');
const iv=d.subarray(0,12), tag=d.subarray(12,28), enc=d.subarray(28);
const dec=crypto.createDecipheriv('aes-256-gcm',k,iv);
dec.setAuthTag(tag);
const t=JSON.parse(Buffer.concat([dec.update(enc),dec.final()]).toString());
console.log('Token 过期:', new Date(t.expiresAt).toISOString());
console.log('是否有效:', Date.now()<t.expiresAt ? '是' : '否');
"

# 步骤 3: 查看错误日志
grep "ERROR" /home/admin/.openclaw/logs/caldav_sync_full.log | tail -10
```

**可能原因**:
- CalDAV 凭据变更 → 更新 `caldav_sync_full.py` 中的 `CALDAV_USER`/`CALDAV_PASS`
- 飞书 Token 过期 → 重新 OAuth 授权 (在飞书中向 work-hub 发送 `/oauth`)
- 日历 ID 变更 → 通过 `/calendar/v4/calendars` API 重新获取

---

### 2. Token 刷新失败

**症状**: `code: 20014, message: The app access token passed is invalid`

**根因**: refresh_token 已过期或无效

**解决方案**:

```bash
# 方案 1: 重新 OAuth 授权 (推荐)
# 在飞书中向 work-hub (金牛) 发送任意消息，触发自动授权

# 方案 2: 导出新 token
node /home/admin/.openclaw/scripts/export_feishu_token.js

# 方案 3: 手动刷新 (使用正确的 v2 endpoint)
node -e "
const fs=require('fs'), https=require('https');
const tokenData=JSON.parse(fs.readFileSync('/home/admin/.openclaw/data/feishu_user_refresh_token.json'));
const appSecret=JSON.parse(fs.readFileSync('/home/admin/.openclaw/runtime-secrets.json'))['/FEISHU_APP_SECRET'];
const body=new URLSearchParams({
  grant_type:'refresh_token',
  refresh_token:tokenData.refresh_token,
  client_id:'cli_a93c20939cf8dbef',
  client_secret:appSecret
}).toString();
const req=https.request('https://open.feishu.cn/open-apis/authen/v2/oauth/token',{
  method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'}
},(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(JSON.parse(d)));});
req.on('error',e=>console.error(e));
req.write(body);
req.end();
"
```

**关键注意事项**:
- ✅ 使用 **v2 endpoint**: `/authen/v2/oauth/token`
- ✅ 使用 **form-urlencoded** 格式
- ❌ 不要使用 v1 endpoint (`/authen/v1/oidc/refresh_access_token`)
- ❌ 不要使用 JSON 格式

---

### 3. 日历 ID 错误

**症状**: `invalid calendar_id` (code: 191001)

**解决方案**:

```bash
# 获取用户日历列表
node -e "
const fs=require('fs'), https=require('https');
const t=JSON.parse(fs.readFileSync('/home/admin/.openclaw/data/feishu_user_access_token.json'));
const req=https.request('https://open.feishu.cn/open-apis/calendar/v4/calendars',{
  method:'GET',
  headers:{'Authorization':'Bearer '+t.access_token}
},(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(JSON.parse(d)));});
req.end();
"

# 更新日历 ID 到脚本
# 编辑 caldav_sync_full.py 中的 FEISHU_CALENDAR_ID
```

---

### 4. 事件重复创建

**症状**: 飞书日历中出现多个相同事件

**根因**: 状态文件丢失或损坏

**解决方案**:

```bash
# 备份当前状态
cp /home/admin/.openclaw/data/caldav_sync_state_v2.json /tmp/caldav_state_backup.json

# 检查状态文件
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq

# 如果损坏，重置状态 (会重新同步所有事件)
rm /home/admin/.openclaw/data/caldav_sync_state_v2.json
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

---

### 5. iCal 解析警告

**症状**: `Ical data was modified to avoid compatibility issues`

**原因**: WPS CalDAV 服务器返回的 iCal 数据不标准 (缺少 DTSTAMP)

**影响**: 无害，`icalendar` 库自动修复

**处理**: 忽略此警告，已在代码中降低日志级别

---

### 6. systemd Timer 未触发

**症状**: `systemctl list-timers` 中无 caldav-sync

**解决方案**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable caldav-sync.timer
sudo systemctl start caldav-sync.timer
sudo systemctl status caldav-sync.timer
```

---

## 🔑 关键文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| **主脚本** | `/home/admin/.openclaw/scripts/caldav_sync_full.py` | 同步逻辑 |
| **状态文件** | `/home/admin/.openclaw/data/caldav_sync_state_v2.json` | UID 映射 |
| **日志文件** | `/home/admin/.openclaw/logs/caldav_sync_full.log` | 运行日志 |
| **Token 存储** | `~/.local/share/openclaw-feishu-uat/*.enc` | 加密 OAuth token |
| **Master Key** | `~/.local/share/openclaw-feishu-uat/master.key` | 32 字节 AES 密钥 |
| **systemd Service** | `/etc/systemd/system/caldav-sync.service` | 服务配置 |
| **systemd Timer** | `/etc/systemd/system/caldav-sync.timer` | 定时器配置 |

---

## 🛠️ 维护命令

```bash
# 查看同步统计
cat /home/admin/.openclaw/data/caldav_sync_state_v2.json | jq '{
  tracked: (.caldav_uids | length),
  synced: .synced_count,
  deleted: .deleted_count,
  last_sync: .last_sync
}'

# 手动触发同步
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py

# 查看实时日志
tail -f /home/admin/.openclaw/logs/caldav_sync_full.log

# 检查 systemd 状态
sudo systemctl status caldav-sync.timer

# 重置同步状态 (谨慎使用)
rm /home/admin/.openclaw/data/caldav_sync_state_v2.json
python3 /home/admin/.openclaw/scripts/caldav_sync_full.py
```

---

## 📞 升级路径

如需升级本系统，参考以下文档:
- `docs/DESIGN_LOG.md`: 完整设计历程和排错历史
- `docs/SKILL.md`: AI Coding 工具操作指南

---

最后更新: 2026-04-10
