import express from 'express';
import { Readable } from 'stream';
import { GeminiApiClient, MODEL_IDS } from '../gemini-client.js';
import { createOpenAIStreamTransformer } from '../stream-transformer.js';

const router = express.Router();

router.get('/models', (req, res) => {
  const modelData = MODEL_IDS.map(modelId => ({
    id: modelId,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'google-gemini-cli'
  }));

  res.json({ object: 'list', data: modelData });
});

router.post('/chat/completions', async (req, res) => {
  try {
    const { model, messages, stream, max_tokens, temperature, top_p, stop, tools, tool_choice, thinking_budget } = req.body;

    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'messages is a required field' });
    }

    const selectedModel = model || 'gemini-2.5-flash';
    const shouldStream = stream !== false;

    console.log(`[OpenAI] Chat completion: model=${selectedModel}, stream=${shouldStream}, messages=${messages.length}`);

    let systemPrompt = '';
    const otherMessages = messages.filter(msg => {
      if (msg.role === 'system') {
        systemPrompt = typeof msg.content === 'string' ? msg.content : '';
        return false;
      }
      return true;
    });

    const geminiClient = new GeminiApiClient(req.app.locals.env);

    try {
      await geminiClient.authManager.initializeAuth();
    } catch (authError) {
      console.error('[OpenAI] Auth failed:', authError.message);
      return res.status(401).json({ error: 'Authentication failed: ' + authError.message });
    }

    if (shouldStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const options = { max_tokens, temperature, top_p, stop, tools, tool_choice, thinkingBudget: thinking_budget };

      try {
        const geminiStream = geminiClient.streamContent(selectedModel, systemPrompt, otherMessages, options);

        let firstChunk = true;
        let completionId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let accumulatedContent = '';

        for await (const chunk of geminiStream) {
          if (chunk.type === 'text' && typeof chunk.data === 'string') {
            accumulatedContent += chunk.data;

            const openaiChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: selectedModel,
              choices: [{
                index: 0,
                delta: { content: chunk.data },
                finish_reason: null
              }]
            };

            res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
          }

          if (chunk.type === 'tool_code' && typeof chunk.data === 'object') {
            const toolCallChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: selectedModel,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: 0,
                    id: `call_${Date.now()}`,
                    type: 'function',
                    function: {
                      name: chunk.data.name,
                      arguments: JSON.stringify(chunk.data.args)
                    }
                  }]
                },
                finish_reason: null
              }]
            };
            res.write(`data: ${JSON.stringify(toolCallChunk)}\n\n`);
          }

          if (chunk.type === 'reasoning' && typeof chunk.data === 'string') {
            const reasoningChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: selectedModel,
              choices: [{
                index: 0,
                delta: { content: `[reasoning] ${chunk.data}` },
                finish_reason: null
              }]
            };
            res.write(`data: ${JSON.stringify(reasoningChunk)}\n\n`);
          }
        }

        const usage = accumulatedContent.length > 0 ? {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        } : undefined;

        const finalChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: selectedModel,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }],
          usage
        };

        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (streamError) {
        console.error('[OpenAI] Stream error:', streamError.message);
        if (!res.headersSent) {
          res.status(500).json({ error: streamError.message });
        } else {
          res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
          res.end();
        }
      }
    } else {
      const options = { max_tokens, temperature, top_p, stop, tools, tool_choice, thinkingBudget: thinking_budget };

      const completion = await geminiClient.getCompletion(selectedModel, systemPrompt, otherMessages, options);

      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: selectedModel,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: completion.content,
            tool_calls: completion.tool_calls
          },
          finish_reason: completion.tool_calls?.length ? 'tool_calls' : 'stop'
        }]
      };

      if (completion.usage) {
        response.usage = {
          prompt_tokens: completion.usage.inputTokens,
          completion_tokens: completion.usage.outputTokens,
          total_tokens: completion.usage.inputTokens + completion.usage.outputTokens
        };
      }

      res.json(response);
    }
  } catch (error) {
    console.error('[OpenAI] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/audio/transcriptions', async (req, res) => {
  res.status(501).json({ error: 'Audio transcriptions not implemented' });
});

export default router;
