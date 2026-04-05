import AuthManager from './auth.js';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';
const GEN_LANGUAGE_ENDPOINT = 'https://generativelanguage.googleapis.com';
const GEN_LANGUAGE_API_VERSION = 'v1beta';

const CODE_ASSIST_MODELS = [
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
  'gemini-2.0-flash', 'gemini-2.0-flash-exp',
  'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'
];

const GEN_LANGUAGE_MODELS = [
  'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview',
  'gemini-2.5-pro-preview', 'gemini-2.5-flash-preview'
];

const DEFAULT_MODELS = {
  'gemini-3.1-pro-preview': { contextWindow: 1000000, maxTokens: 65536, thinking: true, api: 'generativelanguage' },
  'gemini-3.1-flash-lite-preview': { contextWindow: 1000000, maxTokens: 65536, thinking: false, api: 'generativelanguage' },
  'gemini-2.5-pro': { contextWindow: 1000000, maxTokens: 65536, thinking: true, api: 'codeassist' },
  'gemini-2.5-flash': { contextWindow: 1000000, maxTokens: 65536, thinking: true, api: 'codeassist' },
  'gemini-2.5-flash-lite': { contextWindow: 1000000, maxTokens: 65536, thinking: true, api: 'codeassist' },
  'gemini-2.0-flash': { contextWindow: 1000000, maxTokens: 65536, thinking: false, api: 'codeassist' },
  'gemini-2.0-flash-exp': { contextWindow: 1000000, maxTokens: 65536, thinking: false, api: 'codeassist' },
  'gemini-1.5-pro': { contextWindow: 1000000, maxTokens: 16384, thinking: false, api: 'codeassist' },
  'gemini-1.5-flash': { contextWindow: 1000000, maxTokens: 8192, thinking: false, api: 'codeassist' },
  'gemini-1.5-flash-8b': { contextWindow: 1000000, maxTokens: 8192, thinking: false, api: 'codeassist' }
};

const MODEL_IDS = Object.keys(DEFAULT_MODELS);

function getApiType(modelId) {
  if (DEFAULT_MODELS[modelId]) {
    return DEFAULT_MODELS[modelId].api;
  }
  if (modelId.startsWith('gemini-3.1') || modelId.startsWith('gemini-2.5-pro-preview') || modelId.startsWith('gemini-2.5-flash-preview')) {
    return 'generativelanguage';
  }
  return 'codeassist';
}

class GeminiApiClient {
  constructor(env) {
    this.env = env;
    this.authManager = new AuthManager(env);
    this.projectId = null;
  }

  async discoverProjectId() {
    if (this.env.GEMINI_PROJECT_ID) {
      return this.env.GEMINI_PROJECT_ID;
    }
    if (this.projectId) {
      return this.projectId;
    }

    try {
      const response = await this.authManager.callEndpoint('loadCodeAssist', {
        cloudaicompanionProject: undefined,
        metadata: { duetProject: undefined }
      });

      if (response.cloudaicompanionProject) {
        this.projectId = response.cloudaicompanionProject;
        return this.projectId;
      }
      throw new Error('Project ID discovery failed');
    } catch (error) {
      console.error('[Gemini] Failed to discover project ID:', error.message);
      throw new Error('Could not discover project ID. Set GEMINI_PROJECT_ID env var.');
    }
  }

