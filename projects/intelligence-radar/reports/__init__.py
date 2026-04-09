"""
reports/__init__.py - 报告生成模块
"""
from .formatter import ReportFormatter
from .daily_briefing import DailyBriefing
from .flash_report import FlashReport

__all__ = ["ReportFormatter", "DailyBriefing", "FlashReport"]
