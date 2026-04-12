const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * OpenClaw Cron 任务状态采集器
 * 从 jobs.json 和 runs 目录采集任务执行状态
 */
class CronTasksCollector {
  constructor(config) {
    this.jobsPath = config.jobsPath || '/home/admin/.openclaw/cron/jobs.json';
    this.runsDir = config.runsDir || '/home/admin/.openclaw/cron/runs';
    this.thresholds = config.thresholds;
  }

  /**
   * 采集全部 Cron 任务状态
   */
  async collectAll() {
    logger.info('[CronCollector] 开始采集 Cron 任务状态...');

    try {
      // 读取 jobs.json
      const jobsData = await this.readJobsConfig();
      
      // 分析每个任务的状态
      const tasks = jobsData.jobs.map(job => this.analyzeTask(job));
      
      // 统计汇总
      const summary = this.calculateSummary(tasks);
      
      logger.info(`[CronCollector] 采集完成：总计 ${summary.total} 个任务`);
      
      return {
        timestamp: new Date().toISOString(),
        summary,
        tasks
      };
    } catch (error) {
      logger.error('[CronCollector] 采集失败:', error);
      throw error;
    }
  }

  /**
   * 读取 jobs.json 配置
   */
  async readJobsConfig() {
    try {
      const data = await fs.readFile(this.jobsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`[CronCollector] 无法读取 jobs.json (${this.jobsPath}): ${error.message}`);
      logger.warn('[CronCollector] 返回空任务列表');
      return { version: 1, jobs: [] };
    }
  }

  /**
   * 分析单个任务状态
   */
  analyzeTask(job) {
    const state = job.state || {};
    const schedule = job.schedule || {};
    
    // 计算下次执行时间
    const nextRunAt = state.nextRunAtMs ? new Date(state.nextRunAtMs) : null;
    const lastRunAt = state.lastRunAtMs ? new Date(state.lastRunAtMs) : null;
    
    // 判断任务健康状态
    const health = this.assessTaskHealth(job);
    
    // 计算执行时长趋势（如果有历史数据）
    const durationAnalysis = this.analyzeDuration(job);
    
    return {
      id: job.id,
      name: job.name,
      agentId: job.agentId,
      enabled: job.enabled,
      schedule: {
        kind: schedule.kind,
        expr: schedule.expr || `${schedule.everyMs}ms`,
        tz: schedule.tz
      },
      state: {
        lastRunAt: lastRunAt?.toISOString(),
        nextRunAt: nextRunAt?.toISOString(),
        lastRunStatus: state.lastRunStatus || 'unknown',
        lastStatus: state.lastStatus || 'unknown',
        lastDurationMs: state.lastDurationMs,
        lastError: state.lastError,
        consecutiveErrors: state.consecutiveErrors || 0,
        lastDelivered: state.lastDelivered,
        lastDeliveryStatus: state.lastDeliveryStatus
      },
      health,
      durationAnalysis,
      delivery: job.delivery
    };
  }

  /**
   * 评估任务健康状态
   */
  assessTaskHealth(job) {
    const state = job.state || {};
    const { consecutiveErrorsThreshold } = this.thresholds;
    
    // 检查连续错误
    if (state.consecutiveErrors >= consecutiveErrorsThreshold) {
      return {
        status: 'critical',
        signal: '🔴',
        reason: `连续错误 ${state.consecutiveErrors} 次`
      };
    }
    
    // 检查单次错误
    if (state.lastRunStatus === 'error' || state.lastStatus === 'error') {
      return {
        status: 'warning',
        signal: '🟡',
        reason: `最近执行失败: ${state.lastError || '未知错误'}`
      };
    }
    
    // 检查投递失败
    if (state.lastDeliveryStatus === 'failed' || state.lastDeliveryStatus === 'unknown') {
      return {
        status: 'warning',
        signal: '🟡',
        reason: `投递失败: ${state.lastDeliveryStatus}`
      };
    }
    
    // 检查任务是否禁用
    if (!job.enabled) {
      return {
        status: 'disabled',
        signal: '⚪',
        reason: '任务已禁用'
      };
    }
    
    // 正常
    return {
      status: 'healthy',
      signal: '🟢',
      reason: '正常'
    };
  }

  /**
   * 分析执行时长
   */
  analyzeDuration(job) {
    const state = job.state || {};
    const { durationMultiplierThreshold } = this.thresholds;
    
    if (!state.lastDurationMs) {
      return { averageMs: null, currentMs: null, trend: 'unknown' };
    }
    
    // TODO: 从 runs 目录读取历史数据计算平均值
    // 当前简化：仅返回当前值
    return {
      averageMs: null, // 待实现
      currentMs: state.lastDurationMs,
      trend: 'unknown'
    };
  }

  /**
   * 计算汇总统计
   */
  calculateSummary(tasks) {
    const total = tasks.length;
    const enabled = tasks.filter(t => t.enabled).length;
    const healthy = tasks.filter(t => t.health.status === 'healthy').length;
    const warning = tasks.filter(t => t.health.status === 'warning').length;
    const critical = tasks.filter(t => t.health.status === 'critical').length;
    const disabled = tasks.filter(t => t.health.status === 'disabled').length;
    
    const failedTasks = tasks.filter(t => 
      t.health.status === 'critical' || t.health.status === 'warning'
    );
    
    const nextRunTasks = tasks
      .filter(t => t.state.nextRunAt)
      .sort((a, b) => new Date(a.state.nextRunAt) - new Date(b.state.nextRunAt))
      .slice(0, 5)
      .map(t => ({
        name: t.name,
        nextRunAt: t.state.nextRunAt
      }));
    
    return {
      total,
      enabled,
      healthy,
      warning,
      critical,
      disabled,
      failedTasks: failedTasks.map(t => ({
        name: t.name,
        status: t.health.status,
        reason: t.health.reason
      })),
      nextRunTasks
    };
  }

  /**
   * 生成 Markdown 报告
   */
  generateReport(data) {
    const { summary, tasks } = data;
    
    let report = `### OpenClaw Cron 任务状态\n\n`;
    report += `| 指标 | 值 |\n`;
    report += `|------|-----|\n`;
    report += `| 总计 | ${summary.total} |\n`;
    report += `| 已启用 | ${summary.enabled} |\n`;
    report += `| 健康 | ${summary.healthy} |\n`;
    report += `| 警告 | ${summary.warning} |\n`;
    report += `| 严重 | ${summary.critical} |\n`;
    report += `| 禁用 | ${summary.disabled} |\n`;
    
    if (summary.failedTasks.length > 0) {
      report += `\n**异常任务清单**\n\n`;
      report += `| 信号 | 任务名称 | 原因 |\n`;
      report += `|------|----------|------|\n`;
      
      for (const task of summary.failedTasks) {
        const signal = task.status === 'critical' ? '🔴' : '🟡';
        report += `| ${signal} | ${task.name} | ${task.reason} |\n`;
      }
    }
    
    if (summary.nextRunTasks.length > 0) {
      report += `\n**即将执行的任务**\n\n`;
      report += `| 任务 | 下次执行时间 |\n`;
      report += `|------|-------------|\n`;
      
      for (const task of summary.nextRunTasks) {
        const timeStr = new Date(task.nextRunAt).toLocaleString('zh-CN', { 
          timeZone: 'Asia/Shanghai',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        report += `| ${task.name} | ${timeStr} |\n`;
      }
    }
    
    return report;
  }
}

module.exports = CronTasksCollector;
