#!/usr/bin/env python3
"""
run_radar.py - 情报雷达按需查询 CLI
用法:
  python run_radar.py --track ai_frontier --limit 10
  python run_radar.py --track industry_intel --keyword "政务云"
  python run_radar.py --all --flash
"""
import sys
import json
import argparse
from pathlib import Path

# 导入雷达核心
sys.path.insert(0, str(Path(__file__).parent.parent))
from radar.core import RadarCore
from reports.formatter import ReportFormatter


def main():
    parser = argparse.ArgumentParser(description="🛰️ 情报雷达 - 按需情报查询")
    parser.add_argument("--track", default="ai_frontier",
                        help="情报轨道 (ai_frontier/industry_intel/policy_eco/venture_scout)")
    parser.add_argument("--all", action="store_true", help="扫描所有轨道")
    parser.add_argument("--limit", type=int, default=15, help="每源结果上限")
    parser.add_argument("--sources", nargs="+",
                        help="指定传感器 (xurl/gh/blog/web)")
    parser.add_argument("--keyword", help="补充关键词过滤")
    parser.add_argument("--min-score", type=float, default=50.0,
                        help="最低重要性分数 (0-100)")
    parser.add_argument("--save", action="store_true", help="保存到知识库")
    parser.add_argument("--format", default="text",
                        choices=["text", "json", "md"],
                        help="输出格式")
    parser.add_argument("--flash", action="store_true",
                        help="突发模式: 只输出 P0/P1 高优先级")
    args = parser.parse_args()

    radar = RadarCore()
    formatter = ReportFormatter()

    if args.all:
        print("🛰️ 情报雷达启动 → 全轨道扫描")
        results = radar.scan_all(limit=args.limit)
        for track_id, items in results.items():
            track_cfg = radar.get_track_config(track_id)
            print(f"\n{'='*60}")
            print(f"📡 {track_cfg.get('name', track_id)} ({track_id})")
            print(f"   命中 {len(items)} 条情报")
            filtered = items if not args.flash else [i for i in items if i.get("_alert_level") in ("P0","P1")]
            for item in filtered[:5]:
                _print_item(item)
            if args.save:
                radar.save(items, track_id)
    else:
        track_cfg = radar.get_track_config(args.track)
        print(f"🛰️ 情报雷达 → {track_cfg.get('name', args.track)}")

        results = radar.scan(
            args.track,
            limit=args.limit,
            sources=args.sources
        )

        # 关键词过滤
        if args.keyword:
            results = [r for r in results
                       if args.keyword.lower() in (r.get("title","")+r.get("content","")).lower()]
            print(f"   关键词 [{args.keyword}] 过滤后: {len(results)} 条")

        # 分数过滤
        results = [r for r in results if r.get("_score", 0) >= args.min_score]

        # 突发模式
        if args.flash:
            results = [r for r in results if r.get("_alert_level") in ("P0", "P1")]
            print(f"   🚨 突发快讯 (P0/P1): {len(results)} 条")

        print(f"\n{'='*60}")
        for i, item in enumerate(results, 1):
            _print_item(item, num=i)

        print(f"\n📊 共 {len(results)} 条情报 | 最高分: {results[0].get('_score','?') if results else 'N/A'}")

        if args.save:
            radar.save(results, args.track)

    # 输出格式
    if args.format == "json":
        print("\n" + json.dumps(results, ensure_ascii=False, indent=2))
    elif args.format == "md":
        print(formatter.to_markdown(results, args.track))


def _print_item(item: Dict, num: int = None):
    lvl = item.get("_alert_level", "P?")
    score = item.get("_score", 0)
    title = item.get("title", "无标题")
    url = item.get("url", "")
    ago = item.get("_time_ago", "")
    src = item.get("_source_label", "📌")
    kws = item.get("matched_keywords", [])

    prefix = f"{num}. " if num else "• "
    lvl_icon = {"P0": "🔥", "P1": "⚠️", "P2": "📌", "P3": "•"}.get(lvl, "•")
    print(f"{prefix}[{lvl_icon}{lvl}|{score}] {src} {ago}")
    print(f"   {title[:75]}")
    if url:
        print(f"   🔗 {url[:80]}")
    if kws:
        print(f"   🏷️ {', '.join(kws[:4])}")


if __name__ == "__main__":
    main()
