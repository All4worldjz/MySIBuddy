const axios = require('axios');

/**
 * 飞书 API 重试和退避工具
 * 处理 API 限流、临时错误等场景
 */
class FeishuRetryHandler {
  /**
   * 默认配置
   */
  static defaultConfig = {
    maxRetries: 3,
    initialDelay: 1000,    // 1 秒
    maxDelay: 30000,       // 30 秒
    backoffMultiplier: 2,  // 指数退避
    retryableStatus: [429, 500, 502, 503, 504],
    retryableCodes: [99991400, 99991664] // 飞书特定错误码
  };

  /**
   * 执行带重试的请求
   * @param {Function} requestFn - 返回 Promise 的请求函数
   * @param {Object} config - 重试配置
   * @returns {Promise<any>} 请求结果
   */
  static async execute(requestFn, config = {}) {
    const {
      maxRetries,
      initialDelay,
      maxDelay,
      backoffMultiplier,
      retryableStatus,
      retryableCodes
    } = { ...this.defaultConfig, ...config };

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        if (!this.shouldRetry(error, retryableStatus, retryableCodes)) {
          throw error; // 不重试，直接抛出
        }

        // 最后一次尝试失败，抛出错误
        if (attempt === maxRetries) {
          throw this.createRetryError(error, maxRetries);
        }

        // 计算退避延迟
        const delay = this.calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        
        // 记录重试信息
        console.warn(`[Feishu Retry] 请求失败，${delay}ms 后重试 (${attempt + 1}/${maxRetries})`);
        console.warn(`  错误: ${error.message}`);
        if (error.response?.data) {
          console.warn(`  响应: ${JSON.stringify(error.response.data)}`);
        }

        // 等待后重试
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 判断是否应该重试
   */
  static shouldRetry(error, retryableStatus, retryableCodes) {
    // HTTP 状态码重试
    if (error.response && retryableStatus.includes(error.response.status)) {
      return true;
    }

    // 飞书错误码重试
    if (error.response?.data?.code && retryableCodes.includes(error.response.data.code)) {
      return true;
    }

    // 网络错误重试
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * 计算退避延迟（指数退避 + 抖动）
   */
  static calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier) {
    // 指数退避
    const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
    
    // 限制最大延迟
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // 添加随机抖动（±25%），避免惊群效应
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    
    return Math.round(cappedDelay + jitter);
  }

  /**
   * 创建带重试信息的错误
   */
  static createRetryError(originalError, maxRetries) {
    const retryError = new Error(
      `请求失败，已重试 ${maxRetries} 次: ${originalError.message}`
    );
    retryError.originalError = originalError;
    retryError.retries = maxRetries;
    retryError.cause = originalError;
    return retryError;
  }

  /**
   * 延迟函数
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 便捷函数：带重试的 GET 请求
 */
async function feishuGet(url, config = {}) {
  const { retryConfig, ...axiosConfig } = config;
  
  return FeishuRetryHandler.execute(
    () => axios.get(url, axiosConfig),
    retryConfig
  );
}

/**
 * 便捷函数：带重试的 POST 请求
 */
async function feishuPost(url, data = {}, config = {}) {
  const { retryConfig, ...axiosConfig } = config;
  
  return FeishuRetryHandler.execute(
    () => axios.post(url, data, axiosConfig),
    retryConfig
  );
}

module.exports = {
  FeishuRetryHandler,
  feishuGet,
  feishuPost
};
