#!/usr/bin/env python3
"""
feishu_oauth_setup.py - 飞书 OAuth 授权辅助脚本
用途：获取 CC 用户的 user_access_token，用于访问飞书网盘
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

OPENCLAW_CONFIG = "/home/admin/.openclaw/openclaw.json"
RUNTIME_SECRETS = "/home/admin/.openclaw/runtime-secrets.json"
TOKEN_FILE = "/home/admin/.openclaw/credentials/feishu_user_token.json"


def load_config():
    with open(OPENCLAW_CONFIG, "r", encoding="utf-8") as f:
        config = json.load(f)
    with open(RUNTIME_SECRETS, "r", encoding="utf-8") as f:
        secrets = json.load(f)
    
    app_id = config.get("channels", {}).get("feishu", {}).get("accounts", {}).get("work", {}).get("appId", "")
    app_secret = secrets.get("FEISHU_APP_SECRET", "")
    return app_id, app_secret


def get_app_access_token(app_id: str, app_secret: str) -> str:
    """获取 app_access_token（应用身份）"""
    data = json.dumps({
        "app_id": app_id,
        "app_secret": app_secret
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result.get("app_access_token", "")


def get_authorization_url(app_id: str, redirect_uri: str) -> str:
    """生成授权 URL"""
    scopes = "openid contact:user.email:readonly contact:user.name:readonly drive:drive:readonly"
    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "state": "feishu_wiki_sync"
    }
    
    url = "https://passport.feishu.cn/suite/passport/oauth/authorize?" + urllib.parse.urlencode(params)
    return url


def exchange_code_for_token(app_access_token: str, code: str) -> dict:
    """用 authorization_code 换取 user_access_token"""
    data = json.dumps({
        "grant_type": "authorization_code",
        "code": code
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {app_access_token}"
        },
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result.get("data", {})


def refresh_user_token(app_access_token: str, refresh_token: str) -> dict:
    """刷新 user_access_token"""
    data = json.dumps({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {app_access_token}"
        },
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result.get("data", {})


def save_token(token_data: dict):
    """保存 token 到文件"""
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(token_data, f, ensure_ascii=False, indent=2)
    print(f"✅ Token 已保存到: {TOKEN_FILE}")


def load_token() -> dict:
    """加载保存的 token"""
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def main():
    if len(sys.argv) < 2:
        print("""
飞书 OAuth 授权辅助工具

用法:
  python3 feishu_oauth_setup.py generate     # 生成授权 URL
  python3 feishu_oauth_setup.py exchange <code>  # 用 code 换取 token
  python3 feishu_oauth_setup.py refresh      # 刷新现有 token
  python3 feishu_oauth_setup.py status       # 查看当前 token 状态
  python3 feishu_oauth_setup.py test         # 测试 token 是否有效
        """)
        sys.exit(0)
    
    command = sys.argv[1]
    app_id, app_secret = load_config()
    
    if command == "generate":
        redirect_uri = "https://open.feishu.cn/tool/redirect"  # 或使用你自己的 redirect URI
        url = get_authorization_url(app_id, redirect_uri)
        print("=" * 60)
        print("飞书 OAuth 授权 URL")
        print("=" * 60)
        print(f"\n请在浏览器中访问以下 URL，然后用 CC 账号授权登录：\n")
        print(url)
        print(f"\n授权完成后，浏览器会跳转到 redirect URI，URL 中会包含 code 参数。")
        print(f"复制 code 值，然后执行：")
        print(f"  python3 feishu_oauth_setup.py exchange <code>")
        print()
        
    elif command == "exchange":
        if len(sys.argv) < 3:
            print("用法: python3 feishu_oauth_setup.py exchange <code>")
            sys.exit(1)
        
        code = sys.argv[2]
        app_access_token = get_app_access_token(app_id, app_secret)
        
        if not app_access_token:
            print("❌ 获取 app_access_token 失败")
            sys.exit(1)
        
        print("正在换取 user_access_token...")
        token_data = exchange_code_for_token(app_access_token, code)
        
        if "access_token" in token_data:
            token_data["app_id"] = app_id
            token_data["created_at"] = int(__import__("time").time())
            save_token(token_data)
            print(f"\n✅ 授权成功！")
            print(f"用户 OpenID: {token_data.get('openid', 'N/A')}")
            print(f"Token 有效期: {token_data.get('expires_in', 'N/A')} 秒")
        else:
            print(f"❌ 授权失败: {token_data}")
            
    elif command == "refresh":
        token_data = load_token()
        refresh_token = token_data.get("refresh_token", "")
        
        if not refresh_token:
            print("❌ 没有找到 refresh_token，请重新授权")
            sys.exit(1)
        
        app_access_token = get_app_access_token(app_id, app_secret)
        print("正在刷新 user_access_token...")
        
        try:
            new_token_data = refresh_user_token(app_access_token, refresh_token)
            
            if "access_token" in new_token_data:
                new_token_data["app_id"] = app_id
                new_token_data["created_at"] = int(__import__("time").time())
                save_token(new_token_data)
                print(f"\n✅ Token 刷新成功！")
                print(f"新 Token 有效期: {new_token_data.get('expires_in', 'N/A')} 秒")
            else:
                print(f"❌ 刷新失败: {new_token_data}")
                print("可能需要重新授权")
        except Exception as e:
            print(f"❌ 刷新失败: {e}")
            print("可能需要重新授权")
            
    elif command == "status":
        token_data = load_token()
        
        if not token_data:
            print("❌ 没有保存的 token")
            print("请执行: python3 feishu_oauth_setup.py generate")
            sys.exit(1)
        
        import time
        created_at = token_data.get("created_at", 0)
        expires_in = token_data.get("expires_in", 7200)
        age = time.time() - created_at
        
        print("=" * 60)
        print("当前 Token 状态")
        print("=" * 60)
        print(f"OpenID: {token_data.get('openid', 'N/A')}")
        print(f"创建时间: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(created_at))}")
        print(f"已使用: {int(age / 60)} 分钟")
        print(f"有效期: {expires_in} 秒 ({expires_in / 3600:.1f} 小时)")
        
        if age < expires_in:
            print(f"状态: ✅ 有效（剩余 {int((expires_in - age) / 60)} 分钟）")
        else:
            print(f"状态: ❌ 已过期")
            print("请执行: python3 feishu_oauth_setup.py refresh")
            
    elif command == "test":
        token_data = load_token()
        user_token = token_data.get("access_token", "")
        
        if not user_token:
            print("❌ 没有可用的 user_access_token")
            sys.exit(1)
        
        # 测试访问网盘
        req = urllib.request.Request(
            "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=QB50fa4HYlYPCRd5Q8Cck6MMnvf&page_size=5",
            headers={"Authorization": f"Bearer {user_token}"},
            method="GET"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                code = result.get("code", -1)
                
                if code == 0:
                    files = result.get("data", {}).get("files", [])
                    print(f"✅ Token 有效！")
                    print(f"找到 {len(files)} 个文件/文件夹：")
                    for f in files[:5]:
                        print(f"  - {f.get('name', 'N/A')} ({f.get('type', 'N/A')})")
                else:
                    msg = result.get("msg", "未知错误")
                    print(f"❌ Token 无效: {msg}")
        except Exception as e:
            print(f"❌ 请求失败: {e}")
    
    else:
        print(f"未知命令: {command}")
        print("可用命令: generate, exchange, refresh, status, test")


if __name__ == "__main__":
    main()
