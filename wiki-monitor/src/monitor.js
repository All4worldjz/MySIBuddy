const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/default.json');
const cronSchedule = require('../config/cron-schedule.json');
const { logger } = require('./utils/logger');
const HealthServer = require('./utils/health-server');
const TelegramNotifier = require('./utils/telegram-notifier');

// 导入任务模块
const wikiSync = require('./wiki-sync');
const feishuToWiki = require('./feishu-to-wiki');
const wikiToFeishu = require('./wiki-to-feishu');
const wikiHealth = require('./wiki-health');

class Monitor {
  constructor() {
    this.tasks = new Map();
    this.taskFunctions = new Map(); // 存储实际的任务函数
    this.isWatching = false;
    this.isDryRun = process.argv.includes('--dry-run');
    this.healthServer = new HealthServer(3100);
    
    // 初始化 Telegram 通知器
    this.telegram = new TelegramNotifier(
      process.env.TELEGRAM_BOT_TOKEN || config.telegram?.botToken,
      process.env.TELEGRAM_CHAT_ID || config.telegram?.chatId
    );
  }

  /**
   * 注册监控任务
   */
  registerTask(name, schedule, taskFn) {
    const taskConfig = cronSchedule[name];
    
    if (!taskConfig || !taskConfig.enabled) {
      logger.info(`[Monitor] 任务 ${name} 已禁用，跳过`);
      return;
    }

    const cronExpression = this.isDryRun ? '*/1 * * * *' : schedule;
    
    logger.info(`[Monitor] 注册任务: ${name} (${taskConfig.description})`);
    logger.info(`[Monitor] Cron: ${cronExpression}`);
    logger.info(`[Monitor] Dry Run: ${this.isDryRun}`);

    const task = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`[Monitor] 开始执行任务: ${name}`);
        
        if (this.isDryRun) {
          logger.info(`[Monitor] [DRY RUN] 跳过实际执行: ${name}`);
          this.healthServer.recordTaskSuccess(name);
          return;
        }

        await taskFn();
        logger.info(`[Monitor] 任务执行成功: ${name}`);
        this.healthServer.recordTaskSuccess(name);
      } catch (error) {
        logger.error(`[Monitor] 任务执行失败: ${name}`, error);
        this.healthServer.recordTaskFailure(name, error);
        
        if (config.monitor.notifyOnError) {
          await this.notifyError(name, error);
        }
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.tasks.set(name, task);
    this.taskFunctions.set(name, taskFn);
  }

  /**
   * 启动所有监控任务
   */
  async start() {
    logger.info('[Monitor] ===== 启动 Wiki 监控系统 =====');
    logger.info(`[Monitor] 运行模式: ${this.isDryRun ? 'DRY RUN' : 'PROD'}`);

    // 启动健康检查服务器
    this.healthServer.start();
    this.healthServer.status.status = 'running';

    // 注册所有任务
    this.registerTask('wikiSync', cronSchedule.wikiSync.schedule, () => wikiSync.run());
    this.registerTask('feishuToWiki', cronSchedule.feishuToWiki.schedule, () => feishuToWiki.run());
    this.registerTask('wikiToFeishu', cronSchedule.wikiToFeishu.schedule, () => wikiToFeishu.run());
    this.registerTask('wikiHealth', cronSchedule.wikiHealth.schedule, () => wikiHealth.run());

    // 启动所有任务
    this.tasks.forEach((task, name) => {
      task.start();
      logger.info(`[Monitor] 任务已启动: ${name}`);
    });

    logger.info(`[Monitor] 已启动 ${this.tasks.size} 个监控任务`);
    logger.info(`[Monitor] 健康检查服务器: http://localhost:3100/health`);

    // 如果是 watch 模式，保持进程运行
    if (process.argv.includes('--watch')) {
      this.isWatching = true;
      logger.info('[Monitor] 进入 Watch 模式，按 Ctrl+C 退出');
      
      // 优雅退出
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
    } else {
      // 非 watch 模式，运行一次后退出
      logger.info('[Monitor] 运行模式：立即执行所有任务一次');
      await this.runAllTasks();
      logger.info('[Monitor] 所有任务执行完成');
      this.healthServer.stop();
      process.exit(0);
    }
  }

  /**
   * 立即运行所有任务（用于测试）
   */
  async runAllTasks() {
    logger.info('[Monitor] 立即执行所有任务...');
    
    for (const [name, taskFn] of this.taskFunctions) {
      try {
        logger.info(`[Monitor] 执行任务: ${name}`);
        
        if (this.isDryRun) {
          logger.info(`[Monitor] [DRY RUN] 跳过实际执行: ${name}`);
          continue;
        }
        
        await taskFn();
        logger.info(`[Monitor] 任务执行成功: ${name}`);
      } catch (error) {
        logger.error(`[Monitor] 任务失败: ${name}`, error);
      }
    }
  }

  /**
   * 停止所有监控任务
   */
  stop() {
    logger.info('[Monitor] 正在停止所有任务...');
    
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`[Monitor] 任务已停止: ${name}`);
    });

    // 停止健康检查服务器
    this.healthServer.stop();

    logger.info('[Monitor] ===== Wiki 监控系统已停止 =====');
    process.exit(0);
  }

  /**
   * 发送错误通知
   */
  async notifyError(taskName, error) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    try {
      await this.telegram.notifyTaskFailure(taskName, error, timestamp);
      logger.info(`[Monitor] 已发送错误通知: ${taskName}`);
    } catch (notifyError) {
      logger.error('[Monitor] 发送通知失败:', notifyError);
    }
  }
}

// 启动监控
const monitor = new Monitor();
monitor.start().catch(error => {
  logger.error('[Monitor] 启动失败:', error);
  process.exit(1);
});

module.exports = Monitor;
