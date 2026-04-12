# OpenClaw Ops Monitor - 系统与应用全链路监控

> **目的**: 统一监控 Linux 系统健康 + OpenClaw 应用状态 + Cron 任务执行情况  
> **服务器**: admin@47.82.234.46  
> **版本**: v1.0.0  
> **创建日期**: 2026-04-10

---

## 📊 监控范围

### 1. 系统层监控（继承 system_health_report.sh v2.1.0）

| 指标 | 告警阈值 | 采集方式 |
|------|----------|----------|
| 磁盘使用率 | 🟡 ≥80% 🔴 ≥95% | `df -hT` |
| CPU 利用率 | 🟡 ≥70% 🔴 ≥90% | `/proc/stat` 采样 |
| 内存使用率 | 🟡 ≥80% 🔴 ≥95% | `/proc/meminfo` |
| 系统负载 | 🟡 ≥0.7/核 🔴 ≥1.0/核 | `/proc/loadavg` |
| 进程资源 | 🟡 ≥80% 🔴 ≥95% | `ps aux` TOP5 |

### 2. OpenClaw 应用层监控

| 指标 | 告警阈值 | 采集方式 |
|------|----------|----------|
| Gateway 状态 | 🔴 stopped | `pgrep openclaw-gateway` |
| 频道连接 | 🟡 未知 | `openclaw status` |
| Token 上下文 | 🟡 ≥75% 🔴 ≥90% | `openclaw sessions list` |
| 活跃会话 | 监控 | `openclaw sessions list` |
| Memory 系统 | 🔴 FTS 不可用 | `openclaw status --deep` |
| Memory SQLite | 🔴 无数据 | 直连 SQLite |

### 3. OpenClaw Cron 任务监控（新增）

| 指标 | 告警阈值 | 采集方式 |
|------|----------|----------|
| 任务执行状态 | 🔴 连续错误 | `jobs.json` state |
| 任务执行时长 | 🟡 >2x 平均 | 历史 runs 目录 |
| 任务交付状态 | 🔴 投递失败 | `lastDeliveryStatus` |
| 任务调度偏差 | 🟡 >5 分钟 | `nextRunAtMs` 对比 |

---

## 🏗️ 架构设计

```
openclaw-ops-monitor/
├── config/                      # 配置
│   ├── thresholds.json         # 告警阈值配置
│   ├── cron-jobs.json          # OpenClaw Cron 任务快照
│   └── channels.json           # 通知渠道配置
├── src/
│   ├── collectors/             # 数据采集器
│   │   ├── system.js           # 系统指标采集
│   │   ├── openclaw.js         # OpenClaw 应用指标
│   │   └── cron-tasks.js       # Cron 任务状态
│   ├── analyzers/              # 数据分析器
│   │   ├── threshold-check.js  # 阈值比对
│   │   ├── trend-detect.js     # 趋势检测
│   │   └── anomaly-detect.js   # 异常检测
│   ├── notifiers/              # 通知器
│   │   ├── telegram.js         # Telegram 通知
│   │   └── feishu.js           # 飞书通知
│   └── monitor.js              # 主监控调度器
├── reports/                     # 报告输出
│   ├── hourly/                 # 小时报告
│   ├── daily/                  # 日报
│   └── alerts/                 # 告警记录
├── tests/                      # 测试
│   ├── collectors.test.js
│   └── analyzers.test.js
├── package.json
└── README.md
```

---

## 🚀 快速开始

### 1. 安装

```bash
cd openclaw-ops-monitor
npm install
```

### 2. 配置

```bash
# 复制配置模板
cp config/thresholds.example.json config/thresholds.json
cp config/channels.example.json config/channels.json

# 编辑配置
open config/thresholds.json
```

### 3. 运行

```bash
# 立即采集并生成报告
npm run monitor

# 持续监控模式（模拟服务器 cron）
npm run monitor:watch

# 仅检查 Cron 任务状态
npm run check:cron

# 仅检查系统健康
npm run check:system

# 仅检查 OpenClaw 应用
npm run check:openclaw
```

### 4. 查看报告

```bash
# 最新报告
npm run report:latest

# 历史告警
npm run alerts:history
```

---

## 📋 与服务器端脚本的对应关系

| 服务器脚本 | 本地模块 | 功能 |
|-----------|---------|------|
| `system_health_report.sh` | `src/collectors/system.js` | 系统指标采集 |
| `system_health_alert.sh` | `src/analyzers/threshold-check.js` | 阈值告警检查 |
| `/home/admin/.openclaw/cron/jobs.json` | `src/collectors/cron-tasks.js` | Cron 任务监控 |

---

## 🔧 开发指南

### 添加新监控指标

1. 在 `src/collectors/` 创建采集器
2. 在 `config/thresholds.json` 添加阈值
3. 在 `src/monitor.js` 注册采集器
4. 编写测试

### 自定义通知渠道

1. 在 `src/notifiers/` 创建通知器
2. 实现 `send(message)` 方法
3. 在 `config/channels.json` 配置

---

## 📊 报告格式

### 小时报告（紧凑版）

```markdown
# 🖥️ 系统健康 | 47.82.234.46
🕐 2026-04-10 10:00:00 CST

### 告警汇总
**系统资源**
| 磁盘 | 🟢 | CPU | 🟢 | 内存 | 🟡 82% | 负载 | 🟢 |

**OpenClaw 应用**
| Gateway | 🟢 | 模型 | 🟢 | Token | 🟢 | 会话 | 12 | 频道 | 🟢 |

**Cron 任务**
| 总计 | 16 | 成功 | 14 | 失败 | 2 | 待执行 | 1 |

### 异常任务清单
| 🔴 情报雷达-早报 | Message failed | 连续错误: 1 |
| 🔴 每日系统维护 | Channel required | 连续错误: 1 |
```

### 告警消息（Telegram）

```
🚨 系统紧急告警

🔴 磁盘紧急：/dev/vda1 95% /
🔴 Gateway 已停止
🔴 Cron 任务失败：情报雷达-早报 (连续错误 1 次)

时间：2026-04-10 10:00 | openclaw-ops-monitor v1.0.0
```

---

## 🔗 相关文档

- [服务器系统健康脚本](../scripts/system_health_report.sh)
- [服务器异常告警脚本](../scripts/system_health_alert.sh)
- [OpenClaw Cron 任务配置](../docs/openclaw-cron-tasks.md)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-10  
**维护者**: tech-mentor (大师)
