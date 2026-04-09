/**
 * AI News Hub — Summarizer
 * 使用 MiniMax-M2.7 生成新闻摘要
 */

const API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_pro';
const API_KEY = process.env.MINIMAX_API_KEY || '';
const MODEL = 'MiniMax-M2.7';

const PROMPT_TEMPLATE = `你是一个专业的AI学术新闻摘要员。请为以下内容生成结构化摘要。

【来源类型】：{sourceType}
【标题】：{title}
【链接】：{url}
【原始摘要】：{abstract}

请生成以下格式的摘要：

🔬 [论文] {title}
   背景：...
   核心：...
   意义：...

要求：
- 背景：说明这项研究解决的问题和动机（1-2句）
- 核心：简明扼要地说明核心方法和创新点（2-3句）
- 意义：说明对领域的影响和潜在应用（1-2句）
- 中文输出，语言简洁专业
- 如果是论文类型用🔬，讨论类型用🔥
- 链接直接放在标题后面，不要单独成行`;

/**
 * 调用 MiniMax API 生成摘要
 */
async function callMinimax(messages) {
  if (!API_KEY) {
    throw new Error('MINIMAX_API_KEY 环境变量未设置');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MiniMax API 错误: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 解析摘要结果
 */
function parseSummary(text, sourceType) {
  const emoji = sourceType === '论文' ? '🔬' : '🔥';
  
  // 尝试解析结构化摘要
  const bgMatch = text.match(/背景[：:]\s*([\s\S]*?)(?=核心[：:])/);
  const coreMatch = text.match(/核心[：:]\s*([\s\S]*?)(?=意义[：:])/);
  const significanceMatch = text.match(/意义[：:]\s*([\s\S]*?)$/);
  
  return {
    背景: bgMatch ? bgMatch[1].trim() : text.slice(0, 200),
    核心: coreMatch ? coreMatch[1].trim() : '',
    意义: significanceMatch ? significanceMatch[1].trim() : '',
  };
}

/**
 * 为单条内容生成摘要
 */
async function summarize(item) {
  console.log(`[Summarizer] 生成摘要: ${item.title.slice(0, 50)}...`);
  
  const prompt = PROMPT_TEMPLATE
    .replace('{sourceType}', item.sourceType)
    .replace('{title}', item.title)
    .replace('{url}', item.url)
    .replace('{abstract}', (item.abstract || '').slice(0, 1000));
  
  const messages = [
    { role: 'user', content: prompt },
  ];
  
  try {
    const response = await callMinimax(messages);
    const parsed = parseSummary(response, item.sourceType);
    
    // 验证解析结果
    if (!parsed.核心) {
      console.warn('[Summarizer] 摘要解析失败，使用原始响应');
      return { 背景: response.slice(0, 100), 核心: response.slice(100, 300), 意义: response.slice(300, 400) };
    }
    
    return parsed;
  } catch (err) {
    console.error(`[Summarizer] 调用失败: ${err.message}`);
    throw err;
  }
}

module.exports = { summarize };