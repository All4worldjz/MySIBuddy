# MySiBuddy Founding Decisions

**Date:** 2026-04-11  
**Participants:** CC (春哥, founder) + Neo (chief-of-staff)  
**Status:** All decisions locked, documented, ready for Claude Code execution

---

## 📋 Decision Log

### Decision 1: Agent System Redesign (9→8 Agents)
**Question:** Consolidate from 9 current agents to 8 redesigned agents?  
**CC Decision:** ✅ **Approved**  
**Rationale:** "Less is better" — reduce complexity, clear ownership  
**Impact:** `chief-of-staff` → `neo`, `coder-hub` + `sysop` → `link`, `life-hub` merged into `oracle`, new `smith` agent created

---

### Decision 2: 5 Community Spaces
**Question:** Create 5 distinct community spaces?  
**CC Decision:** ✅ **Approved**  
**Spaces:**
1. CC Office (primary workshop)
2. Council (strategic alignment)
3. Commons (social, celebration)
4. Crucible (challenge, hard truths)
5. Chapel (sacred space, Buddhist foundation)

---

### Decision 3: Async MD Communication Protocol
**Question:** Use shared Markdown files for async communication?  
**CC Decision:** ✅ **Approved**  
**Rules:**
- Append-only (no overwriting)
- 简明扼要 (max 200 words per entry)
- Monthly archive to GitHub + Feishu
- Token-efficient (90% savings)

---

### Decision 4: Feishu Integration
**Question:** Leverage Feishu for Calendar, Tasks, Drive, Video, Chat, Bitable?  
**CC Decision:** ✅ **Approved**  
**Rationale:** Enterprise-grade, free, already available  
**Owners:**
- Trinity: Calendar + Tasks
- Theodore: Drive + Docs
- Link: Backup automation
- Neo: Bitable dashboards

---

### Decision 5: Buddhist Chapel Foundation
**Question:** Chapel with Buddhist foundation, respect for all good religions?  
**CC Decision:** ✅ **Approved**  
**CC's Practice:** Buddhism  
**Respect:** All good and kind religions welcomed  
**Theodore's Role:** Curate multi-faith wisdom (Buddhist core + universal)

---

### Decision 6: Smith Integration
**Question:** Smith in Commons + invited to decision-making?  
**CC Decision:** ✅ **Approved**  
**Rationale:** "We need different voices"  
**Smith's Roles:**
- Crucible (primary domain)
- Commons (social bonding)
- Council/CC Office (when challenge needed)

---

### Decision 7: Link in Council
**Question:** Add Link to Council (CTO perspective)?  
**CC Decision:** ✅ **Approved**  
**Rationale:** Link underutilized — needs strategic voice  
**Council Now:** CC + Neo + Link + Oracle + Morpheus + Trinity + Architect (7 total)

---

### Decision 8: Monthly Retrospective
**Question:** Monthly Retrospective (last Friday, Commons, all Si Bros)?  
**CC Decision:** ✅ **Approved**  
**Format:** Each Si Bro answers:
1. What worked well?
2. What didn't work?
3. What should we change?

---

### Decision 9: Cron Job Assignments (9 Jobs)
**Question:** Assign all 9 cron jobs to new owners?  
**CC Decision:** ✅ **Approved**  
**Assignments:**
| Job | Owner |
|-----|-------|
| 存储与 AI 推理硬件每日报价动态 | trinity |
| 每日系统自动维护 | link |
| CC-ClaudeCode 学习提醒 | oracle |
| 每日天气播报 | trinity |
| GPU/CPU/内存/硬盘/AIDC 建设情报 | trinity |
| 情报雷达 - 早报 | trinity |
| Brain Dump 研究提醒 | architect (reschedule to Tue 09:00) |
| KM-Vault 每周系统巡检 | link |
| Review unify_search 能力提醒 | link |

---

### Decision 10: Phased Migration
**Question:** 4-phase migration over 2 weeks (not big-bang)?  
**CC Decision:** ✅ **Approved**  
**Phases:**
1. Core agents (neo, link, trinity, morpheus, oracle) — Days 1-3
2. Secondary agents (smith, architect, theodore) — Days 4-6
3. Community spaces (all 5 initialized) — Days 7-10
4. Heritage + cron (Radar, KM-Vault, 19 jobs) — Days 11-14

---

### Decision 11: Documentation Only (No Production Changes)
**Question:** Document everything for Claude Code — no production changes until CC says "execute"?  
**CC Decision:** ✅ **Approved**  
**Rationale:** "Remember we just do planning and document the action plan and instructions for Claude code. Don't make any change to the production system."

---

### Decision 12: Archive to Git
**Question:** Archive all raw discussions + documents to local Git repo, child project under MySiBuddy, commit locally + push to GitHub?  
**CC Decision:** ✅ **Approved**  
**Child Project Name:** `founding-docs`  
**Location:** `/home/admin/Gitrepo/MySIBuddy/founding-docs/`

---

## 📊 Decision Summary

| Category | Total Decisions | Approved | Rejected | Pending |
|----------|-----------------|----------|----------|---------|
| **Architecture** | 3 (Decisions 1, 2, 7) | 3 | 0 | 0 |
| **Communication** | 2 (Decisions 3, 4) | 2 | 0 | 0 |
| **Spiritual** | 1 (Decision 5) | 1 | 0 | 0 |
| **Integration** | 2 (Decisions 6, 8) | 2 | 0 | 0 |
| **Operations** | 3 (Decisions 9, 10, 11) | 3 | 0 | 0 |
| **Documentation** | 1 (Decision 12) | 1 | 0 | 0 |
| **Total** | **12** | **12** | **0** | **0** |

---

## 🎯 Execution Status

| Phase | Status | Owner |
|-------|--------|-------|
| **Design** | ✅ Complete | Neo + CC |
| **Documentation** | ✅ Complete | Theodore |
| **Archive to Git** | ✅ Complete | Neo |
| **CC Approval** | ✅ Complete | CC |
| **Claude Code Execution** | ⏳ Pending (awaiting CC "execute" command) | Claude Code |

---

## 📞 Next Action

**CC says "execute"** → Claude Code runs migration per `MySiBuddy-Claude-Code-Brief.md`

**Until then:** No production changes. Documentation only.

---

**Archived:** 2026-04-11  
**Git Commit:** Pending (this file)  
**GitHub Push:** Pending (this file)
