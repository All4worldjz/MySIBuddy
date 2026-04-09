/**
 * AI News Hub — 主入口
 * 每天早上 8 点抓取 AI 新闻，生成摘要，推送到 Telegram
 */

const path = require('path');

const fetcherArxiv = require('./fetchers/arxiv');
const fetcherHn = require('./fetchers/hn');
const fetcherReddit = require('./fetchers/reddit');
const summarizer = require('./summarizer');
const formatter = require('./formatter');
const pusher = require('./pusher');

// 日志前缀
const LOG_PREFIX = '[AI News Hub]';

/**
 * 主流程
 */
async function main() {
  console.log(`${LOG_PREFIX} 开始执行 AI Daily 新闻抓取...`);
  const startTime = Date.now();

  let allItems = [];

  // 1. 抓取数据
  console.log(`${LOG_PREFIX} 正在抓取数据源...`);

  // 并行抓取所有数据源
  const results = await Promise.allSettled([
    fetcherArxiv.fetch(),
    fetcherHn.fetch(),
    fetcherReddit.fetch(),
  ]);

  // 合并结果
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      allItems = allItems.concat(result.value);
      console.log(`${LOG_PREFIX} 抓取到 ${result.value.length} 条内容`);
    } else if (result.status === 'rejected') {
      console.error(`${LOG_PREFIX} 数据源抓取失败:`, result.reason?.message || result.reason);
    }
  }

  if (allItems.length === 0) {
    console.error(`${LOG_PREFIX} 未抓取到任何内容，退出`);
    return;
  }

  console.log(`${LOG_PREFIX} 共抓取到 ${allItems.length} 条内容，开始生成摘要...`);

  // 2. 生成摘要
  const summarizedItems = [];
  for (const item of allItems) {
    try {
      const summary = await summarizer.summarize(item);
      summarizedItems.push({ ...item, summary });
    } catch (err) {
      console.error(`${LOG_PREFIX} 摘要生成失败，跳过: ${item.title}`, err.message);
      // 降级：使用原文摘要
      summarizedItems.push({
        ...item,
        summary: {
          背景: item.abstract || item.description || '暂无',
          核心: '（摘要生成失败，请查看原文）',
          意义: '—',
        },
      });
    }
  }

  // 3. 格式化
  const message = formatter.format(summarizedItems);

  // 4. 推送
  console.log(`${LOG_PREFIX} 开始推送至 Telegram...`);
  await pusher.push(message);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`${LOG_PREFIX} 完成！耗时 ${duration}s，处理 ${allItems.length} 条内容`);
}

main().catch((err) => {
  console.error(`${LOG_PREFIX} 严重错误:`, err);
  process.exit(1);
});