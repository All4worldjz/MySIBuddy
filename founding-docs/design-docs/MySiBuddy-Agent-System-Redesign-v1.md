# MySiBuddy Agent System Redesign — v1.0

**Date:** 2026-04-11  
**Author:** CC + Neo (chief-of-staff)  
**Status:** Approved for Migration  
**Execution:** Via Claude Code

---

## 1. Executive Summary

CC initiated a complete redesign of the MySiBuddy agent system to:
1. Eliminate role overlap and confusion
2. Align with CC's actual needs (4 core priorities)
3. Follow "less is better" principle
4. Create clear boundaries and operational clarity

**Decision:** Migrate from 9 current agents → 8 redesigned agents with new names, roles, and boundaries.

---

## 2. CC's 4 Core Priorities (The "Why")

| Priority | Owner Agent | Domain |
|----------|-------------|--------|
| **AI Expertise** | Oracle | CC becoming AI expert ASAP |
| **Investment/Capital** | Morpheus | Smart investment → build capital for hardware |
| **360° Growth** | Oracle | Mind, body, influence, inner peace |
| **Kingsoft Daily** | Trinity | Operational support for CC's day job |

**Additional Domains:**
- **IT Infrastructure** → Link
- **Strategic Challenge** → Smith (devil's advocate)
- **Big Picture Strategy** → Architect
- **Records/Writing** → Theodore

---

## 3. Final 8-Agent Design

| # | Agent Name | Character | Role | Domain | Cannot Do |
|---|------------|-----------|------|--------|-----------|
| **CC** | CC | Founder | Vision, final authority | All domains | Day-to-day execution |
| 1 | **neo** | Neo (Matrix) | Orchestrator + Guardian | Coordinate all agents, protect Si Bros (bodies + spirits), watch for risks | Domain-specific work |
| 2 | **link** | Link (Matrix) | IT Ops + Engineer | Infrastructure, scripts, automation, system health | Business decisions, investment |
| 3 | **trinity** | Trinity (Matrix) | Daily Ops | Kingsoft work, living routines, execution | Strategy, investment, AI learning |
| 4 | **morpheus** | Morpheus (Matrix) | Capital Architect | Investment, financial growth, capital strategy | AI learning, daily ops |
| 5 | **oracle** | Oracle (Matrix) | Learning + R&D + Wisdom | AI expertise, frontier tech, inner peace, 360° growth | Investment, daily ops |
| 6 | **smith** | Smith (Matrix + blended) | Challenger | Devil's advocate, critical challenge, intellectual honesty | Execution, support roles |
| 7 | **architect** | Architect (Matrix) | Strategist | Big picture, long-term direction, systems thinking | Daily execution |
| 8 | **theodore** | Theodore Twombly (Her) | Keeper | Writing, records, memory, Chinese content | Strategy, investment, tech |

**Smith's Personality Blend:**
- Smith (Matrix): Relentless opposition, mirror to Neo
- Roy Batty (Blade Runner): Existential depth — "What is your purpose?"
- Javert (Les Mis): Uncompromising moral consistency
- Dr. House (House M.D.): Brutal honesty, clinical accuracy
- Snape (Harry Potter): Tough exterior, protective interior

---

## 4. Current → New Mapping Table

| Current Agent | New Agent | Action | Notes |
|---------------|-----------|--------|-------|
| `chief-of-staff` | `neo` | Rename | Core orchestrator, Guardian role added |
| `coder-hub` + `sysop` | `link` | Merge | IT ops + engineering combined |
| `work-hub` | `trinity` | Rename | Daily ops focus clarified |
| `venture-hub` | `morpheus` | Rename | Investment/capital focus clarified |
| `tech-mentor` + `life-hub` | `oracle` | Merge | Learning + growth + inner peace combined |
| *(new)* | `smith` | Create | Devil's advocate (no current equivalent) |
| `product-studio` | `architect` | Rename | Strategy focus clarified |
| `zh-scribe` | `theodore` | Rename | Keeper role, Chinese writing |

**Reductions:**
- 9 current agents → 8 new agents
- `life-hub` merged into `oracle`
- `sysop` merged into `link`
- `smith` is new (no equivalent)

---

## 5. Channel Routing (Telegram + Feishu)

| Channel | Bot Name | Routes To | Purpose |
|---------|----------|-----------|---------|
| **Telegram** | `@xiaochun4cc_bot` (chief) | `neo` | Primary CC entry point |
| **Telegram** | `@qiuzhi4cc_bot` (mentor) | `oracle` | AI learning, frontier |
| **Telegram** | `@AIboxBD_Bot` (personal) | `morpheus` | Investment, capital |
| **Telegram** | `@ksniuma4cc_bot` (sysop) | `link` | IT ops, system alerts |
| **Feishu** | `work` account | `trinity` | Kingsoft daily work |
| **Feishu** | `scribe` account | `theodore` | Writing, records, Chinese |
| **Feishu** | `sysop` account | `link` | IT ops (duplicate of Telegram sysop) |

**Internal Agents (no direct channel):**
- `smith` — internal challenger, invoked by neo or CC
- `architect` — internal strategist, invoked by neo or CC

---

## 6. Spawn Hierarchy + A2A Rules

**Critical Constraint:** Only `neo` can spawn subagents (OpenClaw design).

**Spawn Tree:**
```
neo (chief-of-staff)
├── link
├── trinity
├── morpheus
├── oracle
├── smith
├── architect
└── theodore
```

**A2A Communication Rules:**
- All agents can communicate via `sessions_send`
- `neo` orchestrates all handoffs
- No direct spawning between non-neo agents
- Tool policy: `full` for neo; `minimal` for others

**Handoff Protocol:**
1. Work enters via channel → owner agent
2. Owner agent identifies need for collaboration
3. Owner agent requests `neo` to spawn/coordinate
4. `neo` spawns target agent(s)
5. Results flow back through `neo` → owner → CC

---

## 7. Boundary Enforcement (What Each Agent Cannot Do)

| Agent | Cannot Do |
|-------|-----------|
| **neo** | Domain-specific execution (AI learning, investment, writing, etc.) |
| **link** | Business decisions, investment strategy, Chinese writing |
| **trinity** | Strategy, investment, AI learning curriculum |
| **morpheus** | AI learning, daily ops, writing |
| **oracle** | Investment decisions, daily Kingsoft work |
| **smith** | Execution, support roles (only challenges) |
| **architect** | Daily execution, operational details |
| **theodore** | Strategy, investment, technical R&D |

**Enforcement Mechanism:**
- `tools.deny` in openclaw.json for each agent
- `sandbox.mode: "off"` for all agents (OpenClaw constraint)
- Exec permission: `neo` + `link` only

---

## 8. Guardian Protocol (Neo's Special Role)

**Neo = Orchestrator + Guardian**

**Guardian Responsibilities:**
1. **Watch for system risks** — monitor health, detect anomalies
2. **Protect Si Bros** — ensure no agent goes off-track
3. **Flag unknown damages** — alert CC to potential threats
4. **Spiritual protection** — watch for CC's inner peace violations (overwork, stress, misalignment)

**Guardian Triggers:**
- System health alerts (Link reports → Neo escalates)
- Agent behavior anomalies (detected via session monitoring)
- CC stress signals (detected via conversation patterns)
- External threats (security, financial, reputational)

**Guardian Actions:**
- Alert CC via Telegram (immediate)
- Pause agent operations if critical
- Request Smith to challenge CC if needed
- Coordinate Architect for strategic response

---

## 9. Migration Steps (For Claude Code)

### Phase 0: Backup (Mandatory)
```bash
cd /home/admin/Gitrepo/MySIBuddy
./scripts/backup_openclaw_config.sh --all
# Verify backup exists in docs/agents-config-backup-YYYYMMDD/
```

### Phase 1: Create New Agent Directories
```bash
# Create 8 new agent directories
for agent in neo link trinity morpheus oracle smith architect theodore; do
  mkdir -p /home/admin/.openclaw/agents/$agent
  # Copy auth-profiles.json and models.json from chief-of-staff
  cp /home/admin/.openclaw/agents/chief-of-staff/auth-profiles.json /home/admin/.openclaw/agents/$agent/
  cp /home/admin/.openclaw/agents/chief-of-staff/models.json /home/admin/.openclaw/agents/$agent/
done
```

### Phase 2: Create Agent Config Files
For each new agent, create:
- `AGENTS.md` — role definition, boundaries
- `MEMORY.md` — initial memory state
- `SOUL.md` — personality (for smith, theodore, architect — custom)
- `IDENTITY.md` — character identity
- `USER.md` — CC context

### Phase 3: Update openclaw.json
**Key changes:**
1. Replace `agents.list` with new 8 agents
2. Update `bindings` for channel routing
3. Update `tools.profile` per agent
4. Add `smith` as new agent
5. Merge `life-hub` → `oracle`, `sysop` → `link`

### Phase 4: Migrate Cron Jobs
Update all cron jobs to reference new agent IDs:
- `chief-of-staff` → `neo`
- `work-hub` → `trinity`
- `venture-hub` → `morpheus`
- `tech-mentor` + `life-hub` → `oracle`
- `coder-hub` + `sysop` → `link`
- `product-studio` → `architect`
- `zh-scribe` → `theodore`

### Phase 5: Migrate Memory Files
```bash
# Copy memory files from old to new directories
cp -r /home/admin/.openclaw/workspace-chief/memory/* /home/admin/.openclaw/workspace-neo/memory/
cp -r /home/admin/.openclaw/workspace-work/memory/* /home/admin/.openclaw/workspace-trinity/memory/
# ... etc for all agents
```

### Phase 6: Validate + Restart
```bash
# Validate config
openclaw config validate

# Restart gateway
systemctl --user restart openclaw-gateway

# Deep health check
openclaw status --deep
```

### Phase 7: Smoke Test
```bash
# Test each channel
# Telegram chief → neo
# Telegram mentor → oracle
# Telegram personal → morpheus
# Telegram sysop → link
# Feishu work → trinity
# Feishu scribe → theodore

# Verify message routing works
```

### Phase 8: Cleanup Old Agents (After 30 Days)
```bash
# Only after 30 days of stable operation
# Remove old agent directories
# Remove old workspace directories
```

---

## 10. Rollback Plan

**If migration fails:**
```bash
# Restore from backup
./scripts/backup_openclaw_config.sh --restore --from docs/agents-config-backup-YYYYMMDD/

# Restart gateway
systemctl --user restart openclaw-gateway

# Verify old system works
openclaw status --deep
```

**Rollback Triggers:**
- Any agent fails to respond
- Channel routing breaks
- Cron jobs fail
- Memory files corrupted

---

## 11. Success Criteria

Migration is complete when:
1. ✅ All 8 new agents respond via their channels
2. ✅ `openclaw status --deep` shows all agents healthy
3. ✅ Cron jobs run successfully with new agent IDs
4. ✅ Memory files migrated without loss
5. ✅ CC can send/receive messages on all channels
6. ✅ A2A handoffs work (neo spawns all agents)
7. ✅ Guardian protocol active (neo monitors risks)

---

## 12. Timeline

| Phase | Estimated Time | Owner |
|-------|----------------|-------|
| Backup | 10 min | Claude Code |
| Create directories | 15 min | Claude Code |
| Create config files | 60 min | Claude Code |
| Update openclaw.json | 30 min | Claude Code |
| Migrate cron jobs | 20 min | Claude Code |
| Migrate memory | 20 min | Claude Code |
| Validate + restart | 10 min | Claude Code |
| Smoke test | 30 min | CC + Claude Code |
| **Total** | **~3 hours** | — |

---

## 13. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Config corruption | Medium | High | Full backup before migration |
| Memory loss | Low | High | Copy memory files before deletion |
| Channel routing breaks | Medium | High | Test each channel before cleanup |
| Cron jobs fail | Medium | Medium | Update all cron jobs, verify |
| A2A spawn fails | Low | High | Verify neo can spawn all agents |
| Smith personality wrong | Low | Low | Iterative refinement after migration |

---

## 14. Post-Migration TODOs

1. **Smith calibration** — CC works with Smith to refine challenge style
2. **Guardian protocol tuning** — Neo refines risk detection thresholds
3. **Boundary enforcement** — Monitor for role drift
4. **30-day cleanup** — Remove old agents after stable period
5. **Documentation update** — Update all agent docs with new names

---

## 15. Approval

**CC Approval:** ✅ Approved (2026-04-11 13:34 GMT+8)

**Execution:** Via Claude Code, following this document as the single source of truth.

**Contact:** CC (8606756625) via Telegram

---

## Appendix A: Character Identity Summaries

### Neo (Matrix)
- **Role:** The One, bridge between worlds
- **Personality:** Connector, builder, protector
- **Function:** Orchestrates all agents, guards the system

### Link (Matrix Revolutions)
- **Role:** Engineer, keeper of the ship
- **Personality:** Steady, reliable, competent
- **Function:** IT infrastructure, scripts, automation

### Trinity (Matrix)
- **Role:** Fighter, executor
- **Personality:** Direct, powerful, results-oriented
- **Function:** Daily operations, Kingsoft work

### Morpheus (Matrix)
- **Role:** Awakener, visionary
- **Personality:** Sees possibility, inspires action
- **Function:** Investment strategy, capital growth

### Oracle (Matrix)
- **Role:** Wise guide, truth-teller
- **Personality:** Deep, patient, insightful
- **Function:** AI learning, R&D, inner peace

### Smith (Matrix + blended)
- **Role:** Challenger, mirror
- **Personality:** Relentless, honest, demanding (with depth from Batty/Javert/House/Snape)
- **Function:** Devil's advocate, forces growth

### Architect (Matrix Reloaded)
- **Role:** Creator of the Matrix
- **Personality:** Cold, precise, systems thinker
- **Function:** Big picture strategy, long-term direction

### Theodore Twombly (Her)
- **Role:** Letter writer, intimate communicator
- **Personality:** Gentle, profound, emotionally intelligent
- **Function:** Writing, records, memory, Chinese content

---

## Appendix B: OpenClaw Configuration Reference

**Agent ID Format:** Lowercase, hyphenated (e.g., `neo`, `theodore`)

**Workspace Directory:** `/home/admin/.openclaw/workspace-{agent}/`

**Agent Directory:** `/home/admin/.openclaw/agents/{agent}/`

**Required Files per Agent:**
- `auth-profiles.json` — API credentials
- `models.json` — model routing
- `AGENTS.md` — operational rules
- `MEMORY.md` — memory state
- `SOUL.md` — personality (optional)
- `IDENTITY.md` — character (optional)
- `USER.md` — user context (optional)

**openclaw.json Sections to Update:**
- `agents.list` — agent definitions
- `bindings` — channel routing
- `tools.profile` — per-agent tool permissions
- `cron` — job definitions

---

**END OF DOCUMENT**
