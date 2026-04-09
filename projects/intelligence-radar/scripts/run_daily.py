#!/usr/bin/env python3
"""
run_daily.py - 每日定时情报简报脚本
用法:
  python run_daily.py morning   # 08:00 早报
  python run_daily.py evening   # 18:00 晚报
  python run_daily.py flash     # 突发快讯检测
"""
import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
from radar.core import RadarCore
from reports.daily_briefing import DailyBriefing
from reports.flash_report import FlashReport


def main():
    edition = sys.argv[1] if len(sys.argv) > 1 else "morning"
    now = datetime.now()

    print(f"[{now.strftime('%H:%M:%S')}] 🛰️ 情报雷达定时任务启动 → {edition}")

    if edition == "flash":
        run_flash()
    else:
        run_daily(edition)


def run_daily(edition: str):
    radar = RadarCore()
    briefing = DailyBriefing()

    # 先扫描最新数据（过去6小时）
    print("[雷达] 执行最新扫描...")
    for track_id in ["ai_frontier", "industry_intel", "policy_eco"]:
        items = radar.scan(track_id, limit=10)
        radar.save(items, track_id)
        print(f"[雷达] {track_id}: {len(items)} 条已保存")

    # 生成简报
    print("[简报] 生成报告中...")
    report = briefing.generate(edition)
    print(f"[简报] ✅ 生成完成: {report['title']}")

    # 输出 Markdown 版
    report_path = Path(__file__).parent.parent / "summaries" / f"{edition}_{datetime.now().strftime('%Y-%m-%d_%H%M')}.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report["markdown"])
    print(f"[简报] 📄 已保存: {report_path}")

    # 输出 JSON 版（供推送使用）
    json_path = report_path.with_suffix(".json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"[简报] 📋 JSON: {json_path}")

    print("\n📊 简报预览:")
    print(report["markdown"][:500])


def run_flash():
    """突发快讯检测"""
    radar = RadarCore()
    flash = FlashReport()

    print("[雷达] 检测高优先级情报...")
    for track_id in ["ai_frontier", "industry_intel", "policy_eco"]:
        items = radar.scan(track_id, limit=20)
        radar.save(items, track_id)

        high_priority = [i for i in items if i.get("_alert_level") in ("P0", "P1")]
        if high_priority:
            print(f"[🚨 突发] {track_id}: {len(high_priority)} 条 P0/P1 情报")
            for item in high_priority:
                report = flash.generate(item)
                print(f"\n{'='*60}")
                print(report["markdown"][:400])

                # 保存快讯
                flash_path = Path(__file__).parent.parent / "summaries" / "flash" / f"{track_id}_{item.get('_score','0')}.json"
                flash_path.parent.mkdir(parents=True, exist_ok=True)
                with open(flash_path, "w", encoding="utf-8") as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
