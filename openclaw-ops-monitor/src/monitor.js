const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./utils/logger');
const SystemCollector = require('./collectors/system');
const CronTasksCollector = require('./collectors/cron-tasks');
const thresholds = require('../config/thresholds.json');

class OpsMonitor {
  constructor() {
    this.isDryRun = process.argv.includes('--dry-run');
    this.isWatching = process.argv.includes('--watch');
    
    // 初始化采集器
    this.systemCollector = new SystemCollector(thresholds.system);
    this.cronCollector = new CronTasksCollector({
      jobsPath: path.resolve(__dirname, '../config/cron-jobs.json'), // 使用本地配置
      runsDir: '/tmp/openclaw-cron-runs',
      thresholds: thresholds.cronTasks
    });
    
    // 报告存储
    this.reportsDir = path.resolve(__dirname, '../reports');
  }

  /**
   * 启动监控
   */
  async start() {
    logger.info('===== 启动 OpenClaw Ops 监控系统 =====');
    logger.info(`运行模式: ${this.isDryRun ? 'DRY RUN' : 'PROD'}`);

    if (this.isWatching) {
      // 持续监控模式
      this.scheduleTasks();
      logger.info('进入 Watch 模式，按 Ctrl+C 退出');
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
    } else {
      // 立即执行一次
      await this.runAllChecks();
      logger.info('所有检查完成');
      process.exit(0);
    }
  }

  /**
   * 执行全部检查
   */
  async runAllChecks() {
    logger.info('开始执行全部检查...');

    const [systemData, cronData] = await Promise.all([
      this.runSystemCheck(),
      this.runCronCheck()
    ]);

    // 生成综合报告
    await this.generateComprehensiveReport(systemData, cronData);

    logger.info('全部检查执行完成');
  }

  /**
   * 系统检查
   */
  async runSystemCheck() {
    try {
      logger.info('[System] 开始系统资源检查...');
      const data = await this.systemCollector.collectAll();
      const report = this.systemCollector.generateReport(data);
      
      logger.info('[System] 系统检查完成');
      return { data, report };
    } catch (error) {
      logger.error('[System] 系统检查失败:', error);
      return { data: null, report: '系统检查失败', error };
    }
  }

  /**
   * Cron 任务检查
   */
  async runCronCheck() {
    try {
      logger.info('[Cron] 开始 Cron 任务检查...');
      const data = await this.cronCollector.collectAll();
      const report = this.cronCollector.generateReport(data);
      
      logger.info('[Cron] Cron 检查完成');
      return { data, report };
    } catch (error) {
      logger.error('[Cron] Cron 检查失败:', error);
      return { data: null, report: 'Cron 检查失败', error };
    }
  }

  /**
   * 生成综合报告
   */
  async generateComprehensiveReport(systemData, cronData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.reportsDir, `report-${timestamp}.md`);

    let report = `# OpenClaw Ops 监控报告\n\n`;
    report += `生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

    // 告警汇总
    report += `## 告警汇总\n\n`;
    
    const systemAlerts = systemData.data?.summary?.alerts || [];
    const cronAlerts = cronData.data?.summary?.failedTasks || [];
    
    const criticalAlerts = [
      ...systemAlerts.filter(a => a.level === 'critical'),
      ...cronAlerts.filter(t => t.status === 'critical')
    ];
    
    const warningAlerts = [
      ...systemAlerts.filter(a => a.level === 'warning'),
      ...cronAlerts.filter(t => t.status === 'warning')
    ];

    if (criticalAlerts.length > 0) {
      report += `**🔴 严重告警 (${criticalAlerts.length})**\n\n`;
      for (const alert of criticalAlerts) {
        report += `- ${alert.message || alert.name}: ${alert.reason || ''}\n`;
      }
      report += '\n';
    }

    if (warningAlerts.length > 0) {
      report += `**🟡 警告 (${warningAlerts.length})**\n\n`;
      for (const alert of warningAlerts) {
        report += `- ${alert.message || alert.name}: ${alert.reason || ''}\n`;
      }
      report += '\n';
    }

    if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
      report += `**✅ 全部正常**\n\n`;
    }

    // 系统资源
    report += systemData.report + '\n\n';

    // Cron 任务
    report += cronData.report + '\n\n';

    // 保存报告
    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.writeFile(reportPath, report, 'utf-8');
    
    // 同时保存为 latest.md
    const latestPath = path.join(this.reportsDir, 'latest.md');
    await fs.writeFile(latestPath, report, 'utf-8');

    logger.info(`[Report] 报告已保存: ${reportPath}`);
  }

  /**
   * 调度定时任务
   */
  scheduleTasks() {
    // 每小时执行一次系统检查
    cron.schedule('0 * * * *', async () => {
      logger.info('[Scheduler] 执行定时系统检查...');
      await this.runSystemCheck();
    });

    // 每 30 分钟执行 Cron 任务检查
    cron.schedule('*/30 * * * *', async () => {
      logger.info('[Scheduler] 执行定时 Cron 检查...');
      await this.runCronCheck();
    });

    logger.info('[Scheduler] 定时任务已注册');
  }

  /**
   * 停止监控
   */
  stop() {
    logger.info('===== 停止 OpenClaw Ops 监控系统 =====');
    process.exit(0);
  }
}

// 启动
const monitor = new OpsMonitor();
monitor.start().catch(error => {
  logger.error('启动失败:', error);
  process.exit(1);
});

module.exports = OpsMonitor;
