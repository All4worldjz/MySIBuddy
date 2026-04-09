# LLM Knowledge Vault - Agent 分工 Schema (v1.0)
# 创建时间：2026-04-08
# 最后更新：2026-04-08

## 角色与职责

### tech-mentor（主导）
- **权限**：schema/ rw, wiki/ r, raw/ r
- **职责**：
  - 定义知识体系结构（WIKI_SCHEMA.md）
  - 配置 Agent 分工（本 AGENTS.md）
  - 审核巡检报告
  - 管理权限申请（docs/权限申请表.md）

### coder-hub（执行编译）
- **权限**：wiki/ rw, raw/ r, schema/ r
- **职责**：
  - 持续监听 raw/ 新增文件
  - 调用 LLM 编译原始文档为知识节点
  - 更新 wiki/ 目录下的实体页/概念页/摘要页
  - 生成 Q&A 问答对（提问后）
  - 运行 weekly 巡检并生成 reports/weekly.md

### work-hub（知识应用）
- **权限**：wiki/ r, raw/ r, docs/ r
- **职责**：
  - 读取 wiki/ 知识生成方案/计划/报告
  - 在飞书文档中引用知识节点（反向链接到 wiki/）
  - 将重要产出沉淀为 docs/ 正式文档

### life-hub（个人知识）
- **权限**：wiki/ r, raw/ r
- **职责**：
  - 处理个人笔记（飞书 docs/raw/ 同步）
  - 生成生活/兴趣相关的 wiki 实体页
  - 定期请求 tech-mentor 更新个人相关 schema

## 灌入流程（Ingestion Pipeline）

1. 用户/工具上传原始文档到 `raw/` 目录（格式：.md, .docx, .pdf）
2. Docker cron 检测到新文件（每 5 分钟扫描）
3. **立即触发**：
   ```
   sessions_spawn({
     agentId: "coder-hub",
     task: "根据 schema/AGENTS.md 规则，将 raw/xxx.md 编译为 wiki 实体页",
     model: "minimax/MiniMax-M2.7"
   })
   ```
4. coder-hub 执行：
   - 读取 `raw/xxx.md` + `schema/WIKI_SCHEMA.md`
   - 生成 `wiki/concepts/xxx.md` 或 `wiki/entities/xxx.md`
   - 更新 `wiki/index.md`（添加反向链接）
5. 完成后记录元数据到 `wiki/.metadata.json`

## 提问流程（Query Flow）

1. 用户提问："关于 Karpathy LLM Wiki 的设计原理"
2. coder-hub 检索 `wiki/` 相关页面（BM25 + 向量混合）
3. 调用 LLM 综合生成回答
4. **若回答质量高** → 生成 `wiki/qa/Q20260408-001.md`
5. 更新 `wiki/index.md` 知识图谱

## 巡检流程（Maintenance）

- **频率**：每周日 22:00 自动执行
- **触发**：cron job → `sessions_spawn({agentId: "coder-hub", task: "执行 weekly 巡检"})`
- **内容**：
  - 检查 wiki/ 链接断裂（broken links）
  - 发现知识矛盾（contradictions）
  - 标记缺失概念（missing entities）
  - 生成 `wiki/reports/weekly_YYYY-MM-DD.md`
- **输出**：tech-mentor 审核后，重要发现生成 `raw/` 修正建议

## 命名规范

### wiki/ 目录命名
- **Concepts**：`wiki/concepts/xxx.md`（通用概念定义）
- **Entities**：`wiki/entities/xxx.md`（人物/公司/技术实体）
- **QA**：`wiki/qa/Q20260408-001.md`（问答对，按日期编号）
- **Reports**：`wiki/reports/weekly_YYYY-MM-DD.md`

### schema/ 命名
- **核心配置**：`AGENTS.md`, `WIKI_SCHEMA.md`
- **流程文档**：`灌入规则.md`, `巡检计划.md`
- **权限相关**：`权限矩阵.md`

## 工具链集成

| 工具 | 用途 | 调用方式 |
|------|------|---------|
| Obsidian | 人类编辑/查看 | 飞书文档编辑器（native） |
| qmd | 本地 Markdown 搜索 | Docker 容器内 CLI |
| Dataview | 动态表格查询 | `memory_search` 工具替代 |
| Marp | PPT 生成 | 从 wiki/ 抽取内容 |

## 安全约束

1. **raw/ 禁止写入**（除上传者）
2. **wiki/ 禁止手动编辑**（必须通过编译流程）
3. **schema/ 仅 tech-mentor 可写**
4. **所有操作必须记录权限申请**（docs/权限申请表.md）

## 崩溃恢复

- **数据丢失**：从飞书 My_KM_Vault 回收站恢复（30天）
- **编译失败**：coder-hub 记录错误日志到 `wiki/reports/errors_YYYY-MM-DD.log`
- **Agent 权限异常**：tech-mentor 审核后修正 `AGENTS.md`
