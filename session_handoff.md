# Session Handoff

Last updated: 2026-04-03

## Current repo state

- Branch: `dev`
- Latest commit: `pending`
- This commit contains:
  - Formally upgraded to **OpenClaw 2026.4.2**.
  - Finalized **Unified Search Orchestrator** via Host Microservice (bypass sandbox limits).
  - Implemented **System-wide Tiered Security** (Chief unsandboxed, all Hubs sandboxed).
  - Added `HANDOFF_SEARCH_FIX.md` for technical transition.

## Current production state

Verified on remote host `admin@47.82.234.46` (OpenClaw 2026.4.2):

- `openclaw-gateway` running (Version: **2026.4.2**)
- `Channels`: Telegram (3/3), Feishu (2/2), Weixin (1/1) — all **ON / OK**.
- **Security Posture**:
  - **Chief-of-Staff**: High-trust orchestrator, unsandboxed, holds `system-admin` and `unified_search` powers.
  - **Hub Agents**: Fully sandboxed (Docker), restricted to `workspaceOnly` file access.
- **Search Engine**:
  - Microservice running on host port `18790`.
  - Providers: DDG (Cost-effective), EXA (Social/Trends), Tavily (Deep Fetch).

## What happened in this session

1. **Version Consolidation**: Finalized the physical upgrade to **2026.4.2**, resolving Systemd path drifts.
2. **Search Orchestration**:
   - Deployed `search_service.js` as a host-level microservice to bypass sandboxing tool-visibility issues.
   - Updated Skill to use `curl` for bridging between Sandbox and Host.
   - Established the "Master-Worker" delegation protocol for intelligence gathering.
3. **Global Security Hardening**:
   - Enabled physical Docker sandboxing for all Hub agents.
   - Stripped sensitive tools from Hub agents to minimize attack surface.
   - Centralized all administrative and network-access tools to the Chief agent.
4. **Cleanup**: Removed all legacy `.tgz` backups and temporary configuration candidate files.

## Read this first next time

1. `HANDOFF_SEARCH_FIX.md`: Critical reading for continuing search orchestrator integration.
2. `GEMINI.md`: For the latest tiered security and delegation guidelines.
3. `session_handoff.md`: For today's full change log.
