"""
store.py - 情报知识库存储
持久化情报条目，支持去重查询和历史回溯
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any
from collections import defaultdict


class IntelStore:
    """
    轻量级 JSON 文件知识库
    结构: summaries/{track}/{YYYY-MM}.jsonl
    """

    def __init__(self, base_path: str = None):
        if base_path is None:
            base = Path(__file__).parent.parent
            base_path = base / "summaries"
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save(self, track: str, items: List[Dict]) -> int:
        """
        保存情报条目到当月文件
        返回保存数量
        """
        if not items:
            return 0
        month_key = datetime.now().strftime("%Y-%m")
        track_dir = self.base_path / track
        track_dir.mkdir(parents=True, exist_ok=True)
        file_path = track_dir / f"{month_key}.jsonl"
        count = 0
        with open(file_path, "a", encoding="utf-8") as f:
            for item in items:
                # 补全元数据
                item.setdefault("stored_at", datetime.now().isoformat())
                item.setdefault("track", track)
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
                count += 1
        return count

    def query(
        self,
        track: str,
        keywords: Optional[List[str]] = None,
        since_hours: Optional[int] = None,
        min_score: Optional[float] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        查询情报
        - track: 情报轨道
        - keywords: 关键词过滤（AND）
        - since_hours: 只看最近N小时
        - min_score: 最低分数
        - limit: 返回条数上限
        """
        now = datetime.now()
        cutoff = None
        if since_hours:
            cutoff = now - timedelta(hours=since_hours)

        # 扫描最近2个月的文件
        results = []
        months = [now.strftime("%Y-%m")]
        if now.month > 1:
            prev = now.replace(month=now.month - 1)
            months.append(prev.strftime("%Y-%m"))
        else:
            prev = now.replace(year=now.year - 1, month=12)
            months.append(prev.strftime("%Y-%m"))

        for month in months:
            file_path = self.base_path / track / f"{month}.jsonl"
            if not file_path.exists():
                continue
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # 时效过滤
                    if cutoff:
                        stored = item.get("stored_at", "")
                        try:
                            dt = datetime.fromisoformat(stored)
                            if dt < cutoff:
                                continue
                        except ValueError:
                            continue

                    # 关键词过滤
                    if keywords:
                        text = (item.get("title", "") + item.get("content", "")).lower()
                        if not all(kw.lower() in text for kw in keywords):
                            continue

                    # 分数过滤
                    if min_score:
                        score = item.get("_score", 0)
                        if score < min_score:
                            continue

                    results.append(item)

        # 去重（URL唯一）
        seen_urls = set()
        unique = []
        for item in results:
            url = item.get("url") or item.get("link")
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            unique.append(item)

        # 按分数排序
        unique.sort(key=lambda x: x.get("_score", 0), reverse=True)
        return unique[:limit]

    def get_trending(self, track: str, hours: int = 24) -> Dict[str, int]:
        """
        获取最近N小时的热词统计（用于趋势检测）
        """
        items = self.query(track, since_hours=hours, limit=500)
        counter: Dict[str, int] = defaultdict(int)
        for item in items:
            for kw in item.get("matched_keywords", []):
                counter[kw] += 1
        return dict(sorted(counter.items(), key=lambda x: x[1], reverse=True))

    def get_stats(self, track: str) -> Dict[str, Any]:
        """获取情报统计"""
        items = self.query(track, since_hours=168, limit=1000)  # 最近7天
        return {
            "total": len(items),
            "avg_score": round(sum(i.get("_score", 0) for i in items) / max(len(items), 1), 1),
            "p0_count": sum(1 for i in items if i.get("_alert_level") == "P0"),
            "p1_count": sum(1 for i in items if i.get("_alert_level") == "P1"),
        }
