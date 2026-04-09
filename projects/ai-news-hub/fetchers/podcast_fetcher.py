#!/usr/bin/env python3
"""AI 播客、Newsletter、博客抓取器"""

import feedparser
from datetime import datetime, timedelta
from typing import List, Dict

class PodcastFetcher:
    """抓取 AI 领袖播客、Newsletter、博客"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.rss_feeds = config.get('rss_feeds', [])
        
    def fetch(self) -> List[Dict]:
        """获取所有播客/Newsletter/博客内容"""
        all_items = []
        
        for feed_config in self.rss_feeds:
            try:
                items = self._fetch_feed(feed_config)
                all_items.extend(items)
            except Exception as e:
                print(f"[播客/Newsletter] {feed_config.get('name')} 抓取失败: {e}")
        
        # 按时间排序
        all_items.sort(key=lambda x: x.get('published', ''), reverse=True)
        return all_items[:15]  # 最多返回 15 条
    
    def _fetch_feed(self, feed_config: Dict) -> List[Dict]:
        """获取单个 RSS feed"""
        url = feed_config.get('url')
        name = feed_config.get('name', '未知源')
        content_type = feed_config.get('type', 'podcast')
        filter_keywords = feed_config.get('filter_keywords', [])
        
        # 解析 RSS
        feed = feedparser.parse(url)
        
        items = []
        yesterday = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')  # 2天窗口
        
        for entry in feed.entries:
            # 获取发布时间
            pub_date = self._parse_date(entry)
            if not pub_date or pub_date < yesterday:
                continue
            
            title = entry.get('title', '')
            
            # 关键词过滤（如果有设置）
            if filter_keywords and not self._matches_keywords(title, filter_keywords):
                continue
            
            # 获取描述/摘要
            summary = entry.get('summary', '')
            if not summary:
                summary = entry.get('description', '')
            
            # 获取音频链接（播客）
            audio_url = None
            if content_type == 'podcast':
                # 查找 enclosure
                if 'enclosures' in entry and entry.enclosures:
                    for enc in entry.enclosures:
                        if enc.get('type', '').startswith('audio/'):
                            audio_url = enc.get('href')
                            break
            
            items.append({
                'source': name,
                'type': content_type.capitalize(),  # Podcast/Newsletter/Blog
                'title': title,
                'summary': summary[:400] + '...' if len(summary) > 400 else summary,
                'url': entry.get('link', ''),
                'audio_url': audio_url,
                'published': pub_date,
                'author': entry.get('author', name)
            })
        
        return items
    
    def _parse_date(self, entry) -> str:
        """解析发布时间"""
        date_fields = ['published', 'updated', 'pubDate', 'created', 'dc:date']
        for field in date_fields:
            if field in entry:
                date_str = entry[field]
                try:
                    # 尝试多种格式
                    for fmt in ['%Y-%m-%d', '%a, %d %b %Y', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S%z']:
                        try:
                            if fmt == '%Y-%m-%dT%H:%M:%S%z' and '+' in date_str:
                                dt = datetime.strptime(date_str[:19], '%Y-%m-%dT%H:%M:%S')
                            else:
                                dt = datetime.strptime(date_str[:len(fmt)], fmt)
                            return dt.strftime('%Y-%m-%d')
                        except:
                            continue
                except:
                    pass
        return datetime.now().strftime('%Y-%m-%d')
    
    def _matches_keywords(self, title: str, keywords: List[str]) -> bool:
        """检查标题是否匹配关键词"""
        title_lower = title.lower()
        for kw in keywords:
            if kw.lower() in title_lower:
                return True
        return True  # 如果没有关键词限制，默认通过


if __name__ == '__main__':
    # 测试
    config = {
        'rss_feeds': [
            {'name': 'Lex Fridman', 'url': 'https://lexfridman.com/feed/podcast/', 'filter_keywords': ['AI']},
            {'name': 'Import AI', 'url': 'https://importai.substack.com/feed', 'type': 'newsletter'}
        ]
    }
    fetcher = PodcastFetcher(config)
    items = fetcher.fetch()
    for i in items[:5]:
        print(f"[{i['type']}] {i['source']}: {i['title'][:50]}...")
