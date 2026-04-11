# Intelligence Radar Heritage — 情报雷达系统

**Date:** 2026-04-11  
**Source:** `workspace-chief/intelligence-radar/`  
**Destination:** `oracle` (Learning + R&D + Wisdom)  
**Status:** ✅ Preserved for migration

---

## 1. System Overview

**情报雷达 (Intelligence Radar) v1.0** — Multi-source intelligence real-time tracking and AI-powered analysis system.

**Purpose:** Provide CC with AI frontier, industry trends, policy changes, and competitive intelligence via **scheduled + on-demand** dual-mode monitoring.

---

## 2. Core Capabilities (Inherited)

| Capability | Description | Owner |
|------------|-------------|-------|
| 🌐 **Multi-source sensing** | Twitter/X, GitHub, blog RSS, web search, Feishu messages | oracle |
| 🧠 **Intelligent fusion** | Deduplication, clustering, importance scoring, trend detection | oracle |
| 📊 **Graded reports** | 《情报早报》(08:00), 《情报晚报》(18:00), 《突发快讯》(real-time) | oracle |
| 🔔 **Alert levels** | 🔥 P0 Emergency / ⚠️ P1 Important / 📌 P2 Routine | oracle |
| ⏰ **Scheduled tasks** | Daily 08:00 morning brief, 18:00 evening brief, real-time flash | oracle |
| 🔍 **On-demand search** | User-initiated targeted intelligence queries | oracle |

---

## 3. Three Intelligence Tracks

### Track 1: AI Frontier (AI 前沿)
**Owner:** oracle

- Large model progress / paper interpretations / open source updates
- **Core focus:** Hinton, LeCun, Karpathy, Bengio, Musk, OpenAI, Anthropic, Google DeepMind

### Track 2: Industry Intelligence (政企云 & AI 行业)
**Owner:** trinity (for work relevance) + oracle (for AI relevance)

- Government cloud market / bidding / industry reports / competitor dynamics
- **Core focus:** 阿里云，华为云，腾讯云，天翼云，政务云，数据要素

### Track 3: Policy & Ecosystem (政策与生态)
**Owner:** architect (for strategic impact) + oracle (for AI policy)

- AI regulation / data laws / industry standards / open source ecosystem
- **Core focus:** 网信办，工信部，信通院，数据局

---

## 4. Technical Architecture (Preserved)

```
User config (tracks/)
    ↓
Sensor dispatcher (radar/core.py)
    ├─ xurl_sensor     → Twitter/X search
    ├─ gh_sensor       → GitHub Issues/PR/Commits
    ├─ blog_sensor     → Blog RSS feeds
    ├─ web_sensor      → Tavily/Web search
    ├─ summarize_engine → Content summarization
    └─ fusion_engine   → Dedup, scoring, clustering
    ↓
Intelligence KB (store/)
    ↓
Report generator (reports/)
    ├─ Morning brief (08:00)
    ├─ Evening brief (18:00)
    └─ Flash report (real-time)
    ↓
Feishu/WeChat/Email notification (notify/)
```

---

## 5. Alert Level Definitions (Inherited)

| Level | Tag | Trigger Condition | Delivery |
|-------|-----|-------------------|----------|
| **P0 Emergency** | 🔥 | Strategic news (e.g., OpenAI releases GPT-5) | Real-time push |
| **P1 Important** | ⚠️ | Major government deal / policy change | Within 4 hours |
| **P2 Routine** | 📌 | General industry updates | Merged into morning/evening briefs |

---

## 6. Scoring Algorithm (Preserved)

```
Importance Score = 
  Source Weight (xurl:2.0, gh:1.5, blog:1.8, web:1.0)
  × Keyword Hit Density (0.5~2.0)
  × Time Decay (24h:1.0, 48h:0.7, 72h:0.4)
  × Engagement Signal (likes/stars/PR count) (0.5~1.5)
```

---

## 7. File Structure (For Reference)

```
intelligence-radar/
├── SPEC.md                    # This spec document
├── config/
│   └── tracks.json            # Intelligence track config (user-editable)
├── radar/
│   ├── __init__.py
│   ├── core.py                # Main sensor dispatcher
│   ├── sensors/
│   │   ├── __init__.py
│   │   ├── xurl_sensor.py     # Twitter/X sensor
│   │   ├── gh_sensor.py       # GitHub sensor
│   │   ├── blog_sensor.py     # Blog sensor
│   │   └── web_sensor.py      # Web search sensor
│   ├── fusion.py              # Information fusion engine
│   ├── store.py               # Intelligence KB storage
│   ├── scoring.py             # Importance scoring engine
│   └── dedup.py               # Deduplication & clustering
├── reports/
│   ├── __init__.py
│   ├── daily_briefing.py      # Morning brief
│   ├── evening_briefing.py    # Evening brief
│   └── flash_report.py        # Flash report
├── notify/
│   ├── feishu_notifier.py     # Feishu notifications
│   └── formatter.py           # Report formatting
├── scripts/
│   ├── run_radar.py           # On-demand query CLI
│   ├── run_daily.py           # Scheduled brief script
│   └── setup_cron.py          # Cron task registration
└── summaries/                 # Intelligence cache
```

---

## 8. Cron Jobs to Migrate

| Job ID | Name | Schedule | New Owner |
|--------|------|----------|-----------|
| `51289580-1da1-41f5-af4b-0c05afc19f01` | 情报雷达 - 早报 (08:00) | Daily 08:00 | oracle |
| `ee5c4b7e-47e6-4a36-9358-047fe29ed705` | 情报雷达 - 晚报 (18:00) | Daily 18:00 | oracle |
| `1065752e-5f5a-44ad-b2a4-a6519f17b5dd` | 情报雷达 - 突发检测 (每 4h) | Every 4h | oracle |
| `85b2866b-df30-4791-9b4e-8691a53d62e8` | GPU/CPU/内存/硬盘/AIDC 建设情报 | Daily 06:40 | oracle + architect |

---

## 9. Migration Notes

**What to Preserve:**
- ✅ All sensor scripts (xurl, gh, blog, web)
- ✅ Fusion engine (dedup, scoring, clustering)
- ✅ Report templates (morning, evening, flash)
- ✅ Track configurations (AI frontier, industry, policy)
- ✅ Alert level definitions
- ✅ Scoring algorithm

**What to Adapt:**
- 🔄 Delivery channel: Feishu → Telegram (per CC's channel preference)
- 🔄 Owner: chief-of-staff → oracle
- 🔄 Cron job agent references updated

**What to Deprecate:**
- ❌ Email notifications (CC prefers Telegram)
- ❌ WeChat notifications (CC prefers Telegram)

---

## 10. Post-Migration TODOs

1. **oracle** reviews all sensor scripts for compatibility
2. **oracle** tests fusion engine with sample data
3. **link** updates cron jobs to point to oracle
4. **CC** validates morning/evening brief format
5. **neo** monitors first week of intelligence delivery

---

**Version:** v1.0 (2026-04-11)  
**Inherited from:** chief-of-staff intelligence-radar  
**Owned by:** oracle (Learning + R&D + Wisdom)  
**Next Review:** 2026-05-11 (30 days post-migration)
