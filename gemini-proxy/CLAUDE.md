# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start with auto-reload on file changes (Node 18+ built-in watch mode)
npm run dev

# Test health endpoint
curl http://localhost:8787/health

# Test chat completion (streaming)
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-3.1-pro-preview", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Architecture

This is an OpenAI-compatible proxy for Google Gemini that uses the **Code Assist API** instead of the standard Generative Language API.

### Key Discovery: Why Code Assist API?

Gemini 3.x models cannot be accessed via `generativelanguage.googleapis.com` with Gemini CLI's OAuth token because it lacks the `generative-language` scope. However, Gemini CLI internally uses **Code Assist API** (`cloudcode-pa.googleapis.com/v1internal`) which:
- Only requires `cloud-platform` scope (included in Gemini CLI OAuth)
- Supports all Gemini models including 3.x series
- Uses Gemini Code Assist free tier quota

### Request Flow

```
OpenAI Request → src/routes/openai.js → GeminiApiClient.streamContent()
                                           ↓
                                    resolveModel() (handle aliases)
                                           ↓
                                    streamContentCodeAssist()
                                           ↓
                                    AuthManager.callEndpoint() → Code Assist API
```

### Core Files

- **src/gemini-client.js**: Model configuration, API calls, response parsing
- **src/auth.js**: OAuth token management, token refresh, API endpoint wrapper
- **src/routes/openai.js**: OpenAI-compatible chat completions endpoint
- **src/stream-transformer.js**: Transform Gemini responses to OpenAI SSE format
- **src/index.js**: Express server setup, credential loading

### Authentication

Credentials are loaded in order of priority:
1. `GCP_SERVICE_ACCOUNT` environment variable (JSON string with OAuth credentials)
2. `~/.gemini/oauth_creds.json` file (fallback, loaded automatically)

AuthManager:
- Caches valid tokens in `.token_cache.json` to minimize refresh calls
- Auto-refreshes expired tokens using Gemini CLI's client_id/secret
- Auto-discovers project_id via `loadCodeAssist` endpoint on first API call
- On 401 errors: clears cache and re-initializes auth automatically

### Model Configuration

Models are defined in `DEFAULT_MODELS` object in gemini-client.js. Add new models with:
```javascript
'model-name': { contextWindow, maxTokens, thinking: boolean, api: 'codeassist' }
```

Some model names don't exist in Code Assist API - use `MODEL_ALIASES` to map them:
```javascript
'gemini-3.1-flash-lite-preview': 'gemini-3-flash-preview'
```

### Response Parsing

Gemini 3.x responses contain `parts` with:
- `text`: The actual text content
- `thoughtSignature`: Binary data for internal use (do not output)
- `thought: true`: Indicates thinking/reasoning content

Filter correctly:
```javascript
if (part.text && part.thought !== true) {
  yield { type: 'text', data: part.text };
}
if (part.thought === true && part.text) {
  yield { type: 'reasoning', data: part.text };
}
```

### Code Assist API Format

```javascript
// Endpoint
POST https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse

// Request body
{
  "model": "gemini-3.1-pro-preview",
  "project": "<from loadCodeAssist>",
  "request": {
    "contents": [{ "role": "user", "parts": [{ "text": "..." }] }],
    "generationConfig": { ... }
  }
}
```

### Error Handling

- **401**: Token expired → auto-refresh and retry
- **404**: Model not found → check if alias needed
- **429**: Rate limited → wait and retry (Code Assist has rate limits)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 8787) |
| `GCP_SERVICE_ACCOUNT` | JSON string with OAuth credentials (primary auth) |
| `GEMINI_PROJECT_ID` | Override auto-discovered project ID |
| `ENABLE_REAL_THINKING` | Enable thinking output formatting |
| `ENABLE_FAKE_THINKING` | Enable synthetic thinking markers |