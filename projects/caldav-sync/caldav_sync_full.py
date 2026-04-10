#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CalDAV (WPS) → 飞书日历 完整同步脚本

功能:
- 从 WPS CalDAV 获取事件
- 直接调用飞书 Open API 创建/更新/删除事件
- 完整的双向状态同步 (新增、修改、删除)
- 自动去重和增量同步

运行: python3 caldav_sync_full.py
调度: systemd timer 每 10 分钟
"""

import caldav
import requests
from datetime import datetime, timedelta
import json
import logging
import sys
import os
import icalendar
import time
import hashlib
import warnings

# 忽略 icalendar 库的兼容性警告 (WPS CalDAV 不标准但无害)
warnings.filterwarnings('ignore', message='Ical data was modified')

# ==================== 配置区 ====================

# CalDAV 配置
CALDAV_URL = "https://caldav.wps.cn"
CALDAV_USER = "u_tHmFYAfGi9zhrD"
CALDAV_PASS = "KAbrDeKq4xfdMXBDuUy5Y06aPM"

# 飞书 Open API 配置
FEISHU_APP_ID = "cli_a93c20939cf8dbef"
FEISHU_APP_SECRET_REF = "/FEISHU_APP_SECRET"  # 从 runtime-secrets.json 读取

# 飞书用户 OAuth 配置 (CC 用户)
FEISHU_USER_OPEN_ID = "ou_04405f4e9dbe76c2cf241402bc2096b7"  # CC 用户的 open_id
FEISHU_USER_REFRESH_TOKEN_FILE = "/home/admin/.openclaw/data/feishu_user_refresh_token.json"

# 飞书日历 ID (CC 用户的主日历)
# 注意: 必须通过 /calendar/v4/calendars API 获取真实的 calendar_id
FEISHU_CALENDAR_ID = "feishu.cn_ymY7s23MqxLG33KkwElcuf@group.calendar.feishu.cn"

# 状态文件
STATE_FILE = "/home/admin/.openclaw/data/caldav_sync_state_v2.json"
LOG_FILE = "/home/admin/.openclaw/logs/caldav_sync_full.log"

# 飞书 API 端点
FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"
FEISHU_TOKEN_URL = f"{FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"

os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)

# ==================== 日志配置 ====================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 降低 icalendar 库的警告级别 (WPS CalDAV 不标准但无害)
# 必须在 basicConfig 之后设置
logging.getLogger('icalendar').setLevel(logging.ERROR)
logging.getLogger('caldav').setLevel(logging.WARNING)

# ==================== 状态管理 ====================

def load_state():
    """加载同步状态"""
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except:
        return {
            "last_sync": None,
            "caldav_uids": {},  # {caldav_uid: {"feishu_event_id": "...", "summary": "...", "updated": "..."}}
            "synced_count": 0,
            "deleted_count": 0
        }

def save_state(state):
    """保存同步状态"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

# ==================== 飞书 API 客户端 ====================

