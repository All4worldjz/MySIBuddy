# Brain Dump → Skill 技术研究（2026-04-09）

## 背景

春哥提出核心需求：**把人类的隐性知识、经验、思维模式"转储"成 Agent 可执行的 Skill**。

灵感来源：SkillHub 开源项目（iflytek/skillhub）——企业级自托管 Agent 技能注册中心。

---

## 核心洞察

> "Skill 不是让人去读的，是让 Agent 去跑的。它把脑子里的隐性知识，变成了可执行的能力。"

**团队差距 = Skill 库厚度**

---

## 技术分析结果

### SkillHub 源码审计（coder-hub 完成）

**安全结论**：未发现后门或数据外传行为。4 个安全配置风险点（生产部署前需修复）。

**架构**：
- 后端：Java 21 + Spring Boot 3.x，Maven 多模块单体
- 前端：React 19 + TypeScript + Vite
- 存储：PostgreSQL 16 + Redis 7 + LocalFile/S3
- 技能包格式：SKILL.md（YAML frontmatter + Markdown 正文）

### "Dumping" 功能分析（tech-mentor 完成）

**结论**：SkillHub **不存在** "dumping skill" 功能。

- 只有受控的下载机制（只读 zip 包）
- 无反序列化或代码转储能力
- 核心流程：发布 → 审核 → 分发（download）

---

## Brain Dump 技术路径

### 核心挑战

| 层面 | 问题 | SkillHub 现状 |
|------|------|-------------|
| 知识捕获 | 如何提取脑子里的判断标准、经验流程？ | ❌ 无支持，靠手工写 SKILL.md |
| 结构化 | 隐性知识 → 可执行指令转化 | ❌ 仅支持 Markdown 静态文本 |
| 验证 | 怎么知道转储的 Skill 是否忠实于原意？ | ❌ 只有安全扫描，无语义校验 |
| 迭代 | Skill 随经验进化如何版本管理？ | ✅ 有语义化版本控制 |

### 三种实现路径

#### 路径 1：对话式提取（最轻量）
```
春哥口述经验 → 录音 → ASR → LLM 结构化 → SKILL.md → 人工审核 → 发布
```

#### 路径 2：行为克隆（中等复杂度）
```
春哥操作过程（屏幕录制 + 命令行历史）→ 行为序列分析 → 自动化脚本 → Skill
```

#### 路径 3：交互式精炼（最推荐）
```
初始 Skill 草稿 → Agent 执行 → 春哥反馈"这里不对" → 自动修正 → 多轮迭代 → 最终 Skill
```

---

## SkillHub 可扩展切入点

1. **`skillhub-domain`** — 扩展 `Skill` 实体，增加 `training_transcript` 字段
2. **`skillhub-scanner`** — 增加"语义完整性检查"（检查 Skill 是否有模糊指令）
3. **新增 `skillhub-lab` 模块** — Skill 沙盒执行 + 人工反馈闭环

---

## 下一步计划

**Phase 1（本周）**：选具体场景（如"嘉宾介绍写作"），手动写 SKILL.md，验证流程。

**Phase 2（下周）**：设计"对话式提取"原型——口述经验 → LLM 转 SKILL.md 草稿 → 审核修改。

**Phase 3（迭代）**：设计"交互式精炼"工作流，支持 Skill 自我进化。

---

## 待决策

- [ ] 选择首个 Brain Dump 实验场景
- [ ] 确定技术路径（对话式/行为克隆/交互式）
- [ ] 是否自建 SkillHub 实例 or 直接使用 SkillHub + ClawHub

---

## 参考资料

- SkillHub GitHub: https://github.com/iflytek/skillhub
- 原文：阿颖 AI 产品阿颖《这个神级开源项目，解决了 Skill 的最大痛点》
- 安全审计报告：coder-hub subagent (2026-04-09)
- 技术架构分析：tech-mentor subagent (2026-04-09)

---

**Version**: 1.0  
**Created**: 2026-04-09  
**Status**: 待继续
