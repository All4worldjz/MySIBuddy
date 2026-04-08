# 架构说明

## 整体架构

OpenClaw Ansible 项目采用**模块化角色设计**，每个角色负责一个特定的部署阶段。

### 部署流程

```
┌──────────────┐
│  前置检查    │
└──────┬───────┘
       ↓
┌──────────────┐
│ system-prep  │  ← 系统准备（包更新、依赖安装）
└──────┬───────┘
       ↓
┌──────────────┐
│   nodejs     │  ← Node.js 24.x 安装
└──────┬───────┘
       ↓
┌──────────────┐
│ openclaw-core│  ← OpenClaw CLI + 插件安装
└──────┬───────┘
       ↓
┌──────────────┐
│  security-   │  ← 安全加固（SSH/防火墙/swap）
│  hardening   │
└──────┬───────┘
       ↓
┌──────────────┐
│openclaw-     │  ← 8 Agent 集群配置
│  agents      │
└──────┬───────┘
       ↓
┌──────────────┐
│ openclaw-    │  ← Telegram/Feishu 渠道配置
│  channels    │
└──────┬───────┘
       ↓
┌──────────────┐
│  secrets-    │  ← 密钥模板生成
│  templates   │
└──────┬───────┘
       ↓
┌──────────────┐
│   主配置     │  ← openclaw.json + systemd 服务
└──────┬───────┘
       ↓
┌──────────────┐
│ post-deploy  │  ← 健康检查 + 部署报告
└──────────────┘
```

## 角色职责

### 1. system-prep
- 更新系统包（apt/dnf）
- 安装基础依赖（git、curl、jq 等）
- 配置时区和 locale
- 创建 admin 用户和目录结构

### 2. nodejs
- 安装 Node.js 24.x（nvm 或 NodeSource）
- 配置 npm 全局包
- 验证安装

### 3. openclaw-core
- 安装 OpenClaw CLI（指定版本）
- 安装插件（openclaw-lark、telegram 等）
- 验证安装

### 4. security-hardening
- **SSH 加固**：禁用 root 登录、禁用密码认证
- **防火墙**：UFW（Debian）或 firewalld（RHEL）
- **Swap**：4GB swapfile
- **fail2ban**：SSH 防爆破
- **自动更新**：unattended-upgrades

### 5. openclaw-agents
- 创建 8 Agent 目录
- 生成 AGENTS.md、SOUL.md、MEMORY.md
- 配置 auth-profiles.json、models.json
- 创建 memory 子目录

### 6. openclaw-channels
- 配置 Telegram 渠道（3 账号）
- 配置 Feishu 渠道（2 账号）
- 生成渠道 JSON 配置

### 7. secrets-templates
- 生成 runtime-secrets.json 模板
- 生成 gateway.env 模板
- 生成密钥配置说明
- 设置正确权限（600）

### 8. post-deploy
- 检查 OpenClaw 状态
- 检查渠道状态
- 检查 systemd 服务
- 生成部署报告

## 8 Agent 集群架构

### Agent 角色与路由

| Agent | 角色 | 渠道入口 | 模型 |
|-------|------|----------|------|
| chief-of-staff | 编排器 | Telegram chief | minimax/MiniMax-M2.7 |
| work-hub | 工作中枢 | Feishu work | minimax/MiniMax-M2.7 |
| venture-hub | 创业中枢 | Telegram personal (group) | minimax/MiniMax-M2.7 |
| life-hub | 生活中枢 | Telegram personal | minimax/MiniMax-M2.7 |
| product-studio | 产品设计 | 无直接入口 | minimax/MiniMax-M2.7 |
| zh-scribe | 中文成文 | Feishu scribe | minimax/MiniMax-M2.7 |
| tech-mentor | AI导师 | Telegram mentor | minimax/MiniMax-M2.7 |
| coder-hub | 编程助手 | 无直接入口 | minimax/MiniMax-M2.7 |

