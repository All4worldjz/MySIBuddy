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
CALDAV_USER = "u_H7q73bsRsFUyck"
CALDAV_PASS = "2HotzgGR5VDKiBqXwtYG50XbmZ"

# 飞书 Open API 配置
FEISHU_APP_ID = "cli_a93c20939cf8dbef"
FEISHU_APP_SECRET_REF = "/FEISHU_APP_SECRET"  # 从 runtime-secrets.json 读取

# 飞书日历 ID (金牛的主日历)
FEISHU_CALENDAR_ID = "feishu.cn_skWj58NmuUKikMD9qzCfNf@group.calendar.feishu.cn"

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
    """飞书日历 API 客户端"""
    
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token = None
        self.token_expires_at = 0
    
    @staticmethod
    def load_feishu_secret():
        """从 runtime-secrets.json 读取飞书密钥"""
        secrets_file = "/home/admin/.openclaw/runtime-secrets.json"
        try:
            with open(secrets_file) as f:
                secrets = json.load(f)
            return secrets.get("/FEISHU_APP_SECRET", "")
        except Exception as e:
            logger.error(f"读取 runtime-secrets.json 失败: {e}")
            return ""
    
    def get_access_token(self):
        """获取访问令牌 (自动刷新)"""
        if time.time() < self.token_expires_at:
            return self.access_token
        
        # 动态读取密钥
        if not self.app_secret:
            self.app_secret = self.load_feishu_secret()
            if not self.app_secret:
                raise Exception("飞书应用密钥未配置")
        
        resp = requests.post(
            FEISHU_TOKEN_URL,
            json={
                "app_id": self.app_id,
                "app_secret": self.app_secret
            }
        )
        data = resp.json()
        
        if data.get("code") != 0:
            raise Exception(f"获取飞书令牌失败: {data}")
        
        self.access_token = data["tenant_access_token"]
        self.token_expires_at = time.time() + data.get("expire", 7200) - 300  # 提前 5 分钟刷新
        logger.info("✅ 飞书访问令牌获取成功")
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
    
    # 3. 初始化飞书客户端
    feishu_client = FeishuCalendarClient(FEISHU_APP_ID, "")  # 空密钥,从 runtime-secrets.json 读取
    calendar_id = FEISHU_CALENDAR_ID
    logger.info(f"📅 使用飞书日历: {calendar_id}")
    
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
