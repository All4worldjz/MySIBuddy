"""
blog_sensor.py - 博客 RSS 订阅传感器
通过 blogwatcher CLI 监控订阅源的更新
"""
import subprocess
import feedparser
from typing import List, Dict, Optional
from datetime import datetime, timedelta


class BlogSensor:
    """博客 RSS/Atom 订阅传感器"""

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}

    def check_feeds(self, feeds: List[str], hours: int = 24) -> List[Dict]:
        """
        检查多个 RSS/Atom 订阅源，获取最近 N 小时的更新
        - feeds: RSS/Atom URL 列表
        - hours: 只看最近多少小时
        """
        results = []
        cutoff = datetime.now() - timedelta(hours=hours)

        for feed_url in feeds[:20]:  # 最多20个订阅源
            items = self._parse_feed(feed_url, cutoff)
            for item in items:
                item["source"] = "blog"
                item["feed_url"] = feed_url
                results.append(item)

        return results

    def _parse_feed(self, feed_url: str, cutoff: datetime) -> List[Dict]:
        """解析单个 RSS/Atom 源"""
        try:
            feed = feedparser.parse(feed_url)
            items = []
            for entry in feed.entries[:10]:
                published = self._parse_date(entry.get("published") or entry.get("updated"))
                if published and published < cutoff:
                    continue
                items.append({
                    "title": entry.get("title", ""),
                    "content": entry.get("summary", "")[:500],
                    "url": entry.get("link") or entry.get("id", ""),
                    "author": entry.get("author", ""),
                    "published": published.isoformat() if published else "",
                    "source": "blog",
                })
            return items
        except Exception:
            return []

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """解析 RFC 822 / ISO 日期"""
        if not date_str:
            return None
        from email.utils import parsedate_to_datetime
        try:
            return parsedate_to_datetime(date_str)
        except (ValueError, TypeError):
            try:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                return None

    def run_blogwatcher(self, config_path: str = None, limit: int = 20) -> List[Dict]:
        """
        使用 blogwatcher CLI 检查更新
        - config_path: blogwatcher 配置文件路径
        """
        cmd = ["blogwatcher"]
        if config_path:
            cmd += ["--config", config_path]
        cmd += ["--limit", str(limit), "--json"]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0 and result.stdout.strip():
                import json
                return json.loads(result.stdout)
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
            pass
        return []
