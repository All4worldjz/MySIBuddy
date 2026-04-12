const { exec } = require('child_process');
const util = require('util');
const { logger } = require('../utils/logger');

const execPromise = util.promisify(exec);

/**
 * 系统资源指标采集器
 * 对应服务器端：system_health_report.sh v2.1.0
 */
class SystemCollector {
  constructor(thresholds) {
    this.thresholds = thresholds;
  }

  /**
   * 采集全部系统指标
   */
  async collectAll() {
    logger.info('[SystemCollector] 开始采集系统指标...');

    const [disk, cpu, memory, load, processes] = await Promise.all([
      this.collectDisk(),
      this.collectCpu(),
      this.collectMemory(),
      this.collectLoad(),
      this.collectProcesses()
    ]);

    const summary = this.calculateSummary({ disk, cpu, memory, load, processes });

    logger.info(`[SystemCollector] 采集完成`);

    return {
      timestamp: new Date().toISOString(),
      disk,
      cpu,
      memory,
      load,
      processes,
      summary
    };
  }

  /**
   * 采集磁盘使用率
   */
  async collectDisk() {
    try {
      const { stdout } = await execPromise(
        `df -hT -x tmpfs -x devtmpfs -x squashfs -x efivarfs -x vfat 2>/dev/null | tail -n +2`
      );

      const filesystems = stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        const usagePercent = parseInt(parts[5], 10);
        return {
          filesystem: parts[0],
          type: parts[1],
          total: parts[2],
          used: parts[3],
          available: parts[4],
          usePercent: usagePercent,
          mounted: parts[6]
        };
      });

