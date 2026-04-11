# MySiBuddy Migration — Claude Code Execution Brief

**Version:** v1.0  
**Date:** 2026-04-11  
**Status:** Ready for Execution (awaiting CC "execute" command)  
**Parent Project:** MySiBuddy  
**Execution Mode:** Phased (4 phases over 2 weeks)

---

## 🚨 Critical Instructions

**READ FIRST:**
1. **Do NOT execute** until CC explicitly says "execute" or "开始执行"
2. **Follow phases in order** — do not skip phases
3. **Stop and alert CC** if any phase fails
4. **Rollback immediately** if critical failure (see Rollback Plan below)
5. **Document everything** in `founding-docs/execution-log.md`

---

## 📋 Phase 1: Core Agents (Days 1-3)

### Objective
Migrate 5 core agents: neo, link, trinity, morpheus, oracle

### Steps

#### Step 1.1: Create Agent Directories
```bash
cd /home/admin/.openclaw/agents
for agent in neo link trinity morpheus oracle; do
  mkdir -p $agent
  cp chief-of-staff/auth-profiles.json $agent/
  cp chief-of-staff/models.json $agent/
done
```

#### Step 1.2: Create Workspace Directories
```bash
cd /home/admin/.openclaw
for workspace in workspace-neo workspace-link workspace-trinity workspace-morpheus workspace-oracle; do
  mkdir -p $workspace/memory
done
```

#### Step 1.3: Deploy Agent Config Files
```bash
# Copy from templates
cd /home/admin/.openclaw/workspace-chief/docs/agent-templates
for agent in neo link trinity morpheus oracle; do
  cp -r $agent/* /home/admin/.openclaw/workspace-$agent/
done
```

#### Step 1.4: Update openclaw.json (Agents Only)
**File:** `/home/admin/.openclaw/openclaw.json`  
**Section:** `agents.list`  
**Action:** Replace old 9 agents with new 8 agents (neo, link, trinity, morpheus, oracle, smith, architect, theodore)

**Validation:**
```bash
openclaw config validate
```

#### Step 1.5: Restart Gateway
```bash
systemctl --user restart openclaw-gateway
sleep 10
openclaw status --deep
```

#### Step 1.6: Smoke Test
```bash
# Test each new agent responds
# Telegram chief → neo
# Telegram sysop → link
# Feishu work → trinity
# Telegram personal → morpheus
# Telegram mentor → oracle
```

### Success Criteria
- ✅ All 5 agents respond via their channels
- ✅ `openclaw status --deep` shows all healthy
- ✅ No errors in gateway logs

### Rollback Trigger
- Any agent fails to respond
- Gateway fails to restart
- Config validation fails

---

## 📋 Phase 2: Secondary Agents (Days 4-6)

### Objective
Migrate 3 secondary agents: smith, architect, theodore

### Steps

#### Step 2.1: Create Agent Directories
```bash
cd /home/admin/.openclaw/agents
for agent in smith architect theodore; do
  mkdir -p $agent
  cp chief-of-staff/auth-profiles.json $agent/
  cp chief-of-staff/models.json $agent/
done
```

#### Step 2.2: Create Workspace Directories
```bash
cd /home/admin/.openclaw
for workspace in workspace-smith workspace-architect workspace-theodore; do
  mkdir -p $workspace/memory
done
```

#### Step 2.3: Deploy Agent Config Files
```bash
cd /home/admin/.openclaw/workspace-chief/docs/agent-templates
for agent in smith architect theodore; do
  cp -r $agent/* /home/admin/.openclaw/workspace-$agent/
done
```

#### Step 2.4: Update openclaw.json (Complete Agent List)
**File:** `/home/admin/.openclaw/openclaw.json`  
**Section:** `agents.list`  
**Action:** Ensure all 8 agents present (neo, link, trinity, morpheus, oracle, smith, architect, theodore)

#### Step 2.5: Restart + Validate
```bash
systemctl --user restart openclaw-gateway
sleep 10
openclaw status --deep
```

### Success Criteria
- ✅ All 8 agents healthy
- ✅ smith, architect, theodore respond correctly
- ✅ No config errors

### Rollback Trigger
- Any new agent fails
- Config errors detected

---

## 📋 Phase 3: Community Spaces (Days 7-10)

### Objective
Initialize all 5 community spaces with MD files + Feishu folders

### Steps

#### Step 3.1: Create Feishu Folders
```bash
# Using shared script
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "MySiBuddy" "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"
# Returns: token for MySiBuddy folder

bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "communities" "<MySiBuddy_token>"
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "archives" "<MySiBuddy_token>"
```

#### Step 3.2: Create MD Files (Feishu Docs)
**Location:** Feishu Drive `/MySiBuddy/communities/`

Create 5 files:
- `cc-office/2026-04.md`
- `council/2026-04.md`
- `commons/2026-04.md`
- `crucible/2026-04.md`
- `chapel/2026-04.md`

**Format:** Per `community-communication-protocol.md`

#### Step 3.3: Create Calendar Events (Feishu Calendar)
**Owner:** trinity  
**Events:**
- Daily Chapel (08:00, recurring)
- Weekly Council (Sunday 20:00, recurring)
- Weekly Crucible (Wednesday 20:00, bi-weekly)
- Weekly Commons Toast (Friday 18:00, recurring)
- Monthly Retrospective + Party (Last Friday 20:00, recurring)
- Chapel Sabbath (Sunday 08:00, recurring)

