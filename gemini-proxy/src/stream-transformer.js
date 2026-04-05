function createOpenAIStreamTransformer(modelId) {
  let firstChunk = true;
  let completionId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let finishReason = null;
  let accumulatedContent = '';

  return new TransformStream({
    transform(chunk, controller) {
      const chunkData = chunk;

      if (chunkData.type === 'text' && typeof chunkData.data === 'string') {
        accumulatedContent += chunkData.data;

        const openaiChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{
            index: 0,
            delta: {
              content: chunkData.data
            },
            finish_reason: null
          }]
        };

        controller.enqueue(`data: ${JSON.stringify(openaiChunk)}\n\n`);
      }

      if (chunkData.type === 'reasoning' && typeof chunkData.data === 'string') {
        const reasoningChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{
            index: 0,
            delta: {
              content: `[thinking] ${chunkData.data}`
            },
            finish_reason: null
          }]
        };
        controller.enqueue(`data: ${JSON.stringify(reasoningChunk)}\n\n`);
      }

      if (chunkData.type === 'tool_code' && typeof chunkData.data === 'object') {
        const toolCallChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: 0,
                id: `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: chunkData.data.name,
                  arguments: JSON.stringify(chunkData.data.args)
                }
              }]
            },
            finish_reason: null
          }]
        };
        controller.enqueue(`data: ${JSON.stringify(toolCallChunk)}\n\n`);
      }

      if (chunkData.type === 'usage' && typeof chunkData.data === 'object') {
        finishReason = 'stop';
      }
    },

    flush(controller) {
      const usageChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: finishReason || 'stop'
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
      controller.enqueue(`data: ${JSON.stringify(usageChunk)}\n\n`);
      controller.enqueue('data: [DONE]\n\n');
    }
  });
}

export { createOpenAIStreamTransformer };
