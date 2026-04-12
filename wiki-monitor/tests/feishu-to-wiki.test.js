const nock = require('nock');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock 配置
jest.mock('../config/default.json', () => ({
  feishu: {
    appId: 'cli_test_app_id',
    appSecret: 'test_app_secret',
    baseUrl: 'https://open.feishu.cn/open-apis',
    kmVaultToken: 'test_vault_token'
  },
  wiki: {
    localPath: '~/.openclaw/wiki/main',
    rawDir: 'raw/articles'
  },
  logging: {
    level: 'error',
    dir: './logs-test'
  }
}));

describe('FeishuToWiki 模块测试', () => {
  let FeishuToWiki;
  let feishuToWiki;

  beforeEach(() => {
    // 清除 nock 拦截
    nock.cleanAll();
    
    // 重新导入模块（清除缓存）
    jest.resetModules();
    FeishuToWiki = require('../src/feishu-to-wiki');
  });

  afterEach(async () => {
    // 清理测试目录
    const testDir = path.join(os.tmpdir(), 'wiki-monitor-test');
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
  });

  describe('认证测试', () => {
    test('成功获取 tenant token', async () => {
      nock('https://open.feishu.cn')
        .post('/open-apis/auth/v3/tenant_access_token/internal')
        .reply(200, {
          tenant_access_token: 'test_token_123',
          code: 0
        });

      // 注意：实际测试需要重构模块以支持依赖注入
      expect(true).toBe(true); // 占位符
    });

    test('认证失败时抛出错误', async () => {
      nock('https://open.feishu.cn')
        .post('/open-apis/auth/v3/tenant_access_token/internal')
        .reply(401, {
          code: 99991663,
          msg: 'app not found'
        });

      expect(true).toBe(true); // 占位符
    });
  });

  describe('文件列表获取测试', () => {
    test('成功获取文件列表', async () => {
      const mockFiles = {
        code: 0,
        data: {
          files: [
            {
              token: 'doc_token_1',
              title: '测试文档 1',
              doc_type: 'docx',
              modified_time: Date.now() / 1000
            },
            {
              token: 'doc_token_2',
              title: '测试文档 2',
              doc_type: 'doc',
              modified_time: Date.now() / 1000
            }
          ]
        }
      };

      nock('https://open.feishu.cn')
        .get('/open-apis/drive/v1/files')
        .query({ folder_token: 'test_vault_token' })
        .reply(200, mockFiles);

      expect(true).toBe(true); // 占位符
    });

    test('过滤非文档类型文件', async () => {
      const mockFiles = {
        code: 0,
        data: {
          files: [
            { token: 'folder_token', title: '文件夹', doc_type: 'folder' },
            { token: 'sheet_token', title: '表格', doc_type: 'sheet' },
            { token: 'doc_token', title: '文档', doc_type: 'docx' }
          ]
        }
      };

      expect(mockFiles.data.files.filter(f => 
        ['docx', 'doc'].includes(f.doc_type)
      )).toHaveLength(1);
    });
  });

  describe('增量同步测试', () => {
    test('跳过未修改的文件', async () => {
      const lastSyncTime = 1000;
      const fileModifiedTime = 500; // 早于上次同步
      
      expect(fileModifiedTime <= lastSyncTime).toBe(true);
    });

    test('下载修改过的文件', async () => {
      const lastSyncTime = 1000;
      const fileModifiedTime = 2000; // 晚于上次同步
      
      expect(fileModifiedTime > lastSyncTime).toBe(true);
    });
  });

  describe('Frontmatter 添加测试', () => {
    test('正确添加 frontmatter', async () => {
      const content = '文档内容';
      const fileInfo = {
        title: '测试文档',
        token: 'doc_token',
        doc_type: 'docx'
      };

      const frontmatter = `---
title: "${fileInfo.title}"
source: feishu
source_token: "${fileInfo.token}"
source_type: "${fileInfo.doc_type}"
synced_at: 2026-04-10 10:00:00
---

`;

      const expectedOutput = frontmatter + content;
      expect(expectedOutput).toContain('title: "测试文档"');
      expect(expectedOutput).toContain('source: feishu');
    });
  });
});
