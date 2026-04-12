# Wiki Monitor - 完整项目文档

> **版本**: v1.1.0  
> **最后更新**: 2026-04-10  
> **状态**: ✅ 生产就绪

---

## 📦 项目概述

Wiki Monitor 是服务器端定时监控任务的**本地镜像版本**，用于在本地环境测试、调试和预览 Wiki 同步任务。

### 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| Wiki Git 同步 | 自动 Pull/Commit/Push 到 GitHub | ✅ |
| 飞书 → Wiki 同步 | 从飞书 KM-Vault 导出文档到 Wiki | ✅ |
| Wiki → 飞书同步 | 将编译后的 Wiki 镜像到飞书 | ✅ |
| Wiki 健康检查 | 检查 Wiki 状态并生成报告 | ✅ |
| 健康检查 HTTP 服务器 | 提供 /health 端点 | ✅ |
| Telegram 通知 | 任务失败时发送通知 | ✅ |
| 重试和退避 | 自动处理 API 限流和临时错误 | ✅ |

---

## 🏗️ 架构设计

```
wiki-monitor/
├── config/                          # 配置目录
│   ├── default.json                # 默认配置（版本控制）
│   ├── secrets.example.json        # 密钥模板
│   └── cron-schedule.json          # Cron 调度配置
├── src/                             # 源代码
│   ├── monitor.js                  # 统一监控调度器
│   ├── wiki-sync.js                # Wiki Git 同步
│   ├── feishu-to-wiki.js           # 飞书 → Wiki 同步
│   ├── wiki-to-feishu.js           # Wiki → 飞书同步
│   ├── wiki-health.js              # Wiki 健康检查
│   └── utils/
│       ├── logger.js               # 日志工具（Winston）
│       ├── feishu-retry.js         # 飞书 API 重试处理器
│       ├── health-server.js        # 健康检查 HTTP 服务器
│       ├── telegram-notifier.js    # Telegram 通知模块
│       └── env-loader.js           # .env 文件加载器
├── tests/                           # 单元测试
│   ├── feishu-to-wiki.test.js
│   ├── wiki-sync.test.js
│   ├── wiki-health.test.js
│   └── feishu-connection.js        # 连接测试脚本
├── logs/                            # 日志目录（gitignore）
│   ├── monitor.log
│   ├── wiki-sync.log
│   ├── feishu-to-wiki.log
│   ├── wiki-to-feishu.log
│   └── wiki-health.log
├── .env.example                     # 环境变量模板
├── .gitignore
├── package.json
├── README.md                        # 完整文档
├── QUICKSTART.md                    # 快速开始指南
└── SMOKE_TEST_REPORT.md            # 冒烟测试报告
```

---

## 🚀 快速开始

### 1. 安装

```bash
cd wiki-monitor
npm install
```

### 2. 配置密钥

**方式 A：使用 .env 文件（推荐）**

```bash
cp .env.example .env
# 编辑 .env 填入实际值
```

**方式 B：使用 config/secrets.json**

```bash
cp config/secrets.example.json config/secrets.json
# 编辑 config/secrets.json
```

### 3. 运行

```bash
# 运行所有任务（一次性）
npm run monitor

# 持续监控模式（模拟服务器 cron）
npm run monitor:watch

# 模拟运行（不实际执行）
npm run monitor:dry-run

# 运行单个任务
npm run test:wiki-sync
npm run test:feishu-to-wiki
npm run test:wiki-to-feishu
npm run test:wiki-health
```

### 4. 健康检查

```bash
# 启动后访问
curl http://localhost:3100/health
curl http://localhost:3100/health/tasks
curl http://localhost:3100/health/ready
```

### 5. 查看日志

```bash
npm run logs
tail -f logs/wiki-sync.log
```

---

## 📋 任务调度配置

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

## 🔧 核心模块说明

### 1. Monitor（监控调度器）

**职责**: 
- 注册和管理所有定时任务
- 启动健康检查 HTTP 服务器
- 集成 Telegram 通知
- 处理任务成功/失败事件

**关键代码**:
```javascript
class Monitor {
  constructor() {
    this.tasks = new Map();
    this.taskFunctions = new Map();
    this.healthServer = new HealthServer(3100);
    this.telegram = new TelegramNotifier(botToken, chatId);
  }
  
  registerTask(name, schedule, taskFn) { ... }
  async start() { ... }
  async runAllTasks() { ... }
  stop() { ... }
}
```

### 2. FeishuRetryHandler（飞书 API 重试）

**职责**:
- 指数退避重试逻辑
- 处理 API 限流（429）
- 处理临时错误（500, 502, 503, 504）
- 添加随机抖动避免惊群效应

**配置**:
```javascript
{
  maxRetries: 3,
  initialDelay: 1000,    // 1 秒
  maxDelay: 30000,       // 30 秒
  backoffMultiplier: 2,  // 指数退避
  retryableStatus: [429, 500, 502, 503, 504],
  retryableCodes: [99991400, 99991664]
}
```

**使用示例**:
```javascript
const response = await FeishuRetryHandler.execute(
  () => axios.get(url, config),
  { maxRetries: 3 }
);
```

### 3. HealthServer（健康检查 HTTP 服务器）

**端点**:

