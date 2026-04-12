const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const os = require('os');
const config = require('../config/default.json');
const { createTaskLogger } = require('./utils/logger');

const execPromise = util.promisify(exec);

const logger = createTaskLogger('wiki-health');

/**
 * Wiki 健康检查任务
 * 对应服务器端：0 6 * * * openclaw wiki lint
 */
class WikiHealth {
  constructor() {
    this.wikiPath = path.resolve(os.homedir(), config.wiki.localPath.replace('~/', ''));
  }

  /**
   * 运行 Wiki 健康检查
   */
  async run() {
    logger.info('========== 开始 Wiki 健康检查 ==========');

    try {
      // 1. 检查 Wiki 目录是否存在
      if (!await this.directoryExists(this.wikiPath)) {
        logger.error(`Wiki 目录不存在: ${this.wikiPath}`);
        return;
      }

      // 2. 执行 openclaw wiki lint
      logger.info('执行 openclaw wiki lint...');
      const lintResult = await this.runCommand('openclaw wiki lint', this.wikiPath);
      logger.info(`Lint 结果:\n${lintResult.stdout || lintResult.stderr}`);

      // 3. 检查 Wiki 编译状态
      logger.info('检查 Wiki 编译状态...');
      await this.checkWikiStructure();

      // 4. 检查 Git 状态
      logger.info('检查 Git 状态...');
      const gitStatus = await this.runCommand('git status', this.wikiPath);
      logger.info(`Git 状态:\n${gitStatus.stdout}`);

      // 5. 检查最近同步时间
      await this.checkLastSyncTime();

      // 6. 生成健康报告
      await this.generateHealthReport();

      logger.info('========== Wiki 健康检查完成 ==========');

    } catch (error) {
      logger.error('Wiki 健康检查失败:', error);
      throw error;
    }
  }

  /**
   * 检查 Wiki 目录结构
   */
  async checkWikiStructure() {
    const fs = require('fs').promises;
    const requiredDirs = ['raw', 'wiki', 'wiki/entities', 'wiki/concepts'];

    for (const dir of requiredDirs) {
      const fullPath = path.join(this.wikiPath, dir);
      const exists = await this.directoryExists(fullPath);
      
      if (exists) {
        logger.info(`✅ 目录存在: ${dir}`);
      } else {
        logger.warn(`⚠️  目录缺失: ${dir}`);
      }
    }
  }

  /**
   * 检查上次同步时间
   */
  async checkLastSyncTime() {
    const fs = require('fs').promises;
    const lastSyncFile = path.join(this.wikiPath, '.feishu-last-sync');

    try {
      const data = await fs.readFile(lastSyncFile, 'utf-8');
      const lastSync = parseInt(data.trim(), 10);
      const lastSyncDate = new Date(lastSync * 1000);
      const hoursAgo = (Date.now() - lastSync * 1000) / (1000 * 60 * 60);

      if (hoursAgo < 24) {
        logger.info(`✅ 最近同步: ${lastSyncDate.toISOString()} (${hoursAgo.toFixed(1)} 小时前)`);
      } else {
        logger.warn(`⚠️  同步延迟: ${lastSyncDate.toISOString()} (${hoursAgo.toFixed(1)} 小时前)`);
      }
    } catch {
      logger.warn('⚠️  未找到同步时间记录');
    }
  }

  /**
   * 生成健康报告
   */
  async generateHealthReport() {
    logger.info('========== 健康报告 ==========');
    
    // TODO: 统计 Wiki 页面数量
    // TODO: 检查链接有效性
    // TODO: 发送到 Telegram（如果配置了 notifyOnComplete）
    
    logger.info('健康报告生成完成');
  }

  /**
   * 运行命令
   */
  async runCommand(command, cwd) {
    try {
      return await execPromise(command, { cwd });
    } catch (error) {
      // exec 在非零退出码时抛出异常，但我们仍然需要 stdout/stderr
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.code
      };
    }
  }

  /**
   * 检查目录是否存在
   */
  async directoryExists(dir) {
    try {
      const fs = require('fs').promises;
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }
}

// 导出单例
const wikiHealth = new WikiHealth();

// 如果直接运行此文件
if (require.main === module) {
  wikiHealth.run()
    .then(() => {
      logger.info('Wiki Health 检查执行成功');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Wiki Health 检查执行失败:', error);
      process.exit(1);
    });
}

module.exports = wikiHealth;
