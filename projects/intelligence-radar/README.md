# 情报雷达 (Intelligence Radar) v1.0

> 你的千里眼 · 顺风耳 · 国家情报中心

## 定位
多源情报实时追踪与智能分析系统，为金山云政企事业部提供 AI 前沿、行业动态、政策走向、竞品情报的 **定时 + 按需** 双模式监控。

## 核心能力
- 🌐 **多源感知**：Twitter/X · GitHub · 博客订阅 · Web 搜索 · 飞书消息
- 🧠 **智能融合**：去重 · 聚类 · 重要性评分 · 趋势检测
- 📊 **分级报告**：《情报早报》·《突发快讯》·《深度周报》
- 🔔 **分级告警**：🔥 紧急 / ⚠️ 重要 / 📌 常规
- ⏰ **定时任务**：每日 08:00 早报 / 每日 18:00 晚报 / 突发实时推送
- 🔍 **按需搜索**：随时发起的定向情报查询

## 三大情报轨道

### Track 1: AI 前沿 (AI Frontier)
- 大模型进展 / 论文解读 / 开源动态
- 核心关注：Hinton · LeCun · Karpathy · Bengio · Musk · OpenAI · Anthropic · Google DeepMind

### Track 2: 政企云 & AI 行业 (Industry Intelligence)
- 政企云市场 / 招投标 / 行业报告 / 竞品动态
- 核心关注：阿里云 · 华为云 · 腾讯云 · 天翼云 · 政务云 · 数据要素

### Track 3: 政策与生态 (Policy & Ecosystem)
- AI 监管政策 / 数据法规 / 行业标准 / 开源生态
- 核心关注：网信办 · 工信部 · 信通院 · 数据局

## 技术架构
```
用户配置 (tracks/)
    ↓
传感器调度层 (radar/core.py)
    ├─ xurl_sensor     → Twitter/X 搜索
    ├─ gh_sensor       → GitHub Issues/PR/Commits
    ├─ blog_sensor     → 博客 RSS 订阅
    ├─ web_sensor      → Tavily/Web 搜索
    ├─ summarize_engine → 内容摘要压缩
    └─ fusion_engine   → 去重·评分·聚类
    ↓
情报知识库 (store/)
    ↓
报告生成器 (reports/)
    ├─ 情报早报 (08:00)
    ├─ 情报晚报 (18:00)
    └─ 突发快讯 (实时)
    ↓
飞书/微信/邮件推送 (notify/)
```

## 文件结构
```
intelligence-radar/
├── SPEC.md                    # 本规格文档
├── config/
│   └── tracks.json            # 情报轨道配置（用户可编辑）
├── radar/
│   ├── __init__.py
│   ├── core.py                # 传感器调度主引擎
│   ├── sensors/
│   │   ├── __init__.py
│   │   ├── xurl_sensor.py     # Twitter/X 传感器
│   │   ├── gh_sensor.py       # GitHub 传感器
│   │   ├── blog_sensor.py     # 博客订阅传感器
│   │   └── web_sensor.py      # Web 搜索传感器
│   ├── fusion.py              # 信息融合引擎
│   ├── store.py               # 情报知识库存储
│   ├── scoring.py             # 重要性评分引擎
│   └── dedup.py               # 去重与聚类
├── reports/
│   ├── __init__.py
│   ├── daily_briefing.py      # 每日情报早报
│   ├── evening_briefing.py     # 每日情报晚报
│   │   └── flash_report.py    # 突发快讯
├── notify/
│   ├── feishu_notifier.py      # 飞书推送
│   └── formatter.py            # 报告格式化
├── scripts/
│   ├── run_radar.py            # 按需情报查询 CLI
│   ├── run_daily.py            # 定时早报脚本
│   └── setup_cron.py           # Cron 任务注册
└── summaries/                  # 情报缓存目录
```

## 使用方式

### 按需查询
```bash
python scripts/run_radar.py --track ai-frontier --limit 10
python scripts/run_radar.py --track industry --keyword "政务云 招标"
python scripts/run_radar.py --all --flash
```

### 定时任务（Cron）
```bash
# 每日 08:00 情报早报
0 8 * * * cd /home/admin/.openclaw/workspace-chief/intelligence-radar && python scripts/run_daily.py morning

# 每日 18:00 情报晚报
0 18 * * * cd /home/admin/.openclaw/workspace-chief/intelligence-radar && python scripts/run_daily.py evening
```

## Alert Level 定义
| 等级 | 标签 | 触发条件 | 推送方式 |
|------|------|---------|---------|
| P0 紧急 | 🔥 | 战略级新闻（如 OpenAI 发布 GPT-5） | 实时推送 |
| P1 重要 | ⚠️ | 政企大单 / 政策重大变化 | 4小时内推送 |
| P2 常规 | 📌 | 一般行业动态 | 合并入早晚报 |

## 评分算法
```
重要性得分 = 
  来源权重(xurl:2.0, gh:1.5, blog:1.8, web:1.0)
  × 关键词命中密度 (0.5~2.0)
  × 时效性衰减 (24h内:1.0, 48h:0.7, 72h:0.4)
  × 互动信号 (点赞/★/PR数) (0.5~1.5)
```

## 下一步规划
- [ ] v1.1: 接入飞书机器人推送
- [ ] v1.2: 趋势预测（基于历史数据趋势分析）
- [ ] v1.3: 多语言支持（英文情报自动翻译）
- [ ] v2.0: 竞品监控 Dashboard
