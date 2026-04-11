#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
飞书用户 OAuth 授权辅助脚本

用途: 获取 CC 用户的 refresh_token，用于 CalDAV 同步脚本

使用方法:
  方式 1 (推荐): 在飞书中向 work-hub 发送 "/oauth" 触发授权流程
  方式 2: 手动完成授权 (见下方说明)

注意: 由于服务器无公网 IP，需要通过以下方式之一完成授权:
  1. 使用 ngrok/frp 等工具将本地服务暴露到公网
  2. 在本地电脑完成授权，然后把 token 复制到服务器
"""

import json
import os
import sys
import requests
from datetime import datetime

# 配置
FEISHU_APP_ID = "cli_a93c20939cf8dbef"
FEISHU_USER_OPEN_ID = "ou_04405f4e9dbe76c2cf241402bc2096b7"
SECRETS_FILE = "/home/admin/.openclaw/runtime-secrets.json"
REFRESH_TOKEN_FILE = "/home/admin/.openclaw/data/feishu_user_refresh_token.json"

def load_app_secret():
    """加载应用密钥"""
    try:
        with open(SECRETS_FILE) as f:
            secrets = json.load(f)
        return secrets.get("/FEISHU_APP_SECRET", "")
    except Exception as e:
        print(f"❌ 读取 runtime-secrets.json 失败: {e}")
        return ""

def save_refresh_token(refresh_token):
    """保存 refresh_token"""
    os.makedirs(os.path.dirname(REFRESH_TOKEN_FILE), exist_ok=True)
    data = {
        "refresh_token": refresh_token,
        "open_id": FEISHU_USER_OPEN_ID,
        "updated_at": datetime.now().isoformat()
    }
    with open(REFRESH_TOKEN_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ refresh_token 已保存到: {REFRESH_TOKEN_FILE}")

def exchange_code_for_token(code):
    """用授权码换取 access_token 和 refresh_token"""
    app_secret = load_app_secret()
    if not app_secret:
        print("❌ 应用密钥未配置")
        return
    
    resp = requests.post(
        "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
        headers={"Content-Type": "application/json"},
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": FEISHU_APP_ID,
            "client_secret": app_secret
        }
    )
    data = resp.json()
    
    if data.get("code") != 0:
        print(f"❌ 获取 token 失败: {data}")
        return
    
    token_data = data.get("data", {})
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 0)
    
    print(f"\n✅ 授权成功!")
    print(f"👤 用户 open_id: {token_data.get('open_id', '')}")
    print(f"🔑 access_token: {access_token[:20]}... (有效期 {expires_in} 秒)")
    print(f"🔄 refresh_token: {refresh_token[:20]}...")
    
    # 保存 refresh_token
    save_refresh_token(refresh_token)
    
    # 测试 refresh_token
    print("\n=== 测试 refresh_token ===")
    test_refresh_token(refresh_token, app_secret)

def test_refresh_token(refresh_token, app_secret):
    """测试 refresh_token 是否有效"""
    resp = requests.post(
        "https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token",
        headers={"Content-Type": "application/json"},
        json={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": FEISHU_APP_ID,
            "client_secret": app_secret
        }
    )
    data = resp.json()
    
    if data.get("code") == 0:
        print("✅ refresh_token 测试成功")
        token_data = data.get("data", {})
        print(f"👤 用户 open_id: {token_data.get('open_id', '')}")
    else:
        print(f"❌ refresh_token 测试失败: {data}")

def main():
    print("=" * 60)
    print("飞书用户 OAuth 授权辅助工具")
    print("=" * 60)
    print()
    print("请选择授权方式:")
    print("1. 粘贴授权码 (code)")
    print("2. 检查现有 refresh_token")
    print("3. 查看授权指引")
    print()
    
    choice = input("请输入选项 (1/2/3): ").strip()
    
    if choice == "1":
        code = input("请粘贴授权码 (code): ").strip()
        if not code:
            print("❌ 授权码不能为空")
            return
        exchange_code_for_token(code)
    
    elif choice == "2":
        if os.path.exists(REFRESH_TOKEN_FILE):
            with open(REFRESH_TOKEN_FILE) as f:
                data = json.load(f)
            print(f"\n✅ 找到现有 refresh_token:")
            print(f"👤 open_id: {data.get('open_id', '')}")
            print(f"🔄 refresh_token: {data.get('refresh_token', '')[:20]}...")
            print(f"📅 更新时间: {data.get('updated_at', '')}")
            
            # 测试是否有效
            print("\n=== 测试 refresh_token ===")
            app_secret = load_app_secret()
            test_refresh_token(data.get("refresh_token", ""), app_secret)
        else:
            print("❌ 未找到 refresh_token，请先完成授权")
    
    elif choice == "3":
        print("\n" + "=" * 60)
        print("授权指引")
        print("=" * 60)
        print()
        print("方式 1 (推荐): 通过 OpenClaw 内置 OAuth 工具")
        print("-" * 60)
        print("1. 打开飞书，找到 work-hub (金牛)")
        print("2. 发送消息: /oauth")
        print("3. 点击授权卡片完成授权")
        print("4. 授权完成后，refresh_token 会自动保存")
        print()
        print("方式 2: 手动授权 (需要本地 Web 服务器)")
        print("-" * 60)
        print("1. 在浏览器中打开:")
        print(f"   https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={FEISHU_APP_ID}&redirect_uri=http://localhost:8080/callback&state=caldav_sync")
        print("2. 用 CC 用户身份登录并授权")
        print("3. 复制授权回调 URL 中的 code 参数")
        print("4. 运行此脚本，选择选项 1，粘贴 code")
        print()
        print("=" * 60)
    
    else:
        print("❌ 无效选项")

if __name__ == "__main__":
    main()
