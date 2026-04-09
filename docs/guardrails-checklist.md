# OpenClaw 系统安全护栏检查清单（红线）

**版本**: v1.0  
**生效日期**: 2026-04-09  
**审批人**: CC（春哥）  
**Git Commit**: pending  

> **红线声明**: 任何系统级变更必须严格遵循本检查清单。跳过任何步骤视为严重违规。

---

## 一、适用范围

本清单适用于以下操作：
- ✅ 修改 `openclaw.json` 配置（任何字段）
- ✅ 新增/删除/修改 agent、channel、plugin、binding
- ✅ 执行 `openclaw doctor --fix`
- ✅ 重启/重载 Gateway
- ✅ 修改核心配置（plugins、channels、bindings、agents.list、gateway、tools、session）
- ✅ 执行系统命令（systemctl、openclaw CLI）

---

## 二、护栏流程（十步闭环）

### 阶段一：诊断与方案（步骤 1-3）

| 步骤 | 动作 | 输出物 | 春哥确认点 |
|------|------|--------|-----------|
| **1** | **只读诊断** | 诊断报告 | ❏ 诊断结果确认 |
| **2** | **提出最小改动方案** | 方案文档（含回滚方案） | ❏ 方案批准 |
| **3** | **明确配置字段** | 配置变更清单（JSON diff） | ❏ **配置字段确认** |

#### 步骤 1：只读诊断
```bash
# 必做检查
openclaw status --deep
gateway config.get
# 可选：根据变更类型追加
openclaw security audit
openclaw tasks list
```

#### 步骤 2：提出最小改动方案
方案必须包含：
- [ ] 背景与目标（为什么要改）
- [ ] 变更范围（改哪些字段）
- [ ] 风险评估（可能的副作用）
- [ ] 回滚方案（如何恢复）
- [ ] 验证计划（如何确认成功）

#### 步骤 3：明确配置字段（❗关键）
**必须明确列出**：
```json
{
  "变更字段": "agents.defaults.subagents.maxChildrenPerAgent",
  "当前值": 4,
  "目标值": 8,
  "影响范围": "所有 agent 的子会话上限"
}
```

**春哥必须明确回复**："确认修改 [字段名] 从 [X] 到 [Y]"

---

### 阶段二：备份与确认（步骤 4-5）

| 步骤 | 动作 | 输出物 | 春哥确认点 |
|------|------|--------|-----------|
| **4** | **创建时间戳备份** | 备份文件路径 | ❏ 备份完成确认 |
| **5** | **等待春哥确认备份** | 春哥明确批准 | ❏ **继续执行批准** |

#### 步骤 4：创建时间戳备份
```bash
# 标准备份命令
mkdir -p /home/admin/.openclaw/docs/config-backup-$(date +%Y%m%d)
cp /home/admin/.openclaw/openclaw.json \
   /home/admin/.openclaw/docs/config-backup-$(date +%Y%m%d)/openclaw.json.bak

# 输出备份路径
echo "备份已创建：/home/admin/.openclaw/docs/config-backup-$(date +%Y%m%d)/openclaw.json.bak"
```

#### 步骤 5：等待春哥确认（❗关键）
**必须暂停并报告**：
```
备份已创建：`docs/config-backup-20260409/openclaw.json.bak`
是否继续执行变更？
```

**春哥必须明确回复**："继续" 或 "执行"

---

### 阶段三：执行与验证（步骤 6-9）

| 步骤 | 动作 | 输出物 | 春哥确认点 |
|------|------|--------|-----------|
| **6** | **执行变更** | config.patch / config.apply | ❏ 变更完成通知 |
| **7** | **重启或重载** | Gateway 重启 | ❏ 重启完成通知 |
| **8** | **深度验证** | `openclaw status --deep` 输出 | ❏ 验证通过确认 |
| **9** | **真实消息验证** | 测试消息路由正常 | ❏ **功能验证通过** |

#### 步骤 8：深度验证（❗关键）
```bash
# 必做检查
openclaw status --deep

# 验证清单
- [ ] Gateway 服务：running (pid xxx, state active)
- [ ] Channels (Telegram)：ON / OK
- [ ] Channels (Feishu)：ON / OK
- [ ] Agents：8 active
- [ ] Security audit：无新增 critical/error
```

#### 步骤 9：真实消息验证（❗关键）
**必须验证**：
- [ ] 发送测试消息到目标 channel
- [ ] 确认消息进入正确 session key
- [ ] 确认 agent 能正常回复
- [ ] 确认 subagent spawn 正常

---

### 阶段四：文档与归档（步骤 10）

| 步骤 | 动作 | 输出物 | 春哥确认点 |
|------|------|--------|-----------|
| **10** | **文档记录 + Git** | 实施日志 + Git commit + push | ❏ 归档完成通知 |

#### 步骤 10：文档记录
```bash
# 创建实施日志
vi /home/admin/.openclaw/scripts/IMPLEMENTATION_LOG_$(date +%Y%m%d)_<topic>.md

# Git commit
git add scripts/IMPLEMENTATION_LOG_*.md docs/config-backup-*/openclaw.json.bak
git commit -m "feat: <变更主题>

- 变更内容摘要
- 备份路径
- 实施日志路径
- Gateway 重启验证通过"

# Git push
git push origin <branch>
```

---

## 三、禁止行为（红线）

❌ **绝对禁止**：
1. 未备份直接修改配置
2. 春哥未明确确认配置字段就执行
3. 备份后未等春哥确认就继续
4. 未执行 `openclaw status --deep` 就报告完成
5. 未验证真实消息路由就报告成功
6. 跳过文档记录和 Git commit
7. 把"执行计划批准"等同于"配置字段确认"
8. 猜测性改配置（缺少运行/日志/配置证据）

---

## 四、回滚流程

### 触发条件
- Gateway 启动失败
- Channel 显示 OFF 或 ERROR
- Agent 无法调用预期模型
- 真实消息无法进入正确 session
- 春哥明确要求回滚

### 回滚命令
```bash
# 恢复配置
cp /home/admin/.openclaw/docs/config-backup-<date>/openclaw.json.bak \
   /home/admin/.openclaw/openclaw.json

# 重启 Gateway
systemctl --user restart openclaw-gateway

# 验证恢复
openclaw status --deep
```

---

## 五、检查清单模板（复制使用）

```markdown
## 护栏流程执行记录

**变更主题**: _______________  
**执行时间**: _______________  
**执行人**: _______________  

### 阶段一：诊断与方案
- [ ] 步骤 1: 只读诊断完成（输出：_______）
- [ ] 步骤 2: 方案已提出（含回滚方案）
- [ ] 步骤 3: 春哥确认配置字段（消息 ID: _______）

### 阶段二：备份与确认
- [ ] 步骤 4: 备份已创建（路径：_______）
- [ ] 步骤 5: 春哥批准继续（消息 ID: _______）

### 阶段三：执行与验证
- [ ] 步骤 6: 变更已执行
- [ ] 步骤 7: Gateway 已重启
- [ ] 步骤 8: openclaw status --deep 通过
- [ ] 步骤 9: 真实消息验证通过

### 阶段四：文档与归档
- [ ] 步骤 10: 文档记录 + Git commit + push 完成

### 异常记录
（如有异常，记录现象、根因、解决方案）

_______________
```

---

## 六、历史违规记录

| 日期 | 违规项 | 整改措施 |
|------|--------|---------|
| 2026-04-09 | 步骤 3/5/8/9 缺失 | 创建本检查清单，强制固化流程 |

---

**审批签字**: CC（春哥）  
**生效时间**: 2026-04-09 12:45 GMT+8
