"""
web_sensor.py - Web 搜索传感器
通过 Tavily / DuckDuckGo / unified_search 抓取网络情报
"""
import json
import subprocess
from typing import List, Dict, Optional, Any


class WebSensor:
    """Web 搜索情报传感器"""

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}

    def search(self, keywords: List[str], limit: int = 15) -> List[Dict]:
        """
        多引擎 Web 搜索
        优先 unified_search（已内置），降级为 web_search 工具
        """
        results = []

        # unified_search（OpenClaw 内置，零配置）
        unified = self._search_unified(keywords, limit)
        results.extend(unified)

        return results

    def _search_unified(self, keywords: List[str], limit: int) -> List[Dict]:
        """
        调用 OpenClaw unified_search 技能
        注意：此方法返回格式化的结果，实际搜索由 OpenClaw agent 执行
        这里只是声明接口，返回模拟搜索查询请求
        """
        query = " ".join(keywords)
        # 返回搜索请求结构，实际执行在上层 RadarCore
        return [{
            "source": "web",
            "query": query,
            "search_type": "unified_search",
            "requested_limit": limit,
        }]

    def search_tavily(self, query: str, api_key: str = None, limit: int = 10) -> List[Dict]:
        """Tavily API 搜索（需要 API Key）"""
        if not api_key:
            return []
        import urllib.request
        data = json.dumps({
            "query": query,
            "search_depth": "advanced",
            "max_results": limit
        }).encode()
        req = urllib.request.Request(
            "https://api.tavily.com/search",
            data=data,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.load(resp)
                items = []
                for r in result.get("results", []):
                    items.append({
                        "source": "web",
                        "title": r.get("title", ""),
                        "content": r.get("content", ""),
                        "url": r.get("url", ""),
                        "timestamp": "",
                        "score": r.get("score", 0),
                    })
                return items
        except Exception:
            return []

    def search_duckduckgo(self, query: str, limit: int = 10) -> List[Dict]:
        """DuckDuckGo 搜索（免 API Key）"""
        try:
            result = subprocess.run(
                ["ddgr", "--json", "-n", str(limit), query],
                capture_output=True, text=True, timeout=20
            )
            if result.returncode == 0 and result.stdout.strip():
                items = []
                for line in result.stdout.strip().split("\n"):
                    try:
                        r = json.loads(line)
                        items.append({
                            "source": "web",
                            "title": r.get("title", ""),
                            "content": r.get("abstract", "")[:300],
                            "url": r.get("url", ""),
                            "timestamp": "",
                        })
                    except json.JSONDecodeError:
                        continue
                return items
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return []