class FeishuCalendarClient:
    """飞书日历 API 客户端 (支持用户 OAuth 模式)"""
    
    def __init__(self, app_id, user_open_id, use_user_oauth=True):
        self.app_id = app_id
        self.user_open_id = user_open_id
        self.use_user_oauth = use_user_oauth  # True=用户 OAuth, False=应用 tenant token
        self.access_token = None
        self.token_expires_at = 0
        self.refresh_token = None
    
    @staticmethod
    def load_feishu_secret():
        """从 runtime-secrets.json 读取飞书应用密钥"""
        secrets_file = "/home/admin/.openclaw/runtime-secrets.json"
        try:
            with open(secrets_file) as f:
                secrets = json.load(f)
            return secrets.get("/FEISHU_APP_SECRET", "")
        except Exception as e:
            logger.error(f"读取 runtime-secrets.json 失败: {e}")
            return ""
    
    def load_user_refresh_token(self):
        """加载用户 refresh_token (支持 openclaw-lark 加密存储)"""
        # 优先从 openclaw-lark 加密存储读取
        uat_dir = os.path.expanduser("~/.local/share/openclaw-feishu-uat")
        uat_file = os.path.join(uat_dir, f"{self.app_id}_{self.user_open_id}.enc")
        
        if os.path.exists(uat_file):
            logger.info(f"✅ 找到 openclaw-lark token 存储: {uat_file}")
            # 注意：.enc 文件是 AES-256-GCM 加密的，需要 master.key 解密
            # 这里我们标记为已找到，实际解密需要使用 openclaw-lark 的 token-store.js
            # 暂时先尝试从我们自己的 refresh_token 文件读取
            logger.warning("⚠️ openclaw-lark token 存储为加密格式，需要使用 Node.js 解密")
        
        # 从我们自己的 refresh_token 文件读取 (备用方案)
        try:
            if os.path.exists(FEISHU_USER_REFRESH_TOKEN_FILE):
                with open(FEISHU_USER_REFRESH_TOKEN_FILE) as f:
                    data = json.load(f)
                    self.refresh_token = data.get("refresh_token", "")
                    return self.refresh_token
        except Exception as e:
            logger.warning(f"加载 refresh_token 失败: {e}")
        
        return ""
    
    def save_user_refresh_token(self, refresh_token):
        """保存用户 refresh_token"""
        try:
            data = {
                "refresh_token": refresh_token,
                "open_id": self.user_open_id,
                "updated_at": datetime.now().isoformat()
            }
            with open(FEISHU_USER_REFRESH_TOKEN_FILE, 'w') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info("✅ refresh_token 已保存")
        except Exception as e:
            logger.error(f"保存 refresh_token 失败: {e}")
    
    def get_access_token(self):
        """获取访问令牌 (自动刷新，支持用户 OAuth)"""
        if time.time() < self.token_expires_at:
            return self.access_token
        
        if self.use_user_oauth:
            # 用户 OAuth 模式
            return self._get_user_access_token()
        else:
            # 应用 tenant_access_token 模式
            return self._get_tenant_access_token()
    
    def _get_user_access_token(self):
        """使用 refresh_token 获取用户 access_token (v2 endpoint + form-urlencoded)"""
        # 优先尝试从 openclaw-lark 加密存储直接读取 (Node.js 辅助)
        token_file = "/home/admin/.openclaw/data/feishu_user_access_token.json"
        if os.path.exists(token_file):
            with open(token_file) as f:
                token_data = json.load(f)
            
            # 检查是否过期
            expires_at = datetime.fromisoformat(token_data["expires_at"])
            # 处理时区兼容性问题
            now = datetime.now()
            if expires_at.tzinfo is not None:
                now = datetime.now(expires_at.tzinfo)
            
            if now < expires_at:
                self.access_token = token_data["access_token"]
                self.token_expires_at = expires_at.timestamp()
                logger.info("✅ 用户 access_token 加载成功")
                return self.access_token
            else:
                logger.warning("⚠️ access_token 已过期，尝试刷新")
        
        # 如果没有有效的 access_token，用 refresh_token 刷新
        if not self.refresh_token:
            self.refresh_token = self.load_user_refresh_token()
            if not self.refresh_token:
                raise Exception(
                    f"用户 OAuth refresh_token 未配置\n"
                    f"请先运行: node /home/admin/.openclaw/scripts/export_feishu_token.js\n"
                    f"或在飞书中向 work-hub 发送: /oauth"
                )
        
        app_secret = self.load_feishu_secret()
        if not app_secret:
            raise Exception("飞书应用密钥未配置")
        
        # 使用 v2 endpoint + form-urlencoded 格式刷新 (openclaw-lark 使用的方式)
        import urllib.parse
        refresh_url = "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
        body = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.app_id,
            "client_secret": app_secret
        })
        
        resp = requests.post(
            refresh_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=body
        )
        data = resp.json()
        
        # v2 endpoint 返回 token_type 表示成功，v1 返回 code:0
        if data.get("token_type") or data.get("code") == 0:
            self.access_token = data.get("access_token", "")
            if data.get("refresh_token"):
                self.refresh_token = data["refresh_token"]
                self.save_user_refresh_token(self.refresh_token)
            
            expires_in = data.get("expires_in", 7200)
            self.token_expires_at = time.time() + expires_in - 300
            
            # 同时更新 Python 可读的 token 文件
            token_output = {
                "access_token": self.access_token,
                "refresh_token": self.refresh_token,
                "open_id": self.user_open_id,
                "app_id": self.app_id,
                "updated_at": datetime.now().isoformat(),
                "expires_at": datetime.fromtimestamp(self.token_expires_at + 300).isoformat()
            }
            os.makedirs(os.path.dirname(token_file), exist_ok=True)
            with open(token_file, 'w') as f:
                json.dump(token_output, f, ensure_ascii=False, indent=2)
            
            logger.info("✅ 用户 access_token 刷新成功")
            return self.access_token
        else:
            logger.error(f"refresh_token 失效: {data}")
            raise Exception(
                f"用户 OAuth refresh_token 已过期\n"
                f"请重新授权: 在飞书中向 work-hub 发送 /oauth"
            )
    
    def _get_tenant_access_token(self):
        """获取应用 tenant_access_token"""
        app_secret = self.load_feishu_secret()
        if not app_secret:
            raise Exception("飞书应用密钥未配置")
        
        resp = requests.post(
            FEISHU_TOKEN_URL,
            json={
                "app_id": self.app_id,
                "app_secret": app_secret
            }
        )
        data = resp.json()
        
        if data.get("code") != 0:
            raise Exception(f"获取飞书令牌失败: {data}")
        
        self.access_token = data["tenant_access_token"]
        self.token_expires_at = time.time() + data.get("expire", 7200) - 300
        logger.info("✅ 应用 tenant_access_token 获取成功")
        return self.access_token
    
    def list_calendars(self):
        """获取日历列表"""
        token = self.get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.get(
            f"{FEISHU_BASE_URL}/calendar/v4/calendars",
            headers=headers
        )
        data = resp.json()
        
        if data.get("code") != 0:
            raise Exception(f"获取日历列表失败: {data}")
        
        return data.get("data", {}).get("calendars", [])
    
    def create_event(self, calendar_id, event_data):
        """创建飞书日历事件"""
        token = self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        resp = requests.post(
            f"{FEISHU_BASE_URL}/calendar/v4/calendars/{calendar_id}/events",
            headers=headers,
            json=event_data
        )
        data = resp.json()
        
        if data.get("code") != 0:
            logger.error(f"创建飞书事件失败: {data}")
            return None
        
        logger.info(f"✅ 创建飞书事件成功: {event_data.get('summary', '无标题')}")
        return data.get("data", {})
    
    def update_event(self, calendar_id, event_id, event_data):
        """更新飞书日历事件"""
        token = self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        resp = requests.put(
            f"{FEISHU_BASE_URL}/calendar/v4/calendars/{calendar_id}/events/{event_id}",
            headers=headers,
            json=event_data
        )
        data = resp.json()
        
        if data.get("code") != 0:
            logger.error(f"更新飞书事件失败: {data}")
            return None
        
        logger.info(f"✅ 更新飞书事件成功: {event_data.get('summary', '无标题')}")
        return data.get("data", {})
    
    def delete_event(self, calendar_id, event_id):
        """删除飞书日历事件"""
        token = self.get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.delete(
            f"{FEISHU_BASE_URL}/calendar/v4/calendars/{calendar_id}/events/{event_id}",
            headers=headers
        )
        data = resp.json()
        
        if data.get("code") != 0:
            logger.error(f"删除飞书事件失败: {data}")
            return False
        
        logger.info(f"✅ 删除飞书事件成功: {event_id}")
        return True
    
    def list_events(self, calendar_id, start_time, end_time):
        """获取日历事件列表"""
        token = self.get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        params = {
            "time_min": start_time,
            "time_max": end_time
        }
        
        resp = requests.get(
            f"{FEISHU_BASE_URL}/calendar/v4/calendars/{calendar_id}/events",
            headers=headers,
            params=params
        )
        data = resp.json()
        
        if data.get("code") != 0:
            logger.error(f"获取飞书事件列表失败: {data}")
            return []
        
        return data.get("data", {}).get("items", [])

