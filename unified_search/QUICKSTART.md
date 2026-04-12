# 快速启动指南

## 环境准备

在启动服务之前，请确保已完成以下准备工作：

1. 确保 Node.js (版本 >= 18.0.0) 已安装
2. 确认 API 密钥已正确配置在 `runtime-secrets.json` 文件中

## 安装依赖

```bash
cd unified_search
npm install
```

## 启动服务

### 开发模式
```bash
# 使用本地密钥文件启动服务
npm run start-local
```

### 调试模式
```bash
# 启动服务并启用调试功能
npm run debug-local
```

## 测试服务

启动服务后，可以使用以下方法测试：

1. 运行测试脚本：
```bash
npm test
```

2. 或手动发送请求：
```bash
curl -X POST http://127.0.0.1:18791 \
  -H "Content-Type: application/json" \
  -d '{"query": "人工智能发展趋势", "scene": "TECH_RESEARCH"}'
```

## API 密钥配置

当前已配置的 API 密钥：
- **EXA_API_KEY**: 83017a59-702a-4974-84eb-67e7b45f746c
- **TAVILY_API_KEY**: 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

## 环境变量

- `SEARCH_SERVICE_PORT`: 服务端口（默认 18790）
- `SECRETS_PATH`: 密钥文件路径（默认 ./runtime-secrets.json）

## 故障排除

如果遇到 API 密钥相关错误：

1. 确认 `runtime-secrets.json` 文件存在且格式正确
2. 确认 API 密钥未过期且有足够的使用额度
3. 检查网络连接是否正常
4. 查看服务日志获取更多错误信息

## 安全提示

- 请勿将 API 密钥提交到版本控制系统
- 定期轮换 API 密钥
- 监控 API 使用情况，避免超出限额