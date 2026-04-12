#!/usr/bin/env node
/**
 * 对比系统 Crontab vs OpenClaw Cron，识别重复项
 * 运行: node src/analyzers/run-duplicate-check.js
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');
const DuplicateChecker = require('./duplicate-check');

async function main() {
  logger.info('===== 开始 Crontab 对比分析 =====');

  const checker = new DuplicateChecker();

  // 读取 OpenClaw Cron 配置
  const jobsPath = path.resolve(__dirname, '../../config/cron-jobs.json');
  try {
    const jobsData = JSON.parse(await fs.readFile(jobsPath, 'utf-8'));
    checker.loadOpenClawJobs(jobsData);
    logger.info(`[DuplicateCheck] 已加载 ${jobsData.jobs.length} 个 OpenClaw Cron 任务`);
  } catch (error) {
    logger.error(`[DuplicateCheck] 无法读取 jobs.json: ${error.message}`);
    process.exit(1);
  }

  // 检测重复项
  const duplicates = checker.detectDuplicates();
  logger.info(`[DuplicateCheck] 检测到 ${duplicates.length} 组重复`);

  // 生成报告
  const report = checker.generateReport();
  const reportPath = path.resolve(__dirname, '../../reports/duplicate-analysis.md');
  await fs.writeFile(reportPath, report, 'utf-8');

  logger.info(`[DuplicateCheck] 报告已保存: ${reportPath}`);
  logger.info('===== 对比分析完成 =====');

  // 输出到控制台
  console.log('\n' + report);
}

main().catch(error => {
  logger.error('对比分析失败:', error);
  process.exit(1);
});
