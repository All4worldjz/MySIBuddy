"""
flash_report.py - 突发快讯生成器
当扫描发现 P0/P1 高优先级情报时，自动触发
"""
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
from reports.formatter import ReportFormatter


class FlashReport:
    """
    突发快讯：即时生成针对单一高优先级情报的专报
    """

    def __init__(self):
        self.formatter = ReportFormatter()

    def generate(self, item: dict, context: list = None) -> dict:
        """
        为单条 P0/P1 情报生成快讯
        - item: 高优先级情报条目
        - context: 相关联的情报列表（同一事件的多个来源）
        """
        now = datetime.now().strftime("%H:%M")
        title = f"🚨 突发快讯 | {now}"

        # 影响评估
        score = item.get("_score", 0)
        if score >= 80:
            impact = "🔴 **极高影响** - 建议立即关注"
        elif score >= 65:
            impact = "🟠 **高影响** - 建议今日内处理"
        else:
            impact = "🟡 **中等影响** - 持续跟踪"

        # 建议动作
        source = item.get("source", "")
        action = self._get_action(item)

        # 组装内容
        content_lines = [
            f"## {item.get('title', '无标题')}",
            "",
            f"**等级**: {item.get('_alert_level', 'P?')} | **得分**: {score} | **来源**: {item.get('_source_label', '')}",
            "",
            f"**时间**: {item.get('_time_ago', '')} | **命中词**: {', '.join(item.get('matched_keywords', [])[:5])}",
            "",
            f"**影响评估**: {impact}",
            "",
            f"**内容摘要**: {item.get('content', item.get('raw', {}).get('text', ''))[:300]}...",
            "",
            f"**建议动作**: {action}",
        ]

        if item.get("url"):
            content_lines.append(f"\n🔗 [查看原文]({item['url']})")

        # 关联报道
        if context and len(context) > 1:
            content_lines.append("")
            content_lines.append("**关联报道**:")
            for c in context[:3]:
                src = c.get("_source_label", "📌")
                t = c.get("title", "")[:60]
                content_lines.append(f"- {src}: {t}")

        report_md = "\n".join(content_lines)

        return {
            "title": title,
            "item": item,
            "impact": impact,
            "action": action,
            "markdown": report_md,
            "feishu_card": self.formatter.to_flash_alert(item),
        }

    def _get_action(self, item: dict) -> str:
        """根据情报类型给出建议动作"""
        title = item.get("title", "").lower()
        content = item.get("content", "").lower()
        combined = title + " " + content

        if any(k in combined for k in ["gpt-5", "claude 4", "gemini 3", "agi", "breakthrough"]):
            return "1. 评估对现有 AI 业务的影响\n2. 24h内输出技术分析简报\n3. 通知 tech-mentor"
        elif any(k in combined for k in ["招投标", "单一来源", "政采", "大单"]):
            return "1. 查询招标文件细节\n2. 评估金山云竞争力\n3. 通知销售团队"
        elif any(k in combined for k in ["政策", "监管", "网信办", "工信部", "办法"]):
            return "1. 确认政策原文\n2. 评估合规影响\n3. 联系法务"
        elif any(k in combined for k in ["融资", "收购", "并购", "上市"]):
            return "1. 评估市场竞争格局变化\n2. 关注被投方技术路线"
        else:
            return "1. 持续跟踪后续发展\n2. 评估与业务的关联度"
