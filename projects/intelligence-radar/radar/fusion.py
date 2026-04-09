"""
fusion.py - 信息融合引擎
多传感器数据统一格式化 + 关键词命中标注 + 摘要生成
"""
import re
from typing import List, Dict, Any
from .scoring import IntelScorer
from .dedup import DedupEngine


class FusionEngine:
    """
    将来自不同传感器的异构数据统一融合为标准化情报条目
    """

    def __init__(self, scoring_config: Dict = None):
        self.scorer = IntelScorer(scoring_config)
        self.dedup = DedupEngine()

    def fuse(self, raw_items: List[Dict], track_keywords: List[str]) -> List[Dict]:
        """
        融合流程：
        1. 统一格式化（不同传感器 → 统一 schema）
        2. 关键词命中标注
        3. 去重
        4. 评分排序
        5. 摘要（如需要）
        """
        # Step 1: 标准化
        normalized = [self._normalize(item) for item in raw_items]

        # Step 2: 关键词命中
        for item in normalized:
            item["matched_keywords"] = self._match_keywords(
                item.get("title", "") + " " + item.get("content", ""),
                track_keywords
            )

        # Step 3: 去重
        self.dedup.reset()
        unique = self.dedup.dedup(normalized)

        # Step 4: 评分
        scored = self.scorer.rank_items(unique)

        # Step 5: 附加工审字段
        for item in scored:
            item["_source_label"] = self._get_source_label(item["source"])
            item["_time_ago"] = self._format_time_ago(item)

        return scored

    def _normalize(self, item: Dict) -> Dict:
        """将不同传感器格式统一为标准情报条目"""
        source = item.get("source", "unknown")

        # 统一字段映射
        normalized = {
            "source": source,
            "title": item.get("title") or item.get("text", "")[:200],
            "content": item.get("content") or item.get("body") or item.get("text", ""),
            "url": item.get("url") or item.get("link") or item.get("web_url") or item.get("html_url"),
            "timestamp": item.get("created_at") or item.get("published") or item.get("timestamp") or item.get("date"),
            "author": item.get("author") or item.get("user") or item.get("name") or item.get("actor"),
            "engagement_signals": item.get("engagement_signals", self._extract_engagement(item)),
            "raw": item,  # 保留原始数据
        }

        # 来源特定字段提取
        if source == "xurl":
            normalized["author"] = item.get("author_handle") or item.get("username", "")
            normalized["engagement_signals"] = {
                "likes": item.get("like_count", 0),
                "retweets": item.get("retweet_count", 0),
                "replies": item.get("reply_count", 0),
            }
        elif source == "gh":
            normalized["author"] = item.get("user", {}).get("login", "")
            normalized["engagement_signals"] = {
                "stars": item.get("stargazers_count", 0),
                "comments": item.get("comments", 0),
                "pr_number": item.get("number", 0),
            }
        elif source == "blog":
            normalized["timestamp"] = item.get("published") or item.get("updated")

        return normalized

    def _extract_engagement(self, item: Dict) -> Dict[str, int]:
        """从原始数据中提取互动信号"""
        return {
            "likes": item.get("likes", item.get("like_count", 0)),
            "stars": item.get("stars", item.get("stargazers_count", 0)),
            "views": item.get("views", 0),
        }

    def _match_keywords(self, text: str, keywords: List[str]) -> List[str]:
        """高亮命中关键词"""
        text_lower = text.lower()
        matched = []
        for kw in keywords:
            if kw.lower() in text_lower:
                matched.append(kw)
        return matched

    def _get_source_label(self, source: str) -> str:
        labels = {
            "xurl": "🐦 X/Twitter",
            "gh": "🐙 GitHub",
            "blog": "📝 博客",
            "web": "🌐 Web搜索",
            "rss": "📡 RSS",
        }
        return labels.get(source, f"📌 {source}")

    def _format_time_ago(self, item: Dict) -> str:
        """格式化时间差"""
        ts = item.get("timestamp")
        if not ts:
            return ""
        from datetime import datetime
        try:
            if isinstance(ts, str):
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            else:
                dt = datetime.fromtimestamp(ts)
        except (ValueError, OSError):
            return ""
        diff = datetime.now(dt.tzinfo) - dt
        hours = diff.total_seconds() / 3600
        if hours < 1:
            return f"{int(hours*60)}分钟前"
        elif hours < 24:
            return f"{int(hours)}小时前"
        else:
            return f"{int(hours/24)}天前"

    def cluster_events(self, items: List[Dict]) -> List[Dict]:
        """将情报聚类为事件"""
        clusters = self.dedup.cluster(items)
        summaries = []
        for cluster in clusters:
            representative = cluster[0]
            summaries.append({
                "cluster_id": representative.get("_dedup_key", ""),
                "count": len(cluster),
                "primary": representative,
                "related": cluster[1:4] if len(cluster) > 1 else [],
                "is_multi_source": len(set(i["source"] for i in cluster)) > 1,
            })
        return sorted(summaries, key=lambda x: x["primary"].get("_score", 0), reverse=True)
