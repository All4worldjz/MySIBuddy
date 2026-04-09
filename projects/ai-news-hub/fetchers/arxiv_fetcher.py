#!/usr/bin/env python3
"""arXiv 论文抓取器"""

import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import List, Dict
import re

class ArxivFetcher:
    """抓取 arXiv cs.AI/cs.LG/cs.CL 最新论文"""
    
    API_URL = "http://export.arxiv.org/api/query"
    
    def __init__(self, config: Dict):
        self.config = config
        self.categories = config.get('categories', ['cs.AI', 'cs.LG', 'cs.CL'])
        self.keywords = [k.lower() for k in config.get('keywords', [])]
        self.max_results = config.get('max_results', 50)
        
    def fetch(self) -> List[Dict]:
        """获取最近 24 小时的论文"""
        # 构建查询：分类 OR 连接
        cat_query = '+OR+'.join([f'cat:{cat}' for cat in self.categories])
        
        # 计算昨天日期
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        params = {
            'search_query': cat_query,
            'sortBy': 'submittedDate',
            'sortOrder': 'descending',
            'max_results': self.max_results
        }
        
        try:
            response = requests.get(self.API_URL, params=params, timeout=30)
            response.raise_for_status()
            return self._parse_feed(response.text, yesterday)
        except Exception as e:
            print(f"[arXiv] 抓取失败: {e}")
            return []
    
    def _parse_feed(self, xml_content: str, since_date: str) -> List[Dict]:
        """解析 Atom feed"""
        root = ET.fromstring(xml_content)
        
        # Atom 命名空间
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        papers = []
        for entry in root.findall('atom:entry', ns):
            # 获取发布时间
            published = entry.find('atom:published', ns)
            if published is None:
                continue
            pub_date = published.text[:10]  # YYYY-MM-DD
            
            # 只取最近 24 小时
            if pub_date < since_date:
                continue
            
            title = entry.find('atom:title', ns).text or ''
            summary = entry.find('atom:summary', ns).text or ''
            link = entry.find('atom:id', ns).text or ''
            
            # 获取分类
            categories = [cat.get('term') for cat in entry.findall('atom:category', ns)]
            
            # 相关性检查
            relevance_score = self._check_relevance(title, summary)
            if relevance_score == 0:
                continue
            
            papers.append({
                'source': 'arXiv',
                'type': '论文',
                'title': title.replace('\n', ' ').strip(),
                'summary': summary[:500] + '...' if len(summary) > 500 else summary,
                'url': link,
                'published': pub_date,
                'categories': categories,
                'relevance_score': relevance_score
            })
        
        # 按相关性排序
        papers.sort(key=lambda x: x['relevance_score'], reverse=True)
        return papers[:10]  # 最多返回 10 篇
    
    def _check_relevance(self, title: str, summary: str) -> int:
        """检查相关性，返回评分（0-100）"""
        text = (title + ' ' + summary).lower()
        score = 0
        
        # 关键词匹配
        for kw in self.keywords:
            if kw in text:
                score += 10
        
        # 标题匹配权重更高
        title_lower = title.lower()
        for kw in self.keywords:
            if kw in title_lower:
                score += 20
        
        # 排除纯硬件/数据集论文
        exclude_patterns = [
            r'gpu\s+cluster',
            r'dataset\s+only',
            r'hardware\s+acceleration',
        ]
        for pattern in exclude_patterns:
            if re.search(pattern, text):
                score -= 30
        
        return max(0, min(100, score))


if __name__ == '__main__':
    # 测试
    config = {
        'categories': ['cs.AI', 'cs.LG'],
        'keywords': ['LLM', 'transformer', 'reasoning'],
        'max_results': 20
    }
    fetcher = ArxivFetcher(config)
    papers = fetcher.fetch()
    for p in papers[:3]:
        print(f"[{p['relevance_score']}] {p['title'][:60]}...")
