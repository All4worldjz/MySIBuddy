const path = require('path');

/**
 * 加载 .env 文件并合并到配置中
 * 优先级：.env > config/default.json
 */
function loadEnvConfig() {
  try {
    // 尝试加载 dotenv
    const dotenv = require('dotenv');
    const envPath = path.resolve(__dirname, '../.env');
    
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      // .env 文件不存在时不报错
      if (result.error.code !== 'ENOENT') {
        console.warn('[Config] 加载 .env 文件失败:', result.error.message);
      }
      return {};
    }

    // 解析环境变量
    const envConfig = {};
    
    // 飞书配置
    if (process.env.FEISHU_APP_ID) envConfig.FEISHU_APP_ID = process.env.FEISHU_APP_ID;
    if (process.env.FEISHU_APP_SECRET) envConfig.FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
    if (process.env.FEISHU_KM_VAULT_TOKEN) envConfig.FEISHU_KM_VAULT_TOKEN = process.env.FEISHU_KM_VAULT_TOKEN;
    if (process.env.FEISHU_BASE_URL) envConfig.FEISHU_BASE_URL = process.env.FEISHU_BASE_URL;
    
    // GitHub 配置
    if (process.env.GITHUB_SSH_KEY) envConfig.GITHUB_SSH_KEY = process.env.GITHUB_SSH_KEY;
    if (process.env.GITHUB_REPO) envConfig.GITHUB_REPO = process.env.GITHUB_REPO;
    if (process.env.GITHUB_BRANCH) envConfig.GITHUB_BRANCH = process.env.GITHUB_BRANCH;
    
    // Wiki 配置
    if (process.env.WIKI_LOCAL_PATH) envConfig.WIKI_LOCAL_PATH = process.env.WIKI_LOCAL_PATH;
    if (process.env.WIKI_RAW_DIR) envConfig.WIKI_RAW_DIR = process.env.WIKI_RAW_DIR;
    if (process.env.WIKI_WIKI_DIR) envConfig.WIKI_WIKI_DIR = process.env.WIKI_WIKI_DIR;
    if (process.env.WIKI_EXPORT_FOLDER_NAME) envConfig.WIKI_EXPORT_FOLDER_NAME = process.env.WIKI_EXPORT_FOLDER_NAME;
    
    // 日志配置
    if (process.env.LOG_LEVEL) envConfig.LOG_LEVEL = process.env.LOG_LEVEL;
    if (process.env.LOG_DIR) envConfig.LOG_DIR = process.env.LOG_DIR;
    if (process.env.LOG_MAX_FILES) envConfig.LOG_MAX_FILES = parseInt(process.env.LOG_MAX_FILES, 10);
    if (process.env.LOG_MAX_SIZE) envConfig.LOG_MAX_SIZE = process.env.LOG_MAX_SIZE;
    
    // 监控器配置
    if (process.env.MONITOR_ENABLED) envConfig.MONITOR_ENABLED = process.env.MONITOR_ENABLED === 'true';
    if (process.env.MONITOR_DRY_RUN) envConfig.MONITOR_DRY_RUN = process.env.MONITOR_DRY_RUN === 'true';
    if (process.env.MONITOR_NOTIFY_ON_COMPLETE) envConfig.MONITOR_NOTIFY_ON_COMPLETE = process.env.MONITOR_NOTIFY_ON_COMPLETE === 'true';
    if (process.env.MONITOR_NOTIFY_ON_ERROR) envConfig.MONITOR_NOTIFY_ON_ERROR = process.env.MONITOR_NOTIFY_ON_ERROR === 'true';
    
    // Telegram 配置
    if (process.env.TELEGRAM_BOT_TOKEN) envConfig.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (process.env.TELEGRAM_CHAT_ID) envConfig.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    console.log('[Config] .env 文件加载成功');
    return envConfig;
  } catch (error) {
    console.warn('[Config] dotenv 模块不可用:', error.message);
    return {};
  }
}

module.exports = { loadEnvConfig };
