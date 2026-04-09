"""
daily_briefing.py - 每日情报简报生成器
生成 08:00 早报和 18:00 晚报
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))
from radar.core import RadarCore
from reports.formatter import ReportFormatter


class DailyBriefing:
    """
    每日情报简报生成器
    - 早报 (morning): 08:00，当日重点 + 昨夜今晨动态
    - 晚报 (evening): 18:00，全天汇总 + 明日预览
    """

    TRACKS_ORDER = ["ai_frontier", "industry_intel", "policy_eco"]

    def __init__(self):
        self.radar = RadarCore()
        self.formatter = ReportFormatter()

    def generate(self, edition: str = "morning") -> dict:
        """
        生成简报
        - edition: "morning" | "evening"
        """
        date_str = datetime.now().strftime("%Y-%m-%d")
        time_label = "🌅 早报" if edition == "morning" else "🌙 晚报"
        title = f"📡 情报{time_label} | {date_str}"

        hours_back = 12 if edition == "morning" else 24

        sections = []

        # 1. 高优先级快讯
        p0_p1_items = []
        for track_id in self.TRACKS_ORDER:
            items = self.radar.store.query(
                track_id,
                since_hours=hours_back,
                min_score=65,
                limit=10
            )
            p0_p1_items.extend(items)

        p0_p1_items.sort(key=lambda x: x.get("_score", 0), reverse=True)
        sections.append(self._section("🔥 重点速览", p0_p1_items[:5]))

        # 2. 各轨道动态
        for track_id in self.TRACKS_ORDER:
            track_cfg = self.radar.get_track_config(track_id)
            items = self.radar.store.query(track_id, since_hours=hours_back, limit=8)
            track_name = track_cfg.get("name", track_id)
            sections.append(self._section(f"📌 {track_name}", items[:5]))

        # 3. 热词趋势
        trending = {}
        for track_id in self.TRACKS_ORDER:
            trending[track_id] = self.radar.get_trending(track_id, hours=hours_back)

        sections.append(self._trending_section(trending))

        # 4. 统计摘要
        stats = {}
        for track_id in self.TRACKS_ORDER:
            stats[track_id] = self.radar.get_stats(track_id)
        sections.append(self._stats_section(stats))

        # 组装报告
        report_md = self._assemble(title, sections, edition)

        return {
            "title": title,
            "edition": edition,
            "date": date_str,
            "sections": sections,
            "markdown": report_md,
            "feishu_card": self._to_feishu_card(sections, title),
        }

    def _section(self, heading: str, items: list) -> dict:
        lines = []
        for item in items:
            lvl = item.get("_alert_level", "")
            score = item.get("_score", 0)
            title_text = item.get("title", "无标题")[:60]
            ago = item.get("_time_ago", "")
            src = item.get("_source_label", "")
            kws = ", ".join(item.get("matched_keywords", [])[:3])
            lines.append(f"- [{lvl}|{score}] {src} {ago}: **{title_text}**" + (f" 🏷️{kws}" if kws else ""))
        return {"heading": heading, "items": items, "text": "\n".join(lines) if lines else "_暂无情报_"}

    def _trending_section(self, trending: dict) -> dict:
        all_trending = []
        for track_id, words in trending.items():
            for word, count in list(words.items())[:5]:
                all_trending.append((word, count, track_id))
        all_trending.sort(key=lambda x: x[1], reverse=True)
        top = all_trending[:15]
        text = " | ".join([f"`{w[0]}`({w[1]})" for w in top]) if top else "_暂无数据_"
        return {"heading": "📈 热词趋势 (Top15)", "text": text}

    def _stats_section(self, stats: dict) -> dict:
        lines = []
        for track_id, s in stats.items():
            track_cfg = self.radar.get_track_config(track_id)
            name = track_cfg.get("name", track_id)
            lines.append(
                f"- **{name}**: {s.get('total',0)}条 | 均分{s.get('avg_score','?')} | "
                f"🔥{s.get('p0_count',0)} ⚠️{s.get('p1_count',0)}"
            )
        return {"heading": "📊 情报统计 (7日)", "text": "\n".join(lines)}

    def _assemble(self, title: str, sections: list, edition: str) -> str:
        lines = [f"# {title}", ""]
        greeting = "☀️ 新的一天，从情报开始" if edition == "morning" else "🌙 今日情报总结"
        lines.append(f"*{greeting}*")
        lines.append("")

        for sec in sections:
            lines.append(f"## {sec['heading']}")
            lines.append(sec["text"])
            lines.append("")

        return "\n".join(lines)

    def _to_feishu_card(self, sections: list, title: str) -> dict:
        elements = []
        for sec in sections[:4]:
            content = f"**{sec['heading']}**\n{sec['text'][:300]}"
            elements.append({"tag": "div", "text": {"tag": "lark_md", "content": content}})
            elements.append({"tag": "hr"})

        return {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {"tag": "plain_text", "content": title},
                    "template": "blue"
                },
                "elements": elements
            }
        }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--edition", default="morning", choices=["morning", "evening"])
    args = parser.parse_args()

    report = DailyBriefing().generate(args.edition)
    print(report["markdown"])
    print("\n[已生成飞书卡片格式]")
