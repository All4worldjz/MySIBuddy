#!/usr/bin/env python3
"""AI News Hub 主调度器"""

import yaml
import json
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict
import os
import sys

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetchers import ArxivFetcher, HNFetcher, RedditFetcher, ZhFetcher, PodcastFetcher
from summarizer import GeminiSummarizer
from pusher import TelegramPusher

class NewsHub:
    """AI News Hub 主控制器"""
    
    def __init__(self, config_path: str = 'config.yaml'):
        self.config = self._load_config(config_path)
        self.db_path = self.config.get('storage', {}).get('db_path', 'data/news.db')
        self._init_db()
        
        # 初始化组件
        self.summarizer = GeminiSummarizer()
        self.pusher = TelegramPusher(
            self.config.get('telegram', {}).get('target_session')
        )
        
        # 初始化抓取器
        self.fetchers = {}
        sources = self.config.get('sources', {})
        
        if sources.get('arxiv', {}).get('enabled', False):
            self.fetchers['arxiv'] = ArxivFetcher(sources['arxiv'])
        
        if sources.get('hackernews', {}).get('enabled', False):
            self.fetchers['hn'] = HNFetcher(sources['hackernews'])
        
        if sources.get('reddit', {}).get('enabled', False):
            self.fetchers['reddit'] = RedditFetcher(sources['reddit'])
        
        if sources.get('zh_sources', {}).get('enabled', False):
            self.fetchers['zh'] = ZhFetcher(sources['zh_sources'])
        
        if sources.get('podcasts', {}).get('enabled', False):
            self.fetchers['podcasts'] = PodcastFetcher(sources['podcasts'])
    
    def _load_config(self, path: str) -> Dict:
        """加载配置"""
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _init_db(self):
        """初始化数据库"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                source TEXT NOT NULL,
                type TEXT,
                published TEXT,
                fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
                summary TEXT,
                pushed BOOLEAN DEFAULT 0
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def run(self):
        """执行完整流程"""
        print(f"[{datetime.now()}] AI News Hub 启动")
        
        # 1. 抓取
        all_articles = []
        for name, fetcher in self.fetchers.items():
            print(f"[{datetime.now()}] 正在抓取 {name}...")
            try:
                articles = fetcher.fetch()
                print(f"[{datetime.now()}] {name}: 获取 {len(articles)} 条")
                all_articles.extend(articles)
            except Exception as e:
                print(f"[{datetime.now()}] {name} 抓取失败: {e}")
        
        print(f"[{datetime.now()}] 共获取 {len(all_articles)} 条原始内容")
        
        # 2. 去重
        unique_articles = self._deduplicate(all_articles)
        print(f"[{datetime.now()}] 去重后: {len(unique_articles)} 条")
        
        # 3. 存储新文章
        new_articles = self._store_new(unique_articles)
        print(f"[{datetime.now()}] 新增: {len(new_articles)} 条")
        
        # 4. 生成摘要（限制数量）
        max_summarize = self.config.get('summarizer', {}).get('max_articles_per_source', 5)
        articles_to_summarize = self._select_for_summarize(new_articles, max_summarize)
        
        print(f"[{datetime.now()}] 生成摘要: {len(articles_to_summarize)} 条")
        for article in articles_to_summarize:
            try:
                if article.get('type') == '论文':
                    summary = self.summarizer.summarize_paper(article)
                else:
                    summary = self.summarizer.summarize_community(article)
                article['summary_data'] = summary
            except Exception as e:
                print(f"[{datetime.now()}] 摘要生成失败: {e}")
                article['summary_data'] = {
                    'one_line': '摘要生成失败',
                    'method': '请查看原文',
                    'significance': ''
                }
        
        # 5. 生成推送内容
        if articles_to_summarize:
            message = self.pusher.format_daily_news(articles_to_summarize)
            
            # 保存到文件（供外部推送使用）
            output_file = f"data/daily_{datetime.now().strftime('%Y%m%d')}.txt"
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(message)
            
            print(f"[{datetime.now()}] 推送内容已保存到: {output_file}")
            
            # 推送到 tech-mentor
            target_session = self.pusher.get_session_key()
            print(f"[{datetime.now()}] 推送到: {target_session}")
            
            try:
                self._send_to_session(target_session, message)
                print(f"[{datetime.now()}] 推送成功")
            except Exception as e:
                print(f"[{datetime.now()}] 推送失败: {e}")
            
            # 打印预览
            print("\n" + "="*50)
            print("推送预览:")
            print("="*50)
            print(message[:1000] + "..." if len(message) > 1000 else message)
            print("="*50)
        else:
            print(f"[{datetime.now()}] 无新内容，跳过推送")
        
        # 6. 清理旧数据
        self._cleanup_old()
        
        print(f"[{datetime.now()}] AI News Hub 完成")
    
    def _deduplicate(self, articles: List[Dict]) -> List[Dict]:
        """基于 URL 去重"""
        seen = set()
        unique = []
        for a in articles:
            url = a.get('url', '')
            if url and url not in seen:
                seen.add(url)
                unique.append(a)
        return unique
    
    def _store_new(self, articles: List[Dict]) -> List[Dict]:
        """存储新文章，返回真正新增的文章"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        new_articles = []
        for article in articles:
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO articles 
                    (url, title, source, type, published)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    article.get('url'),
                    article.get('title'),
                    article.get('source'),
                    article.get('type'),
                    article.get('published')
                ))
                
                if cursor.rowcount > 0:
                    new_articles.append(article)
            except Exception as e:
                print(f"存储失败: {e}")
        
        conn.commit()
        conn.close()
        return new_articles
    
    def _select_for_summarize(self, articles: List[Dict], max_per_source: int) -> List[Dict]:
        """选择要生成摘要的文章"""
        # 按源分组
        by_source = {}
        for a in articles:
            source = a.get('source', 'unknown')
            if source not in by_source:
                by_source[source] = []
            by_source[source].append(a)
        
        # 每个源最多取 max_per_source 条
        selected = []
        for source, items in by_source.items():
            # 按相关性/分数排序
            items.sort(key=lambda x: x.get('relevance_score', x.get('score', 0)), reverse=True)
            selected.extend(items[:max_per_source])
        
        return selected
    
    def _send_to_session(self, session_key: str, message: str):
        """推送到指定会话 - 通过写入文件由外部脚本处理"""
        # 保存推送内容到标记文件，由 cron 脚本或外部工具读取并推送
        push_marker = f"/home/admin/ai-news-hub/data/push_pending_{datetime.now().strftime('%Y%m%d')}"
        with open(push_marker, 'w', encoding='utf-8') as f:
            f.write(session_key + '\n')
            f.write(message[:4000])  # Telegram 限制
        
        print(f"[{datetime.now()}] 推送内容已标记: {push_marker}")
        print(f"[{datetime.now()}] 请手动执行: openclaw sessions send --session-key {session_key}")
    
    def _cleanup_old(self):
        """清理旧数据"""
        retention = self.config.get('storage', {}).get('retention_days', 7)
        cutoff = (datetime.now() - timedelta(days=retention)).strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM articles WHERE published < ?', (cutoff,))
        conn.commit()
        conn.close()
        
        print(f"[{datetime.now()}] 已清理 {retention} 天前的数据")


if __name__ == '__main__':
    hub = NewsHub()
    hub.run()
