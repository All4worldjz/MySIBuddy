# 飞书网盘 API 排错经验（2026-04-08）

> **文档目的**：记录飞书 Drive API 调用过程中的踩坑和排错经验，供后续开发参考。

---

## 一、API 端点踩坑

### 1.1 列出文件夹内容

**错误端点**（返回 404）：
```
GET /open-apis/drive/v1/folders/{folder_token}/children
```

**正确端点**：
```
GET /open-apis/drive/v1/files?folder_token={token}&page_size=200
```

**响应差异**：
- 正确响应返回 `data.files` 数组，而非 `data.items`
- 每个文件对象包含 `name`、`token`、`type`、`parent_token` 字段

### 1.2 创建文件夹

**错误方式**（folder_token 作为 Query 参数）：
```
POST /open-apis/drive/v1/files/create_folder?folder_token={token}
Body: {"name": "文件夹名"}
```
**错误响应**：`field validation failed: folder_token is required`

**正确方式**（folder_token 在 Body 中）：
```
POST /open-apis/drive/v1/files/create_folder
Body: {"name": "文件夹名", "folder_token": "父文件夹token"}
```

**注意**：`folder_token` 是必填参数，无法在根目录直接创建文件夹。

### 1.3 批量查询元信息

**正确请求格式**：
```json
POST /open-apis/drive/v1/metas/batch_query
{
  "request_docs": [
    {"doc_token": "xxx", "doc_type": "folder"}
  ]
}
```

**响应字段差异**：
| 预期字段 | 实际返回字段 |
|----------|--------------|
| `name` | `title` |
| `type` | `doc_type` |
| `parent_token` | **不返回** |

**代码适配示例**：
```python
# 错误方式
name = meta.get('name')  # 返回 None

# 正确方式
name = meta.get('title', meta.get('name', 'Unknown'))
```

---

## 二、回收站创建踩坑

### 2.1 根目录限制

**问题**：尝试在网盘根目录创建"回收站"文件夹失败。

**原因**：飞书 API 要求 `folder_token` 必填，无法在真正的根目录创建文件夹。

**解决方案**：
1. 使用现有的顶级文件夹（如 CC文件柜）作为回收站的父目录
2. 配置中记录 `parent_token` 用于后续定位

### 2.2 回收站 token 持久化

**问题**：每次脚本运行都尝试创建回收站。

**解决方案**：
1. 配置文件中存储回收站 token
2. 脚本启动时检查 token 是否有效
3. 无效时重新查找或创建

**配置示例**：
```json
{
  "recycle_bin": {
    "name": "回收站",
    "token": "XcTHfLy7clpx51dBomLcvA7XnTf",
    "parent_token": "RfSrf8oMYlMyQTdbW0ZcGSE1nNb",
    "status": "active"
  }
}
```

---

## 三、移动/删除 API 注意事项

### 3.1 移动文件夹

**正确端点**：
```
POST /open-apis/drive/v1/files/{file_token}/move?type={type}
Body: {"folder_token": "目标文件夹token", "name": "可选新名称"}
```

**注意**：
- `type` 参数必填，值为 `folder`、`file`、`doc` 等
- `name` 参数可选，用于移动时重命名

### 3.2 删除文件夹

**正确端点**：
```
DELETE /open-apis/drive/v1/files/{file_token}?type={type}
```

**重要**：
- 删除文件夹会**级联删除**所有子内容
- 飞书有内置回收站，删除后可在飞书应用中恢复
- 30天后飞书系统自动永久删除

### 3.3 软删除 vs 永久删除

**软删除实现**：使用移动 API 将文件移至回收站文件夹
```bash
POST /open-apis/drive/v1/files/{token}/move?type=folder
Body: {"folder_token": "回收站token"}
```

**永久删除**：使用删除 API
```bash
DELETE /open-apis/drive/v1/files/{token}?type=folder
```

---

## 四、认证和权限

### 4.1 获取 tenant_access_token

**端点**：
```
POST /open-apis/auth/v3/tenant_access_token/internal
Body: {"app_id": "xxx", "app_secret": "xxx"}
```

**响应**：
```json
{
  "code": 0,
  "tenant_access_token": "t-xxx",
  "expire": 7200
}
```

**注意**：
- token 有效期通常 2 小时
- 建议缓存 token，避免频繁请求
- 脚本中每次运行重新获取即可

### 4.2 权限要求

| 操作 | 所需权限 |
|------|----------|
| 列出文件 | `drive:drive:readonly` |
| 创建文件夹 | `drive:drive` |
| 移动文件 | `drive:drive` |
| 删除文件 | `drive:drive` |

---

## 五、调试技巧

### 5.1 使用 curl 快速测试

```bash
# 获取 token
TOKEN=$(curl -s -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"xxx","app_secret":"xxx"}' | jq -r '.tenant_access_token')

# 列出文件夹内容
curl -s "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=xxx" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 创建文件夹
curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/files/create_folder" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","folder_token":"父token"}' | jq .
```

### 5.2 错误码速查

| 错误码 | 含义 | 解决方案 |
|--------|------|----------|
| 99992402 | 参数验证失败 | 检查必填参数是否正确传递 |
| 1061002 | 参数错误 | 检查参数格式和值 |
| 99991663 | 文件不存在 | 检查 token 是否正确 |
| 99991661 | 无权限 | 检查应用权限配置 |

### 5.3 日志分析

```bash
# 查看飞书插件日志
journalctl --user -u openclaw-gateway -n 100 --no-pager | grep -i "feishu_drive_file"

# 搜索特定操作
journalctl --user -u openclaw-gateway --since "2026-04-07" | grep -i "create_folder\|move\|delete"
```

---

## 六、最佳实践

### 6.1 安全操作原则

1. **先预览再执行**：删除/移动前使用 `--dry-run` 确认
2. **软删除优先**：默认移至回收站，而非永久删除
3. **受保护列表**：关键文件夹禁止删除/移动
4. **审计日志**：记录所有操作，便于追溯

### 6.2 脚本设计模式

```
┌─────────────────────────────────────────┐
│  1. 参数校验                            │
│  2. 获取访问令牌                        │
│  3. 验证目标存在性                      │
│  4. 受保护检查                          │
│  5. 重名检测（创建/移动）               │
│  6. 显示操作预览                        │
│  7. 交互确认（可选）                    │
│  8. 执行操作                            │
│  9. 记录审计日志                        │
└─────────────────────────────────────────┘
```

### 6.3 配置文件设计

```json
{
  "protected_tokens": ["关键文件夹token列表"],
  "protected_names": ["关键文件夹名称列表"],
  "recycle_bin": {
    "token": "回收站token",
    "parent_token": "父文件夹token",
    "auto_cleanup_days": 30
  }
}
```

---

## 七、参考资源

- [飞书开放平台 - Drive API 文档](https://open.feishu.cn/document/server-docs/drive-v1/read-only/overview)
- [本地操作规范文档](./feishu-drive-operations-guide.md)
- [安全策略共享库](../scripts/lib/feishu_drive_guardrails.sh)

---

**文档版本**：1.0.0
**更新日期**：2026-04-08
**维护者**：chief-of-staff