import AuthManager from './auth.js';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';

// 模型别名映射
const MODEL_ALIASES = {
  'gemini-3.1-flash-lite-preview': 'gemini-3-flash-preview',
  'gemini-3.1-flash-preview': 'gemini-3-flash-preview',
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'gemini-3-pro': 'gemini-3-pro-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
};

// 模型配置
const DEFAULT_MODELS = {
  'gemini-3.1-pro-preview': { contextWindow: 1000000, maxTokens: 65536, thinking: true },
  'gemini-3-pro-preview': { contextWindow: 1000000, maxTokens: 65536, thinking: true },
  'gemini-3-flash-preview': { contextWindow: 1000000, maxTokens: 65536, thinking: false },
  'gemini-2.5-pro': { contextWindow: 1000000, maxTokens: 65536, thinking: true },
  'gemini-2.5-flash': { contextWindow: 1000000, maxTokens: 65536, thinking: true },
  'gemini-2.5-flash-lite': { contextWindow: 1000000, maxTokens: 65536, thinking: true },
  'gemini-2.0-flash': { contextWindow: 1000000, maxTokens: 65536, thinking: false },
  'gemini-2.0-flash-exp': { contextWindow: 1000000, maxTokens: 65536, thinking: false },
  'gemini-1.5-pro': { contextWindow: 1000000, maxTokens: 16384, thinking: false },
  'gemini-1.5-flash': { contextWindow: 1000000, maxTokens: 8192, thinking: false },
  'gemini-1.5-flash-8b': { contextWindow: 1000000, maxTokens: 8192, thinking: false }
};

const MODEL_IDS = Object.keys(DEFAULT_MODELS);

// ========== 性能优化：全局缓存 ==========

// Project ID 全局缓存（跨请求共享）
let globalProjectId = null;
let projectIdPromise = null;

// 访问令牌缓存
let cachedAccessToken = null;

// ========== 工具函数 ==========

function resolveModel(modelId) {
  return MODEL_ALIASES[modelId] || modelId;
}

// 消息格式转换缓存（相同消息避免重复转换）
const messageFormatCache = new WeakMap();

function messageToGeminiFormat(msg) {
  // 尝试从缓存读取
  if (messageFormatCache.has(msg)) {
    return messageFormatCache.get(msg);
  }

  const role = msg.role === 'assistant' ? 'model' : 'user';
  let result;

  if (msg.role === 'tool') {
    result = {
      role: 'user',
      parts: [{
        functionResponse: {
          name: msg.tool_call_id || 'unknown_function',
          response: { result: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }
        }
      }]
    };
  } else if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
    const parts = [];
    if (typeof msg.content === 'string' && msg.content.trim()) {
      parts.push({ text: msg.content });
    }
    for (const toolCall of msg.tool_calls) {
      if (toolCall.type === 'function') {
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments)
          }
        });
      }
    }
    result = { role: 'model', parts };
  } else if (typeof msg.content === 'string') {
    result = { role, parts: [{ text: msg.content }] };
  } else if (Array.isArray(msg.content)) {
    const parts = [];
    for (const content of msg.content) {
      if (content.type === 'text') {
        parts.push({ text: content.text });
      } else if (content.type === 'image_url' && content.image_url?.url?.startsWith('data:')) {
        const [mimeType, base64Data] = content.image_url.url.split(',');
        parts.push({
          inlineData: {
            mimeType: mimeType.split(':')[1].split(';')[0],
            data: base64Data
          }
        });
      } else if (content.type === 'input_audio' && content.input_audio) {
        parts.push({
          inlineData: {
            mimeType: content.input_audio.format,
            data: content.input_audio.data
          }
        });
      }
    }
    result = { role, parts };
  } else {
    result = { role, parts: [{ text: String(msg.content) }] };
  }

  // 缓存结果
  messageFormatCache.set(msg, result);
  return result;
}

// ========== 主客户端类 ==========

class GeminiApiClient {
  constructor(env) {
    this.env = env;
    this.authManager = new AuthManager(env);
  }

  // 优化的 Project ID 发现（带并发控制）
  async discoverProjectId() {
    // 优先使用环境变量
    if (this.env.GEMINI_PROJECT_ID) {
      return this.env.GEMINI_PROJECT_ID;
    }

    // 使用全局缓存
    if (globalProjectId) {
      return globalProjectId;
    }

    // 防止并发请求重复调用 API
    if (projectIdPromise) {
      return projectIdPromise;
    }

    projectIdPromise = this._fetchProjectId();
    try {
      return await projectIdPromise;
    } finally {
      projectIdPromise = null;
    }
  }

