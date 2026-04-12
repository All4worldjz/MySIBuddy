const CronTasksCollector = require('../src/collectors/cron-tasks');

// Mock 配置
const mockJobsData = {
  version: 1,
  jobs: [
    {
      id: 'test-job-1',
      name: '测试任务-正常',
      agentId: 'chief-of-staff',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 * * * *', tz: 'Asia/Shanghai' },
      state: {
        lastRunAtMs: Date.now() - 3600000,
        nextRunAtMs: Date.now() + 3600000,
        lastRunStatus: 'ok',
        lastStatus: 'ok',
        lastDurationMs: 5000,
        consecutiveErrors: 0,
        lastDelivered: true,
        lastDeliveryStatus: 'delivered'
      }
    },
    {
      id: 'test-job-2',
      name: '测试任务-错误',
      agentId: 'work-hub',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 */6 * * *', tz: 'Asia/Shanghai' },
      state: {
        lastRunAtMs: Date.now() - 7200000,
        nextRunAtMs: Date.now() + 14400000,
        lastRunStatus: 'error',
        lastStatus: 'error',
        lastError: 'Message failed',
        lastDurationMs: 30000,
        consecutiveErrors: 1,
        lastDelivered: true,
        lastDeliveryStatus: 'delivered'
      }
    },
    {
      id: 'test-job-3',
      name: '测试任务-连续错误',
      agentId: 'life-hub',
      enabled: true,
      schedule: { kind: 'every', everyMs: 3600000 },
      state: {
        lastRunAtMs: Date.now() - 1800000,
        nextRunAtMs: Date.now() + 1800000,
        lastRunStatus: 'error',
        lastStatus: 'error',
        lastError: 'Channel required',
        lastDurationMs: 10000,
        consecutiveErrors: 3,
        lastDelivered: false,
        lastDeliveryStatus: 'unknown'
      }
    },
    {
      id: 'test-job-4',
      name: '测试任务-禁用',
      agentId: 'tech-mentor',
      enabled: false,
      schedule: { kind: 'cron', expr: '0 22 * * 0', tz: 'Asia/Shanghai' },
      state: {
        lastRunAtMs: null,
        nextRunAtMs: null,
        lastRunStatus: 'ok',
        lastStatus: 'ok',
        consecutiveErrors: 0
      }
    }
  ]
};

describe('CronTasksCollector 测试', () => {
  let collector;

  beforeEach(() => {
    collector = new CronTasksCollector({
      thresholds: {
        consecutiveErrorsThreshold: 2,
        durationMultiplierThreshold: 2.0,
        scheduleDeviationMinutes: 5
      }
    });
    
    // Mock 读取 jobs.json
    collector.readJobsConfig = jest.fn().mockResolvedValue(mockJobsData);
  });

  describe('任务健康评估测试', () => {
    test('正常任务返回健康状态', () => {
      const job = mockJobsData.jobs[0];
      const health = collector.assessTaskHealth(job);
      
      expect(health.status).toBe('healthy');
      expect(health.signal).toBe('🟢');
    });

    test('单次错误任务返回警告状态', () => {
      const job = mockJobsData.jobs[1];
      const health = collector.assessTaskHealth(job);
      
      expect(health.status).toBe('warning');
      expect(health.signal).toBe('🟡');
    });

    test('连续错误任务返回严重状态', () => {
      const job = mockJobsData.jobs[2];
      const health = collector.assessTaskHealth(job);
      
      expect(health.status).toBe('critical');
      expect(health.signal).toBe('🔴');
    });

    test('禁用任务返回禁用状态', () => {
      const job = mockJobsData.jobs[3];
      const health = collector.assessTaskHealth(job);
      
      expect(health.status).toBe('disabled');
      expect(health.signal).toBe('⚪');
    });
  });

  describe('汇总计算测试', () => {
    test('正确计算任务统计', async () => {
      const data = await collector.collectAll();
      
      expect(data.summary.total).toBe(4);
      expect(data.summary.enabled).toBe(3);
      expect(data.summary.healthy).toBe(1);
      expect(data.summary.warning).toBe(1);
      expect(data.summary.critical).toBe(1);
      expect(data.summary.disabled).toBe(1);
    });

    test('正确识别失败任务', async () => {
      const data = await collector.collectAll();
      
      expect(data.summary.failedTasks.length).toBe(2);
      expect(data.summary.failedTasks.some(t => t.status === 'warning')).toBe(true);
      expect(data.summary.failedTasks.some(t => t.status === 'critical')).toBe(true);
    });

    test('正确排序即将执行的任务', async () => {
      const data = await collector.collectAll();
      
      expect(data.summary.nextRunTasks.length).toBeGreaterThan(0);
      // 验证按时间排序
      if (data.summary.nextRunTasks.length > 1) {
        const times = data.summary.nextRunTasks.map(t => new Date(t.nextRunAt).getTime());
        for (let i = 0; i < times.length - 1; i++) {
          expect(times[i]).toBeLessThanOrEqual(times[i + 1]);
        }
      }
    });
  });

  describe('报告生成测试', () => {
    test('生成 Markdown 报告', async () => {
      const data = await collector.collectAll();
      const report = collector.generateReport(data);
      
      expect(report).toContain('### OpenClaw Cron 任务状态');
      expect(report).toContain('测试任务-错误');
      expect(report).toContain('测试任务-连续错误');
      expect(report).toContain('🔴');
      expect(report).toContain('🟡');
    });
  });
});
