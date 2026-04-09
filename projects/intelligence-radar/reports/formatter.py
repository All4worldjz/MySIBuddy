"""
formatter.py - 情报报告格式化器
支持: text / markdown / 飞书文档
"""


class ReportFormatter:
    """将情报列表格式化为不同格式的报告"""

    def to_text(self, items: list, title: str = "情报报告") -> str:
        lines = [f"{'='*60}", f"  {title}", f"{'='*60}", ""]
        for i, item in enumerate(items, 1):
            lvl = item.get("_alert_level", "P?")
            score = item.get("_score", 0)
            title_text = item.get("title", "无标题")
            ago = item.get("_time_ago", "")
            src = item.get("_source_label", "📌")
            url = item.get("url", "")

            lines.append(f"{i}. [{lvl}|{score}] {src} {ago}")
            lines.append(f"   {title_text[:75]}")
            if url:
                lines.append(f"   → {url[:80]}")
            lines.append("")
        return "\n".join(lines)

    def to_markdown(self, items: list, track: str = "情报") -> str:
        lines = [f"# 🛰️ 情报报告 | {track}", ""]
        for i, item in enumerate(items[:20], 1):
            lvl = item.get("_alert_level", "P?")
            score = item.get("_score", 0)
            title_text = item.get("title", "无标题")
            url = item.get("url", "")
            ago = item.get("_time_ago", "")
            src = item.get("_source_label", "📌")
            content = item.get("content", "")[:150]
            kws = ", ".join(item.get("matched_keywords", [])[:5])

            lvl_emoji = {"P0": "🔴", "P1": "🟠", "P2": "🟡", "P3": "⚪"}.get(lvl, "⚪")
            lines.append(f"## {i}. {lvl_emoji} {title_text}")
            lines.append("")
            lines.append(f"- **等级**: {lvl} | **得分**: {score} | **来源**: {src} | **时间**: {ago}")
            if url:
                lines.append(f"- **链接**: {url}")
            if content:
                lines.append(f"- **摘要**: {content}...")
            if kws:
                lines.append(f"- **标签**: {kws}")
            lines.append("")
        return "\n".join(lines)

    def to_feishu_card(self, items: list, title: str = "情报速报") -> dict:
        """生成飞书消息卡片格式"""
        elements = []
        for item in items[:8]:  # 飞书卡片限制
            lvl = item.get("_alert_level", "P?")
            title_text = item.get("title", "无标题")[:50]
            url = item.get("url", "")
            ago = item.get("_time_ago", "")
            score = item.get("_score", 0)
            src = item.get("_source_label", "📌")

            tag = {
                "P0": {"tag": "red", "content": "🔴紧急"},
                "P1": {"tag": "orange", "content": "🟠重要"},
                "P2": {"tag": "blue", "content": "🔵常规"},
            }.get(lvl, {"tag": "grey", "content": "⚪"})

            element = {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": (
                        f"**{tag['content']} [{score}]** {src} {ago}\n"
                        f"{title_text}\n"
                        f"{url if url else ''}"
                    )
                }
            }
            elements.append(element)

        return {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {"tag": "plain_text", "content": f"🛰️ {title}"},
                    "template": "red" if any(i.get("_alert_level") == "P0" for i in items) else "blue"
                },
                "elements": elements
            }
        }

    def to_flash_alert(self, item: dict) -> dict:
        """生成单条突发情报的飞书卡片"""
        lvl = item.get("_alert_level", "P?")
        return {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {"tag": "plain_text", "content": f"🚨 突发快讯 [{lvl}]"},
                    "template": "red"
                },
                "elements": [
                    {"tag": "div", "text": {"tag": "lark_md", "content": f"**{item.get('title','')}**"}},
                    {"tag": "hr"},
                    {"tag": "div", "text": {"tag": "lark_md", "content": item.get("content","")[:300]}},
                    {"tag": "div", "text": {"tag": "lark_md", "content": f"来源: {item.get('_source_label','')} | {item.get('_time_ago','')}"}},
                    {"tag": "action", "actions": [
                        {"tag": "a", "text": {"tag": "lark_md", "content": "🔗 查看原文"}, "type": "primary", "url": item.get("url","")}
                    ]} if item.get("url") else {"tag": "div", "text": {"tag": "lark_md", "content": ""}}
                ]
            }
        }
