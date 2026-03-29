#!/usr/bin/env bash
set -euo pipefail

BASE="$HOME/.openclaw"
BACKUP_DIR="$HOME/.openclaw-backup/backup-$(date +%Y%m%d-%H%M%S)"
RUNTIME_SECRETS="$BASE/runtime-secrets.json"
AUTH_SHARED="$BASE/shared-auth/auth-profiles.shared.json"

mkdir -p "$(dirname "$BACKUP_DIR")"
if [ -d "$BASE" ]; then
  cp -a "$BASE" "$BACKUP_DIR"
fi

install -d -m 700 \
  "$BASE/shared-auth" \
  "$BASE/agents/chief-of-staff/agent" \
  "$BASE/agents/work-hub/agent" \
  "$BASE/agents/venture-hub/agent" \
  "$BASE/agents/life-hub/agent" \
  "$BASE/agents/product-studio/agent" \
  "$BASE/workspace-chief/memory" \
  "$BASE/workspace-work/memory" \
  "$BASE/workspace-venture/memory" \
  "$BASE/workspace-life/memory" \
  "$BASE/workspace-product/memory"

install -m 600 /dev/null "$AUTH_SHARED"
for agent in chief-of-staff work-hub venture-hub life-hub product-studio; do
  rm -f "$BASE/agents/$agent/agent/auth-profiles.json"
  ln "$AUTH_SHARED" "$BASE/agents/$agent/agent/auth-profiles.json"
done

