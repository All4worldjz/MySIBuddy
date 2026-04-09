#!/usr/bin/env python3
"""
feishu_to_wiki_sync.py - 从飞书 KM-Vault 导出文档到 Wiki raw/ 目录
用途：定时将飞书网盘中的新文档导出到 Wiki 原始资料层
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# ===== 配置 =====
KM_VAULT_TOKEN = "QB50fa4HYlYPCRd5Q8Cck6MMnvf"
WIKI_RAW_DIR = "/home/admin/.openclaw/wiki/main/raw/articles"
SYNC_LOG = "/home/admin/.openclaw/logs/feishu-to-wiki-sync.log"
LAST_SYNC_FILE = "/home/admin/.openclaw/wiki/main/.feishu-last-sync"
OPENCLAW_CONFIG = "/home/admin/.openclaw/openclaw.json"
RUNTIME_SECRETS = "/home/admin/.openclaw/runtime-secrets.json"


def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    os.makedirs(os.path.dirname(SYNC_LOG), exist_ok=True)
    with open(SYNC_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run_cmd(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        log(f"命令失败: {' '.join(cmd)}")
        log(f"stderr: {result.stderr}")
    return result.stdout.strip()


def load_config():
    with open(OPENCLAW_CONFIG, "r", encoding="utf-8") as f:
        config = json.load(f)
    with open(RUNTIME_SECRETS, "r", encoding="utf-8") as f:
        secrets = json.load(f)
    
    app_id = config.get("channels", {}).get("feishu", {}).get("accounts", {}).get("work", {}).get("appId", "")
    app_secret = secrets.get("FEISHU_APP_SECRET", "")
    return app_id, app_secret


def get_tenant_token(app_id: str, app_secret: str) -> str:
    import urllib.request
    import urllib.error
    
    data = json.dumps({"app_id": app_id, "app_secret": app_secret}).encode("utf-8")
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result.get("tenant_access_token", "")
    except Exception as e:
        log(f"获取 tenant token 失败: {e}")
        return ""


def get_folder_files(folder_token: str, tenant_token: str) -> list[dict]:
    import urllib.request
    
    url = f"https://open.feishu.cn/open-apis/drive/v1/files?folder_token={folder_token}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {tenant_token}"},
        method="GET"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result.get("data", {}).get("files", [])
    except Exception as e:
        log(f"获取文件列表失败: {e}")
        return []


def download_doc_as_markdown(doc_token: str, tenant_token: str) -> str:
    import urllib.request
    
    url = f"https://open.feishu.cn/open-apis/docx/v1/documents/{doc_token}/raw_content"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {tenant_token}", "Content-Type": "application/json"},
        method="GET"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result.get("data", {}).get("content", "")
    except Exception as e:
        log(f"下载文档失败: {e}")
        return ""


def main():
    log("=" * 60)
    log("开始飞书 → Wiki 同步")
    log("=" * 60)
    
    # 加载配置
    app_id, app_secret = load_config()
    if not app_id or not app_secret:
        log("ERROR: 飞书凭证未配置")
        sys.exit(1)
    
    log(f"飞书 AppID: {app_id[:10]}...")
    
    # 获取 tenant token
    tenant_token = get_tenant_token(app_id, app_secret)
    if not tenant_token:
        log("ERROR: 无法获取飞书 tenant token")
        sys.exit(1)
    
    log("飞书认证成功")
    
    # 确保 raw 目录存在
    os.makedirs(WIKI_RAW_DIR, exist_ok=True)
    
    # 获取上次同步时间
    last_sync = None
    if os.path.exists(LAST_SYNC_FILE):
        with open(LAST_SYNC_FILE, "r") as f:
            last_sync = f.read().strip()
        log(f"上次同步时间: {last_sync}")
    
    # 获取文件列表
    log("正在获取 KM-Vault 文件列表...")
    files = get_folder_files(KM_VAULT_TOKEN, tenant_token)
    log(f"找到 {len(files)} 个文件")
    
    new_count = 0
    skipped_count = 0
    
    for file_info in files:
        file_token = file_info.get("token", "")
        file_name = file_info.get("name", "")
        file_type = file_info.get("type", "")
        
        # 只处理文档类型
        if file_type not in ("docx", "doc"):
            skipped_count += 1
            continue
        
        # 生成文件名
        safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in file_name)
        output_file = os.path.join(WIKI_RAW_DIR, f"{safe_name}.md")
        
        log(f"正在下载: {file_name}")
        content = download_doc_as_markdown(file_token, tenant_token)
        
        if content:
            # 添加 Frontmatter
            frontmatter = f"""---
title: "{file_name}"
source: feishu
source_token: "{file_token}"
synced_at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
---

"""
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(frontmatter + content)
            
            log(f"✅ 已下载: {file_name}")
            new_count += 1
        else:
            if os.path.exists(output_file):
                os.remove(output_file)
            log(f"⚠️  空文档，跳过: {file_name}")
            skipped_count += 1
    
    # 记录同步时间
    with open(LAST_SYNC_FILE, "w") as f:
        f.write(str(int(datetime.now().timestamp())))
    
    log(f"新增: {new_count} | 跳过: {skipped_count}")
    
    # 触发 Wiki 编译
    log("触发 Wiki 编译...")
    result = run_cmd(["openclaw", "wiki", "compile"])
    log(f"编译结果: {result[:200]}")
    
    # Git 提交
    log("Git 提交更改...")
    os.chdir("/home/admin/.openclaw/wiki/main")
    run_cmd(["git", "add", "."])
    
    status = run_cmd(["git", "status", "--porcelain"])
    if status:
        run_cmd(["git", "commit", "-m", f"飞书同步: 新增 {new_count} 个文档"])
        run_cmd(["git", "push", "origin", "main"])
        log("Git 推送成功")
    else:
        log("Git 无更改")
    
    log("=" * 60)
    log("飞书 → Wiki 同步完成")
    log("=" * 60)


if __name__ == "__main__":
    main()
