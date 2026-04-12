const axios = require('axios');
const { logger } = require('./logger');

/**
 * Telegram 通知模块
 * 用于发送任务成功/失败通知
 */
class TelegramNotifier {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.enabled = !!(botToken && chatId);
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * 发送通知
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      logger.debug('[Telegram] 通知未启用，跳过');
      return;
    }

    const {
      parseMode = 'HTML',
      disablePreview = false
    } = options;

    try {
      const response = await axios.post(
        `${this.baseUrl}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: parseMode,
          disable_web_page_preview: disablePreview
        }
      );

      logger.info('[Telegram] 通知发送成功');
      return response.data;
    } catch (error) {
      logger.error('[Telegram] 通知发送失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 发送任务失败通知
   */
  async notifyTaskFailure(taskName, error, timestamp) {
    const message = `
🚨 <b>监控任务失败</b>

📋 <b>任务:</b> ${taskName}
⏰ <b>时间:</b> ${timestamp || new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
❌ <b>错误:</b> <code>${error.message || String(error)}</code>

请检查日志获取详细信息。
`.trim();

    return this.send(message);
  }

  /**
   * 发送任务成功通知
   */
  async notifyTaskSuccess(taskName, details, timestamp) {
    const message = `
✅ <b>监控任务成功</b>

📋 <b>任务:</b> ${taskName}
⏰ <b>时间:</b> ${timestamp || new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
${details ? `📝 <b>详情:</b>\n${details}` : ''}
`.trim();

    return this.send(message);
  }

  /**
   * 发送每日摘要
   */
  async sendDailySummary(summary) {
    const {
      totalRuns,
      successCount,
      failureCount,
      tasks
    } = summary;

    const taskDetails = tasks.map(task => {
      const status = task.lastError ? '❌' : '✅';
      return `${status} ${task.name}: ${task.runCount} 次运行`;
    }).join('\n');

    const message = `
📊 <b>每日监控摘要</b>

⏰ <b>日期:</b> ${new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}

📈 <b>统计:</b>
• 总运行: ${totalRuns}
• 成功: ${successCount}
• 失败: ${failureCount}

📋 <b>任务详情:</b>
${taskDetails}
`.trim();

    return this.send(message);
  }

  /**
   * 发送健康状态报告
   */
  async sendHealthReport(healthStatus) {
    const {
      status,
      uptime,
      tasksTotal,
      tasksHealthy,
      tasksUnhealthy
    } = healthStatus;

    const statusEmoji = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '🚨';

    const message = `
${statusEmoji} <b>系统健康报告</b>

📊 <b>状态:</b> ${status}
⏱️ <b>运行时间:</b> ${uptime}

📋 <b>任务状态:</b>
• 总计: ${tasksTotal}
• 健康: ${tasksHealthy}
• 异常: ${tasksUnhealthy}
`.trim();

    return this.send(message);
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      logger.info('[Telegram] 连接测试成功');
      logger.info(`[Telegram] Bot: ${response.data.result.first_name}`);
      return true;
    } catch (error) {
      logger.error('[Telegram] 连接测试失败:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = TelegramNotifier;
