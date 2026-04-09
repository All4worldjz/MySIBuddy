#!/usr/bin/env python3
"""Gemini 摘要生成器"""

import subprocess
import json
import re
from typing import Dict, List

class GeminiSummarizer:
    """使用 Gemini CLI 生成结构化摘要"""
    
    # 论文摘要 Prompt
    PAPER_PROMPT = '''你是一个专业的 AI 领域学术记者，为技术从业者撰写精炼论文摘要。
规则：
1. 语言：中文（技术词汇保留英文缩写）
2. 风格：简洁、信息密度高，不废话
3. 输出严格遵循以下 JSON 格式，不添加任何额外文字

请为以下 arXiv 论文生成摘要：

标题：{title}
摘要：{summary}
分类：{category}
发布时间：{published}

输出格式（严格 JSON）：
{{
  "one_line": "一句话总结（≤30字）",
  "method": "方法亮点（≤80字）",
  "significance": "意义与影响（≤60字）",
  "tags": ["标签1", "标签2", "标签3"]
}}'''

    # 社区内容摘要 Prompt
    COMMUNITY_PROMPT = '''你是一个 AI 领域社区内容编辑，将热帖转化为精炼摘要。
规则：提取技术实质，过滤噪音，保持客观。

标题：{title}
内容：{content}
来源：{source}
热度：{score}

输出格式（严格 JSON）：
{{
  "one_line": "一句话总结（≤30字）",
  "key_points": ["要点1", "要点2", "要点3"],
  "community_reaction": "社区反应一句话总结",
  "tags": ["标签1", "标签2"]
}}'''

    def __init__(self):
        self.gemini_cmd = 'gemini'
    
    def summarize_paper(self, article: Dict) -> Dict:
        """为论文生成摘要"""
        prompt = self.PAPER_PROMPT.format(
            title=article.get('title', ''),
            summary=article.get('summary', '')[:1000],
            category=', '.join(article.get('categories', [])),
            published=article.get('published', '')
        )
        
        return self._call_gemini(prompt)
    
    def summarize_community(self, article: Dict) -> Dict:
        """为社区内容生成摘要"""
        content = article.get('summary', '')
        if not content:
            content = article.get('title', '')
        
        prompt = self.COMMUNITY_PROMPT.format(
            title=article.get('title', ''),
            content=content[:800],
            source=article.get('source', ''),
            score=article.get('score', 0)
        )
        
        return self._call_gemini(prompt)
    
    def _call_gemini(self, prompt: str) -> Dict:
        """调用 Gemini CLI"""
        try:
            result = subprocess.run(
                [self.gemini_cmd, prompt],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                print(f"[Gemini] 调用失败: {result.stderr}")
                return self._fallback_summary()
            
            # 提取 JSON
            output = result.stdout
            return self._extract_json(output)
            
        except subprocess.TimeoutExpired:
            print("[Gemini] 调用超时")
            return self._fallback_summary()
        except Exception as e:
            print(f"[Gemini] 异常: {e}")
            return self._fallback_summary()
    
    def _extract_json(self, text: str) -> Dict:
        """从 Gemini 输出中提取 JSON"""
        # 尝试直接解析
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        
        # 尝试提取 JSON 块
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        
        # 回退
        return self._fallback_summary()
    
    def _fallback_summary(self) -> Dict:
        """失败时的默认摘要"""
        return {
            "one_line": "内容摘要生成失败",
            "method": "请查看原文获取详情",
            "significance": "无法自动分析",
            "tags": ["AI"]
        }


if __name__ == '__main__':
    # 测试
    summarizer = GeminiSummarizer()
    
    test_article = {
        'title': 'Test Paper Title',
        'summary': 'This is a test abstract about large language models.',
        'categories': ['cs.AI', 'cs.CL'],
        'published': '2026-04-06'
    }
    
    result = summarizer.summarize_paper(test_article)
    print(json.dumps(result, indent=2, ensure_ascii=False))