      return { filesystems };
    } catch (error) {
      logger.error('[SystemCollector] 磁盘采集失败:', error.message);
      return { filesystems: [], error: error.message };
    }
  }

  /**
   * 采集 CPU 利用率
   */
  async collectCpu() {
    try {
      // 采样两次计算差值
      const { stdout: line1 } = await execPromise(`grep '^cpu ' /proc/stat`);
      await new Promise(resolve => setTimeout(resolve, 300));
      const { stdout: line2 } = await execPromise(`grep '^cpu ' /proc/stat`);

      const vals1 = line1.trim().split(/\s+/).slice(1).map(Number);
      const vals2 = line2.trim().split(/\s+/).slice(1).map(Number);

      const diffs = vals2.map((v, i) => v - vals1[i]);
      const total = diffs.reduce((a, b) => a + b, 0);
      const idle = diffs[3]; // idle 是第 4 个值
      const usedPercent = total > 0 ? Math.round(((total - idle) / total) * 100) : 0;

      const { stdout: nproc } = await execPromise(`nproc`);
      const cores = parseInt(nproc.trim(), 10);

      return {
        usedPercent,
        idlePercent: 100 - usedPercent,
        cores
      };
    } catch (error) {
      logger.error('[SystemCollector] CPU 采集失败:', error.message);
      return { usedPercent: null, idlePercent: null, error: error.message };
    }
  }

  /**
   * 采集内存使用率
   */
  async collectMemory() {
    try {
      const { stdout } = await execPromise(`cat /proc/meminfo`);
      const info = {};

      stdout.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s+(\d+)/);
        if (match) {
          info[match[1]] = parseInt(match[2], 10) * 1024; // 转换为字节
        }
      });

      const total = info.MemTotal || 0;
      const free = info.MemFree || 0;
      const available = info.MemAvailable || free;
      const buffers = info.Buffers || 0;
      const cached = info.Cached || 0;
      const used = total - free - buffers - cached;
      const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;

      const swapTotal = info.SwapTotal || 0;
      const swapFree = info.SwapFree || 0;
      const swapUsed = swapTotal - swapFree;
      const swapPercent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;

      return {
        total,
        used,
        available,
        usedPercent,
        swapTotal,
        swapUsed,
        swapPercent
      };
    } catch (error) {
      logger.error('[SystemCollector] 内存采集失败:', error.message);
      return { total: 0, used: 0, available: 0, usedPercent: null, error: error.message };
    }
  }

  /**
   * 采集系统负载
   */
  async collectLoad() {
    try {
      const { stdout } = await execPromise(`cat /proc/loadavg`);
      const [load1, load5, load15] = stdout.trim().split(/\s+/).slice(0, 3).map(Number);

      const { stdout: nproc } = await execPromise(`nproc`);
      const cores = parseInt(nproc.trim(), 10);

      return {
        load1,
        load5,
        load15,
        cores,
        ratio1: (load1 / cores).toFixed(2),
        ratio5: (load5 / cores).toFixed(2),
        ratio15: (load15 / cores).toFixed(2)
      };
    } catch (error) {
      logger.error('[SystemCollector] 负载采集失败:', error.message);
      return { load1: null, load5: null, load15: null, cores: null, error: error.message };
    }
  }

  /**
   * 采集进程 TOP5
   */
  async collectProcesses() {
    try {
      const { stdout: cpuTop } = await execPromise(
        `ps aux --sort=-%cpu | tail -n +2 | head -5`
      );
      const { stdout: memTop } = await execPromise(
        `ps aux --sort=-%mem | tail -n +2 | head -5`
      );

      const parsePs = (output) => output.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        return {
          user: parts[0],
          pid: parts[1],
          cpuPercent: parseFloat(parts[2]),
          memPercent: parseFloat(parts[3]),
          vsz: parts[4],
          rss: parts[5],
          command: parts.slice(10).join(' ').substring(0, 50)
        };
      });

      return {
        cpuTop: parsePs(cpuTop),
        memTop: parsePs(memTop)
      };
    } catch (error) {
      logger.error('[SystemCollector] 进程采集失败:', error.message);
      return { cpuTop: [], memTop: [], error: error.message };
    }
  }

  /**
   * 计算汇总
   */
  calculateSummary(data) {
    const alerts = [];
    const { disk, cpu, memory, load } = this.thresholds;

    // 磁盘检查
    for (const fs of data.disk.filesystems || []) {
      if (fs.usePercent >= disk.critPercent) {
        alerts.push({
          level: 'critical',
          metric: 'disk',
          message: `磁盘 ${fs.mounted} 使用率 ${fs.usePercent}% ≥ ${disk.critPercent}%`
        });
      } else if (fs.usePercent >= disk.warnPercent) {
        alerts.push({
          level: 'warning',
          metric: 'disk',
          message: `磁盘 ${fs.mounted} 使用率 ${fs.usePercent}% ≥ ${disk.warnPercent}%`
        });
      }
    }

    // CPU 检查
    if (data.cpu.usedPercent !== null) {
      if (data.cpu.usedPercent >= cpu.critPercent) {
        alerts.push({
          level: 'critical',
          metric: 'cpu',
          message: `CPU 使用率 ${data.cpu.usedPercent}% ≥ ${cpu.critPercent}%`
        });
      } else if (data.cpu.usedPercent >= cpu.warnPercent) {
        alerts.push({
          level: 'warning',
          metric: 'cpu',
          message: `CPU 使用率 ${data.cpu.usedPercent}% ≥ ${cpu.warnPercent}%`
        });
      }
    }

    // 内存检查
    if (data.memory.usedPercent !== null) {
      if (data.memory.usedPercent >= memory.critPercent) {
        alerts.push({
          level: 'critical',
          metric: 'memory',
          message: `内存使用率 ${data.memory.usedPercent}% ≥ ${memory.critPercent}%`
        });
      } else if (data.memory.usedPercent >= memory.warnPercent) {
        alerts.push({
          level: 'warning',
          metric: 'memory',
          message: `内存使用率 ${data.memory.usedPercent}% ≥ ${memory.warnPercent}%`
        });
      }
    }

    // 负载检查
    if (data.load.ratio1 !== null) {
      const ratio = parseFloat(data.load.ratio1);
      if (ratio >= load.critRatio) {
        alerts.push({
          level: 'critical',
          metric: 'load',
          message: `1分钟负载比 ${ratio} ≥ ${load.critRatio}`
        });
      } else if (ratio >= load.warnRatio) {
        alerts.push({
          level: 'warning',
          metric: 'load',
          message: `1分钟负载比 ${ratio} ≥ ${load.warnRatio}`
        });
      }
    }

    return {
      alerts,
      hasCritical: alerts.some(a => a.level === 'critical'),
      hasWarning: alerts.some(a => a.level === 'warning')
    };
  }

  /**
   * 生成 Markdown 报告
   */
  generateReport(data) {
    const { disk, cpu, memory, load, processes, summary } = data;

    let report = `### 系统资源状态\n\n`;

    // 磁盘
    report += `**📀 磁盘**\n\n`;
    report += `| 文件系统 | 总容量 | 已用 | 可用 | 使用率 | 挂载点 | 信号 |\n`;
    report += `|----------|--------|------|------|--------|--------|------|\n`;
    for (const fs of disk.filesystems || []) {
      const signal = fs.usePercent >= this.thresholds.disk.critPercent ? '🔴' :
                     fs.usePercent >= this.thresholds.disk.warnPercent ? '🟡' : '🟢';
      report += `| ${fs.filesystem} | ${fs.total} | ${fs.used} | ${fs.available} | ${fs.usePercent}% | ${fs.mounted} | ${signal} |\n`;
    }

    // CPU
    report += `\n**🖥️ CPU**\n\n`;
    report += `| 指标 | 值 | 信号 |\n`;
    report += `|------|-----|------|\n`;
    const cpuSignal = cpu.usedPercent >= this.thresholds.cpu.critPercent ? '🔴' :
                      cpu.usedPercent >= this.thresholds.cpu.warnPercent ? '🟡' : '🟢';
    report += `| 使用率 | ${cpu.usedPercent}% | ${cpuSignal} |\n`;
    report += `| 核心数 | ${cpu.cores} | |\n`;

    // 内存
    report += `\n**💾 内存**\n\n`;
    report += `| 指标 | 值 |\n`;
    report += `|------|-----|\n`;
    const formatBytes = (bytes) => {
      const gb = bytes / (1024 * 1024 * 1024);
      return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    };
    const memSignal = memory.usedPercent >= this.thresholds.memory.critPercent ? '🔴' :
                      memory.usedPercent >= this.thresholds.memory.warnPercent ? '🟡' : '🟢';
    report += `| 总量 | ${formatBytes(memory.total)} |\n`;
    report += `| 已用 | ${formatBytes(memory.used)} (${memory.usedPercent}%) |\n`;
    report += `| 可用 | ${formatBytes(memory.available)} |\n`;
    report += `| 信号 | ${memSignal} |\n`;

    // 负载
    report += `\n**📈 负载**\n\n`;
    report += `| 时间 | 负载值 | 核心数 | 负载比 | 信号 |\n`;
    report += `|------|--------|--------|--------|------|\n`;
    const loadSignal1 = parseFloat(load.ratio1) >= this.thresholds.load.critRatio ? '🔴' :
                        parseFloat(load.ratio1) >= this.thresholds.load.warnRatio ? '🟡' : '🟢';
    report += `| 1分钟 | ${load.load1} | ${load.cores} | ${load.ratio1} | ${loadSignal1} |\n`;
    const loadSignal5 = parseFloat(load.ratio5) >= this.thresholds.load.critRatio ? '🔴' :
                        parseFloat(load.ratio5) >= this.thresholds.load.warnRatio ? '🟡' : '🟢';
    report += `| 5分钟 | ${load.load5} | ${load.cores} | ${load.ratio5} | ${loadSignal5} |\n`;
    const loadSignal15 = parseFloat(load.ratio15) >= this.thresholds.load.critRatio ? '🔴' :
                         parseFloat(load.ratio15) >= this.thresholds.load.warnRatio ? '🟡' : '🟢';
    report += `| 15分钟 | ${load.load15} | ${load.cores} | ${load.ratio15} | ${loadSignal15} |\n`;

    return report;
  }
}

module.exports = SystemCollector;
