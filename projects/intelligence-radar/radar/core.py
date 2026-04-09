"""
core.py - 情报雷达核心调度引擎
协调所有传感器 → 融合 → 评分 → 存储 → 报告生成
"""
import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from radar.fusion import FusionEngine
from radar.store import IntelStore
from radar.sensors import XUrlSensor, GHSensor, BlogSensor, WebSensor


class RadarCore:
    """
    情报雷达核心调度器

    使用方式:
        radar = RadarCore()
        intel = radar.scan(track="ai_frontier", limit=20)
        radar.save(intel, track="ai_frontier")
    """

    def __init__(self, config_path: str = None):
        if config_path is None:
            base = Path(__file__).parent.parent
            config_path = base / "config" / "tracks.json"
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

        self.store = IntelStore()
        self.fusion = FusionEngine(self.config.get("scoring"))

        # 初始化传感器
        self.sensors = {
            "xurl": XUrlSensor(),
            "gh": GHSensor(),
            "blog": BlogSensor(),
            "web": WebSensor(),
        }

    def get_track_config(self, track: str) -> Dict:
        """获取指定轨道的配置"""
        return self.config["tracks"].get(track, {})

    def scan(
        self,
        track: str,
        limit: int = 20,
        sources: Optional[List[str]] = None,
        force_sources: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        扫描指定情报轨道

        参数:
            track: 轨道ID (ai_frontier / industry_intel / policy_eco / venture_scout)
            limit: 每源返回条数
            sources: 指定使用的传感器（如不指定则用轨道配置的）
            force_sources: 强制使用的传感器列表（覆盖轨道配置）

        返回:
            按重要性排序的情报列表
        """
        track_cfg = self.get_track_config(track)
        keywords = track_cfg.get("keywords", [])
        xurl_handles = track_cfg.get("xurl_handles", [])
        gh_repos = track_cfg.get("gh_repos", [])
        blog_feeds = track_cfg.get("blog_feeds", [])
        enabled_sources = force_sources or sources or track_cfg.get("sources", ["web"])

        print(f"[雷达] 启动扫描 → 轨道: {track_cfg.get('name', track)}")
        print(f"[雷达] 关键词: {keywords[:5]}...")
        print(f"[雷达] 传感器: {enabled_sources}")

        raw_items = []

        # X/Twitter
        if "xurl" in enabled_sources and (keywords or xurl_handles):
            print("[雷达] 🐦 扫描 X/Twitter...")
            try:
                items = self.sensors["xurl"].search(keywords, xurl_handles, limit)
                raw_items.extend(items)
                print(f"[雷达]   → 获取 {len(items)} 条")
            except Exception as e:
                print(f"[雷达]   → X/Twitter 失败: {e}")

        # GitHub
        if "gh" in enabled_sources and gh_repos:
            print("[雷达] 🐙 扫描 GitHub...")
            try:
                items = self.sensors["gh"].fetch_repos(gh_repos, limit=limit)
                raw_items.extend(items)
                print(f"[雷达]   → 获取 {len(items)} 条")
            except Exception as e:
                print(f"[雷达]   → GitHub 失败: {e}")

        # 博客
        if "blog" in enabled_sources and blog_feeds:
            print("[雷达] 📝 扫描博客订阅...")
            try:
                items = self.sensors["blog"].check_feeds(blog_feeds, hours=48)
                raw_items.extend(items)
                print(f"[雷达]   → 获取 {len(items)} 条")
            except Exception as e:
                print(f"[雷达]   → 博客扫描失败: {e}")

        # Web 搜索
        if "web" in enabled_sources and keywords:
            print("[雷达] 🌐 执行 Web 搜索...")
            # Web 搜索由 OpenClaw unified_search 工具提供
            # 这里记录意图，实际执行在 agent 层
            print(f"[雷达]   → 搜索词: {' OR '.join(keywords[:3])}")

        print(f"[雷达] 融合层: 共 {len(raw_items)} 条原始数据 → 进入融合")

        # 融合 + 评分 + 排序
        fused = self.fusion.fuse(raw_items, keywords)

        # P0/P1 单独打印
        high_priority = [i for i in fused if i.get("_alert_level") in ("P0", "P1")]
        if high_priority:
            print(f"[雷达] ⚠️  高优先级情报: {len(high_priority)} 条")
            for item in high_priority[:3]:
                print(f"       [{item['_alert_level']}] {item.get('title', '')[:60]}")

        return fused

    def scan_all(self, limit: int = 15) -> Dict[str, List[Dict]]:
        """扫描所有已配置轨道"""
        results = {}
        for track_id in self.config["tracks"]:
            results[track_id] = self.scan(track_id, limit=limit)
        return results

    def save(self, items: List[Dict], track: str) -> int:
        """保存情报到知识库"""
        count = self.store.save(track, items)
        print(f"[雷达] 💾 已保存 {count} 条到 {track}")
        return count

    def query_history(
        self,
        track: str,
        keywords: Optional[List[str]] = None,
        hours: int = 24,
        min_score: float = 50
    ) -> List[Dict]:
        """查询知识库中的历史情报"""
        return self.store.query(track, keywords=keywords, since_hours=hours, min_score=min_score)

    def get_trending(self, track: str, hours: int = 24) -> Dict[str, int]:
        """获取热词趋势"""
        return self.store.get_trending(track, hours=hours)

    def get_stats(self, track: str) -> Dict[str, Any]:
        """获取情报统计"""
        return self.store.get_stats(track)


# 便捷 CLI 入口
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="情报雷达 CLI")
    parser.add_argument("--track", default="ai_frontier", help="情报轨道")
    parser.add_argument("--limit", type=int, default=20, help="结果数量")
    parser.add_argument("--sources", nargs="+", help="指定传感器")
    parser.add_argument("--save", action="store_true", help="保存到知识库")
    parser.add_argument("--query", help="查询历史关键词")
    args = parser.parse_args()

    radar = RadarCore()

    if args.query:
        results = radar.query_history(args.track, keywords=[args.query])
    else:
        results = radar.scan(args.track, limit=args.limit, sources=args.sources)

    # 打印结果
    for i, item in enumerate(results[:args.limit], 1):
        lvl = item.get("_alert_level", "P?")
        score = item.get("_score", 0)
        title = item.get("title", "无标题")[:70]
        ago = item.get("_time_ago", "")
        src = item.get("_source_label", "")
        kws = ", ".join(item.get("matched_keywords", [])[:3])
        print(f"\n{i}. [{lvl}|{score}] {src} {ago}")
        print(f"   {title}")
        if kws:
            print(f"   🏷️ {kws}")

    print(f"\n共 {len(results)} 条情报")

    if args.save and not args.query:
        radar.save(results, args.track)