### 多智能体协作

```
chief-of-staff (编排器)
    ├─ work-hub
    ├─ venture-hub
    ├─ life-hub
    ├─ product-studio
    ├─ zh-scribe
    ├─ tech-mentor
    └─ coder-hub

tech-mentor
    └─ coder-hub (可 spawn)
```

### 工具权限策略

| Agent | Sandbox | Exec 权限 | 说明 |
|-------|---------|-----------|------|
| chief-of-staff | off | ✅ 允许 | 编排器，需要系统级访问 |
| coder-hub | off | ✅ 允许 | 编程助手，需要 CLI 访问 |
| tech-mentor | off | ❌ 禁止 | AI导师，需 spawn coder-hub |
| work-hub | off | ❌ 禁止 | 工作中枢 |
| venture-hub | off | ❌ 禁止 | 创业中枢 |
| life-hub | off | ❌ 禁止 | 生活中枢 |
| product-studio | off | ❌ 禁止 | 产品设计 |
| zh-scribe | off | ❌ 禁止 | 中文成文 |

## 模型路由

### 主提供商
- **MiniMax**: minimax/MiniMax-M2.7

### 备用链
- **阿里云百炼**: modelstudio/qwen3.5-plus
- **阿里云百炼**: modelstudio/kimi-k2.5

所有 Agent 共享相同的主模型和备用链。

## 通信渠道

### Telegram（3 账号）
- **chief**: chief-of-staff 入口
- **personal**: life-hub 入口 + venture-hub 群组
- **mentor**: tech-mentor 入口

### Feishu（2 账号）
- **work**: work-hub 入口（openclaw-lark 插件）
- **scribe**: zh-scribe 入口（openclaw-lark 插件）

## 密钥管理

### 双层存储架构

1. **runtime-secrets.json**: OpenClaw 运行时密钥（SecretRef 解析）
2. **gateway.env**: 环境变量（进程启动时加载）

### SecretRef 格式

```json
{
  "apiKeyRef": "/MINIMAX_API_KEY"
}
```

**注意**: `id` 字段必须以 `/` 开头（绝对 JSON 指针格式）

### 部署后必须

1. 编辑 `runtime-secrets.json` 填入真实密钥
2. 编辑 `gateway.env` 填入相同密钥
3. 重启 Gateway: `systemctl --user restart openclaw-gateway`
4. 验证: `openclaw secrets audit`

## systemd 服务配置

### 服务文件位置
```
/home/admin/.config/systemd/user/openclaw-gateway.service
```

### 服务配置
- **EnvironmentFile**: 从 gateway.env 加载环境变量
- **Restart**: on-failure（自动重启）
- **RestartSec**: 10 秒
- **安全加固**: NoNewPrivileges、ProtectSystem、ProtectHome

## 跨平台支持

### 支持的系统
- **Ubuntu**: 22.04, 24.04
- **Debian**: 11, 12
- **CentOS**: 9 Stream
- **Rocky Linux**: 9
- **AlmaLinux**: 9

### 平台差异处理

| 组件 | Debian/Ubuntu | RHEL/CentOS/Rocky |
|------|---------------|-------------------|
| 包管理器 | apt | dnf |
| 防火墙 | UFW | firewalld |
| 自动更新 | unattended-upgrades | dnf-automatic |
| 日志文件 | /var/log/auth.log | /var/log/secure |

Ansible 自动检测系统类型并应用正确的配置。

## 配置优先级

1. **group_vars/all.yml**: 全局默认值
2. **host_vars/<hostname>.yml**: 主机特定覆盖
3. **inventory 变量**: 主机清单中的变量

## 幂等性设计

所有角色都遵循幂等性原则：
- 可重复运行而不会破坏已有配置
- 使用 `creates`、`when` 等条件避免重复操作
- 使用 Ansible 模块的状态检查（`state: present`）

---

**最后更新**: 2026-04-08
