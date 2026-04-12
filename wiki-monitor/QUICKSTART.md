# Wiki Monitor 快速开始指南

> 5 分钟内启动本地 Wiki 监控

---

## 一、安装

```bash
# 进入项目目录
cd wiki-monitor

# 安装依赖（已完成）
npm install
```

---

## 二、配置密钥

```bash
# 复制密钥模板
cp config/secrets.example.json config/secrets.json

# 编辑密钥文件
open config/secrets.json
```

填入你的飞书和 GitHub 凭证：

```json
{
  "feishu": {
    "appId": "cli_your_actual_app_id",
    "appSecret": "your_actual_app_secret",
    "kmVaultToken": "your_km_vault_token"
  },
  "github": {
    "sshKey": "~/.ssh/id_ed25519"
  }
}
```

---

## 三、运行监控任务

### 方式 1：运行所有任务（一次性）

```bash
npm run monitor
```

### 方式 2：持续监控模式（模拟服务器 cron）

```bash
npm run monitor:watch
```

这会根据 `config/cron-schedule.json` 中的调度配置自动运行任务。

### 方式 3：运行单个任务

```bash
# Wiki Git 同步
npm run test:wiki-sync

# 飞书 → Wiki 同步
npm run test:feishu-to-wiki

# Wiki → 飞书同步
npm run test:wiki-to-feishu

# Wiki 健康检查
npm run test:wiki-health
```

### 方式 4：模拟运行（不实际执行）

```bash
npm run monitor:dry-run
```

---

## 四、查看日志

```bash
# 实时查看所有日志
npm run logs

# 查看特定日志
tail -f logs/wiki-sync.log
tail -f logs/feishu-to-wiki.log
tail -f logs/wiki-to-feishu.log
tail -f logs/wiki-health.log
```

---

## 五、测试连接

```bash
# 测试飞书连接
npm run test:feishu-connection

# 运行单元测试
npm test
```

---

## 六、常见任务场景

### 场景 1：测试飞书同步

```bash
# 1. 确保 config/secrets.json 已配置
# 2. 运行飞书 → Wiki 同步
npm run test:feishu-to-wiki

# 3. 查看日志
tail -f logs/feishu-to-wiki.log
```

### 场景 2：测试 Wiki Git 同步

```bash
# 1. 确保本地 Wiki 目录存在（~/.openclaw/wiki/main）
# 2. 运行 Wiki Git 同步
npm run test:wiki-sync

# 3. 查看日志
tail -f logs/wiki-sync.log
```

### 场景 3：完整监控流程

```bash
# 1. 启动持续监控模式
npm run monitor:watch

# 2. 等待任务自动触发（或手动触发）
# 3. 查看日志
tail -f logs/*.log
```

---

## 七、故障排查

### 问题 1：找不到模块

```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

### 问题 2：飞书认证失败

```bash
# 检查密钥配置
cat config/secrets.json | jq '.feishu'

# 测试连接
npm run test:feishu-connection
```

### 问题 3：Git 同步失败

```bash
# 检查 SSH 密钥
ssh -T git@github.com

# 检查仓库访问
git ls-remote git@github.com:All4worldjz/MySiBuddy-Wiki.git
```

---

## 八、下一步

- 📖 阅读 [完整文档](README.md)
- 🔧 查看 [服务器端 Cron 任务配置](../docs/wiki-cron-tasks.md)
- 📝 了解 [飞书 Wiki 双向同步方案](../docs/feishu-wiki-bidirectional-sync.md)

---

**最后更新**: 2026-04-10