# ==================== CalDAV 解析 ====================

def parse_ical_event(ical_data):
    """解析 iCal 事件数据"""
    try:
        cal = icalendar.Calendar.from_ical(ical_data)
        for component in cal.walk('VEVENT'):
            dtstart = component.get('DTSTART')
            dtend = component.get('DTEND')
            dtstamp = component.get('DTSTAMP')
            
            # 处理 DTSTART/DTEND (可能是列表,取第一个)
            def get_dt(prop_value):
                if prop_value is None:
                    return None
                # 如果是列表,取第一个
                if isinstance(prop_value, list):
                    prop_value = prop_value[0]
                if hasattr(prop_value, 'dt'):
                    dt = prop_value.dt
                    # 如果是列表,取第一个
                    if isinstance(dt, list):
                        dt = dt[0]
                    if hasattr(dt, 'isoformat'):
                        return dt.isoformat()
                return None
            
            start_iso = get_dt(dtstart)
            end_iso = get_dt(dtend)
            
            if not start_iso or not end_iso:
                logger.warning(f"事件时间缺失,跳过: {component.get('SUMMARY', '无标题')}")
                return None
            
            summary = str(component.get('SUMMARY', '无标题')) if component.get('SUMMARY') else '无标题'
            description = str(component.get('DESCRIPTION', '')) if component.get('DESCRIPTION') else ''
            location = str(component.get('LOCATION', '')) if component.get('LOCATION') else ''
            uid = str(component.get('UID', '')) if component.get('UID') else ''
            
            # 获取更新时间
            updated_iso = None
            if dtstamp:
                if isinstance(dtstamp, list):
                    dtstamp = dtstamp[0]
                if hasattr(dtstamp, 'dt'):
                    dt = dtstamp.dt
                    if isinstance(dt, list):
                        dt = dt[0]
                    if hasattr(dt, 'isoformat'):
                        updated_iso = dt.isoformat()
            
            event = {
                'uid': uid,
                'summary': summary,
                'start_time': start_iso,
                'end_time': end_iso,
                'description': description,
                'location': location,
                'updated': updated_iso
            }
            return event
    except Exception as e:
        logger.warning(f"解析 iCal 失败：{e}")
    return None

