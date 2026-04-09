# 实施日志：子会话上限提升配置变更

**日期**: 2026-04-09  
**版本**: v1.0  
**Git Commit**: pending  
**实施者**: chief-of-staff  
**审批人**: CC（春哥）

---

## 一、背景与问题

### 1.1 问题现象
- chief-of-staff 主会话堆积 **42 个子会话**（配置上限 4 个）
- 大量子会话状态为 `done` 或 `timeout`，但未被正确清理（"僵尸会话"）
- tech-mentor、work-hub、coder-hub、zh-scribe 均存在类似超限问题

### 1.2 根因分析
1. **协同编排契约违反**: chief-of-staff 在批量任务中不断 spawn 新 session 而不等待 completion 事件回流
2. **超时处理缺失**: timeout 的子会话未被清理，父会话未处理超时状态
3. **配置上限过低**: `maxChildrenPerAgent: 4` 无法满足跨域统筹场景的实际并发需求

### 1.3 业务场景需求
| Agent | 典型协作场景 | 合理并发需求 |
|-------|-------------|-------------|
| chief-of-staff | 跨域统筹，同时协调 7 个 hub | 7-8 |
| work-hub | 工作项目 + 技术评估 + 文档协作 | 5-6 |
| coder-hub | tech-mentor 调用的 specialist | 4-6 |

---

## 二、解决方案

### 2.1 配置变更（阶段一）
```json
defaults.subagents.maxChildrenPerAgent: 4 → 8
defaults.subagents.maxConcurrent: 2 → 4
```

### 2.2 阶段二（观察 1-2 周后）
根据实际并发峰值和 Token 消耗，再决定是否提升：
```json
chief-of-staff: 8 → 10
work-hub: 6 → 8
```

### 2.3 关键提醒
**提升上限只是缓解症状，不是根治**。必须同时修复：
1. 协同编排契约：必须在全部预期子任务 completion 回流后才能发送最终答复
2. 超时处理：timeout 的子会话必须被清理
3. 会话清理：定期清理已完成的僵尸会话

---

## 三、实施过程

### 3.1 时间线
| 时间 | 动作 | 状态 |
|------|------|------|
| 12:34 | CC 批准执行方案 | ✅ |
| 12:35 | 创建配置备份 | ✅ `/home/admin/.openclaw/docs/config-backup-20260409/openclaw.json.bak` |
| 12:36 | 修改 openclaw.json 配置 | ✅ |
| 12:38 | 重启 Gateway | ✅ systemd restart ok |
| 12:39 | 验证配置生效 | ✅ `maxChildrenPerAgent: 8` |
| 12:40 | 验证 Gateway 状态 | ✅ running (sessions 179) |

### 3.2 关键命令
```bash
# 备份配置
mkdir -p /home/admin/.openclaw/docs/config-backup-20260409
cp /home/admin/.openclaw/openclaw.json /home/admin/.openclaw/docs/config-backup-20260409/openclaw.json.bak

# 修改配置（通过 edit 工具）
# defaults.subagents.maxChildrenPerAgent: 4 → 8
# defaults.subagents.maxConcurrent: 2 → 4

# 重启 Gateway
systemctl --user restart openclaw-gateway

# 验证状态
openclaw status --deep
grep -A5 '"subagents"' /home/admin/.openclaw/openclaw.json
```

---

## 四、验证结果

### 4.1 配置验证
```json
"subagents": {
  "maxConcurrent": 4,
  "maxSpawnDepth": 1,
  "maxChildrenPerAgent": 8,  // ✅ 已生效
  "archiveAfterMinutes": 60,
  ...
}
```

### 4.2 Gateway 状态
```
Gateway service: systemd installed · enabled · running (pid 3817, state active)
Agents: 8 · sessions 179 · default chief-of-staff active
```

### 4.3 遗留问题
- 旧会话未清理：Gateway 重启保留了会话状态（预期行为，会话持久化）
- 解决方案：等待自然过期（`archiveAfterMinutes: 60`）或后续手动终止

---

## 五、问题排查与教训

### 5.1 踩坑记录
1. **备份脚本路径错误**: `/home/admin/.openclaw/scripts/backup_openclaw_config.sh` 不存在
   - 解决：手动创建备份目录并复制配置文件
   
2. **热重载未清理会话**: Gateway 热重载后旧会话仍然存在
   - 原因：会话状态持久化是预期行为
   - 解决：等待自然过期或手动终止

### 5.2 教训总结
1. **配置变更前必须备份**: 即使有版本控制，也要创建时间戳备份
2. **会话清理需单独处理**: 配置变更不会自动清理现有会话
3. **分阶段执行更安全**: 先提升到中间值，观察后再决定是否继续提升

---

## 六、后续计划

| 任务 | 负责人 | 截止时间 | 状态 |
|------|--------|----------|------|
| 监控子会话并发峰值 | chief-of-staff | 2026-04-16 | 待执行 |
| 评估是否需要阶段二提升 | chief-of-staff | 2026-04-23 | 待执行 |
| 修复协同编排契约（代码层面） | coder-hub | pending | 待讨论 |
| 添加超时会话自动清理机制 | coder-hub | pending | 待讨论 |

---

## 七、参考文档
- MEMORY.md: `## 系统健康监控脚本实施记录（2026-04-09）`
- scripts/IMPLEMENTATION_LOG.md（模板）
- openclaw.json 配置 schema

---

**Git Commit**: pending  
**远程仓库**: git@github.com:All4worldjz/MySIBuddy.git  
**分支**: openclaw-ops
