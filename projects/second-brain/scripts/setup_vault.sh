#!/usr/bin/env bash
#===============================================================================
# setup_vault.sh - 初始化第二大脑 Obsidian Vault
#
# 用途：在 /home/admin/obsidian-vault/ 创建初始 Vault 骨架并初始化 Git
# 依赖：git, bash
# 版本：v0.1.0 (2026-04-09)
#===============================================================================

set -e

VAULT_DIR="/home/admin/obsidian-vault"
GITIGNORE_CONTENT='
# 附件（不跟踪大文件）
_attachments/

# 临时文件
tmp/
*.tmp
*.swp

# Obsidian 工作文件
.trash/

# 大型媒体文件
*.zip
*.tar.gz
*.pdf
*.mp4
'

GITATTRIBUTES_CONTENT='
*.md text eol=lf
'

echo "[INFO] 开始初始化 Obsidian Vault..."

# 1. 创建目录结构
echo "[INFO] 创建目录结构..."
mkdir -p "$VAULT_DIR"/{raw,wiki/00-Inbox,_attachments,.scripts}

# 2. 写入 .gitignore
echo "[INFO] 写入 .gitignore..."
cat > "$VAULT_DIR/.gitignore" << 'EOF'
# 附件（不跟踪大文件）
_attachments/

# 临时文件
tmp/
*.tmp
*.swp

# Obsidian 工作文件
.trash/

# 大型媒体文件
*.zip
*.tar.gz
EOF

# 3. 写入 .gitattributes
echo "[INFO] 写入 .gitattributes..."
cat > "$VAULT_DIR/.gitattributes" << 'EOF'
*.md text eol=lf
EOF

# 4. 写入 README.md
echo "[INFO] 写入 README.md..."
cat > "$VAULT_DIR/wiki/00-Inbox/README.md" << 'EOF'
# 00-Inbox（收件箱）

此目录用于临时存放待处理的内容。

## 使用流程

1. 飞书 Wiki 新文档自动同步到 `raw/` 目录
2. 人工整理后移入对应分类目录
3. 整理完成后删除原始文件

## 分类目录

- `01-AI-Frontier/` - AI 前沿与思想领袖追踪
- `02-Tech-Arch/` - 技术架构与系统设计
- `03-Leadership/` - 团队管理与领导力
- `04-History-Phil/` - 历史与哲学读书笔记
- `05-Venture/` - 创业战略与探索
- `06-Personal/` - 个人思考与决策
EOF

# 5. Git 初始化（检查是否已初始化）
if [ ! -d "$VAULT_DIR/.git" ]; then
    echo "[INFO] 初始化 Git 仓库..."
    cd "$VAULT_DIR"
    git init
    
    echo ""
    echo "[⚠️  重要] 请配置 GitHub 远程仓库："
    echo "   cd $VAULT_DIR"
    echo "   git remote add origin git@github.com:your-username/your-repo.git"
    echo "   git push -u origin main"
    echo ""
else
    echo "[INFO] Git 仓库已存在，跳过初始化..."
fi

# 6. 首次提交（如果工作目录有变更）
cd "$VAULT_DIR"
if [ -n "$(git status --porcelain)" ]; then
    echo "[INFO] 提交初始骨架..."
    git add .
    git commit -m "chore: init obsidian vault scaffold (second-brain project)
    
- 目录结构：raw/, wiki/00-Inbox/, _attachments/, .scripts/
- .gitignore：排除附件和临时文件
- .gitattributes：MD 文件统一 LF 行尾"
    echo "[✅ 完成] 初始骨架已提交"
else
    echo "[INFO] 无需提交（工作区干净）"
fi

echo ""
echo "[✅ Vault 初始化完成]"
echo "   Vault 路径：$VAULT_DIR"
echo "   下一步：请配置 GitHub 远程仓库并 push"
