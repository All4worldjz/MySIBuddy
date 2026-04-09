# AI News Hub

每天早上 8 点自动抓取 AI 进展，推送到 tech-mentor。

## 功能

- **arXiv**: cs.AI/LG/CL 最新论文
- **Hacker News**: AI 热帖（score ≥ 100）
- **Reddit**: r/MachineLearning 讨论
- **中文源**: 机器之心、量子位
- **AI 领袖声音**:
  - 📧 Newsletter: Import AI, The Batch (Andrew Ng), AI Alignment
  - 📝 博客: Andrej Karpathy, Lilian Weng (OpenAI), Sebastian Ruder
  - 🎙️ 播客: Lex Fridman, Machine Learning Street Talk, TWIML
- **Gemini 摘要**: 自动生成结构化摘要

## 目录

```
~/ai-news-hub/
├── config.yaml          # 配置
├── scheduler.py         # 主程序
├── fetchers/            # 抓取模块
├── data/                # 数据库和日志
└── cron.sh              # 定时脚本
```

## 手动运行

```bash
cd ~/ai-news-hub
python3 scheduler.py
```

## 定时任务

已配置 cron 每天 8:00 运行：
```bash
crontab -l
# 0 8 * * * /home/admin/ai-news-hub/cron.sh
```

## 推送到 tech-mentor

由于 OpenClaw 内部限制，推送需要两步：

1. **scheduler.py 运行后**，生成 `/home/admin/ai-news-hub/data/daily_YYYYMMDD.txt`
2. **手动或脚本推送**:
   ```bash
   # 读取生成的文件内容
   cat /home/admin/ai-news-hub/data/daily_$(date +%Y%m%d).txt
   
   # 通过 OpenClaw 推送到 tech-mentor
   # 需要在 OpenClaw 会话中执行
   ```

## 当前状态

- ✅ HN 抓取: 正常
- ✅ 中文 RSS: 正常
- ⚠️ Reddit: 需要 OAuth（当前被 403）
- ✅ Gemini 摘要: 配置完成
- ✅ 定时任务: 已配置

## 待优化

1. Reddit OAuth 认证
2. 自动推送到 Telegram（绕过 sessions_send 限制）
3. 添加更多中文源
4. 飞书多维表格记录统计
