# 飞书认证标准方法

> **创建日期**: 2026-04-10  
> **适用范围**: 所有需要飞书 API 认证的脚本和任务  
> **参考实现**: `caldav_sync_full.py`

---

## 🔑 认证方法

### 标准配置

```python
# App ID: 硬编码
FEISHU_APP_ID = "cli_a93c20939cf8dbef"

# App Secret: 从 runtime-secrets.json 读取
FEISHU_APP_SECRET = secrets.get("FEISHU_APP_SECRET", "")
# 或从 jq 读取:
# jq -r '."/FEISHU_APP_SECRET" // empty' /home/admin/.openclaw/runtime-secrets.json
```

### Bash 脚本模板

```bash
#!/usr/bin/env bash
FEISHU_APP_ID="cli_a93c20939cf8dbef"
FEISHU_APP_SECRET=$(jq -r '."/FEISHU_APP_SECRET" // empty' /home/admin/.openclaw/runtime-secrets.json 2>/dev/null || echo "")

get_tenant_token() {
    curl -s -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
        -H "Content-Type: application/json" \
        -d "{\"app_id\": \"$FEISHU_APP_ID\", \"app_secret\": \"$FEISHU_APP_SECRET\"}" | \
        jq -r '.tenant_access_token'
}
```

### Python 脚本模板

```python
import json, urllib.request

def load_feishu_secret():
    """从 runtime-secrets.json 读取飞书应用密钥"""
    secrets_file = "/home/admin/.openclaw/runtime-secrets.json"
    with open(secrets_file) as f:
        secrets = json.load(f)
    return secrets.get("FEISHU_APP_SECRET", "")

FEISHU_APP_ID = "cli_a93c20939cf8dbef"
FEISHU_APP_SECRET = load_feishu_secret()

def get_tenant_token():
    data = json.dumps({"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET}).encode("utf-8")
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read()).get("tenant_access_token", "")
```

---

## 📁 文件夹权限

### 可用的文件夹 Token

| 名称 | Token | 说明 |
|------|-------|------|
| **My_KM_Vault** | `QB50fa4HYlYPCRd5Q8Cck6MMnvf` | ✅ 主知识库（CC 创建，已授权） |
| 小春文件柜 | `Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd` | ✅ 共享工作目录 |
| CC文件柜 | `RfSrf8oMYlMyQTdbW0ZcGSE1nNb` | ⚠️ 受保护（禁止删除/移动） |
| 回收站 | `XcTHfLy7clpx51dBomLcvA7XnTf` | ⚠️ 只读 |
| 📁测试归档 | `TZa9f0KaQldDPXdDnX6cF3K7nme` | 📝 测试文件夹 |

### 使用建议

1. **知识库同步**: 使用 **My_KM_Vault** (`QB50fa4HYlYPCRd5Q8Cck6MMnvf`)
2. **工作共享**: 使用 **小春文件柜** (`Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd`)
3. **API 端点**: `GET /open-apis/drive/v1/files?folder_token={token}`
4. **响应字段**: `data.files` 数组，文件名为 `name` 字段

---

## ✅ 已修复的脚本

| 脚本 | 修复内容 | 状态 |
|------|----------|------|
| `feishu_to_wiki_sync.py` | 认证方法 + KM_VAULT_TOKEN | ✅ |
| `wiki_to_feishu_sync.sh` | 认证方法 + KM_VAULT_TOKEN | ✅ |
| `caldav_sync.sh` | 认证方法 + 文件夹 Token | ✅ |

---

## 🚫 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `app secret invalid` | AppSecret 值不正确 | 从 runtime-secrets.json 读取 `FEISHU_APP_SECRET` |
| `1061004 forbidden` | 文件夹无权限 | 使用小春文件柜 Token |
| `无法获取 tenant token` | jq 路径错误 | 使用 `."/FEISHU_APP_SECRET"` 或 `FEISHU_APP_SECRET` |

---

**文档版本**: v1.0  
**最后更新**: 2026-04-10  
**维护者**: tech-mentor (大师)
