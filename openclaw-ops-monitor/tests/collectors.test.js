const SystemCollector = require('../src/collectors/system');
const thresholds = require('../config/thresholds.json');

describe('SystemCollector 测试', () => {
  let collector;

  beforeEach(() => {
    collector = new SystemCollector(thresholds.system);
  });

  describe('磁盘采集测试', () => {
    test('采集磁盘使用率', async () => {
      const disk = await collector.collectDisk();
      
      expect(disk).toHaveProperty('filesystems');
      expect(Array.isArray(disk.filesystems)).toBe(true);
      
      if (disk.filesystems.length > 0) {
        const fs = disk.filesystems[0];
        expect(fs).toHaveProperty('filesystem');
        expect(fs).toHaveProperty('usePercent');
        expect(fs).toHaveProperty('mounted');
      }
    });
  });

  describe('CPU 采集测试', () => {
    test('采集 CPU 使用率', async () => {
      const cpu = await collector.collectCpu();
      
      expect(cpu).toHaveProperty('usedPercent');
      // macOS 没有 /proc/stat，允许采集失败
      if (cpu.error) {
        expect(cpu.usedPercent).toBeNull();
      } else {
        expect(cpu).toHaveProperty('cores');
        expect(cpu.cores).toBeGreaterThan(0);
      }
    });
  });

  describe('内存采集测试', () => {
    test('采集内存使用率', async () => {
      const memory = await collector.collectMemory();
      
      // macOS 没有 /proc/meminfo，允许采集失败
      if (memory.error) {
        expect(memory.total).toBe(0);
      } else {
        expect(memory).toHaveProperty('total');
        expect(memory).toHaveProperty('used');
        expect(memory).toHaveProperty('available');
        expect(memory).toHaveProperty('usedPercent');
      }
    });
  });

  describe('负载采集测试', () => {
    test('采集系统负载', async () => {
      const load = await collector.collectLoad();
      
      // macOS 没有 /proc/loadavg，允许采集失败
      if (load.error) {
        expect(load.load1).toBeNull();
      } else {
        expect(load).toHaveProperty('load1');
        expect(load).toHaveProperty('load5');
        expect(load).toHaveProperty('load15');
        expect(load).toHaveProperty('cores');
        expect(load).toHaveProperty('ratio1');
      }
    });
  });

  describe('汇总计算测试', () => {
    test('无告警时返回空数组', () => {
      const data = {
        disk: { filesystems: [{ usePercent: 50, mounted: '/' }] },
        cpu: { usedPercent: 30 },
        memory: { usedPercent: 40 },
        load: { ratio1: '0.30' }
      };

      const summary = collector.calculateSummary(data);
      
      expect(summary.alerts).toHaveLength(0);
      expect(summary.hasCritical).toBe(false);
      expect(summary.hasWarning).toBe(false);
    });

    test('磁盘超限时返回严重告警', () => {
      const data = {
        disk: { filesystems: [{ usePercent: 96, mounted: '/' }] },
        cpu: { usedPercent: 30 },
        memory: { usedPercent: 40 },
        load: { ratio1: '0.30' }
      };

      const summary = collector.calculateSummary(data);
      
      expect(summary.alerts.length).toBeGreaterThan(0);
      expect(summary.hasCritical).toBe(true);
      expect(summary.alerts[0].level).toBe('critical');
    });

    test('CPU 超限时返回严重告警', () => {
      const data = {
        disk: { filesystems: [] },
        cpu: { usedPercent: 92 },
        memory: { usedPercent: 40 },
        load: { ratio1: '0.30' }
      };

      const summary = collector.calculateSummary(data);
      
      expect(summary.hasCritical).toBe(true);
      expect(summary.alerts[0].metric).toBe('cpu');
    });
  });
});
