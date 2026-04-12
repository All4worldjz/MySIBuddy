const { logger } = require('../utils/logger');

/**
 * 系统 Crontab vs OpenClaw Cron 重复项检测器
 */
class DuplicateChecker {
  constructor() {
    // 系统 Crontab 任务（从服务器获取）
    this.systemCrontab = [
      {
        id: 'sys-1',
        name: 'AI News Hub',
        schedule: '0 8 * * *',
        command: '/home/admin/ai-news-hub/cron.sh',
        source: 'system-crontab'
      },
      {
        id: 'sys-2',
        name: 'Wiki Git 自动同步',
        schedule: '*/15 * * * *',
        command: 'cd /home/admin/.openclaw/wiki/main && git pull/commit/push',
        source: 'system-crontab'
      },
      {
        id: 'sys-3',
        name: 'Wiki → 飞书同步',
        schedule: '0 3 * * *',
        command: 'bash wiki_to_feishu_sync.sh',
        source: 'system-crontab'
      },
      {
        id: 'sys-4',
        name: '飞书 → Wiki 同步',
        schedule: '0 */6 * * *',
        command: 'python3 feishu_to_wiki_sync.py',
        source: 'system-crontab'
      },
      {
        id: 'sys-5',
        name: 'Wiki 自动编译',
        schedule: '0 * * * *',
        command: 'openclaw wiki compile',
        source: 'system-crontab'
      },
      {
        id: 'sys-6',
        name: '系统健康报告',
        schedule: '0 6 * * *',
        command: 'bash system_health_report.sh',
        source: 'system-crontab'
      }
    ];

    // OpenClaw Cron 任务（从 jobs.json 解析）
    this.openclawCron = [];
    
    // 重复项列表
    this.duplicates = [];
  }

  /**
   * 加载 OpenClaw Cron 任务
   */
  loadOpenClawJobs(jobsData) {
    this.openclawCron = jobsData.jobs.map(job => ({
      id: job.id,
      name: job.name,
      schedule: job.schedule.kind === 'cron' ? job.schedule.expr : `every ${job.schedule.everyMs}ms`,
      command: job.payload?.message?.substring(0, 50) || 'N/A',
      agentId: job.agentId,
      source: 'openclaw-cron',
      state: job.state
    }));
  }

  /**
   * 检测重复项
   */
  detectDuplicates() {
    this.duplicates = [];

    // 1. Wiki 相关任务对比
    this.checkWikiDuplicates();

    // 2. 系统健康相关任务对比
    this.checkHealthDuplicates();

    // 3. 情报/新闻相关任务对比
    this.checkNewsDuplicates();

    // 4. 飞书同步相关任务对比
    this.checkFeishuSyncDuplicates();

    return this.duplicates;
  }

  /**
   * 检查 Wiki 相关重复
   */
  checkWikiDuplicates() {
    const wikiSystemTasks = this.systemCrontab.filter(t => 
      t.name.includes('Wiki') || t.command.includes('wiki')
    );

    const wikiOpenClawTasks = this.openclawCron.filter(t => 
      t.name.includes('Wiki') || t.name.includes('KM-Vault')
    );

    if (wikiSystemTasks.length > 0 && wikiOpenClawTasks.length > 0) {
      this.duplicates.push({
        category: 'Wiki 相关',
        severity: '🔴 严重',
        systemTasks: wikiSystemTasks,
        openclawTasks: wikiOpenClawTasks,
        analysis: 'Wiki 同步和编译任务在系统 Crontab 和 OpenClaw Cron 中均有配置，可能导致重复执行',
        recommendation: '建议统一迁移到 OpenClaw Cron，利用 agent 能力进行智能判断'
      });
    }
  }

  /**
   * 检查系统健康相关重复
   */
  checkHealthDuplicates() {
    const healthSystemTasks = this.systemCrontab.filter(t => 
      t.name.includes('健康') || t.command.includes('health')
    );

    const healthOpenClawTasks = this.openclawCron.filter(t => 
      t.name.includes('健康') || t.name.includes('系统维护') || t.name.includes('巡检')
    );

    if (healthSystemTasks.length > 0 && healthOpenClawTasks.length > 0) {
      this.duplicates.push({
        category: '系统健康监控',
        severity: '🟡 警告',
        systemTasks: healthSystemTasks,
        openclawTasks: healthOpenClawTasks,
        analysis: '系统健康检查任务在两层都有配置，系统 Crontab 每天 06:00 执行，OpenClaw Cron 每小时执行',
        recommendation: '系统 Crontab 保留每天 06:00 的深度检查，OpenClaw Cron 负责每小时轻量检查'
      });
    }
  }

