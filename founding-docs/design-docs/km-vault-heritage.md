# KM-Vault Heritage — Knowledge Management System

**Date:** 2026-04-11  
**Source:** `workspace-tech-mentor/KM_Vault/`  
**Destination:** `theodore` (Keeper) + `oracle` (Learning)  
**Status:** ✅ Preserved for migration

---

## 1. System Overview

**KM-Vault (Knowledge Vault)** — Knowledge management system based on Karpathy's "LLM Knowledge Bases" design.

**Core Philosophy:**
- **Knowledge as file system** — Markdown directory trees instead of vector databases
- **Compile once, stay fresh** — LLM actively organizes knowledge, not just retrieves
- **Schema-driven** — AGENTS.md defines agent behavior
- **Ingest = compile** — New documents auto-trigger LLM processing

---

## 2. Architecture (Inherited)

```
┌──────────────────────────────────────────────────┐
│              Docker Container                    │
│  ┌────────────────────────────────────────────┐ │
│  │  Knowledge Compiler Agent                  │ │
│  │  - raw/ → Ingest raw docs (read-only)      │ │
│  │  - wiki/ → Auto-generated Markdown         │ │
│  │  - schema/ → Config (AGENTS.md, etc.)      │ │
│  └────────────────────────────────────────────┘ │
│                    │                              │
│                  API                            │
│                    ▼                              │
│  ┌────────────────────────────────────────────┐ │
│  │  Feishu My_KM_Vault                        │ │
│  │  - raw/, wiki/, schema/, docs/             │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 3. Directory Structure (Preserved)

```
KM_Vault/
├── Dockerfile              # Docker image config
├── docker_build.sh         # Build script
├── .env.example            # Environment template
├── .github/
│   └── workflows/
│       └── km-vault.yml    # CI/CD config
├── raw/                    # Raw documents (awaiting compilation)
├── wiki/                   # Compiled knowledge base
│   ├── concepts/          # Concept definitions
│   ├── entities/          # Entity pages
│   ├── qa/                # Q&A pairs
│   ├── summary/           # Document summaries
│   └── reports/           # Inspection reports
├── schema/                 # Agent instruction config
│   ├── AGENTS.md          # Agent role definitions
│   └── WIKI_SCHEMA.md     # Knowledge naming conventions
└── docs/                   # System documentation
    └── 灌入流程.md         # User guide
```

---

## 4. Workflows (Inherited)

### Ingest Workflow (灌入流程)
1. User uploads document to `raw/` (Feishu or CLI)
2. Docker cron scans for new files every 5 minutes
3. Calls `coder-hub` to compile into `wiki/` structured knowledge
4. Generates `wiki/.metadata.json` with metadata

### Question Workflow (提问流程)
1. User asks: "关于 Karpathy LLM Wiki 的设计原理"
2. `coder-hub` retrieves relevant pages from `wiki/`
3. LLM synthesizes answer
4. High-quality answer → generates `wiki/qa/Q20260408-001.md`

### Inspection Workflow (巡检流程)
1. Every Sunday 22:00 (automatic)
2. Checks broken links, contradictions, gaps
3. Generates `wiki/reports/weekly_YYYY-MM-DD.md`

---

## 5. Tool Chain (Preserved)

| Tool | Purpose | Owner |
|------|---------|-------|
| **Obsidian** | Human editing/viewing (Feishu native editor) | theodore |
| **qmd** | Local Markdown search (BM25 + vector) | link |
| **Dataview** | Dynamic table queries (memory_search alternative) | theodore |
| **Marp** | PPT generation (extract from wiki/) | theodore + architect |

---

## 6. Disk Space Estimates (For Reference)

| Environment | Minimum | Maximum |
|-------------|---------|---------|
| Docker volume | 2.5GB | 4.5GB |
| Feishu cloud | 0.7GB | 2.5GB |
| **Total** | **3.2GB** | **7GB** |

---

## 7. Security Constraints (Inherited)

| Constraint | Owner |
|------------|-------|
| `raw/` write-protected (except uploader) | link |
| `wiki/` manual editing prohibited (must go through compilation) | theodore |
| `schema/` writable only by tech-mentor → now oracle | oracle |
| All operations must log permission requests | link |

---

## 8. Feishu Folder Link

📁 **My_KM_Vault**: https://pbrhmf5bin.feishu.cn/drive/folder/QB50fa4HYlYPCRd5Q8Cck6MMnvf

**Token:** `QB50fa4HYlYPCRd5Q8Cck6MMnvf`

---

## 9. Cron Jobs to Migrate

| Job ID | Name | Schedule | New Owner |
|--------|------|----------|-----------|
| `a15b2f2c-b6b7-48ad-9b88-df64561df2f2` | KM-Vault 每周系统巡检 | Weekly Sunday 22:00 | theodore |
| `1db28b74-be50-47a9-8bd2-6847a5eeeb5e` | KM-Vault 飞书 raw 目录扫描 | Hourly | theodore |
| `3b340869-404d-4c73-9500-b3c10dcbb059` | KM-Vault 飞书入库触发 | Every 12h | theodore |
| `sys-migrated-4` | Wiki 飞书同步 | Daily 03:00 | theodore |

---

## 10. Migration Notes

**What to Preserve:**
- ✅ Docker container structure
- ✅ Raw → wiki compilation workflow
- ✅ Q&A pair generation
- ✅ Weekly inspection reports
- ✅ Schema-driven design (AGENTS.md, WIKI_SCHEMA.md)
- ✅ Feishu integration

**What to Adapt:**
- 🔄 Owner: tech-mentor → theodore (Keeper role)
- 🔄 Compilation agent: coder-hub → theodore (for Chinese content) + oracle (for AI knowledge)
- 🔄 Cron job agent references updated

**What to Deprecate:**
- ❌ 5-minute scan interval (too frequent → change to hourly)
- ❌ coder-hub as primary compiler (theodore owns knowledge curation)

---

## 11. Post-Migration TODOs

1. **theodore** reviews wiki/ structure for completeness
2. **link** verifies Docker container health
3. **oracle** validates AI knowledge compilation quality
4. **CC** tests question workflow (ask → retrieve → answer)
5. **neo** monitors first weekly inspection report

---

## 12. Related Links

- [Karpathy LLM Knowledge Bases](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [OpenClaw Official Docs](https://docs.openclaw.ai)
- [Technical Spec](KM_Vault/.github/docs/技术选型.md)

---

**Version:** v1.0 (2026-04-11)  
**Inherited from:** tech-mentor KM_Vault  
**Owned by:** theodore (Keeper) + oracle (Learning)  
**Next Review:** 2026-05-11 (30 days post-migration)
