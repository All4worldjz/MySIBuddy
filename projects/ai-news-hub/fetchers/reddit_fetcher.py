#!/usr/bin/env python3
"""Reddit 抓取器"""

import requests
from datetime import datetime, timedelta
from typing import List, Dict

class RedditFetcher:
    """抓取 Reddit AI 相关讨论（无需 OAuth，使用公开 JSON）"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.subreddits = config.get('subreddits', ['MachineLearning'])
        self.min_score = config.get('min_score', 50)
        self.min_comments = config.get('min_comments', 10)
        self.max_items = config.get('max_items', 20)
        self.headers = {
            'User-Agent': 'AI-News-Hub/1.0 (by /u/aibot)'
        }
        
    def fetch(self) -> List[Dict]:
        """获取各版块热门帖子"""
        all_posts = []
        
        for subreddit in self.subreddits:
            try:
                posts = self._fetch_subreddit(subreddit)
                all_posts.extend(posts)
            except Exception as e:
                print(f"[Reddit] r/{subreddit} 抓取失败: {e}")
        
        # 去重（基于 URL）
        seen_urls = set()
        unique_posts = []
        for post in all_posts:
            url = post.get('url', '')
            if url not in seen_urls:
                seen_urls.add(url)
                unique_posts.append(post)
        
        # 按分数排序
        unique_posts.sort(key=lambda x: x.get('score', 0), reverse=True)
        return unique_posts[:10]
    
    def _fetch_subreddit(self, subreddit: str) -> List[Dict]:
        """获取单个版块的热门帖子"""
        # 使用 .json?raw_json=1 避免 403
        url = f"https://www.reddit.com/r/{subreddit}/hot.json?raw_json=1&limit=25"
        
        # 添加随机延迟避免被限流
        import time
        import random
        time.sleep(random.uniform(1, 3))
        
        response = requests.get(url, headers=self.headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        posts = []
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        for child in data.get('data', {}).get('children', []):
            post_data = child.get('data', {})
            
            # 过滤条件
            score = post_data.get('ups', 0)
            comments = post_data.get('num_comments', 0)
            
            if score < self.min_score or comments < self.min_comments:
                continue
            
            # 获取时间
            created_utc = post_data.get('created_utc', 0)
            pub_date = datetime.fromtimestamp(created_utc).strftime('%Y-%m-%d')
            
            # 只取最近 24 小时
            if pub_date < yesterday:
                continue
            
            posts.append({
                'source': f'Reddit r/{subreddit}',
                'type': '讨论',
                'title': post_data.get('title', ''),
                'url': post_data.get('url', ''),
                'reddit_url': f"https://reddit.com{post_data.get('permalink', '')}",
                'score': score,
                'comments': comments,
                'published': pub_date
            })
        
        return posts


if __name__ == '__main__':
    # 测试
    config = {
        'subreddits': ['MachineLearning'],
        'min_score': 20,
        'max_items': 10
    }
    fetcher = RedditFetcher(config)
    posts = fetcher.fetch()
    for p in posts[:3]:
        print(f"[{p['score']}] {p['title'][:60]}...")
