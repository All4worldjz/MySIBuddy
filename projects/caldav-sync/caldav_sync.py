#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CalDAV (WPS) → 飞书日历 同步脚本
运行：python3 caldav_sync.py
输出：JSON 格式事件列表，供 work-hub 通过 feishu_calendar_event 创建
调度：systemd timer 每 5 分钟
"""

import caldav
from datetime import datetime, timedelta
import json
import logging
import sys
import os
import icalendar

# 配置
CALDAV_URL = "https://caldav.wps.cn"
CALDAV_USER = "u_H7q73bsRsFUyck"
CALDAV_PASS = "2HotzgGR5VDKiBqXwtYG50XbmZ"

STATE_FILE = "/home/admin/.openclaw/data/caldav_sync_state.json"
OUTPUT_FILE = "/home/admin/.openclaw/data/caldav_events_pending.json"
LOG_FILE = "/home/admin/.openclaw/logs/caldav_sync.log"

os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)

# 日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except:
        return {"last_sync": "2026-04-01T00:00:00+08:00", "synced_event_uids": [], "synced_count": 0}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def parse_ical_event(ical_data):
    """解析 iCal 事件数据"""
    try:
        cal = icalendar.Calendar.from_ical(ical_data)
        for component in cal.walk('VEVENT'):
            dtstart = component.get('DTSTART')
            dtend = component.get('DTEND')
            
            # 转换为 ISO 8601 格式（飞书 API 需要）
            start_iso = None
            end_iso = None
            if dtstart and dtstart.dt:
                if hasattr(dtstart.dt, 'isoformat'):
                    start_iso = dtstart.dt.isoformat()
                else:
                    start_iso = dtstart.dt.strftime('%Y-%m-%dT%H:%M:%S%z')
            if dtend and dtend.dt:
                if hasattr(dtend.dt, 'isoformat'):
                    end_iso = dtend.dt.isoformat()
                else:
                    end_iso = dtend.dt.strftime('%Y-%m-%dT%H:%M:%S%z')
            
            event = {
                'summary': str(component.get('SUMMARY', '无标题')),
                'start_time': start_iso,
                'end_time': end_iso,
                'description': str(component.get('DESCRIPTION', '')),
                'location': str(component.get('LOCATION', '')),
                'uid': str(component.get('UID', ''))
            }
            return event
    except Exception as e:
        logger.warning(f"解析 iCal 失败：{e}")
    return None

def fetch_caldav_events(since_dt):
    """从 CalDAV 获取增量事件"""
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
            logger.info(f"扫描日历：{calendar.id}")
            end_dt = datetime.now() + timedelta(days=90)
            caldav_events = calendar.search(
                event=True,
                expand=True,
                start=since_dt,
                end=end_dt
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

def sync():
    logger.info("=== CalDAV 同步开始 ===")
    
    # 加载状态
    state = load_state()
    last_sync = state.get("last_sync", "2026-04-01T00:00:00+08:00")
    synced_event_uids = set(state.get("synced_event_uids", []))
    
    try:
        since_dt = datetime.fromisoformat(last_sync.replace('+08:00', '+08:00'))
    except:
        since_dt = datetime(2026, 4, 1)
    
    logger.info(f"同步起始时间：{since_dt}")
    
    # 获取增量事件
    caldav_events = fetch_caldav_events(since_dt)
    
    # 过滤已同步的事件
    pending_events = []
    for event in caldav_events:
        if event['uid'] not in synced_event_uids:
            pending_events.append(event)
    
    logger.info(f"待同步事件：{len(pending_events)} 个")
    
    # 更新状态（标记为已同步）
    for event in pending_events:
        synced_event_uids.add(event['uid'])
    
    state["last_sync"] = datetime.now().isoformat()
    state["synced_count"] = state.get("synced_count", 0) + len(pending_events)
    state["synced_event_uids"] = list(synced_event_uids)
    save_state(state)
    
    # 输出到 JSON 文件（供 work-hub 消费）
    output = {
        "pending_events": pending_events,
        "synced_count": state.get("synced_count", 0),
        "timestamp": datetime.now().isoformat()
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    logger.info(f"事件已保存到：{OUTPUT_FILE}")
    logger.info(f"=== 同步完成 ===")
    
    # 输出摘要
    if pending_events:
        print(f"\n📅 发现 {len(pending_events)} 个待同步事件：")
        for i, ev in enumerate(pending_events[:5]):
            print(f"  {i+1}. {ev['summary']} ({ev['start_time']} - {ev['end_time']})")
        if len(pending_events) > 5:
            print(f"  ... 还有 {len(pending_events) - 5} 个")
        print(f"\n请执行：sessions_send → work-hub 创建这些事件")
    else:
        print("\n✅ 没有新事件需要同步")

if __name__ == "__main__":
    sync()
