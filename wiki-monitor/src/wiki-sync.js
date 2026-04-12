const { simpleGit } = require('simple-git');
const path = require('path');
const os = require('os');
const config = require('../config/default.json');
const { createTaskLogger } = require('./utils/logger');

const logger = createTaskLogger('wiki-sync');

/**
 * Wiki Git 自动同步任务
 * 对应服务器端：每 15 分钟执行 git pull --rebase && git add . && git commit && git push
 */
class WikiSync {
  constructor() {
    this.wikiPath = path.resolve(os.homedir(), config.wiki.localPath.replace('~/', ''));
    this.git = null; // 延迟初始化
  }

  /**
   * 初始化 Git 实例（在确认目录存在后）
   */
  async initGit() {
    if (!this.git && await this.directoryExists(this.wikiPath)) {
      this.git = simpleGit(this.wikiPath);
    }
    return this.git;
  }

  /**
   * 运行 Wiki Git 同步
   */
  async run() {
    logger.info('========== 开始 Wiki Git 同步 ==========');

    try {
      // 1. 检查目录是否存在
      if (!await this.directoryExists(this.wikiPath)) {
        logger.warn(`Wiki 目录不存在: ${this.wikiPath}，跳过同步`);
        return;
      }

      // 2. 初始化 Git
      if (!this.initGit()) {
        logger.error('Git 初始化失败');
        return;
      }

      // 3. Git Pull
      logger.info('执行 git pull --rebase...');
      const pullResult = await this.git.pull(['--rebase', 'origin', config.github.branch]);
      logger.info(`Pull 结果: ${pullResult.summary.changes} 个变更`);

      // 4. Git Add
      logger.info('执行 git add .');
      await this.git.add('.');

      // 5. Git Status 检查
      const status = await this.git.status();
      if (status.staged.length === 0 && status.not_added.length === 0) {
        logger.info('没有需要提交的更改');
        return;
      }

      // 6. Git Commit
      logger.info(`执行 git commit: "${config.github.commitMessage}"`);
      const commitResult = await this.git.commit(config.github.commitMessage);
      logger.info(`Commit 结果: ${commitResult.commit}`);

      // 7. Git Push
      logger.info('执行 git push...');
      const pushResult = await this.git.push('origin', config.github.branch);
      logger.info(`Push 结果: ${pushResult.branch}`);

      logger.info('========== Wiki Git 同步完成 ==========');
    } catch (error) {
      logger.error('Wiki Git 同步失败:', error);
      throw error;
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
const wikiSync = new WikiSync();

// 如果直接运行此文件
if (require.main === module) {
  wikiSync.run()
    .then(() => {
      logger.info('Wiki Sync 执行成功');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Wiki Sync 执行失败:', error);
      process.exit(1);
    });
}

module.exports = wikiSync;
