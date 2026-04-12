#!/usr/bin/env python3
"""Update Feishu accounts for all agents."""

import json

# 新的飞书应用配置
NEW_APPS = {
    "link": {
        "appId": "cli_a93ba1f60ff85bb4",
        "appSecret": "MiVZ4oSc4huK66V41ruvWUIyGELhZaOv"
    },
    "morpheus": {
        "appId": "cli_a951f94174f95bda",
        "appSecret": "k1peVdTWYnirzQtM0ez5dg1gfz7jOdKZ"
    },
    "oracle": {
        "appId": "cli_a951fa0a74785bef",
        "appSecret": "1qO0Ryogd4HBftILzJKXkdt0XiDUX1SZ"
    },
    "architect": {
        "appId": "cli_a951faaa34b85bb3",
        "appSecret": "hfG6rcL8ehK7SNbsIqWIqg6yMnkGr"
    }
}

# Neo 复用 sysop 账号
REUSE_SYSOP_FOR_NEO = True

# 允许的用户列表
ALLOW_FROM = [
    "ou_04405f4e9dbe76c2cf241402bc2096b7",
    "ou_44a2421fec9c56a09860de54d2c4eac6",
    "ou_6a5dc9e99d447aa5a75d1f7a13ae0365"
]

def main():
    # 1. 更新 runtime-secrets.json
    secrets_path = "/home/admin/.openclaw/runtime-secrets.json"
    with open(secrets_path) as f:
        secrets = json.load(f)
    
    # 添加新密钥
    for name, config in NEW_APPS.items():
        secret_key = f"FEISHU_APP_SECRET_{name.upper()}"
        secrets[secret_key] = config["appSecret"]
        secrets[f"/{secret_key}"] = config["appSecret"]
    
    # Neo 复用 sysop
    if REUSE_SYSOP_FOR_NEO:
        secrets["FEISHU_APP_SECRET_NEO"] = secrets["FEISHU_APP_SECRET_SYSOP"]
        secrets["/FEISHU_APP_SECRET_NEO"] = secrets["/FEISHU_APP_SECRET_SYSOP"]
    
    with open(secrets_path, "w") as f:
        json.dump(secrets, f, indent=2)
    
    print("runtime-secrets.json 已更新")
    print(f"新增密钥: {list(NEW_APPS.keys())}")
    
    # 2. 更新 openclaw.json
    config_path = "/home/admin/.openclaw/openclaw.json"
    with open(config_path) as f:
        config = json.load(f)
    
    feishu_accounts = config["channels"]["feishu"]["accounts"]
    
    # 添加 neo 账号 (复用 sysop appId)
    if REUSE_SYSOP_FOR_NEO and "neo" not in feishu_accounts:
        sysop = feishu_accounts.get("sysop", {})
        feishu_accounts["neo"] = {
            "enabled": True,
            "name": "Feishu Neo",
            "appId": sysop.get("appId", "cli_a95206bcacb85cb1"),
            "appSecret": {
                "source": "file",
                "provider": "runtime",
                "id": "/FEISHU_APP_SECRET_NEO"
            },
            "dmPolicy": "pairing",
            "groupPolicy": "allowlist",
            "allowFrom": sysop.get("allowFrom", ALLOW_FROM),
            "groups": {}
        }
    
    # 添加新账号
    for name, app_config in NEW_APPS.items():
        if name not in feishu_accounts:
            feishu_accounts[name] = {
                "enabled": True,
                "name": f"Feishu {name.capitalize()}",
                "appId": app_config["appId"],
                "appSecret": {
                    "source": "file",
                    "provider": "runtime",
                    "id": f"/FEISHU_APP_SECRET_{name.upper()}"
                },
                "dmPolicy": "pairing",
                "groupPolicy": "allowlist",
                "allowFrom": ALLOW_FROM,
                "groups": {}
            }
    
    # 3. 更新 bindings - 移除无效的 link→feishu:link 路由
    bindings = config.get("bindings", [])
    bindings = [b for b in bindings if not (
        b.get("agentId") == "link" and 
        b.get("match", {}).get("channel") == "feishu" and
        b.get("match", {}).get("accountId") == "link" and
        not b.get("match", {}).get("peer")
    )]
    
    # 4. 添加新的直接对话路由
    new_bindings = []
    for agent in ["neo", "link", "morpheus", "oracle", "architect"]:
        exists = any(
            b.get("agentId") == agent and 
            b.get("match", {}).get("channel") == "feishu" and 
            b.get("match", {}).get("accountId") == agent and 
            not b.get("match", {}).get("peer")
            for b in bindings
        )
        if not exists:
            new_bindings.append({
                "type": "route",
                "agentId": agent,
                "match": {
                    "channel": "feishu",
                    "accountId": agent
                }
            })
    
    bindings.extend(new_bindings)
    config["bindings"] = bindings
    
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    
    print("openclaw.json 已更新")
    print(f"新增 Feishu 账号: {list(NEW_APPS.keys()) + ['neo']}")
    print(f"新增 bindings 路由: {[b['agentId'] for b in new_bindings]}")

if __name__ == "__main__":
    main()