"""
feishu_notifier.py - 飞书推送模块
将情报报告通过飞书机器人/应用推送
"""
import json
from typing import Dict, List, Optional


class FeishuNotifier:
    """
    飞书消息推送
    - 早晚报: 生成飞书文档 → 推送链接
    - 突发快讯: 直接推送卡片消息
    """

    # 飞书文档文件夹（来自 MEMORY.md）
    FOLDER_TOKEN = "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"  # 小春文件柜

    def __init__(self):
        self.api_base = "https://open.feishu.cn/open-apis"

    def notify_briefing(self, report: dict, recipients: List[str] = None) -> dict:
        """
        推送每日简报
        1. 创建飞书文档
        2. 推送卡片消息含文档链接
        """
        # 1. 创建飞书文档
        doc_result = self._create_doc(
            title=report["title"],
            content=report["markdown"],
            folder_token=self.FOLDER_TOKEN
        )

        doc_token = doc_result.get("doc_token") or doc_result.get("document_id", "")
        doc_url = doc_result.get("url", "")

        # 2. 推送卡片消息
        card = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {"tag": "plain_text", "content": f"📡 {report['title']}"},
                    "template": "blue"
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": f"📄 情报简报已生成，共 **{len(report['sections'])}** 个板块\n"
                                       f"📅 {report['date']} {report['edition']}"
                        }
                    },
                    {"tag": "hr"},
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "a",
                                "text": {"tag": "lark_md", "content": "📖 查看完整报告"},
                                "type": "primary",
                                "url": doc_url or f"https://feishu.cn/docx/{doc_token}"
                            }
                        ]
                    }
                ]
            }
        }

        return {
            "doc_created": bool(doc_token),
            "doc_token": doc_token,
            "doc_url": doc_url,
            "notification_sent": True,
            "card": card,
        }

    def notify_flash(self, flash_report: dict) -> dict:
        """
        推送突发快讯（高优先级卡片，直接发消息）
        """
        item = flash_report.get("item", {})
        score = item.get("_score", 0)

        card = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": f"🚨 突发快讯 [P0/P1] 得分:{score}"
                    },
                    "template": "red" if score >= 80 else "orange"
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": f"**{item.get('title','')}**"
                        }
                    },
                    {"tag": "hr"},
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": flash_report.get("impact", "")
                        }
                    },
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": f"> {item.get('content','')[:200]}..."
                        }
                    },
                    {"tag": "hr"},
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": f"🏷️ {', '.join(item.get('matched_keywords',[])[:5])}"
                        }
                    },
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "a",
                                "text": {"tag": "lark_md", "content": "🔗 查看详情"},
                                "type": "primary",
                                "url": item.get("url", "")
                            }
                        ]
                    } if item.get("url") else {"tag": "div", "text": {"tag": "lark_md", "content": ""}}
                ]
            }
        }

        return {"notification_sent": True, "card": card}

    def _create_doc(self, title: str, content: str, folder_token: str) -> dict:
        """
        创建飞书云文档
        使用 feishu_create_doc 工具（由 OpenClaw agent 执行）
        这里返回指令结构
        """
        return {
            "instruction": "feishu_create_doc",
            "title": title,
            "content": content,
            "folder_token": folder_token,
        }
