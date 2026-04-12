const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const config = require('../config/default.json');
const { createTaskLogger } = require('./utils/logger');
const { FeishuRetryHandler } = require('./utils/feishu-retry');

const logger = createTaskLogger('wiki-to-feishu');

/**
 * Wiki → 飞书同步任务
 * 对应服务器端：0 3 * * * bash /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh
 */
class WikiToFeishu {
  constructor() {
    this.baseUrl = config.feishu.baseUrl;
    this.appId = config.feishu.appId;
    this.appSecret = config.feishu.appSecret;
    this.kmVaultToken = config.feishu.kmVaultToken;
    this.wikiDir = path.resolve(
      os.homedir(),
      config.wiki.localPath.replace('~/', ''),
      config.wiki.wikiDir
    );
    this.exportFolderName = config.wiki.exportFolderName;
    this.lastSyncFile = path.resolve(
      os.homedir(),
      config.wiki.localPath.replace('~/', ''),
      '.feishu-export-last-sync'
    );
    this.tenantToken = null;
    this.exportFolderToken = null;
  }

  /**
   * 运行 Wiki → 飞书同步
   */
  async run() {
    logger.info('========== 开始 Wiki → 飞书同步 ==========');

    try {
      // 1. 认证
      await this.authenticate();
      logger.info('飞书认证成功');

      // 2. 获取或创建导出文件夹
      this.exportFolderToken = await this.getOrCreateExportFolder();
      logger.info(`导出文件夹 Token: ${this.exportFolderToken}`);

      // 3. 扫描 Wiki 页面
      const wikiFiles = await this.scanWikiFiles();
      logger.info(`扫描到 ${wikiFiles.length} 个 Wiki 页面`);

      // 4. 创建飞书文档
      let exportCount = 0;
      for (const wikiFile of wikiFiles) {
        // 跳过 index.md
        if (wikiFile.basename === 'index.md') {
          continue;
        }

        // 生成标题
        const title = this.generateTitle(wikiFile.relPath);

        // 读取内容
        const content = await fs.readFile(wikiFile.path, 'utf-8');

        // 创建飞书文档
        logger.info(`正在导出: ${wikiFile.relPath}`);
        const docToken = await this.createFeishuDoc(title, content);

        if (docToken) {
          exportCount++;
          logger.info(`✅ 已导出: ${wikiFile.relPath} → https://pbrhmf5bin.feishu.cn/docx/${docToken}`);
        }
      }

      // 5. 记录同步时间
      await this.saveLastSyncTime();

      logger.info('========== Wiki → 飞书同步完成 ==========');
      logger.info(`共导出 ${exportCount} 个文档`);
      logger.info(`访问地址: https://pbrhmf5bin.feishu.cn/drive/folder/${this.exportFolderToken}`);

    } catch (error) {
      logger.error('Wiki → 飞书同步失败:', error);
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
   * 获取或创建导出文件夹
   */
  async getOrCreateExportFolder() {
    // 查找现有文件夹
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

    const files = response.data.data?.files || [];
    const existingFolder = files.find(f => f.title === this.exportFolderName);

    if (existingFolder) {
      return existingFolder.token;
    }

    // 创建新文件夹
    logger.info(`创建导出文件夹: ${this.exportFolderName}`);
    const createResponse = await FeishuRetryHandler.execute(
      () => axios.post(
        `${this.baseUrl}/drive/v1/files/create_folder`,
        {
          name: this.exportFolderName,
          folder_token: this.kmVaultToken,
          type: 'folder'
        },
        {
          headers: {
            Authorization: `Bearer ${this.tenantToken}`,
            'Content-Type': 'application/json'
          }
        }
      ),
      { maxRetries: 3 }
    );

    const folderToken = createResponse.data.data?.token;
    if (!folderToken) {
      throw new Error('无法创建导出文件夹');
    }

    return folderToken;
  }

  /**
   * 扫描 Wiki 页面
   */
  async scanWikiFiles() {
    const files = [];
    await this.scanDirRecursive(this.wikiDir, this.wikiDir, files);
    return files;
  }

  /**
   * 递归扫描目录
   */
  async scanDirRecursive(baseDir, currentDir, files) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirRecursive(baseDir, fullPath, files);
      } else if (entry.name.endsWith('.md')) {
        files.push({
          path: fullPath,
          basename: entry.name,
          relPath: path.relative(baseDir, fullPath)
        });
      }
    }
  }

  /**
   * 生成飞书文档标题
   */
  generateTitle(relPath) {
    const withoutExt = relPath.replace(/\.md$/, '');
    return `Wiki - ${withoutExt.split('/').join(' › ')}`;
  }

  /**
   * 创建飞书文档（带内容）
   */
  async createFeishuDoc(title, content) {
    try {
      // 1. 创建空白文档
      const createResponse = await FeishuRetryHandler.execute(
        () => axios.post(
          `${this.baseUrl}/docx/v1/documents`,
          {
            folder_token: this.exportFolderToken,
            title: title
          },
          {
            headers: {
              Authorization: `Bearer ${this.tenantToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        { maxRetries: 3 }
      );

      const docToken = createResponse.data.data?.document?.document_id;
      if (!docToken) {
        logger.error(`创建文档失败: ${title}`);
        return null;
      }

      // 2. 获取文档根节点
      const blocksResponse = await FeishuRetryHandler.execute(
        () => axios.get(
          `${this.baseUrl}/docx/v1/documents/${docToken}/blocks`,
          {
            headers: {
              Authorization: `Bearer ${this.tenantToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        { maxRetries: 3 }
      );

      const blocks = blocksResponse.data.data?.items || [];
      const rootBlock = blocks.find(b => b.block_type === 1); // 1 = Page 类型

      if (!rootBlock) {
        logger.error(`获取文档根节点失败: ${title}`);
        return null;
      }

      // 3. 在根节点后插入文本块
      // 将内容分割为行，每行作为一个文本块
      const lines = content.split('\n').filter(line => line.trim());
      
      for (let i = 0; i < Math.min(lines.length, 50); i++) { // 限制 50 行避免 API 限流
        const line = lines[i].trim();
        if (!line) continue;

        await FeishuRetryHandler.execute(
          () => axios.post(
            `${this.baseUrl}/docx/v1/documents/${docToken}/blocks/${rootBlock.block_id}/children`,
            {
              children: [
                {
                  block_type: 2, // 2 = Text 类型
                  text: {
                    elements: [
                      { text_run: { content: line } }
                    ]
                  }
                }
              ]
            },
            {
              headers: {
                Authorization: `Bearer ${this.tenantToken}`,
                'Content-Type': 'application/json'
              }
            }
          ),
          { maxRetries: 2, initialDelay: 2000 } // 更长的延迟避免限流
        );

        // 每 10 行添加延迟
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`✅ 创建文档: ${title} (${docToken})`);
      return docToken;
    } catch (error) {
      logger.error(`创建文档失败: ${title}`, error.response?.data || error.message);
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
const wikiToFeishu = new WikiToFeishu();

// 如果直接运行此文件
if (require.main === module) {
  wikiToFeishu.run()
    .then(() => {
      logger.info('Wiki → Feishu 同步执行成功');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Wiki → Feishu 同步执行失败:', error);
      process.exit(1);
    });
}

module.exports = wikiToFeishu;
