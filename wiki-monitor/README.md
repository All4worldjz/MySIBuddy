# Wiki Monitor - 本地监控工具

> **目的**: 在本地运行服务器端的定时监控任务，用于测试、调试和预览
> **服务器路径**: `admin@47.82.234.46:/home/admin/.openclaw/scripts/`

---

## 一、功能概述

本工具是服务器端定时任务的**本地镜像版本**，允许在本地环境测试和验证以下任务：

| 任务 | 服务器 Cron | 本地测试命令 |
|------|-------------|-------------|
| Wiki Git 自动同步 | `*/15 * * * *` | `npm run test:wiki-sync` |
| 飞书 → Wiki 同步 | `0 */6 * * *` | `npm run test:feishu-to-wiki` |
| Wiki → 飞书同步 | `0 3 * * *` | `npm run test:wiki-to-feishu` |
| Wiki 健康检查 | `0 6 * * *` | `npm run test:wiki-health` |

---

## 二、架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Wiki Monitor                         │
│                                                         │
│  src/                                                   │
│  ├── wiki-sync.js          Wiki Git 同步               │
│  ├── feishu-to-wiki.js     飞书 → Wiki 同步            │
│  ├── wiki-to-feishu.js     Wiki → 飞书同步             │
│  ├── wiki-health.js        Wiki 健康检查               │
│  └── monitor.js            统一监控调度器               │
│                                                         │
│  config/                                                │
│  ├── default.json          默认配置                     │
│  ├── secrets.example.json  密钥配置模板                 │
│  └── cron-schedule.json    Cron 调度配置                │
│                                                         │
│  logs/                                                  │
│  ├── wiki-sync.log         Wiki 同步日志                │
│  ├── feishu-to-wiki.log    飞书同步日志                 │
│  ├── wiki-to-feishu.log    Wiki 导出日志                │
│  └── health-check.log      健康检查日志                 │
│                                                         │
│  tests/                                                 │
│  ├── wiki-sync.test.js     Wiki 同步测试                │
│  └── feishu-api.test.js    飞书 API 测试                │
└─────────────────────────────────────────────────────────┘
```

---

## 三、快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置密钥

```bash
cp config/secrets.example.json config/secrets.json
# 编辑 config/secrets.json 填入飞书、GitHub 凭证
```

### 3. 运行监控任务

```bash
# 运行所有监控任务（一次性）
npm run monitor

# 启动持续监控模式（模拟服务器 cron）
npm run monitor:watch

# 运行单个任务
npm run test:wiki-sync
npm run test:feishu-to-wiki
npm run test:wiki-to-feishu
npm run test:wiki-health
```

### 4. 查看日志

```bash
# 实时查看所有日志
npm run logs

# 查看特定任务日志
tail -f logs/wiki-sync.log
tail -f logs/feishu-to-wiki.log
```

---

## 四、配置说明

### config/secrets.json

```json
{
  "feishu": {
    "appId": "cli_xxx",
    "appSecret": "xxx",
    "kmVaultToken": "QB50fa4HYlYPCRd5Q8Cck6MMnvf"
  },
  "github": {
    "sshKey": "~/.ssh/id_ed25519",
    "repo": "git@github.com:All4worldjz/MySiBuddy-Wiki.git",
    "branch": "main"
  },
  "wiki": {
    "localPath": "~/.openclaw/wiki/main",
    "rawDir": "raw/articles",
    "wikiDir": "wiki"
  }
}
```

### config/cron-schedule.json

```json
{
  "wikiSync": {
    "schedule": "*/15 * * * *",
    "enabled": true,
    "description": "Wiki Git 自动同步"
  },
  "feishuToWiki": {
    "schedule": "0 */6 * * *",
    "enabled": true,
    "description": "飞书 → Wiki 同步"
  },
  "wikiToFeishu": {
    "schedule": "0 3 * * *",
    "enabled": true,
    "description": "Wiki → 飞书同步"
  },
  "wikiHealth": {
    "schedule": "0 6 * * *",
    "enabled": true,
    "description": "Wiki 健康检查"
  }
}
```

---

## 五、与服务器端的关系

| 对比项 | 服务器端 | 本地监控 |
|--------|----------|----------|
| **运行环境** | 远程 Linux (`47.82.234.46`) | 本地 macOS |
| **Wiki 路径** | `/home/admin/.openclaw/wiki/main` | `~/.openclaw/wiki/main` |
| **密钥存储** | `runtime-secrets.json` | `config/secrets.json` |
| **调度方式** | 系统 crontab | Node.js `node-cron` |
| **日志路径** | `/home/admin/.openclaw/logs/` | `./logs/` |
| **用途** | 生产环境运行 | 测试、调试、预览 |

---

## 六、开发指南

### 添加新监控任务

1. 在 `src/` 创建任务文件（如 `new-task.js`）
2. 在 `config/cron-schedule.json` 添加调度配置
3. 在 `src/monitor.js` 注册任务
4. 在 `tests/` 创建测试文件
5. 在 `package.json` 添加 npm script

### 测试流程

```bash
# 1. 单元测试
npm test

# 2. 集成测试（需要配置密钥）
npm run test:integration

# 3. 模拟运行（不实际执行）
npm run monitor -- --dry-run
```

---

## 七、故障排查

### 问题 1：飞书认证失败

```bash
# 检查 config/secrets.json
cat config/secrets.json | jq '.feishu'

# 测试飞书连接
npm run test:feishu-connection
```

### 问题 2：Git 同步失败

```bash
# 检查 SSH 密钥
ssh -T git@github.com

# 检查仓库访问权限
git ls-remote git@github.com:All4worldjz/MySiBuddy-Wiki.git
```

### 问题 3：Cron 任务未触发

```bash
# 检查 cron 配置
cat config/cron-schedule.json | jq '.wikiSync.enabled'

# 查看调度器日志
tail -f logs/monitor.log
```

---

## 八、相关文档

- [服务器端 Cron 任务配置](../docs/wiki-cron-tasks.md)
- [飞书 Wiki 双向同步方案](../docs/feishu-wiki-bidirectional-sync.md)
- [服务器部署指南](../docs/server-deployment.md)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-10  
**维护者**: tech-mentor (大师)
