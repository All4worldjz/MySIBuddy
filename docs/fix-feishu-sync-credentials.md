# 修复飞书同步脚本凭证读取

在服务器上执行以下命令：

```bash
# 修复 feishu_to_wiki_sync.sh
sed -i 's|FEISHU_APP_ID=$(jq -r .lark.work.appId.*|FEISHU_APP_ID=$(jq -r ".channels.feishu.accounts.work.appId" /home/admin/.openclaw/openclaw.json 2>/dev/null || echo "")|' /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh

sed -i 's|FEISHU_APP_SECRET=$(jq -r .lark.work.appSecret.*|FEISHU_APP_SECRET=$(jq -r ".FEISHU_APP_SECRET" /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")|' /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh

# 修复 wiki_to_feishu_sync.sh
sed -i 's|FEISHU_APP_ID=$(jq -r .lark.work.appId.*|FEISHU_APP_ID=$(jq -r ".channels.feishu.accounts.work.appId" /home/admin/.openclaw/openclaw.json 2>/dev/null || echo "")|' /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh

sed -i 's|FEISHU_APP_SECRET=$(jq -r .lark.work.appSecret.*|FEISHU_APP_SECRET=$(jq -r ".FEISHU_APP_SECRET" /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")|' /home/admin/.openclaw/scripts/wiki_to_feishu_sync.sh

# 验证
grep "FEISHU_APP_ID=" /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh | head -1
grep "FEISHU_APP_SECRET=" /home/admin/.openclaw/scripts/feishu_to_wiki_sync.sh | head -1
```
