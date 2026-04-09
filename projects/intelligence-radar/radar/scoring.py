"""
scoring.py - 情报重要性评分引擎
"""
import time
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional


class IntelScorer:
    """基于多维度信号的重要性评分"""

    SOURCE_WEIGHTS = {
        "xurl": 2.0,
        "gh": 1.5,
        "blog": 1.8,
        "web": 1.0
    }

    RECENCY_DECAY = {
        24: 1.0,
        48: 0.7,
        72: 0.4,
        168: 0.1
    }

    def __init__(self, config: Optional[Dict] = None):
        if config:
            self.SOURCE_WEIGHTS = config.get("source_weights", self.SOURCE_WEIGHTS)
            self.RECENCY_DECAY = config.get("recency_decay", self.RECENCY_DECAY)

    def score(self, item: Dict[str, Any]) -> float:
        """
        计算单条情报的综合得分 0-100
        """
        source = item.get("source", "web")
        source_weight = self.SOURCE_WEIGHTS.get(source, 1.0)

        # 时效性衰减
        age_hours = self._get_age_hours(item)
        recency = self._get_recency_factor(age_hours)

        # 命中密度
        hit_density = self._calc_hit_density(item)

        # 互动信号
        engagement = self._calc_engagement(item)

        # 关键词稀缺性加分（长尾词+1.2）
        rarity = item.get("keyword_rarity", 1.0)

        raw_score = (
            source_weight
            * recency
            * hit_density
            * engagement
            * rarity
        )

        # 归一化到 0-100
        return min(100.0, round(raw_score * 50, 1))

    def _get_age_hours(self, item: Dict) -> float:
        """计算情报年龄（小时）"""
        ts = item.get("timestamp") or item.get("created_at")
        if not ts:
            return 999.0
        if isinstance(ts, str):
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                return 999.0
        elif isinstance(ts, (int, float)):
            dt = datetime.fromtimestamp(ts)
        else:
            return 999.0
        age = datetime.now(dt.tzinfo) - dt
        return age.total_seconds() / 3600

    def _get_recency_factor(self, hours: float) -> float:
        if hours <= 24:
            return self.RECENCY_DECAY[24]
        elif hours <= 48:
            return self.RECENCY_DECAY[48]
        elif hours <= 72:
            return self.RECENCY_DECAY[72]
        else:
            return self.RECENCY_DECAY[168]

    def _calc_hit_density(self, item: Dict) -> float:
        """关键词命中密度 0.5~2.0"""
        keywords = item.get("matched_keywords", [])
        n = len(keywords)
        if n == 0:
            return 0.5
        return min(2.0, 0.5 + 0.3 * n)

    def _calc_engagement(self, item: Dict) -> float:
        """互动信号 0.5~1.5"""
        # 支持的信号：likes, stars, retweets, pr_number, comments
        signals = item.get("engagement_signals", {})
        total = sum(signals.values())
        if total == 0:
            return 1.0
        if total >= 1000:
            return 1.5
        elif total >= 100:
            return 1.2
        elif total >= 10:
            return 1.0
        return 0.8

    def get_alert_level(self, score: float) -> str:
        if score >= 80:
            return "P0"
        elif score >= 65:
            return "P1"
        elif score >= 50:
            return "P2"
        return "P3"

    def rank_items(self, items: List[Dict]) -> List[Dict]:
        """对情报列表打分并排序"""
        for item in items:
            item["_score"] = self.score(item)
            item["_alert_level"] = self.get_alert_level(item["_score"])
        return sorted(items, key=lambda x: x["_score"], reverse=True)
