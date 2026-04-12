const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const config = require('../config/default.json');
const { createTaskLogger } = require('./utils/logger');
const { FeishuRetryHandler } = require('./utils/feishu-retry');

const logger = createTaskLogger('feishu-to-wiki');

/**
 * 飞书 → Wiki 同步任务
 * 对应服务器端：每 6 小时执行 feishu_to_wiki_sync.sh
 */
class FeishuToWiki {
  constructor() {
    this.baseUrl = config.feishu.baseUrl;
    this.appId = config.feishu.appId;
    this.appSecret = config.feishu.appSecret;
    this.kmVaultToken = config.feishu.kmVaultToken;
    this.wikiRawDir = path.resolve(
      os.homedir(),
      config.wiki.localPath.replace('~/', ''),
      config.wiki.rawDir
    );
    this.lastSyncFile = path.resolve(
      os.homedir(),
      config.wiki.localPath.replace('~/', ''),
      '.feishu-last-sync'
    );
    this.tenantToken = null;
  }

  /**
   * 运行飞书 → Wiki 同步
   */
  async run() {
    logger.info('========== 开始飞书 → Wiki 同步 ==========');

    try {
      // 1. 认证
      await this.authenticate();
      logger.info('飞书认证成功');

      // 2. 确保 raw 目录存在
      await fs.mkdir(this.wikiRawDir, { recursive: true });

      // 3. 获取上次同步时间
      const lastSync = await this.getLastSyncTime();
      if (lastSync) {
        logger.info(`上次同步时间: ${new Date(lastSync * 1000).toISOString()}`);
      }

      // 4. 获取文件列表
      logger.info('正在获取 KM-Vault 文件列表...');
      const files = await this.getFolderFiles();
      logger.info(`获取到 ${files.length} 个文件`);

      // 5. 下载文档
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        // 只处理文档类型
        if (!['docx', 'doc'].includes(file.doc_type)) {
          skippedCount++;
          continue;
        }

        // 检查是否需要更新
        if (lastSync && file.modified_time <= lastSync) {
          skippedCount++;
          continue;
        }

        // 下载文档
        const safeName = file.title.replace(/[\/:*?"<>|]/g, '_');
        const outputFile = path.join(this.wikiRawDir, `${safeName}.md`);

        logger.info(`正在下载: ${file.title} (${file.doc_type})`);
        await this.downloadDocAsMarkdown(file.token, file.doc_type, outputFile);

        // 添加 Frontmatter
        await this.addFrontmatter(outputFile, file);

        newCount++;
        logger.info(`✅ 已下载: ${file.title}`);
      }

      // 6. 记录同步时间
      await this.saveLastSyncTime();

      logger.info('========== 同步完成 ==========');
      logger.info(`新增: ${newCount} | 更新: ${updatedCount} | 跳过: ${skippedCount}`);

    } catch (error) {
      logger.error('飞书 → Wiki 同步失败:', error);
      throw error;
    }
  }

  /**
   * 飞书认证
   */
  async authenticate() {
    const response = await FeishuRetryHandler.execute(
      () => axios.post(
        `${this.baseUrl}/auth/v3/tenant_access_token/internal`,
        {
          app_id: this.appId,
          app_secret: this.appSecret
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      ),
      { maxRetries: 5, initialDelay: 500 }
    );

    this.tenantToken = response.data.tenant_access_token;

    if (!this.tenantToken || this.tenantToken === 'null') {
      throw new Error('无法获取飞书 tenant token');
    }
  }

  /**
   * 获取文件夹中的文件列表
   */
  async getFolderFiles() {
    const response = await FeishuRetryHandler.execute(
      () => axios.get(
        `${this.baseUrl}/drive/v1/files`,
        {
          params: { folder_token: this.kmVaultToken },
          headers: { Authorization: `Bearer ${this.tenantToken}` }
        }
      ),
      { maxRetries: 3 }
    );

    return response.data.data?.files || [];
  }

  /**
   * 下载飞书文档内容为 Markdown
   */
  async downloadDocAsMarkdown(docToken, docType, outputFile) {
    let content = '';

    if (docType === 'docx') {
      const response = await FeishuRetryHandler.execute(
        () => axios.get(
          `${this.baseUrl}/docx/v1/documents/${docToken}/raw_content`,
          {
            headers: {
              Authorization: `Bearer ${this.tenantToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        { maxRetries: 3 }
      );
      content = response.data.content || '';
    } else if (docType === 'doc') {
      // 旧版文档
      const response = await FeishuRetryHandler.execute(
        () => axios.get(
          `${this.baseUrl}/doc/v2/${docToken}/content`,
          {
            headers: { Authorization: `Bearer ${this.tenantToken}` }
          }
        ),
        { maxRetries: 3 }
      );
      content = response.data.content || '';
    }

    await fs.writeFile(outputFile, content, 'utf-8');
  }

  /**
   * 添加 Frontmatter
   */
  async addFrontmatter(outputFile, fileInfo) {
    const content = await fs.readFile(outputFile, 'utf-8');
    const frontmatter = `---
title: "${fileInfo.title}"
source: feishu
source_token: "${fileInfo.token}"
source_type: "${fileInfo.doc_type}"
synced_at: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}
---

`;

    await fs.writeFile(outputFile, frontmatter + content);
  }

  /**
   * 获取上次同步时间
   */
  async getLastSyncTime() {
    try {
      const data = await fs.readFile(this.lastSyncFile, 'utf-8');
      return parseInt(data.trim(), 10);
    } catch {
      return null;
    }
  }

  /**
   * 保存同步时间
   */
  async saveLastSyncTime() {
    const now = Math.floor(Date.now() / 1000);
    await fs.writeFile(this.lastSyncFile, now.toString(), 'utf-8');
  }
}

// 导出单例
const feishuToWiki = new FeishuToWiki();

// 如果直接运行此文件
if (require.main === module) {
  feishuToWiki.run()
    .then(() => {
      logger.info('Feishu → Wiki 同步执行成功');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Feishu → Wiki 同步执行失败:', error);
      process.exit(1);
    });
}

module.exports = feishuToWiki;
