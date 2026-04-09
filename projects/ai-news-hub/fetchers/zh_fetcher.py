#!/usr/bin/env python3
"""中文 RSS 源抓取器"""

import feedparser
import requests
from datetime import datetime, timedelta
from typing import List, Dict
import re

class ZhFetcher:
    """抓取中文 AI 媒体 RSS"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.rss_feeds = config.get('rss_feeds', [])
        self.keywords = [k.lower() for k in config.get('keywords', [])]
        
    def fetch(self) -> List[Dict]:
        """获取中文 RSS 内容"""
        all_items = []
        
        for feed_config in self.rss_feeds:
            try:
                items = self._fetch_feed(feed_config)
                all_items.extend(items)
            except Exception as e:
                print(f"[中文源] {feed_config.get('name')} 抓取失败: {e}")
        
        # 按时间排序
        all_items.sort(key=lambda x: x.get('published', ''), reverse=True)
        return all_items[:10]
    
    def _fetch_feed(self, feed_config: Dict) -> List[Dict]:
        """获取单个 RSS feed"""
        url = feed_config.get('url')
        name = feed_config.get('name', '未知源')
        
        # 解析 RSS
        feed = feedparser.parse(url)
        
        items = []
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        for entry in feed.entries:
            # 获取发布时间
            pub_date = self._parse_date(entry)
            if not pub_date or pub_date < yesterday:
                continue
            
            title = entry.get('title', '')
            
            # 关键词过滤
            if not self._is_ai_related(title):
                continue
            
            items.append({
                'source': name,
                'type': '中文',
                'title': title,
                'summary': entry.get('summary', '')[:300] + '...',
                'url': entry.get('link', ''),
                'published': pub_date
            })
        
        return items
    
    def _parse_date(self, entry) -> str:
        """解析发布时间"""
        # 尝试不同字段
        date_fields = ['published', 'updated', 'pubDate', 'created']
        for field in date_fields:
            if hasattr(entry, field):
                date_str = getattr(entry, field)
                try:
                    # 尝试解析常见格式
                    for fmt in ['%Y-%m-%d', '%a, %d %b %Y', '%Y-%m-%dT%H:%M:%S']:
                        try:
                            dt = datetime.strptime(date_str[:len(fmt)], fmt)
                            return dt.strftime('%Y-%m-%d')
                        except:
                            continue
                except:
                    pass
        return datetime.now().strftime('%Y-%m-%d')
    
    def _is_ai_related(self, title: str) -> bool:
        """检查标题是否 AI 相关"""
        title_lower = title.lower()
        
        # 中文关键词
        zh_keywords = ['ai', '人工智能', '大模型', '机器学习', '深度学习', 
                      'gpt', 'llm', '算法', '神经网络', 'openai', '谷歌']
        
        for kw in zh_keywords:
            if kw in title_lower:
                return True
        
        return False


if __name__ == '__main__':
    # 测试
    config = {
        'rss_feeds': [
            {'name': '机器之心', 'url': 'https://www.jiqizhixin.com/rss'}
        ],
        'keywords': ['AI', '人工智能']
    }
    fetcher = ZhFetcher(config)
    items = fetcher.fetch()
    for i in items[:3]:
        print(f"[{i['source']}] {i['title'][:50]}...")