#### Step 3.4: Create Bitable Dashboards
**Owner:** neo  
**Dashboards:**
- Task Tracker (all assignments)
- Guardian Dashboard (CC workload, stress)
- Community Activity (who posted where)

### Success Criteria
- ✅ All 5 Feishu folders created
- ✅ All 5 MD files initialized
- ✅ All calendar events created
- ✅ Bitable dashboards working

### Rollback Trigger
- Feishu folder creation fails
- Calendar events fail to create

---

## 📋 Phase 4: Heritage + Cron (Days 11-14)

### Objective
Migrate Intelligence Radar, KM-Vault, and all 9 cron jobs

### Steps

#### Step 4.1: Migrate Intelligence Radar
**Owner:** oracle  
**Action:** Copy `intelligence-radar/` to `workspace-oracle/intelligence-radar/`  
**Test:** Run morning brief manually

#### Step 4.2: Migrate KM-Vault
**Owners:** theodore + link  
**Action:** Verify Docker container running, Feishu sync working  
**Test:** Compile one raw document

#### Step 4.3: Migrate Cron Jobs (9 Total)
**Command:**
```bash
# For each cron job, update agent reference
openclaw cron disable <job_id>
# Update openclaw.json cron section
# Re-enable with new agent
openclaw cron enable <job_id>
```

**Assignments:**
| Job ID | New Owner |
|--------|-----------|
| `7c768e72` | trinity |
| `ffd9fcb9` | link |
| `b45c27bb` | oracle |
| `755c5e91` | trinity |
| `85b2866b` | trinity |
| `51289580` | trinity |
| `e3ef02e7` | architect (reschedule to Tue 09:00) |
| `a15b2f2c` | link |
| `8e28b39e` | link |

#### Step 4.4: Create community_archive.sh
**Owners:** theodore + link  
**Location:** `/home/admin/.openclaw/scripts/community_archive.sh`  
**Purpose:** Monthly MD file archive to GitHub + Feishu

#### Step 4.5: Full System Test
```bash
openclaw status --deep
# Verify all 9 cron jobs listed with correct owners
# Verify all 8 agents healthy
```

### Success Criteria
- ✅ Intelligence Radar delivers morning brief
- ✅ KM-Vault compiles raw documents
- ✅ All 9 cron jobs running with new owners
- ✅ `community_archive.sh` created and tested

### Rollback Trigger
- Any cron job fails 3+ consecutive times
- Intelligence Radar fails to deliver
- KM-Vault Docker container fails

---

## 🔄 Rollback Plan

### If Phase 1 Fails
```bash
# Restore openclaw.json from backup
cp /home/admin/.openclaw/openclaw.json.pre-migration /home/admin/.openclaw/openclaw.json
systemctl --user restart openclaw-gateway
```

### If Phase 2-4 Fails
```bash
# Rollback only that phase
# Keep successful phases
# Alert CC with specific failure
```

### Emergency Full Rollback
```bash
# Full system restore from backup
cd /home/admin/Gitrepo/MySIBuddy
./scripts/backup_openclaw_config.sh --restore --from latest
systemctl --user restart openclaw-gateway
```

---

## 📊 Execution Checklist

### Phase 1 (Core Agents)
- [ ] Step 1.1: Agent directories created
- [ ] Step 1.2: Workspace directories created
- [ ] Step 1.3: Config files deployed
- [ ] Step 1.4: openclaw.json updated
- [ ] Step 1.5: Gateway restarted
- [ ] Step 1.6: Smoke test passed
- [ ] **Phase 1 Complete:** ✅ / ❌

### Phase 2 (Secondary Agents)
- [ ] Step 2.1: Agent directories created
- [ ] Step 2.2: Workspace directories created
- [ ] Step 2.3: Config files deployed
- [ ] Step 2.4: openclaw.json complete
- [ ] Step 2.5: Restart + validate passed
- [ ] **Phase 2 Complete:** ✅ / ❌

### Phase 3 (Community Spaces)
- [ ] Step 3.1: Feishu folders created
- [ ] Step 3.2: MD files initialized
- [ ] Step 3.3: Calendar events created
- [ ] Step 3.4: Bitable dashboards created
- [ ] **Phase 3 Complete:** ✅ / ❌

### Phase 4 (Heritage + Cron)
- [ ] Step 4.1: Intelligence Radar migrated
- [ ] Step 4.2: KM-Vault verified
- [ ] Step 4.3: 9 cron jobs migrated
- [ ] Step 4.4: community_archive.sh created
- [ ] Step 4.5: Full system test passed
- [ ] **Phase 4 Complete:** ✅ / ❌

---

## 📝 Execution Log

**Template for logging:**
```markdown
## Phase X — YYYY-MM-DD HH:MM

**Started by:** [CC command]  
**Executed by:** Claude Code  
**Status:** In Progress / Complete / Failed  

### Steps Completed
1. [Step name] — ✅ / ❌
2. [Step name] — ✅ / ❌

### Issues Encountered
- [Issue 1]
- [Issue 2]

### Resolutions
- [Resolution 1]
- [Resolution 2]

### Next Steps
- [Next step 1]
- [Next step 2]
```

**Location:** `founding-docs/execution-log.md`

---

## 📞 Contact

**CC (Founder):** 8606756625 (Telegram)  
**Neo (Orchestrator):** Current chief-of-staff session  
**Emergency:** Stop execution, alert CC, rollback to backup

---

**AWAITING CC "EXECUTE" COMMAND**

Do not execute until CC explicitly says "execute" or "开始执行".
