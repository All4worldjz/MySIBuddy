#!/usr/bin/env python3
"""Telegram 推送器"""

import json
from datetime import datetime
from typing import List, Dict

class TelegramPusher:
    """生成 Telegram 格式的推送内容"""
    
    def __init__(self, target_session: str = None):
        self.target_session = target_session
    
    def format_daily_news(self, articles: List[Dict], date: str = None) -> str:
        """格式化每日新闻"""
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        lines = [
            f"📰 AI 日报 | {date}",
            "",
            "━━━━━━━━━━━━━━━━━━━━━━━",
            ""
        ]
        
        # 分类展示
        papers = [a for a in articles if a.get('type') == '论文']
        hns = [a for a in articles if a.get('source') == 'Hacker News']
        reddits = [a for a in articles if 'Reddit' in a.get('source', '')]
        zhs = [a for a in articles if a.get('type') == '中文']
        
        # 论文
        if papers:
            lines.append("🔬 **最新论文**")
            lines.append("")
            for i, p in enumerate(papers[:5], 1):
                lines.extend(self._format_paper(p, i))
                lines.append("")
        
        # HN 热帖
        if hns:
            lines.append("🔥 **Hacker News 热门**")
            lines.append("")
            for i, h in enumerate(hns[:3], 1):
                lines.extend(self._format_community(h, i))
                lines.append("")
        
        # Reddit 讨论
        if reddits:
            lines.append("💬 **Reddit 热门讨论**")
            lines.append("")
            for i, r in enumerate(reddits[:3], 1):
                lines.extend(self._format_community(r, i))
                lines.append("")
        
        # 中文源
        if zhs:
            lines.append("🇨🇳 **中文资讯**")
            lines.append("")
            for i, z in enumerate(zhs[:3], 1):
                lines.extend(self._format_zh(z, i))
                lines.append("")
        
        # 播客/Newsletter/博客
        podcasts = [a for a in articles if a.get('type') in ['Podcast', 'Newsletter', 'Blog']]
        if podcasts:
            lines.append("🎙️ **专家观点**")
            lines.append("")
            for i, p in enumerate(podcasts[:5], 1):
                lines.extend(self._format_podcast(p, i))
                lines.append("")
        
        lines.append("━━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("")
        lines.append("💡 AI News Hub 自动生成")
        
        return '\n'.join(lines)
    
    def _format_paper(self, article: Dict, index: int) -> List[str]:
        """格式化论文"""
        summary = article.get('summary_data', {})
        lines = [
            f"{index}. **{article.get('title', '无标题')}**",
            f"   📌 {summary.get('one_line', '暂无摘要')}",
            f"   🔬 {summary.get('method', '')}",
            f"   🎯 {summary.get('significance', '')}",
            f"   📎 [{article.get('source', 'arXiv')}]({article.get('url', '')})"
        ]
        return lines
    
    def _format_community(self, article: Dict, index: int) -> List[str]:
        """格式化社区内容"""
        summary = article.get('summary_data', {})
        score = article.get('score', 0)
        
        lines = [
            f"{index}. **{article.get('title', '无标题')}**",
            f"   📌 {summary.get('one_line', '暂无摘要')}",
        ]
        
        key_points = summary.get('key_points', [])
        if key_points:
            lines.append(f"   💡 {' | '.join(key_points[:2])}")
        
        lines.append(f"   📊 热度 {score} | 📎 [链接]({article.get('url', '')})")
        
        return lines
    
    def _format_zh(self, article: Dict, index: int) -> List[str]:
        """格式化中文内容"""
        lines = [
            f"{index}. **{article.get('title', '无标题')}**",
            f"   📎 [{article.get('source', '')}]({article.get('url', '')})"
        ]
        return lines
    
    def _format_podcast(self, article: Dict, index: int) -> List[str]:
        """格式化播客/Newsletter/博客"""
        summary = article.get('summary_data', {})
        content_type = article.get('type', 'Podcast')
        
        # 图标
        icon = "🎙️" if content_type == "Podcast" else ("📧" if content_type == "Newsletter" else "📝")
        
        lines = [
            f"{index}. {icon} **{article.get('title', '无标题')}**",
            f"   👤 {article.get('author', article.get('source', ''))}",
        ]
        
        if summary.get('one_line'):
            lines.append(f"   📌 {summary['one_line']}")
        
        # 音频链接（播客）
        if article.get('audio_url'):
            lines.append(f"   🔊 [收听]({article['audio_url']})")
        
        lines.append(f"   📎 [原文]({article.get('url', '')})")
        
        return lines
    
    def get_session_key(self) -> str:
        """获取目标会话 key"""
        return self.target_session or "agent:tech-mentor:telegram:direct:8606756625"


if __name__ == '__main__':
    # 测试
    pusher = TelegramPusher()
    
    test_articles = [
        {
            'type': '论文',
            'source': 'arXiv',
            'title': 'Test Paper on LLMs',
            'url': 'https://arxiv.org/abs/1234',
            'summary_data': {
                'one_line': '提出新的 LLM 架构',
                'method': '使用 Transformer 改进',
                'significance': '提升 15% 性能'
            }
        },
        {
            'source': 'Hacker News',
            'type': '热帖',
            'title': 'OpenAI 发布新模型',
            'url': 'https://news.ycombinator.com/item?id=123',
            'score': 250,
            'summary_data': {
                'one_line': '社区热议新模型',
                'key_points': ['性能提升', '价格下降']
            }
        }
    ]
    
    output = pusher.format_daily_news(test_articles)
    print(output)