  async _fetchProjectId() {
    try {
      const response = await this.authManager.callEndpoint('loadCodeAssist', {
        cloudaicompanionProject: undefined,
        metadata: { duetProject: undefined }
      });

      if (response.cloudaicompanionProject) {
        globalProjectId = response.cloudaicompanionProject;
        console.log(`[Gemini] Cached project ID: ${globalProjectId}`);
        return globalProjectId;
      }
      throw new Error('Project ID discovery failed');
    } catch (error) {
      console.error('[Gemini] Failed to discover project ID:', error.message);
      throw new Error('Could not discover project ID. Set GEMINI_PROJECT_ID env var.');
    }
  }

  // 预热方法（启动时调用）
  async warmup() {
    console.log('[Gemini] Warming up...');
    const start = Date.now();

    try {
      // 预加载认证
      await this.authManager.initializeAuth();
      cachedAccessToken = this.authManager.getAccessToken();

      // 预加载 Project ID
      await this.discoverProjectId();

      console.log(`[Gemini] Warmup completed in ${Date.now() - start}ms`);
      return true;
    } catch (error) {
      console.error('[Gemini] Warmup failed:', error.message);
      return false;
    }
  }

  async *streamContent(modelId, systemPrompt, messages, options = {}) {
    await this.authManager.initializeAuth();
    const actualModelId = resolveModel(modelId);

    if (actualModelId !== modelId) {
      console.log(`[Gemini] Model alias: ${modelId} -> ${actualModelId}`);
    }

    yield* this.streamContentCodeAssist(actualModelId, systemPrompt, messages, options);
  }

  async *streamContentCodeAssist(modelId, systemPrompt, messages, options = {}) {
    const projectId = await this.discoverProjectId();
    const accessToken = this.authManager.getAccessToken();

    // 优化：使用数组 map 而非展开运算符
    const contents = messages.map(messageToGeminiFormat);

    if (systemPrompt) {
      contents.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    // 构建生成配置
    const generationConfig = {};
    if (options.max_tokens) generationConfig.maxOutputTokens = options.max_tokens;
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.top_p !== undefined) generationConfig.topP = options.top_p;
    if (options.stop) generationConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop];

    const isThinkingModel = DEFAULT_MODELS[modelId]?.thinking;
    if (options.thinkingBudget !== undefined && isThinkingModel) {
      generationConfig.thinkingBudget = options.thinkingBudget;
    }

    const request = { contents, generationConfig };
    if (options.tools?.length > 0) {
      request.tools = options.tools;
    }

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:streamGenerateContent?alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ model: modelId, project: projectId, request })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Code Assist API failed (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response has no body');
    }

    // 流式处理响应
    const decoder = new TextDecoder();
    let buffer = '';
    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.substring(6).trim();
          if (!jsonStr) continue;

          let jsonData;
          try {
            jsonData = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          const candidate = jsonData.response?.candidates?.[0];
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text && part.thought !== true) {
                yield { type: 'text', data: part.text };
              }
              if (part.functionCall) {
                yield { type: 'tool_code', data: { name: part.functionCall.name, args: part.functionCall.args } };
              }
              if (part.thought === true && part.text) {
                yield { type: 'reasoning', data: part.text };
              }
            }
          }

          if (jsonData.response?.usageMetadata) {
            const usage = jsonData.response.usageMetadata;
            yield { type: 'usage', data: { inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0 } };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getCompletion(modelId, systemPrompt, messages, options = {}) {
    let content = '';
    let usage;
    const tool_calls = [];

    for await (const chunk of this.streamContent(modelId, systemPrompt, messages, options)) {
      if (chunk.type === 'text' && typeof chunk.data === 'string') {
        content += chunk.data;
      } else if (chunk.type === 'usage' && typeof chunk.data === 'object') {
        usage = chunk.data;
      } else if (chunk.type === 'tool_code' && typeof chunk.data === 'object') {
        tool_calls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'function',
          function: { name: chunk.data.name, arguments: JSON.stringify(chunk.data.args) }
        });
      }
    }

    return { content, usage, tool_calls: tool_calls.length > 0 ? tool_calls : undefined };
  }
}

export { DEFAULT_MODELS, MODEL_IDS, MODEL_ALIASES, resolveModel, GeminiApiClient };