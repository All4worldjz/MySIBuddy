# MySiBuddy Tools & Services Inventory

**Date:** 2026-04-11  
**Purpose:** Full audit of existing tools, services, cron jobs for migration  
**Status:** Ready for CC decision

---

## 📊 Executive Summary

| Category | Total Items | Migrate | Retire | Replace |
|----------|-------------|---------|--------|---------|
| **Cron Jobs** | 9 active | 7 | 2 | 0 |
| **Scripts** | 18 | 15 | 2 | 1 (new) |
| **Telegram Bots** | 4 | 4 | 0 | 0 |
| **Feishu Accounts** | 3 | 3 | 0 | 0 |
| **Memory Files** | 9 workspaces | 9 | 0 | 0 |
| **Systems** | 2 (Radar + KM-Vault) | 2 | 0 | 0 |
| **Feishu Folders** | 2 protected | 2 | 0 | +3 (new) |

---

## ⏰ Cron Jobs (9 Active)

| Job ID | Name | Schedule | Current Owner | New Owner | Decision |
|--------|------|----------|---------------|-----------|----------|
| `7c768e72` | 存储与 AI 推理硬件每日报价动态 | Daily 01:00 | work-hub | **morpheus** | ✅ Migrate |
| `ffd9fcb9` | 每日系统自动维护 | Daily 03:00 | chief-of-staff | **link** | ✅ Migrate |
| `b45c27bb` | CC-ClaudeCode 学习提醒 | Monthly 3rd 10:00 | chief-of-staff | **oracle** | ✅ Migrate |
| `755c5e91` | 每日天气播报 | Daily 06:00 | life-hub | **trinity** | ⚠️ Retire? (low value) |
| `85b2866b` | GPU/CPU/内存/硬盘/AIDC 建设情报 | Daily 06:40 | work-hub | **oracle + architect** | ✅ Migrate |
| `51289580` | 情报雷达 - 早报 (08:00) | Daily 08:00 | chief-of-staff | **oracle** | ✅ Migrate |
| `e3ef02e7` | Brain Dump 研究提醒 | One-shot 2026-04-12 | chief-of-staff | **theodore** | ⚠️ Retire? (one-time) |
| `a15b2f2c` | KM-Vault 每周系统巡检 | Weekly Sun 22:00 | tech-mentor | **theodore + link** | ✅ Migrate |
| `8e28b39e` | Review unify_search 能力提醒 | Weekly Sat 10:00 | work-hub | **architect** | ⚠️ Retire? (obsolete) |

**CC Decision Needed:**
- `755c5e91` (天气播报): Keep or retire? (low value)
- `e3ef02e7` (Brain Dump): Keep or retire? (one-shot, passed)
- `8e28b39e` (unify_search): Keep or retire? (may be obsolete)

---

## 🛠️ Scripts (18 Total)

### System Health + Ops (6 scripts)
| Script | Purpose | New Owner | Decision |
|--------|---------|-----------|----------|
| `system_health_report.sh` | Hourly health report | **link** | ✅ Migrate |
| `system_health_alert.sh` | 30-min critical alerts | **link** | ✅ Migrate |
| `safe_openclaw_validate.sh` | Config validation | **link** | ✅ Migrate |
| `safe_openclaw_apply.sh` | Safe config apply | **link** | ✅ Migrate |
| `safe_openclaw_rollback.sh` | Config rollback | **link** | ✅ Migrate |
| `safe_openclaw_smoke.sh` | Quick health check | **link** | ✅ Migrate |

### Feishu Operations (6 scripts)
| Script | Purpose | New Owner | Decision |
|--------|---------|-----------|----------|
| `feishu_create_folder.sh` | Create folders | **theodore** | ✅ Migrate |
| `feishu_delete_folder.sh` | Soft delete folders | **theodore** | ✅ Migrate |
| `feishu_move_folder.sh` | Move folders | **theodore** | ✅ Migrate |
| `feishu_import_to_raw.sh` | Import to KM-Vault raw | **theodore** | ✅ Migrate |
| `feishu_knowledge_vault_sync.sh` | KM-Vault sync | **theodore + link** | ✅ Migrate |
| `feishu_to_wiki_sync.py` | Wiki sync | **theodore** | ✅ Migrate |

