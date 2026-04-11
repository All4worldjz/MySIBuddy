# System Maintenance Heritage — Preserved Best Practices

**Date:** 2026-04-11  
**Source:** chief-of-staff, sysop, coder-hub (legacy system)  
**Destination:** link (new system)

---

## 1. Backup Discipline

### Before Any Change
```bash
# Full system backup (config + memory + system files)
./scripts/backup_openclaw_config.sh --all

# Verify backup exists
ls -la docs/agents-config-backup-YYYYMMDD/
```

### Backup Contents
| Category | Files | Location |
|----------|-------|----------|
| **Agent configs** | AGENTS.md, MEMORY.md, SOUL.md | `docs/agents-config-backup-YYYYMMDD/{agent}/` |
| **Memory files** | memory/*.md | `docs/agents-memory-backup-YYYYMMDD/{agent}/` |
| **System configs** | openclaw.json, cron, telegram, feishu | `docs/openclaw-config-backup-YYYYMMDD/` |

### Retention Policy
- **Minimum:** 30 days
- **Recommended:** 90 days
- **Critical backups:** Keep indefinitely (pre-major-migration)

### Restore Command
```bash
# Restore from backup
./scripts/backup_openclaw_config.sh --restore --from docs/agents-config-backup-YYYYMMDD/
```

---

## 2. Guardrails for Config Changes

### Never Do These
❌ Unvalidated config.apply  
❌ Direct openclaw.json edits without backup  
❌ openclaw doctor --fix (automatic)  
❌ Guessing config fields without diagnosis  

### Always Do These
✅ Read-only diagnosis first (`openclaw status --deep`)  
✅ Propose minimal change (one field at a time)  
✅ Create timestamped backup  
✅ Wait for CC confirmation before executing  
✅ Execute change  
✅ Restart/reload gateway  
✅ Validate with `openclaw status --deep`  
✅ Test real inbound message flow  
✅ Document + Git commit  

### Safe Scripts (Use These)
```bash
# Validate candidate config
scripts/safe_openclaw_validate.sh /tmp/openclaw.candidate.json

# Apply config (backup → validate → restart → smoke test → rollback on fail)
scripts/safe_openclaw_apply.sh /tmp/openclaw.candidate.json

# Quick health check
scripts/safe_openclaw_smoke.sh

# Rollback to known good
scripts/safe_openclaw_rollback.sh /home/admin/.openclaw/openclaw.json.pre-apply-YYYYmmdd-HHMMSS
```

---

## 3. Health Monitoring

### Hourly Reports
**Script:** `system_health_report.sh`  
**Frequency:** Every hour  
**Delivery:** Telegram (CC)  
**Content:**
- System resources (disk, CPU, memory, load, process TOP5)
- OpenClaw app (Gateway, models, tokens, sessions, channels)
- Memory system (files, chunks, vector, FTS, cache)

### 30-Minute Alerts
**Script:** `system_health_alert.sh`  
**Frequency:** Every 30 minutes  
**Delivery:** Telegram (CC) — only on critical alerts  
**Thresholds:**
| Metric | 🔴 Threshold |
|--------|-------------|
| Disk usage | ≥95% |
| Memory usage | ≥95% |
| Load ratio | ≥1.0 |
| Gateway status | stopped |
| Memory FTS | != ready |

### On-Demand Health Check
```bash
openclaw status --deep
```

### Health Dashboard
**URL:** http://127.0.0.1:18789/  
**Access:** Localhost only (SSH tunnel for remote)

---

## 4. Feishu Drive Safety

### Protected Folders (Cannot Delete/Move)
| Name | Token | Purpose |
|------|-------|---------|
| CC文件柜 | `RfSrf8oMYlMyQTdbW0ZcGSE1nNb` | CC personal files |
| 小春文件柜 | `Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd` | Shared work directory |
| 回收站 | `XcTHfLy7clpx51dBomLcvA7XnTf` | Soft delete (30-day auto cleanup) |
| 📁测试归档 | `TZa9f0KaQldDPXdDnX6cF3K7nme` | Test folder storage |

### Safe Scripts
```bash
# Create folder
bash /home/admin/.openclaw/scripts/feishu_create_folder.sh "<name>" "<parent_token>"

# Preview delete (recommended first)
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --dry-run

# Soft delete (to recycle bin, 30-day retention)
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --force

# Permanent delete (irreversible)
bash /home/admin/.openclaw/scripts/feishu_delete_folder.sh --token <token> --permanent --force

# Preview move
bash /home/admin/.openclaw/scripts/feishu_move_folder.sh --token <token> --dest <dest_token> --dry-run
```

### Audit Log
**Location:** `/home/admin/.openclaw/logs/feishu_drive_operations.log`  
**Retention:** 90 days

### Deletion Safety Rule
**Any deletion must:**
1.上报 chief-of-staff (neo)
2. CC approves
3. --dry-run first
4. --force to execute
5. Log entry created

---

## 5. Cron Job Management

### Naming Convention
**Format:** `{domain}-{function}-{frequency}`  
**Examples:**
- `系统健康异常告警` — System health anomaly alert
- `KM-Vault 飞书入库触发` — KM-Vault Feishu intake trigger
- `情报雷达 - 早报 (08:00)` — Intelligence radar morning brief

### Owner Assignment
Each cron job has one owner agent:
- System health → link
- KM-Vault → theodore (Chinese content)
- Intelligence radar → oracle (frontier awareness)
- Calendar sync → trinity (daily ops)
- AI News → oracle (learning)

### Error Handling
| Consecutive Errors | Action |
|--------------------|--------|
| 1 | Log, monitor |
| 2 | Alert owner agent |
| 3 | Alert neo (Guardian) |
| 4+ | Pause job, alert CC |

### Maintenance Commands
```bash
# List all cron jobs
openclaw cron list

# Disable job
openclaw cron disable <job_id>

# Enable job
openclaw cron enable <job_id>

# Run job now (debug)
openclaw cron run <job_id>

# View run history
openclaw cron runs <job_id>
```

---

## 6. Git Discipline

### Commit Convention
**Format:** `{agent}: {action} — {description}`  
**Examples:**
- `neo: coordinate — AI Learning Path v0.1 handoff to oracle`
- `link: backup — pre-migration backup created`
- `theodore: write — 公众号 article draft completed`

### Branch Strategy
- `main` — Stable baseline (verified changes)
- `dev` — Active development

### Required Commit Elements
1. Functionality description
2. Version number (if applicable)
3. Deployment environment
4. Change reason

### Push Policy
- Default: **do not push to origin** unless CC explicitly asks
- Migration commits: Always push after CC approval

---

## 7. Security Hardening

### SSH Configuration
```bash
# Verify secure SSH
grep -E "^PermitRootLogin|^PasswordAuthentication" /etc/ssh/sshd_config
# Expected: PermitRootLogin=no, PasswordAuthentication=no
```

### Firewall Rules
```bash
# Verify firewall (SSH + established + loopback only)
sudo iptables -L INPUT -n
# Expected: ACCEPT SSH(22), ESTABLISHED, LOOPBACK; DROP others
```

### Swap Configuration
```bash
# Verify swap (4GB minimum)
free -h | grep Swap
# Expected: 4GB+ swap, 0B used (unless under load)
```

### Key Management
**Double-layer architecture:**
1. `runtime-secrets.json` — Runtime secret resolution
2. `gateway.env` — Process startup environment variables
3. systemd `EnvironmentFile` — Service-level env vars

**Audit command:**
```bash
openclaw secrets audit
```

---

## 8. Troubleshooting Playbook

### Gateway Not Responding
```bash
# Check status
systemctl --user is-active openclaw-gateway

# Check logs
journalctl --user -u openclaw-gateway -n 50 --no-pager

# Restart
systemctl --user restart openclaw-gateway

# Verify
openclaw status --deep
```

### Channel Offline
```bash
# Check channel status
openclaw status --deep | grep -E "(ON|OK|Channel)"

# If Telegram: verify bot token
cat ~/.openclaw/runtime-secrets.json | jq '.TELEGRAM_BOT_TOKEN'

# If Feishu: verify app credentials
cat ~/.openclaw/runtime-secrets.json | jq '.FEISHU_*'
```

### Memory Corruption
```bash
# Check memory status
openclaw status --deep | grep -i memory

# If FTS != ready: rebuild index
# (Contact neo for escalation)

# If vector != ready: check embedding model config
```

### Cron Job Stuck
```bash
# Check task status
openclaw tasks audit

# Force cancel stale tasks (SQLite direct)
sqlite3 ~/.openclaw/tasks/runs.sqlite "UPDATE task_runs SET status='cancelled' WHERE status='running'"
```

---

## 9. Migration Checklist (For Future Migrations)

**Phase 0: Backup**
- [ ] Full system backup created
- [ ] Backup verified (files exist, readable)

**Phase 1: Create New**
- [ ] New agent directories created
- [ ] auth-profiles.json + models.json copied
- [ ] AGENTS.md, SOUL.md, IDENTITY.md, USER.md written

**Phase 2: Config Update**
- [ ] openclaw.json updated (agents.list)
- [ ] Bindings updated (channel routing)
- [ ] Tools profile updated (permissions)
- [ ] Cron jobs updated (agent references)

**Phase 3: Memory Migration**
- [ ] Memory files copied (old → new)
- [ ] MEMORY.md migrated
- [ ] Wiki files migrated (if applicable)

**Phase 4: Validation**
- [ ] openclaw config validate passes
- [ ] Gateway restarts successfully
- [ ] openclaw status --deep shows all healthy
- [ ] All channels respond (smoke test)
- [ ] Cron jobs run successfully
- [ ] A2A spawn works (neo → all agents)

**Phase 5: Cleanup (After 30 Days)**
- [ ] Old agents removed (directories)
- [ ] Old workspaces archived
- [ ] Git commit + push
- [ ] Documentation updated

---

**Version:** v1.0 (2026-04-11)  
**Inherited from:** chief-of-staff, sysop, coder-hub  
**Owned by:** link (new system)  
**Next Review:** 2026-05-11 (30 days)
