"""
xurl_sensor.py - Twitter/X 传感器
通过 xurl CLI + 关键词搜索抓取 Twitter 情报
"""
import json
import subprocess
from typing import List, Dict, Optional


class XUrlSensor:
    """X/Twitter 情报传感器"""

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}

    def search(self, keywords: List[str], handles: List[str], limit: int = 20) -> List[Dict]:
        """
        搜索 Twitter
        - keywords: 关键词列表（OR 关系）
        - handles: 关注用户列表
        - limit: 结果上限
        """
        results = []

        # 关键词搜索
        if keywords:
            query = " OR ".join(keywords[:5])  # X API 限制
            raw = self._run_xurl(["search", "--query", query, "--limit", str(limit)])
            for item in raw:
                item["source"] = "xurl"
                item["search_type"] = "keyword"
                results.append(item)

        # 指定用户时间线（仅获取最近带关键词的）
        for handle in handles[:5]:
            raw = self._run_xurl(["user", "--handle", handle.lstrip("@"), "--limit", "10"])
            for item in raw:
                item["source"] = "xurl"
                item["author_handle"] = f"@{handle.lstrip('@')}"
                item["search_type"] = "user_timeline"
                results.append(item)

        return results

    def _run_xurl(self, args: List[str]) -> List[Dict]:
        """执行 xurl CLI 并解析 JSON 输出"""
        try:
            result = subprocess.run(
                ["xurl"] + args,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
        except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
            pass
        return []
