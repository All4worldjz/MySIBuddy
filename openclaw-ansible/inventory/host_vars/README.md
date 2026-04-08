# OpenClaw 变量配置示例
# 此文件定义可在 host_vars 中覆盖的变量

# 时区配置
# system_timezone: "America/New_York"

# Node.js 版本
# nodejs_version: "24"

# OpenClaw 版本
# openclaw_version: "2026.4.5"

# Agent 配置示例（覆盖全局默认值）
# openclaw_agents:
#   - id: "chief-of-staff"
#     model: "modelstudio/qwen3.5-plus"  # 使用不同模型

# 安全加固配置示例
# security_hardening:
#   ssh:
#     max_auth_tries: 5
#   fail2ban:
#     enabled: false  # 禁用 fail2ban

# 密钥模板示例（实际密钥应在部署后手动填写）
# secrets_templates:
#   runtime_secrets:
#     minimax_api_key: ""
#     modelstudio_api_key: ""
