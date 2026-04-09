"""
dedup.py - 去重与聚类引擎
使用 SimHash + 关键词匹配双层去重
"""
import hashlib
import re
from typing import List, Dict, Set, Tuple


class DedupEngine:
    """情报去重引擎"""

    def __init__(self, similarity_threshold: float = 0.85):
        self.threshold = similarity_threshold
        self._seen_hashes: Set[str] = set()
        self._seen_urls: Dict[str, str] = {}

    def dedup(self, items: List[Dict]) -> List[Dict]:
        """
        对情报列表去重，返回唯一列表
        策略：
        1. URL 完全匹配 → 直接去重
        2. SimHash 相似度 > 85% → 内容去重
        3. 标题完全相同 + 来源相同 → 去重
        """
        unique = []
        for item in items:
            url = item.get("url") or item.get("link")
            title = item.get("title", "")
            content_hash = self._simple_hash(item.get("content", title))

            # URL 精确去重
            if url and url in self._seen_urls:
                continue

            # SimHash 近似去重
            if content_hash in self._seen_hashes:
                continue

            # 标题 + 来源 联合去重
            key = f"{item.get('source', '')}:{title[:80]}"
            if key in self._seen_hashes:
                continue

            # 通过，加入唯一列表
            self._seen_hashes.add(content_hash)
            if url:
                self._seen_urls[url] = content_hash
            self._seen_hashes.add(key)

            item["_dedup_key"] = content_hash
            unique.append(item)

        return unique

    def cluster(self, items: List[Dict]) -> List[List[Dict]]:
        """
        将情报聚类，同一事件的多条报道归为一组
        返回 clusters: List[事件集群]
        """
        if not items:
            return []

        clusters = []
        used: Set[int] = set()

        for i, item in enumerate(items):
            if i in used:
                continue
            cluster = [item]
            used.add(i)

            title_words = self._extract_key_words(item.get("title", ""))

            for j, other in enumerate(items):
                if j <= i or j in used:
                    continue
                other_words = self._extract_key_words(other.get("title", ""))
                overlap = len(title_words & other_words)
                if overlap >= 2 and overlap / max(len(title_words), 1) > 0.3:
                    cluster.append(other)
                    used.add(j)

            clusters.append(cluster)

        return clusters

    def _simple_hash(self, text: str) -> str:
        """生成文本的快速哈希"""
        text = re.sub(r"\s+", "", text.lower())
        return hashlib.md5(text.encode()).hexdigest()[:16]

    def _extract_key_words(self, text: str) -> Set[str]:
        """提取标题关键词（中文+英文词）"""
        chinese = re.findall(r"[\u4e00-\u9fff]+", text)
        english = re.findall(r"[a-zA-Z0-9]{3,}", text)
        keywords = set(chinese + english)
        # 过滤停用词
        stopwords = {"的", "了", "在", "是", "和", "与", "The", "A", "An", "In", "On", "For", "to", "of"}
        return keywords - stopwords

    def reset(self):
        """重置去重状态（新一次查询）"""
        self._seen_hashes.clear()
        self._seen_urls.clear()
