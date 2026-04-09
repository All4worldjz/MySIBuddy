/**
 * AI News Hub — Pusher
 * 推送消息到 Telegram
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8606756625';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * 发送单条消息
 */
async function sendMessage(text) {
  const url = `${TELEGRAM_API}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram API 错误: ${response.status} - ${err}`);
  }
  
  return response.json();
}

/**
 * 重试发送
 */
async function sendWithRetry(text) {
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Pusher] 发送消息 (尝试 ${attempt}/${MAX_RETRIES})...`);
      const result = await sendMessage(text);
      console.log(`[Pusher] 发送成功: ${result.result?.message_id || 'OK'}`);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[Pusher] 尝试 ${attempt} 失败: ${err.message}`);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  
  throw new Error(`重试 ${MAX_RETRIES} 次后仍失败: ${lastError.message}`);
}

/**
 * 推送消息
 */
async function push(messages) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN 环境变量未设置');
  }
  
  // messages 是数组（可能需要拆分成多条）
  const parts = Array.isArray(messages) ? messages : [messages];
  
  for (const part of parts) {
    await sendWithRetry(part);
    // 每条消息间隔一下
    if (parts.length > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

module.exports = { push };