# 飞书操作脚本集（feishu-ops）

## 概述

春哥 AI 助手系统中的飞书平台操作工具集，用于文件夹管理、文档同步、日历集成等飞书生态操作。

## 安全说明

⚠️ **本项目包含敏感凭据配置，严禁将真实凭据 commit 到 Git。**

- 凭据存储位置：`~/.openclaw/`（运行时目录，不在 Git 管理下）
- 详细说明：参见 `CREDENTIALS_TEMPLATE/README.md`
- 所有脚本假设凭据已在 `~/.openclaw/` 中正确配置

## 目录结构

```
feishu-ops/
├── .gitignore                    # 敏感文件排除规则
├── README.md                     # 本文件
├── CREDENTIALS_TEMPLATE/         # 凭据配置模板
│   └── README.md                 # 凭据配置说明
└── scripts/
    ├── feishu_create_folder.sh   # 创建飞书文件夹
    ├── feishu_delete_folder.sh   # 删除飞书文件夹（含安全策略）
    ├── feishu_move_folder.sh      # 移动飞书文件夹
    ├── feishu_import_to_raw.sh   # 导入飞书文档到知识库
    ├── feishu_knowledge_vault_sync.sh  # 知识库同步备份
    ├── feishu_to_wiki_sync.py    # 飞书文档导出到 Wiki
    ├── feishu_oauth_setup.py      # OAuth 授权设置
    ├── wiki_to_feishu_sync.sh     # Wiki 同步到飞书
    ├── lib/
    │   └── feishu_drive_guardrails.sh  # 安全护栏规则
    ├── safe_openclaw_*.sh         # OpenClaw 安全操作脚本
    └── search_service.js          # 搜索服务
```

## 核心脚本说明

### 文件夹管理

| 脚本 | 用途 | 关键参数 |
|------|------|---------|
| `feishu_create_folder.sh` | 创建子文件夹 | 文件夹名 + 父文件夹 token |
| `feishu_delete_folder.sh` | 删除文件夹 | `--token` + `--dry-run` 先预览 |
| `feishu_move_folder.sh` | 移动文件夹 | `--token` + `--dest` 目标文件夹 |

### 同步工具

| 脚本 | 用途 |
|------|------|
| `feishu_to_wiki_sync.py` | 飞书文档导出到 Wiki raw/ 目录 |
| `wiki_to_feishu_sync.sh` | Wiki 文档同步到飞书 |
| `feishu_knowledge_vault_sync.sh` | 知识库定时同步备份 |

### 安全护栏

| 脚本 | 用途 |
|------|------|
| `feishu_drive_guardrails.sh` | 定义受保护文件夹，禁止删除/移动 |
| `safe_openclaw_*.sh` | OpenClaw 配置变更的安全操作脚本 |

## 受保护文件夹（不可删除）

| 名称 | Token |
|------|-------|
| CC文件柜 | `RfSrf8oMYlMyQTdbW0ZcGSE1nNb` |
| 小春文件柜 | `Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd` |
| 回收站 | `XcTHfLy7clpx51dBomLcvA7XnTf` |
| 📁测试归档 | `TZa9f0KaQldDPXdDnX6cF3K7nme` |

## 使用前提

1. 飞书应用已开通相关权限（云空间、日历、文档等）
2. 用户已完成 OAuth 授权（运行 `feishu_oauth_setup.py`）
3. 飞书应用凭据配置在 `~/.openclaw/` 目录

## 工程铁律合规性

本项目遵循工程铁律：
- ✅ **可复制**：所有操作均有脚本，手动步骤最小化
- ✅ **可追溯**：Git 版本控制，变更历史完整
- ✅ **可迭代**：含 SPEC、README、护栏注释，支持后续改进
