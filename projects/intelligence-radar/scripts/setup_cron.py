#!/usr/bin/env python3
"""
setup_cron.py - 注册情报雷达定时任务到 OpenClaw Cron
用法:
  python setup_cron.py register    # 注册全部定时任务
  python setup_cron.py list        # 列出当前雷达 Cron 任务
  python setup_cron.py remove      # 移除全部雷达 Cron 任务
"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

RADAR_SCRIPT = str(Path(__file__).parent / "run_daily.py")
WORKSPACE = "/home/admin/.openclaw/workspace-chief"


def register():
    """注册定时任务"""
    from cron import cron

    jobs = [
        {
            "name": "情报雷达-早报",
            "schedule": {"kind": "cron", "expr": "0 8 * * *", "tz": "Asia/Shanghai"},
            "payload": {
                "kind": "agentTurn",
                "message": (
                    f"执行情报雷达早报扫描。\n"
                    f"运行命令: cd {WORKSPACE}/intelligence-radar && python scripts/run_daily.py morning\n"
                    f"完成后将报告保存到飞书指定文件夹。"
                ),
                "model": "minimax/MiniMax-M2.7",
                "timeoutSeconds": 600,
            },
            "delivery": {"mode": "announce", "channel": "telegram", "to": "8606756625"},
            "description": "每日 08:00 情报早报扫描 + 飞书推送",
        },
        {
            "name": "情报雷达-晚报",
            "schedule": {"kind": "cron", "expr": "0 18 * * *", "tz": "Asia/Shanghai"},
            "payload": {
                "kind": "agentTurn",
                "message": (
                    f"执行情报雷达晚报扫描。\n"
                    f"运行命令: cd {WORKSPACE}/intelligence-radar && python scripts/run_daily.py evening\n"
                    f"完成后将报告保存到飞书指定文件夹。"
                ),
                "model": "minimax/MiniMax-M2.7",
                "timeoutSeconds": 600,
            },
            "delivery": {"mode": "announce", "channel": "telegram", "to": "8606756625"},
            "description": "每日 18:00 情报晚报扫描 + 飞书推送",
        },
        {
            "name": "情报雷达-突发检测",
            "schedule": {"kind": "cron", "expr": "0 */4 * * *", "tz": "Asia/Shanghai"},
            "payload": {
                "kind": "agentTurn",
                "message": (
                    f"执行突发快讯检测。\n"
                    f"运行命令: cd {WORKSPACE}/intelligence-radar && python scripts/run_daily.py flash\n"
                    f"如果发现 P0 情报，立即推送飞书消息。"
                ),
                "model": "minimax/MiniMax-M2.7",
                "timeoutSeconds": 300,
            },
            "delivery": {"mode": "announce", "channel": "telegram", "to": "8606756625"},
            "description": "每4小时检测一次突发 P0/P1 情报",
        },
    ]

    print("🛰️ 注册情报雷达 Cron 任务...")
    for job in jobs:
        result = cron(action="add", job=job)
        job_id = result.get("jobId", result.get("id", ""))
        status = "✅" if job_id else "❌"
        print(f"  {status} {job['name']} → ID: {job_id}")

    print("\n📋 全部任务注册完成")


def list_jobs():
    """列出当前雷达相关 Cron 任务"""
    from cron import cron
    result = cron(action="list")
    jobs = result if isinstance(result, list) else []
    radar_jobs = [j for j in jobs if "雷达" in j.get("name", "")]
    print(f"🛰️ 当前情报雷达 Cron 任务: {len(radar_jobs)}")
    for j in radar_jobs:
        print(f"  - {j.get('name')} | {j.get('schedule',{}).get('expr','')} | ID: {j.get('jobId','')}")


def remove():
    """移除全部雷达 Cron 任务"""
    from cron import cron
    result = cron(action="list")
    jobs = result if isinstance(result, list) else []
    radar_jobs = [j for j in jobs if "雷达" in j.get("name", "")]
    if not radar_jobs:
        print("无雷达任务需要移除")
        return
    print(f"🗑️ 移除 {len(radar_jobs)} 个雷达任务...")
    for j in radar_jobs:
        job_id = j.get("jobId") or j.get("id")
        cron(action="remove", jobId=job_id)
        print(f"  ✅ 已移除: {j.get('name')}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "register":
        register()
    elif cmd == "list":
        list_jobs()
    elif cmd == "remove":
        remove()
    else:
        print(f"未知命令: {cmd}")
        print("用法: python setup_cron.py [register|list|remove]")
