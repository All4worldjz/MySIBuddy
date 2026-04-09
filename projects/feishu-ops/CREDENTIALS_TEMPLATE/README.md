# 凭据配置说明

本目录为凭据模板参考，实际配置请参考 `~/.openclaw/` 中的运行时凭据。

## 必需凭据

使用前请在 `~/.openclaw/` 目录下配置以下凭据文件（或通过环境变量）：

### 1. 飞书应用凭据（feishu_app_credentials.json）

```json
{
  "app_id": "cli_xxxxxxxx",
  "app_secret": "xxxxxxxxxxxxxxxx",
  "app_token": "xxxxxxxxxxxxxxxx"
}
```

### 2. 受保护文件夹配置

编辑 `scripts/lib/feishu_drive_guardrails.sh`，确认以下受保护文件夹的 Token：

```
PROTECTED_FOLDER_IDS=(
  "RfSrf8oMYlMyQTdbW0ZcGSE1nNb"  # CC文件柜
  "Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd"  # 小春文件柜
  "TZa9f0KaQldDPXdDnX6cF3K7nme"  # 测试归档
  "XcTHfLy7clpx51dBomLcvA7XnTf"  # 回收站
)
```

### 3. OAuth 用户凭据（feishu_user_credentials.json）

用于以用户身份访问飞书 API：

```json
{
  "user_access_token": "待补充",
  "refresh_token": "待补充",
  "expires_at": "待补充"
}
```

> 获取方式：运行 `scripts/feishu_oauth_setup.py`，按提示完成飞书 OAuth 授权。

## 安全规则

- ❌ 禁止将任何凭据文件 commit 到 Git
- ✅ 所有凭据必须在 `~/.openclaw/` 运行时目录中管理
- ✅ 生产环境使用环境变量或密钥管理服务