### Intelligence Radar (4 scripts)
| Script | Purpose | New Owner | Decision |
|--------|---------|-----------|----------|
| `run_radar.py` | On-demand intelligence query | **oracle** | ✅ Migrate |
| `run_daily.py` | Daily briefings (morning/evening) | **oracle** | ✅ Migrate |
| `setup_cron.py` | Cron registration | **oracle + link** | ✅ Migrate |
| `radar/core.py` | Sensor dispatcher | **oracle** | ✅ Migrate |

### KM-Vault (2 scripts)
| Script | Purpose | New Owner | Decision |
|--------|---------|-----------|----------|
| `docker_run_km_vault.sh` | Docker container runner | **link** | ✅ Migrate |
| `compile_raw.sh` | Raw → wiki compilation | **theodore** | ✅ Migrate |

### Other (Retire - 2 scripts)
| Script | Purpose | Decision |
|--------|---------|----------|
| `caldav_sync.sh` | CalDAV calendar sync | ⚠️ Retire? (Feishu Calendar replaces) |
| `update_agent_memory_feishu_ops.sh` | Memory update | ⚠️ Retire? (replaced by new protocol) |

### New Script Needed (1)
| Script | Purpose | Owner | Status |
|--------|---------|-------|--------|
| `community_archive.sh` | Monthly MD file archive | **theodore + link** | 🔲 To create |

---

## 📱 Telegram Bots (4 Accounts)

| Bot | Username | Current Use | New Use | Decision |
|-----|----------|-------------|---------|----------|
| **chief** | `@xiaochun4cc_bot` | chief-of-staff | **neo** (CC Office, Council, Guardian) | ✅ Migrate |
| **mentor** | `@qiuzhi4cc_bot` | tech-mentor | **oracle** (AI learning, Chapel) | ✅ Migrate |
| **personal** | `@AIboxBD_Bot` | personal/venture | **morpheus** (investment) + **commons** | ✅ Migrate |
| **sysop** | `@ksniuma4cc_bot` | sysop | **link** (IT alerts, system health) | ✅ Migrate |

**No changes needed.** All 4 bots migrate directly.

---

## 📇 Feishu Accounts (3 Accounts)

| Account | Current Use | New Use | Decision |
|---------|-------------|---------|----------|
| **work** | work-hub | **trinity** (Kingsoft work, CC Office booking) | ✅ Migrate |
| **scribe** | zh-scribe | **theodore** (Chinese writing, memory curation) | ✅ Migrate |
| **sysop** | sysop | **link** (IT ops, KM-Vault, Drive management) | ✅ Migrate |

**No changes needed.** All 3 accounts migrate directly.

---

## 📁 Memory Files (9 Workspaces)

| Workspace | MEMORY.md Size | New Owner | Action |
|-----------|----------------|-----------|--------|
| `workspace-chief` | ~50KB | **neo** | Curate + migrate key decisions |
| `workspace-work` | ~30KB | **trinity** | Migrate client facts |
| `workspace-venture` | ~20KB | **morpheus** | Migrate investment thesis |
| `workspace-tech-mentor` | ~40KB | **oracle** | Migrate AI learning progress |
| `workspace-life` | ~15KB | **oracle** | Migrate growth milestones |
| `workspace-zh-scribe` | ~35KB | **theodore** | Migrate Chinese content |
| `workspace-product` | ~10KB | **architect** | Migrate product decisions |
| `workspace-sysop` | ~25KB | **link** | Migrate ops history |
| `workspace-coder` | ~5KB | **link** | Migrate scripts history |

**All 9 migrate.** Theodore curates, Link backs up.

---

## 🖥️ Systems (2 Major)

### Intelligence Radar
| Component | Location | New Owner | Decision |
|-----------|----------|-----------|----------|
| Sensors (xurl, gh, blog, web) | `radar/sensors/` | **oracle** | ✅ Migrate |
| Fusion engine | `radar/fusion.py` | **oracle** | ✅ Migrate |
| Reports (morning, evening, flash) | `reports/` | **oracle** | ✅ Migrate |
| Tracks config | `config/tracks.json` | **oracle + architect** | ✅ Migrate |
| Cron jobs (4) | See above | **oracle** | ✅ Migrate |