def fetch_caldav_events(since_dt=None):
    """从 CalDAV 获取事件"""
    try:
        client = caldav.DAVClient(
            url=CALDAV_URL,
            username=CALDAV_USER,
            password=CALDAV_PASS
        )
        principal = client.principal()
        calendars = principal.calendars()
        events = []
        
        for calendar in calendars:
            logger.info(f"扫描 CalDAV 日历：{calendar.id}")
            
            # 查询时间范围: 过去 7 天到未来 90 天
            if since_dt is None:
                query_start = datetime.now() - timedelta(days=7)
            else:
                query_start = since_dt
            
            query_end = datetime.now() + timedelta(days=90)
            
            caldav_events = calendar.search(
                event=True,
                expand=True,
                start=query_start,
                end=query_end
            )
            
            for ev in caldav_events:
                if ev.data:
                    event = parse_ical_event(ev.data)
                    if event and event.get('uid'):
                        events.append(event)
        
        logger.info(f"从 CalDAV 获取到 {len(events)} 个事件")
        return events
    except Exception as e:
        logger.error(f"CalDAV 获取失败：{e}")
        return []

# ==================== 同步逻辑 ====================

def event_to_feishu_format(event):
    """将 CalDAV 事件转换为飞书 API 格式"""
    # 飞书 API 需要 Unix 时间戳 (秒)
    from datetime import timezone
    
    def to_timestamp(iso_str):
        if not iso_str:
            return None
        try:
            dt = datetime.fromisoformat(iso_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except:
            return None
    
    start_ts = to_timestamp(event['start_time'])
    end_ts = to_timestamp(event['end_time'])
    
    if not start_ts or not end_ts:
        logger.error(f"时间格式转换失败: {event['summary']}")
        return None
    
    feishu_event = {
        "summary": event['summary'],
        "description": event.get('description', ''),
        "start_time": {
            "timestamp": str(start_ts),
            "timezone": "Asia/Shanghai"
        },
        "end_time": {
            "timestamp": str(end_ts),
            "timezone": "Asia/Shanghai"
        }
    }
    
    if event.get('location'):
        # 飞书事件位置放在 description 中
        feishu_event["description"] = f"📍 {event['location']}\n\n{event.get('description', '')}"
    
    return feishu_event

def full_sync():
    """完整同步流程"""
    logger.info("=" * 60)
    logger.info("=== CalDAV → 飞书日历 同步开始 ===")
    logger.info("=" * 60)
    
    # 1. 加载状态
    state = load_state()
    caldav_uids = state.get("caldav_uids", {})
    
    # 2. 从 CalDAV 获取事件
    logger.info("📥 正在从 WPS CalDAV 获取事件...")
    caldav_events = fetch_caldav_events()
    
    if not caldav_events:
        logger.warning("⚠️ 未获取到 CalDAV 事件")
        return
    
    # 3. 初始化飞书客户端 (用户 OAuth 模式)
    feishu_client = FeishuCalendarClient(
        app_id=FEISHU_APP_ID,
        user_open_id=FEISHU_USER_OPEN_ID,
        use_user_oauth=True  # 使用用户 OAuth 身份
    )
    calendar_id = FEISHU_CALENDAR_ID
    logger.info(f"📅 使用飞书用户日历: {calendar_id}")
    logger.info(f"👤 用户 open_id: {FEISHU_USER_OPEN_ID}")
    
    # 4. 同步逻辑: 新增和更新
    current_caldav_uids = set()
    created_count = 0
    updated_count = 0
    deleted_count = 0
    
    for event in caldav_events:
        caldav_uid = event['uid']
        current_caldav_uids.add(caldav_uid)
        
        feishu_event_data = event_to_feishu_format(event)
        
        # 检查是否已同步
        if caldav_uid in caldav_uids:
            # 已存在,检查是否需要更新
            existing = caldav_uids[caldav_uid]
            feishu_event_id = existing["feishu_event_id"]
            
            # 比较更新时间 (如果 CalDAV 有 DTSTAMP)
            if event.get('updated') and event['updated'] != existing.get('updated'):
                logger.info(f"🔄 更新事件: {event['summary']}")
                result = feishu_client.update_event(calendar_id, feishu_event_id, feishu_event_data)
                if result:
                    caldav_uids[caldav_uid]["updated"] = event['updated']
                    updated_count += 1
            else:
                logger.debug(f"⏭️ 跳过未变更事件: {event['summary']}")
        else:
            # 新事件,创建
            logger.info(f"➕ 创建新事件: {event['summary']}")
            result = feishu_client.create_event(calendar_id, feishu_event_data)
            if result and result.get("event", {}).get("event_id"):
                feishu_event_id = result["event"]["event_id"]
                caldav_uids[caldav_uid] = {
                    "feishu_event_id": feishu_event_id,
                    "summary": event['summary'],
                    "updated": event.get('updated')
                }
                created_count += 1
    
    # 5. 删除同步: 找出 CalDAV 中已删除的事件
    deleted_uids = set(caldav_uids.keys()) - current_caldav_uids
    for uid in deleted_uids:
        existing = caldav_uids[uid]
        feishu_event_id = existing["feishu_event_id"]
        
        logger.info(f"🗑️ 删除已移除事件: {existing['summary']}")
        success = feishu_client.delete_event(calendar_id, feishu_event_id)
        if success:
            deleted_count += 1
            del caldav_uids[uid]
    
    # 6. 更新状态
    state["last_sync"] = datetime.now().isoformat()
    state["caldav_uids"] = caldav_uids
    state["synced_count"] = state.get("synced_count", 0) + created_count
    state["deleted_count"] = state.get("deleted_count", 0) + deleted_count
    
    save_state(state)
    
    # 7. 输出摘要
    logger.info("=" * 60)
    logger.info("=== 同步完成 ===")
    logger.info(f"📊 总计: CalDAV 事件 {len(caldav_events)} 个")
    logger.info(f"➕ 新增: {created_count} 个")
    logger.info(f"🔄 更新: {updated_count} 个")
    logger.info(f"🗑️ 删除: {deleted_count} 个")
    logger.info(f"💾 已追踪: {len(caldav_uids)} 个")
    logger.info("=" * 60)
    
    # 打印到 stdout (供 systemd 日志捕获)
    print(f"\n{'='*60}")
    print(f"CalDAV → 飞书日历 同步完成")
    print(f"  CalDAV 事件: {len(caldav_events)} 个")
    print(f"  新增: {created_count} 个")
    print(f"  更新: {updated_count} 个")
    print(f"  删除: {deleted_count} 个")
    print(f"  已追踪: {len(caldav_uids)} 个")
    print(f"{'='*60}")

if __name__ == "__main__":
    try:
        full_sync()
    except Exception as e:
        logger.error(f"❌ 同步失败：{e}", exc_info=True)
        sys.exit(1)
