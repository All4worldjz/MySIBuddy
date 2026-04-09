# SkillHub：解决团队 Skill 共享痛点

> 🔗 原文：[AI 产品阿颖 - 微信文章](https://mp.weixin.qq.com/s/L5aVbOEi2v9-66tbD465lg)
> ⏰ 剪存时间：2026-04-09
> 📚 分类：AI 工具 / Agent 实践

---

## 核心观点

**Skill 才是组织沉淀经验的正确方式。**

- 文档/Wiki 写完躺在那没人看；Skill 让 Agent 直接调用
- 团队差距体现在 Skill 库的厚度上
- 隐性知识 → 可执行的 Agent 能力

---

## SkillHub 是什么

**开源项目**：https://github.com/iflytek/skillhub

**定位**：私有化部署的 ClawdHub，解决团队内部 Skill 共享难题

**安装命令**：
```bash
curl -fsSL https://raw.githubusercontent.com/iflytek/skillhub/main/scripts/runtime.sh | sh -s -- up
```

---

## 解决了什么问题

| 痛点 | 解决方案 |
|------|---------|
| Skill 怎么共享 | 统一平台管理，分发安装 |
| 版本混乱 | 统一版本，更新即更新 |
| 不知道谁有什么 | 平台搜索，追溯作者/版本 |
| 权限隔离 | 命名空间 + 成员管理 |
| 安全顾虑 | 自动扫描 + 人工审核 |

---

## 核心功能

1. **统一管理**：所有 Skill 在平台上有名字、作者、版本
2. **权限隔离**：命名空间按部门划分，研发/运营互不干扰
3. **审核机制**：上传后管理员审核，系统先自动扫描风险点
4. **一键安装**：把安装提示词发给 AI，自动完成安装
5. **版本更新**：通知 AI 更新到最新版本即可

---

## 安装流程

1. 部署 SkillHub（3 分钟搞定）
2. 管理员创建 Token
3. 把 Token 发给 AI，AI 自动登录安装 Skill
4. 使用时直接让 AI 调用

---

## 团队 AI Native 实践

> **把经验变成 Skill，把流程变成 Skill，把判断标准变成 Skill。**

- 培训内容 → 录下来 → AI 整理成 Skill
- 所有 Skill 统一放到 SkillHub 管理
- 团队间差距 = Skill 库厚度差距

---

## 参考链接

- GitHub：https://github.com/iflytek/skillhub
- 视频演示：点击观看上传/审核流程

---

**归档时间**：2026-04-09  
**归档人**：CC  
**关联研究**：memory/2026-04-09-brain-dump-skill-research.md