  messageToGeminiFormat(msg) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (msg.role === 'tool') {
      return {
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.tool_call_id || 'unknown_function',
            response: { result: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }
          }
        }]
      };
    }

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
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
      return { role: 'model', parts };
    }

    if (typeof msg.content === 'string') {
      return { role, parts: [{ text: msg.content }] };
    }

    if (Array.isArray(msg.content)) {
      const parts = [];
      for (const content of msg.content) {
        if (content.type === 'text') {
          parts.push({ text: content.text });
        } else if (content.type === 'image_url' && content.image_url) {
          const imageUrl = content.image_url.url;
          if (imageUrl.startsWith('data:')) {
            const [mimeType, base64Data] = imageUrl.split(',');
            const mediaType = mimeType.split(':')[1].split(';')[0];
            parts.push({ inlineData: { mimeType: mediaType, data: base64Data } });
          } else {
            parts.push({ fileData: { mimeType: 'image/jpeg', fileUri: imageUrl } });
          }
        } else if (content.type === 'input_audio' && content.input_audio) {
          parts.push({
            inlineData: {
              mimeType: content.input_audio.format,
              data: content.input_audio.data
            }
          });
        }
      }
      return { role, parts };
    }

    return { role, parts: [{ text: String(msg.content) }] };
  }

  async *streamContent(modelId, systemPrompt, messages, options = {}) {
    await this.authManager.initializeAuth();
    const apiType = getApiType(modelId);

    if (apiType === 'generativelanguage') {
      yield* this.streamContentGenLanguage(modelId, systemPrompt, messages, options);
    } else {
      yield* this.streamContentCodeAssist(modelId, systemPrompt, messages, options);
    }
  }

  async *streamContentGenLanguage(modelId, systemPrompt, messages, options = {}) {
    const contents = messages.map(msg => this.messageToGeminiFormat(msg));
    if (systemPrompt) {
      contents.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    const isThinkingModel = DEFAULT_MODELS[modelId]?.thinking || false;

    const generationConfig = {};
    if (options.max_tokens) generationConfig.maxOutputTokens = options.max_tokens;
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.top_p !== undefined) generationConfig.topP = options.top_p;
    if (options.stop) generationConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop];
    if (options.thinkingBudget !== undefined && isThinkingModel) {
      generationConfig.thinkingBudget = options.thinkingBudget;
    }

    const request = { contents };
    if (Object.keys(generationConfig).length > 0) {
      request.generationConfig = generationConfig;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = options.tools;
    }

    const url = `${GEN_LANGUAGE_ENDPOINT}/${GEN_LANGUAGE_API_VERSION}/models/${modelId}:streamGenerateContent?alt=sse`;
    console.log(`[Gemini] Generative Language API streaming to ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authManager.getAccessToken()}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Generative Language API request failed (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response has no body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const stream = response.body;
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const jsonData = JSON.parse(jsonStr);
              const candidate = jsonData.candidates?.[0];

              if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                  if (part.text) {
                    yield { type: 'text', data: part.text };
                  }
                  if (part.functionCall) {
                    yield {
                      type: 'tool_code',
                      data: {
                        name: part.functionCall.name,
                        args: part.functionCall.args
                      }
                    };
                  }
                  if (part.thought) {
                    yield { type: 'reasoning', data: part.text || '' };
                  }
                }
              }

              if (jsonData.usageMetadata) {
                yield {
                  type: 'usage',
                  data: {
                    inputTokens: jsonData.usageMetadata.promptTokenCount || 0,
                    outputTokens: jsonData.usageMetadata.candidatesTokenCount || 0
                  }
                };
              }
            } catch (e) {
              console.error('[Gemini] Parse error:', e.message);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *streamContentCodeAssist(modelId, systemPrompt, messages, options = {}) {
    const projectId = await this.discoverProjectId();

    const contents = messages.map(msg => this.messageToGeminiFormat(msg));
    if (systemPrompt) {
      contents.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    const isThinkingModel = DEFAULT_MODELS[modelId]?.thinking || false;

    const generationConfig = {};
    if (options.max_tokens) generationConfig.maxOutputTokens = options.max_tokens;
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.top_p !== undefined) generationConfig.topP = options.top_p;
    if (options.stop) generationConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop];
    if (options.thinkingBudget !== undefined && isThinkingModel) {
      generationConfig.thinkingBudget = options.thinkingBudget;
    }

    const request = {
      contents,
      generationConfig
    };

    if (options.tools && options.tools.length > 0) {
      request.tools = options.tools;
    }

    const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:streamGenerateContent?alt=sse`;
    console.log(`[Gemini] Code Assist API streaming to ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authManager.getAccessToken()}`
      },
      body: JSON.stringify({ model: modelId, project: projectId, request })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Code Assist API request failed (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response has no body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const stream = response.body;
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const jsonData = JSON.parse(jsonStr);
              const candidate = jsonData.response?.candidates?.[0];

              if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                  if (part.text) {
                    yield { type: 'text', data: part.text };
                  }
                  if (part.functionCall) {
                    yield {
                      type: 'tool_code',
                      data: {
                        name: part.functionCall.name,
                        args: part.functionCall.args
                      }
                    };
                  }
                  if (part.thought === true && part.text) {
                    yield { type: 'reasoning', data: part.text };
                  }
                }
              }

              if (jsonData.response?.usageMetadata) {
                const usage = jsonData.response.usageMetadata;
                yield {
                  type: 'usage',
                  data: {
                    inputTokens: usage.promptTokenCount || 0,
                    outputTokens: usage.candidatesTokenCount || 0
                  }
                };
              }
            } catch (e) {
              console.error('[Gemini] Parse error:', e.message);
            }
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
          function: {
            name: chunk.data.name,
            arguments: JSON.stringify(chunk.data.args)
          }
        });
      }
    }

    return { content, usage, tool_calls: tool_calls.length > 0 ? tool_calls : undefined };
  }
}

export { DEFAULT_MODELS, MODEL_IDS, getApiType, GeminiApiClient };
