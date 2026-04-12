const winston = require('winston');
const path = require('path');
const config = require('../../config/default.json');

// 确保日志目录存在
const logDir = path.resolve(config.logging.dir);
require('fs').mkdirSync(logDir, { recursive: true });

// 创建日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${stack ? '\n' + stack : ''}`;
  })
);

// 创建 logger 实例
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // 文件输出（所有日志）
    new winston.transports.File({
      filename: path.join(logDir, 'monitor.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: config.logging.maxFiles,
      tailable: true
    })
  ]
});

// 为每个任务创建独立的 logger
function createTaskLogger(taskName) {
  return winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, `${taskName}.log`),
        maxsize: 10 * 1024 * 1024,
        maxFiles: config.logging.maxFiles,
        tailable: true
      })
    ]
  });
}

module.exports = { logger, createTaskLogger };
