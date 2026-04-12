# Unified Search Service

这是一个统一搜索服务，集成了多个搜索提供商（Exa和Tavily），支持智能路由和负载均衡。

## 功能特性

- 支持多种搜索场景：CHINA_SOCIAL, GLOBAL_TRENDS, TECH_RESEARCH, GENERAL
- 智能路由：根据不同场景选择最优的搜索提供商
- 负载均衡：当首选提供商不可用时，自动切换到备用提供商
- 错误处理：提供详细的错误信息和降级方案
- HTTP接口：提供RESTful API接口

## 架构设计

- 服务监听端口：18790
- 依赖于OpenClaw的密钥管理系统（runtime-secrets.json）
- 支持多种搜索场景，每种场景有不同的提供商优先级

## 场景优先级

- CHINA_SOCIAL: 优先使用Tavily，备选Exa
- GLOBAL_TRENDS: 优先使用Exa，备选Tavily
- TECH_RESEARCH: 优先使用Exa，备选Tavily
- GENERAL: 优先使用Tavily，备选Exa

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