  /**
   * 检查情报/新闻相关重复
   */
  checkNewsDuplicates() {
    const newsSystemTasks = this.systemCrontab.filter(t => 
      t.name.includes('News') || t.name.includes('情报')
    );

    const newsOpenClawTasks = this.openclawCron.filter(t => 
      t.name.includes('情报') || t.name.includes('早报') || t.name.includes('晚报')
    );

    if (newsSystemTasks.length > 0 || newsOpenClawTasks.length > 0) {
      this.duplicates.push({
        category: '情报/新闻',
        severity: '🟢 低风险',
        systemTasks: newsSystemTasks,
        openclawTasks: newsOpenClawTasks,
        analysis: 'AI News Hub 在系统 Crontab，情报雷达在 OpenClaw Cron，功能可能重叠',
        recommendation: '确认 AI News Hub 和情报雷达的职责边界，避免重复推送'
      });
    }
  }

  /**
   * 检查飞书同步相关重复
   */
  checkFeishuSyncDuplicates() {
    const feishuSystemTasks = this.systemCrontab.filter(t => 
      t.name.includes('飞书') || t.command.includes('feishu')
    );

    const feishuOpenClawTasks = this.openclawCron.filter(t => 
      t.name.includes('飞书') || t.name.includes('KM-Vault')
    );

    if (feishuSystemTasks.length > 0 && feishuOpenClawTasks.length > 0) {
      this.duplicates.push({
        category: '飞书同步',
        severity: '🟡 警告',
        systemTasks: feishuSystemTasks,
        openclawTasks: feishuOpenClawTasks,
        analysis: '飞书 ↔ Wiki 同步在系统 Crontab 配置，KM-Vault 飞书入库在 OpenClaw Cron，功能可能重叠',
        recommendation: '系统 Crontab 负责定时批量同步，OpenClaw Cron 负责触发式实时同步'
      });
    }
  }

  /**
   * 生成对比报告
   */
  generateReport() {
    let report = `# 系统 Crontab vs OpenClaw Cron 对比报告\n\n`;
    report += `生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

    // 系统 Crontab 清单
    report += `## 一、系统 Crontab 任务清单（${this.systemCrontab.length} 个）\n\n`;
    report += `| # | 任务名称 | 调度 | 命令 |\n`;
    report += `|---|----------|------|------|\n`;
    for (const task of this.systemCrontab) {
      report += `| ${task.id} | ${task.name} | \`${task.schedule}\` | ${task.command.substring(0, 40)}... |\n`;
    }

    // OpenClaw Cron 清单
    report += `\n## 二、OpenClaw Cron 任务清单（${this.openclawCron.length} 个）\n\n`;
    report += `| # | 任务名称 | Agent | 调度 | 状态 |\n`;
    report += `|---|----------|-------|------|------|\n`;
    for (const task of this.openclawCron) {
      const status = task.state?.lastRunStatus === 'error' ? '⚠️' : '✅';
      report += `| ${task.id.substring(0, 8)} | ${task.name} | ${task.agentId} | \`${task.schedule}\` | ${status} |\n`;
    }

    // 重复项清单
    report += `\n## 三、重复项检测（${this.duplicates.length} 组）\n\n`;
    
    for (const dup of this.duplicates) {
      report += `### ${dup.severity} ${dup.category}\n\n`;
      report += `**分析**: ${dup.analysis}\n\n`;
      
      report += `**系统 Crontab 任务**:\n`;
      for (const task of dup.systemTasks) {
        report += `- \`${task.schedule}\` ${task.name}\n`;
      }
      
      report += `\n**OpenClaw Cron 任务**:\n`;
      for (const task of dup.openclawTasks) {
        report += `- \`${task.schedule}\` ${task.name} (${task.agentId})\n`;
      }
      
      report += `\n**建议**: ${dup.recommendation}\n\n`;
      report += `---\n\n`;
    }

    // 优化建议
    report += `## 四、优化建议\n\n`;
    report += `### 短期（1 周内）\n\n`;
    report += `1. **统一 Wiki 任务管理**: 将系统 Crontab 的 Wiki 任务迁移到 OpenClaw Cron\n`;
    report += `2. **明确健康检查边界**: 系统 Crontab 保留每日深度检查，OpenClaw 负责小时级轻量检查\n`;
    report += `3. **修复错误任务**: 修复 3 个警告任务（情报早报/系统维护/CalDAV）\n\n`;
    
    report += `### 中期（1 个月内）\n\n`;
    report += `1. **清理废弃任务**: 删除或禁用不再需要的任务\n`;
    report += `2. **统一日志管理**: 所有任务日志统一输出到 /home/admin/.openclaw/logs/\n`;
    report += `3. **监控集成**: 使用 openclaw-ops-monitor 统一监控两层任务\n\n`;

    return report;
  }
}

module.exports = DuplicateChecker;
