# 统一搜索服务 (Unified Search Service)

此项目是从OpenClaw系统中提取的统一搜索服务，用于提供集成的网络搜索功能。

## 项目结构

```
unified_search/
├── search_service.js      # 原始搜索服务代码
├── debug_search_service.js # 调试版本的搜索服务
├── test_search.js         # 测试脚本
├── runtime-secrets.json   # 模拟的密钥文件
├── .env.example           # 环境变量示例
├── README.md             # 项目说明
├── package.json          # 项目配置
└── docs/                 # 文档目录
    └── architecture.md   # 架构设计文档
```

## 安装与运行

1. 安装依赖：
```bash
npm install
```

2. 配置API密钥：
- 复制 `.env.example` 为 `.env`
- 在 `runtime-secrets.json` 中添加你的 Exa 和 Tavily API 密钥

3. 启动服务：
```bash
# 使用原始版本
npm start

# 使用调试版本（本地路径）
npm run start-local

# 启动调试模式
npm run debug-local
```

4. 测试服务：
```bash
npm test
```

## 功能说明

- **多提供商支持**：支持Exa和Tavily两个搜索API提供商
- **智能路由**：根据不同的场景（CHINA_SOCIAL, GLOBAL_TRENDS, TECH_RESEARCH, GENERAL）选择不同的提供商优先级
- **负载均衡**：按优先级顺序尝试不同的提供商，如果一个失败则尝试下一个
- **错误处理**：当所有提供商都失败时，返回错误信息
- **HTTP接口**：提供POST接口接收查询请求，返回Markdown格式结果

## API 接口

POST 请求到 http://127.0.0.1:18790
请求体：
```json
{
  "query": "搜索查询",
  "scene": "搜索场景（可选，默认为GENERAL）"
}
```

返回：Markdown格式的搜索结果

## 调试说明

`debug_search_service.js` 包含了额外的日志输出，便于调试和理解服务的工作流程。