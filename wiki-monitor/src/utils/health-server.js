const http = require('http');
const { logger } = require('./logger');

/**
 * 健康检查 HTTP 服务器
 * 提供 /health 端点用于监控
 */
class HealthServer {
  constructor(port = 3100) {
    this.port = port;
    this.server = null;
    this.status = {
      status: 'starting',
      uptime: 0,
      tasks: new Map(),
      lastCheck: null
    };
    this.startTime = Date.now();
  }

  /**
   * 启动健康检查服务器
   */
  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      logger.info(`[HealthServer] 健康检查服务器已启动，端口: ${this.port}`);
    });

    this.server.on('error', (error) => {
      logger.error('[HealthServer] 服务器错误:', error);
    });

    return this;
  }

  /**
   * 停止健康检查服务器
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('[HealthServer] 健康检查服务器已停止');
      });
    }
  }

  /**
   * 处理 HTTP 请求
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      this.handleHealth(res);
    } else if (url.pathname === '/health/tasks' && req.method === 'GET') {
      this.handleTasks(res);
    } else if (url.pathname === '/health/ready' && req.method === 'GET') {
      this.handleReady(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  }

  /**
   * /health 端点
   * 返回整体健康状态
   */
  handleHealth(res) {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    const health = {
      status: this.calculateHealthStatus(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      tasksTotal: this.status.tasks.size,
      tasksHealthy: this.countHealthyTasks(),
      tasksUnhealthy: this.countUnhealthyTasks()
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  /**
   * /health/tasks 端点
   * 返回所有任务的详细状态
   */
  handleTasks(res) {
    const tasks = [];
    
    for (const [name, taskStatus] of this.status.tasks) {
      tasks.push({
        name,
        status: taskStatus.status,
        lastRun: taskStatus.lastRun,
        lastSuccess: taskStatus.lastSuccess,
        lastError: taskStatus.lastError,
        runCount: taskStatus.runCount || 0
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tasks }, null, 2));
  }

  /**
   * /health/ready 端点
   * 返回是否准备好执行任务
   */
  handleReady(res) {
    const ready = this.status.status === 'running' && this.status.tasks.size > 0;
    
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready }, null, 2));
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskName, status) {
    this.status.tasks.set(taskName, {
      ...this.status.tasks.get(taskName),
      ...status,
      lastRun: new Date().toISOString()
    });

    this.status.lastCheck = new Date().toISOString();
  }

  /**
   * 记录任务成功
   */
  recordTaskSuccess(taskName) {
    const current = this.status.tasks.get(taskName) || { runCount: 0 };
    
    this.status.tasks.set(taskName, {
      ...current,
      status: 'healthy',
      lastSuccess: new Date().toISOString(),
      lastError: null,
      runCount: (current.runCount || 0) + 1
    });
  }

  /**
   * 记录任务失败
   */
  recordTaskFailure(taskName, error) {
    const current = this.status.tasks.get(taskName) || { runCount: 0 };
    
    this.status.tasks.set(taskName, {
      ...current,
      status: 'unhealthy',
      lastError: error.message || String(error),
      runCount: (current.runCount || 0) + 1
    });
  }

  /**
   * 计算整体健康状态
   */
  calculateHealthStatus() {
    if (this.status.tasks.size === 0) {
      return 'starting';
    }

    const unhealthyCount = this.countUnhealthyTasks();
    
    if (unhealthyCount === 0) {
      return 'healthy';
    } else if (unhealthyCount < this.status.tasks.size / 2) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * 统计健康任务数
   */
  countHealthyTasks() {
    let count = 0;
    for (const [, taskStatus] of this.status.tasks) {
      if (taskStatus.status === 'healthy') {
        count++;
      }
    }
    return count;
  }

  /**
   * 统计不健康任务数
   */
  countUnhealthyTasks() {
    let count = 0;
    for (const [, taskStatus] of this.status.tasks) {
      if (taskStatus.status === 'unhealthy') {
        count++;
      }
    }
    return count;
  }
}

module.exports = HealthServer;
