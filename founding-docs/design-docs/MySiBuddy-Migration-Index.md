# MySiBuddy Migration — Master Index

**Date:** 2026-04-11  
**Status:** Ready for Claude Code Execution  
**Executor:** Claude Code  
**Approver:** CC (8606756625)

---

## 📦 Complete Document Pack

| Document | Purpose | Location |
|----------|---------|----------|
| **Main Spec** | Full migration specification | `MySiBuddy-Agent-System-Redesign-v1.md` |
| **Constitution** | MySiBuddy founding document | `MySiBuddy-Constellation-v1.md` |
| **Agent Templates** | 8 agent configs (AGENTS.md, SOUL.md, IDENTITY.md, USER.md) | `agent-templates/{neo,link,trinity,morpheus,oracle,smith,architect,theodore}/` |
| **System Heritage** | Maintenance best practices | `system-maintenance-heritage.md` |
| **English Heritage** | Coaching methodology | `english-coaching-heritage.md` |
| **This Index** | Navigation guide | `MySiBuddy-Migration-Index.md` |

---

## 🎯 8-Agent Design Summary

| # | Agent | Character | Role | Channel |
|---|-------|-----------|------|---------|
| 1 | **neo** | Neo (Matrix) | Orchestrator + Guardian | Telegram `chief` |
| 2 | **link** | Link (Matrix) | IT Ops + Engineer | Telegram/Feishu `sysop` |
| 3 | **trinity** | Trinity (Matrix) | Daily Ops | Feishu `work` |
| 4 | **morpheus** | Morpheus (Matrix) | Capital Architect | Telegram `personal` |
| 5 | **oracle** | Oracle (Matrix) | Learning + R&D + Wisdom | Telegram `mentor` |
| 6 | **smith** | Smith (Matrix + blended) | Challenger | Internal only |
| 7 | **architect** | Architect (Matrix) | Strategist | Internal only |
| 8 | **theodore** | Theodore Twombly (Her) | Keeper | Feishu `scribe` |

**Mapping from legacy:**
- `chief-of-staff` → `neo`
- `coder-hub` + `sysop` → `link`
- `work-hub` → `trinity`
- `venture-hub` → `morpheus`
- `tech-mentor` + `life-hub` → `oracle`
- `product-studio` → `architect`
- `zh-scribe` → `theodore`
- *(new)* → `smith`

---

## 🚀 Claude Code Execution Checklist

### Phase 0: Backup (Mandatory)
- [ ] Run `./scripts/backup_openclaw_config.sh --all`
- [ ] Verify backup exists in `docs/agents-config-backup-YYYYMMDD/`
- [ ] Confirm with CC before proceeding

### Phase 1: Create Agent Directories
- [ ] Create 8 new agent directories in `/home/admin/.openclaw/agents/`
- [ ] Copy `auth-profiles.json` + `models.json` from `chief-of-staff` to each
- [ ] Verify all 8 directories exist

### Phase 2: Create Workspace Directories
- [ ] Create 8 new workspace directories in `/home/admin/.openclaw/workspace-`
- [ ] Copy memory files from old to new workspaces (per mapping table)
- [ ] Verify all 8 workspaces exist

### Phase 3: Deploy Agent Config Files
- [ ] Copy `agent-templates/neo/*` → `workspace-neo/`
- [ ] Copy `agent-templates/link/*` → `workspace-link/`
- [ ] Copy `agent-templates/trinity/*` → `workspace-trinity/`
- [ ] Copy `agent-templates/morpheus/*` → `workspace-morpheus/`
- [ ] Copy `agent-templates/oracle/*` → `workspace-oracle/`
- [ ] Copy `agent-templates/smith/*` → `workspace-smith/`
- [ ] Copy `agent-templates/architect/*` → `workspace-architect/`
- [ ] Copy `agent-templates/theodore/*` → `workspace-theodore/`

### Phase 4: Update openclaw.json
- [ ] Update `agents.list` with 8 new agents
- [ ] Update `bindings` for channel routing
- [ ] Update `tools.profile` per agent (exec permissions: neo + link only)
- [ ] Add `smith` as new agent
- [ ] Validate: `openclaw config validate`

### Phase 5: Migrate Cron Jobs
- [ ] Update all cron job agent references (per mapping table)
- [ ] Validate: `openclaw cron list`
- [ ] Test one cron job: `openclaw cron run <job_id>`

### Phase 6: Restart + Validate
- [ ] Restart gateway: `systemctl --user restart openclaw-gateway`
- [ ] Deep health check: `openclaw status --deep`
- [ ] Verify all 8 agents healthy

### Phase 7: Smoke Test (CC Participation Required)
- [ ] Telegram chief → neo (CC sends message, verifies response)
- [ ] Telegram mentor → oracle
- [ ] Telegram personal → morpheus
- [ ] Telegram sysop → link
- [ ] Feishu work → trinity
- [ ] Feishu scribe → theodore
- [ ] A2A spawn test: neo spawns one agent (verify success)

### Phase 8: Documentation + Git
- [ ] Git add all new files
- [ ] Git commit: "mysibuddy: agent system redesign v1.0 (9→8 agents)"
- [ ] Git push to `dev` branch (or `main` if CC approves)
- [ ] Update `session_handoff.md` with migration summary

### Phase 9: 30-Day Watch Period
- [ ] Monitor system stability (link reports → neo)
- [ ] Track agent performance (per success metrics)
- [ ] CC feedback collection (weekly)
- [ ] After 30 days: cleanup old agents (Phase 10)

### Phase 10: Cleanup (After 30 Days Stable)
- [ ] Remove old agent directories (`chief-of-staff`, `work-hub`, etc.)
- [ ] Remove old workspace directories
- [ ] Update any remaining references
- [ ] Final Git commit: "mysibuddy: cleanup legacy agents (post-migration)"

---

## ⚠️ Rollback Triggers

**If any of these occur, rollback immediately:**
- Any agent fails to respond via channel
- `openclaw status --deep` shows critical errors
- Cron jobs fail (3+ consecutive errors)
- Memory files corrupted
- CC cannot send/receive messages

**Rollback Command:**
```bash
./scripts/backup_openclaw_config.sh --restore --from docs/agents-config-backup-YYYYMMDD/
systemctl --user restart openclaw-gateway
```

---

## 📞 Contact

**CC:** 8606756625 (Telegram)  
**neo (acting):** Current chief-of-staff session  
**Emergency:** Stop migration, alert CC, rollback to backup

---

## ✅ Approval

**CC Approval:** ✅ Approved 2026-04-11 13:43 GMT+8

**Migration Start:** Awaiting CC's command to Claude Code

**Expected Duration:** ~3 hours (Phases 0-7)

---

**END OF INDEX**