| 端点 | 方法 | 描述 | 状态码 |
|------|------|------|--------|
| `/health` | GET | 整体健康状态 | 200/503 |
| `/health/tasks` | GET | 所有任务详细状态 | 200 |
| `/health/ready` | GET | 是否准备好 | 200/503 |

**响应示例** (`/health`):
```json
{
  "status": "healthy",
  "uptime": "2h 15m 30s",
  "timestamp": "2026-04-10T10:00:00.000Z",
  "version": "1.1.0",
  "tasksTotal": 4,
  "tasksHealthy": 4,
  "tasksUnhealthy": 0
}
```

### 4. TelegramNotifier（Telegram 通知）

**功能**:
- 任务失败通知
- 任务成功通知（可选）
- 每日摘要
- 健康状态报告

**消息格式**:
```
🚨 监控任务失败

📋 任务: wikiSync
⏰ 时间: 2026-04-10 10:00:00
❌ 错误: Wiki 目录不存在

请检查日志获取详细信息。
```

---

## 🧪 测试

### 运行测试

```bash
# 单元测试
npm test

# 连接测试
npm run test:feishu-connection

# 冒烟测试
npm run monitor:dry-run
```

### 测试覆盖

| 模块 | 测试数 | 状态 |
|------|--------|------|
| feishu-to-wiki | 8 | ✅ |
| wiki-sync | 7 | ✅ |
| wiki-health | 7 | ✅ |
| **总计** | **22** | **✅** |

---

## 📊 监控指标

### 健康状态

| 状态 | 描述 | 动作 |
|------|------|------|
| `healthy` | 所有任务正常 | 无需操作 |
| `degraded` | 部分任务失败 | 检查日志 |
| `unhealthy` | 多数任务失败 | 立即调查 |
| `starting` | 系统启动中 | 等待 |

### 日志指标

- **成功任务**: 记录成功次数和最后成功时间
- **失败任务**: 记录错误信息和最后失败时间
- **API 调用**: 记录重试次数和最终结果

---

## 🔐 安全注意事项

1. **密钥管理**:
   - 不要将 `.env` 或 `secrets.json` 提交到 Git
   - 使用 `.env.example` 作为模板
   - 生产环境使用环境变量

2. **API 限流防护**:
   - 自动重试和退避
   - 限制单次请求数量
   - 添加延迟避免触发限流

3. **错误处理**:
   - 所有异步操作都有 try-catch
   - 失败时记录详细日志
   - 可选的 Telegram 通知

---

## 🛠️ 开发和扩展

### 添加新任务

1. 在 `src/` 创建任务文件（如 `new-task.js`）
2. 导出单例并实现 `run()` 方法
3. 在 `config/cron-schedule.json` 添加调度配置
4. 在 `src/monitor.js` 注册任务
5. 在 `tests/` 创建测试文件
6. 在 `package.json` 添加 npm script

### 示例：添加新任务

```javascript
// src/new-task.js
const { createTaskLogger } = require('./utils/logger');
const logger = createTaskLogger('new-task');

class NewTask {
  async run() {
    logger.info('========== 开始新任务 ==========');
    // 任务逻辑
    logger.info('========== 新任务完成 ==========');
  }
}

const newTask = new NewTask();

if (require.main === module) {
  newTask.run().catch(console.error);
}

module.exports = newTask;
```

```json
// config/cron-schedule.json
{
  "newTask": {
    "schedule": "0 * * * *",
    "enabled": true,
    "description": "新任务描述"
  }
}
```

```javascript
// src/monitor.js
const newTask = require('./new-task');

// 在 start() 方法中注册
this.registerTask('newTask', cronSchedule.newTask.schedule, () => newTask.run());
```

---

## 📝 变更日志

### v1.1.0 (2026-04-10)

**新增**:
- ✅ 飞书 API 重试和退避逻辑
- ✅ Wiki → 飞书文档块 API 集成
- ✅ .env 配置支持
- ✅ 健康检查 HTTP 服务器（/health 端点）
- ✅ Telegram 通知模块
- ✅ 22 个单元测试

**修复**:
- ✅ 模块路径错误
- ✅ JSDoc 解析错误
- ✅ Git 初始化崩溃
- ✅ node-cron API 错误

**改进**:
- ✅ 优雅降级（目录不存在时不崩溃）
- ✅ 日志系统（独立任务日志）
- ✅ 错误处理（完整的 try-catch）

### v1.0.0 (2026-04-10)

- ✅ 初始版本
- ✅ 4 个核心任务
- ✅ 基础调度器
- ✅ 冒烟测试通过

---

## 🔗 相关文档

- [服务器端 Cron 任务配置](../docs/wiki-cron-tasks.md)
- [飞书 Wiki 双向同步方案](../docs/feishu-wiki-bidirectional-sync.md)
- [快速开始指南](QUICKSTART.md)
- [冒烟测试报告](SMOKE_TEST_REPORT.md)

---

## 👥 维护者

- **tech-mentor (大师)**: AI 导师，技术选型和架构设计
- **coder-hub (小码哥)**: 编程助手，代码实现和测试

---

## 📄 许可证

MIT License

---

**文档版本**: v1.1  
**最后更新**: 2026-04-10  
**状态**: ✅ 生产就绪