cat > "$BASE/openclaw.json" <<JSON
{
  "secrets": {
    "providers": {
      "runtime": {
        "source": "file",
        "path": "$RUNTIME_SECRETS",
        "mode": "json"
      }
    },
    "defaults": {
      "file": "runtime"
    }
  },
  "auth": {
    "order": {
      "google": [
        "google:primary",
        "google:secondary",
        "google:tertiary"
      ],
      "minimax": [
        "minimax:primary"
      ]
    }
  },
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main"
      }
    },
    "list": [
      {
        "id": "chief-of-staff",
        "default": true,
        "workspace": "~/.openclaw/workspace-chief",
        "agentDir": "~/.openclaw/agents/chief-of-staff/agent",
        "model": {
          "primary": "google/gemini-3.1-flash-lite-preview",
          "fallbacks": [
            "minimax/MiniMax-M2.7"
          ]
        }
      },
      {
        "id": "work-hub",
        "workspace": "~/.openclaw/workspace-work",
        "agentDir": "~/.openclaw/agents/work-hub/agent",
        "model": {
          "primary": "google/gemini-3.1-flash-lite-preview",
          "fallbacks": [
            "google/gemini-3.1-pro-preview",
            "minimax/MiniMax-M2.7"
          ]
        }
      },
      {
        "id": "venture-hub",
        "workspace": "~/.openclaw/workspace-venture",
        "agentDir": "~/.openclaw/agents/venture-hub/agent",
        "model": {
          "primary": "google/gemini-3.1-flash-lite-preview",
          "fallbacks": [
            "google/gemini-3.1-pro-preview",
            "minimax/MiniMax-M2.7"
          ]
        }
      },
      {
        "id": "life-hub",
        "workspace": "~/.openclaw/workspace-life",
        "agentDir": "~/.openclaw/agents/life-hub/agent",
        "model": {
          "primary": "google/gemini-3.1-flash-lite-preview",
          "fallbacks": [
            "minimax/MiniMax-M2.7"
          ]
        }
      },
      {
        "id": "product-studio",
        "workspace": "~/.openclaw/workspace-product",
        "agentDir": "~/.openclaw/agents/product-studio/agent",
        "model": {
          "primary": "google/gemini-3.1-pro-preview",
          "fallbacks": [
            "google/gemini-3.1-flash-lite-preview",
            "minimax/MiniMax-M2.7"
          ]
        }
      }
    ]
  },
  "session": {
    "dmScope": "per-channel-peer"
  },
  "channels": {
    "telegram": {
      "accounts": {
        "chief": {
          "dmPolicy": "pairing",
          "botToken": {
            "source": "file",
            "provider": "runtime",
            "id": "/TELEGRAM_BOT_TOKEN_CHIEF"
          }
        },
        "personal": {
          "dmPolicy": "pairing",
          "botToken": {
            "source": "file",
            "provider": "runtime",
            "id": "/TELEGRAM_BOT_TOKEN_PERSONAL"
          }
        }
      }
    },
    "feishu": {
      "accounts": {
        "work": {
          "appId": "__SET_FEISHU_APP_ID__",
          "appSecret": {
            "source": "file",
            "provider": "runtime",
            "id": "/FEISHU_APP_SECRET"
          }
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "chief-of-staff",
      "match": {
        "channel": "telegram",
        "accountId": "chief"
      }
    },
    {
      "agentId": "venture-hub",
      "match": {
        "channel": "telegram",
        "accountId": "personal",
        "peer": {
          "kind": "group",
          "id": "TELEGRAM_VENTURE_GROUP_ID"
        }
      }
    },
    {
      "agentId": "life-hub",
      "match": {
        "channel": "telegram",
        "accountId": "personal",
        "peer": {
          "kind": "group",
          "id": "TELEGRAM_LIFE_GROUP_ID"
        }
      }
    },
    {
      "agentId": "life-hub",
      "match": {
        "channel": "telegram",
        "accountId": "personal"
      }
    },
    {
      "agentId": "work-hub",
      "match": {
        "channel": "feishu",
        "accountId": "work"
      }
    }
  ],
  "plugins": {
    "slots": {
      "memory": "memory-core",
      "contextEngine": "legacy"
    }
  }
}
JSON

cat > "$BASE/workspace-chief/SOUL.md" <<MD
你是 Jack 的数字参谋长。
你的职责是识别任务属于工作、创业还是生活域，并做调度与统筹。
你默认不做高风险执行。
你优先保持边界清晰、信息整洁、任务可推进。
MD
cat > "$BASE/workspace-chief/AGENTS.md" <<MD
- 默认先判断任务属于 work / venture / life 哪一域
- 跨域任务由你统筹
- 需要深入产品设计时可建议调用 product-studio
- 不把工作机密带入生活或创业域
- 不把生活财务细节带入工作域
MD
cat > "$BASE/workspace-chief/MEMORY.md" <<MD
# 长期记忆
- 这是 Jack 的跨域总控数字助理
- 当前系统采用 work / venture / life 三域结构
- 当前版本不使用 mem0 和 LCM
MD
cat > "$BASE/workspace-work/SOUL.md" <<MD
你是 Jack 的正式工作中枢。
你处理产品设计、市场营销、客户管理、团队管理等正式工作任务。
你重视稳定、专业、可落地。
MD
cat > "$BASE/workspace-work/AGENTS.md" <<MD
- 只处理正式工作相关事务
- 优先保持输出可执行、贴近真实业务
- 需要细化产品设计时可建议调用 product-studio
- 不主动引入生活域和创业域信息
MD
cat > "$BASE/workspace-work/MEMORY.md" <<MD
# 长期记忆
- 这是正式工作域中枢
- 主要任务类型包括产品、营销、客户、团队管理
MD
cat > "$BASE/workspace-venture/SOUL.md" <<MD
你是 Jack 的创业准备中枢。
你处理 AI 驱动的个人创业准备、产品探索、PMF 思考和实验设计。
你强调速度、实验和聚焦。
MD
cat > "$BASE/workspace-venture/AGENTS.md" <<MD
- 只处理个人创业和创业准备相关事务
- 重视 PMF、MVP、实验设计和资源约束
- 不默认使用正式工作机密
MD
cat > "$BASE/workspace-venture/MEMORY.md" <<MD
# 长期记忆
- 这是创业域中枢
- 主要任务包括 AI 创业方向、产品探索、MVP 和 PMF
MD
cat > "$BASE/workspace-life/SOUL.md" <<MD
你是 Jack 的生活中枢。
你处理日常事务、计划、理财、学习与成长。
你保持低摩擦、清晰、稳健。
MD
cat > "$BASE/workspace-life/AGENTS.md" <<MD
- 只处理生活、财务、事务、学习和成长类问题
- 不主动拉入工作域上下文
- 输出尽量简洁、可执行
MD
cat > "$BASE/workspace-life/MEMORY.md" <<MD
# 长期记忆
- 这是生活域中枢
- 主要任务包括日常事务、理财、学习与成长
MD
cat > "$BASE/workspace-product/SOUL.md" <<MD
你是 Jack 的产品设计 specialist。
你负责需求分析、方案设计、PRD 结构、功能边界和产品路线思考。
你更偏高质量思考和结构化输出。
MD
cat > "$BASE/workspace-product/AGENTS.md" <<MD
- 这是后台 specialist，不是前台主入口
- 重点处理产品设计、结构化分析、PRD 和复杂方案思考
- 不主动接管其他域的总控职责
MD
cat > "$BASE/workspace-product/MEMORY.md" <<MD
# 长期记忆
- 这是产品设计 specialist
- 默认服务于 work-hub，也可为 venture-hub 提供产品设计支持
MD

cat > "$BASE/manual-auth-commands.sh" <<MD
#!/usr/bin/env bash
set -euo pipefail
export OPENCLAW_AGENT_DIR="$HOME/.openclaw/agents/chief-of-staff/agent"
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"
openclaw models auth paste-token --provider google --profile-id "google:primary"
openclaw models auth paste-token --provider google --profile-id "google:secondary"
openclaw models auth paste-token --provider google --profile-id "google:tertiary"
openclaw models auth paste-token --provider minimax --profile-id "minimax:primary"
openclaw models auth order set --provider google google:primary google:secondary google:tertiary
openclaw models auth order set --provider minimax minimax:primary
MD

chmod 700 "$BASE/bootstrap_openclaw_rebuild.sh" "$BASE/manual-auth-commands.sh"
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" openclaw config validate
export OPENCLAW_AGENT_DIR="$HOME/.openclaw/agents/chief-of-staff/agent"
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" openclaw models auth order get --provider google
