#!/usr/bin/env python3
"""Hacker News 热帖抓取器"""

import requests
from datetime import datetime, timedelta
from typing import List, Dict

class HNFetcher:
    """抓取 Hacker News AI 相关热帖"""
    
    API_BASE = "https://hacker-news.firebaseio.com/v0"
    
    def __init__(self, config: Dict):
        self.config = config
        self.min_score = config.get('min_score', 100)
        self.min_score_weekend = config.get('min_score_weekend', 80)
        self.keywords = [k.lower() for k in config.get('keywords', [])]
        self.max_items = config.get('max_items', 30)
        
    def fetch(self) -> List[Dict]:
        """获取 AI 相关热帖"""
        # 判断是否是周末
        today = datetime.now()
        is_weekend = today.weekday() >= 5
        score_threshold = self.min_score_weekend if is_weekend else self.min_score
        
        try:
            # 获取 top stories
            top_response = requests.get(
                f"{self.API_BASE}/topstories.json",
                timeout=30
            )
            top_response.raise_for_status()
            top_ids = top_response.json()[:200]  # 取前 200
            
            # 获取详情（限制数量避免超时）
            stories = []
            for story_id in top_ids[:self.max_items * 3]:
                story = self._get_story(story_id)
                if story and self._is_ai_related(story):
                    stories.append(story)
                if len(stories) >= self.max_items:
                    break
            
            # 过滤低分
            filtered = [s for s in stories if s.get('score', 0) >= score_threshold]
            
            # 按分数排序
            filtered.sort(key=lambda x: x.get('score', 0), reverse=True)
            return filtered[:10]
            
        except Exception as e:
            print(f"[HN] 抓取失败: {e}")
            return []
    
    def _get_story(self, story_id: int) -> Dict:
        """获取单条 story 详情"""
        try:
            response = requests.get(
                f"{self.API_BASE}/item/{story_id}.json",
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            if not data or data.get('type') != 'story':
                return None
            
            # 跳过招聘帖
            title = data.get('title', '').lower()
            if any(kw in title for kw in ['hiring', 'we are hiring', 'join us', 'career']):
                return None
            
            # 获取时间
            timestamp = data.get('time', 0)
            pub_date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')
            
            return {
                'source': 'Hacker News',
                'type': '热帖',
                'title': data.get('title', ''),
                'url': data.get('url') or f"https://news.ycombinator.com/item?id={story_id}",
                'score': data.get('score', 0),
                'comments': data.get('descendants', 0),
                'published': pub_date,
                'hn_id': story_id
            }
        except Exception as e:
            print(f"[HN] 获取 story {story_id} 失败: {e}")
            return None
    
    def _is_ai_related(self, story: Dict) -> bool:
        """检查是否是 AI 相关内容"""
        title = story.get('title', '').lower()
        
        # 关键词匹配
        for kw in self.keywords:
            if kw in title:
                return True
        
        return False


if __name__ == '__main__':
    # 测试
    config = {
        'min_score': 50,
        'keywords': ['AI', 'GPT', 'machine learning'],
        'max_items': 20
    }
    fetcher = HNFetcher(config)
    stories = fetcher.fetch()
    for s in stories[:3]:
        print(f"[{s['score']}] {s['title'][:60]}...")