### KM-Vault
| Component | Location | New Owner | Decision |
|-----------|----------|-----------|----------|
| Docker container | `KM_Vault/` | **link** (ops) + **theodore** (content) | ✅ Migrate |
| Raw folder | Feishu Drive | **theodore** | ✅ Migrate |
| Wiki folder | Feishu Drive | **theodore** | ✅ Migrate |
| Schema | `schema/` | **theodore** | ✅ Migrate |
| Cron jobs (3) | See above | **theodore + link** | ✅ Migrate |

---

## 📂 Feishu Folders (Protected)

| Folder | Token | Current Use | New Use | Decision |
|--------|-------|-------------|---------|----------|
| **CC 文件柜** | `RfSrf8oMYlMyQTdbW0ZcGSE1nNb` | CC personal | CC personal + Chapel sacred texts | ✅ Migrate |
| **小春文件柜** | `Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd` | Shared work | MySiBuddy communities + archives | ✅ Migrate |
| **回收站** | `XcTHfLy7clpx51dBomLcvA7XnTf` | Soft delete | Soft delete (no change) | ✅ Migrate |
| **📁测试归档** | `TZa9f0KaQldDPXdDnX6cF3K7nme` | Test folders | Test folders (no change) | ✅ Migrate |

### New Folders to Create (3)
| Folder | Parent Token | Purpose | Owner |
|--------|--------------|---------|-------|
| **MySiBuddy** | 小春文件柜 | Main community folder | **theodore** |
| **MySiBuddy/communities** | MySiBuddy | 5 space MD files | **theodore** |
| **MySiBuddy/archives** | MySiBuddy | Monthly archives | **link** |

---

## 🔧 OpenClaw CLI Tools (Available)

| Tool | Use Case | New Owner |
|------|----------|-----------|
| `openclaw cron *` | Cron job management | **link** |
| `openclaw agents *` | Agent management | **neo** |
| `openclaw channels *` | Channel management | **neo** |
| `openclaw config *` | Config validation | **link** |
| `openclaw secrets *` | Secret management | **link** |
| `openclaw tasks *` | Task management | **neo** |
| `openclaw backup *` | Backup creation | **link** |
| `openclaw status --deep` | Health checks | **link** |

---

## 📋 CC Decision Summary

### Decisions Needed (5 items)

| # | Item | Options | Recommendation |
|---|------|---------|----------------|
| 1 | `755c5e91` (每日天气播报) | Keep / Retire | ⚠️ Retire (low value, Feishu weather replaces) |
| 2 | `e3ef02e7` (Brain Dump) | Keep / Retire | ⚠️ Retire (one-shot, already passed) |
| 3 | `8e28b39e` (unify_search) | Keep / Retire | ⚠️ Retire (may be obsolete) |
| 4 | `caldav_sync.sh` | Keep / Retire | ⚠️ Retire (Feishu Calendar replaces) |
| 5 | New folders | Create 3 | ✅ Create (Theodore + Link) |

### Migration Priorities (3 Phases)

| Phase | Items | Timeline | Owner |
|-------|-------|----------|-------|
| **Phase 1** (Critical) | 4 Telegram bots, 3 Feishu accounts, 7 cron jobs | Days 1-3 | **neo + link** |
| **Phase 2** (Systems) | Intelligence Radar, KM-Vault, scripts | Days 4-7 | **oracle + theodore + link** |
| **Phase 3** (Memory) | 9 MEMORY.md files, new folders | Days 8-10 | **theodore** |

---

## 🎯 Recommended Actions

### Tonight (Preparation)
- [ ] CC decides on 5 items above (Keep/Retire)
- [ ] Theodore creates 3 new Feishu folders
- [ ] Link verifies all scripts are executable

### Tomorrow (Phase 1 Start)
- [ ] Migrate 4 Telegram bots (rename to new agents)
- [ ] Migrate 3 Feishu accounts (rename to new agents)
- [ ] Migrate 7 cron jobs (update agent references)
- [ ] Test: CC Office session works

### This Week (Phase 2-3)
- [ ] Oracle takes over Intelligence Radar
- [ ] Theodore + Link share KM-Vault
- [ ] Theodore curates 9 MEMORY.md files
- [ ] Link creates `community_archive.sh`

---

**Ready for CC decision.** Please review and approve/reject each item.
