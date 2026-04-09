/**
 * AI News Hub — Formatter
 * 格式化输出为 Telegram 消息
 */

const MAX_MESSAGE_LENGTH = 4000;

/**
 * 格式化单条内容
 */
function formatItem(item, index, total) {
  const emoji = item.sourceType === '论文' ? '🔬' : '🔥';
  const label = item.sourceType === '论文' ? '论文' : '讨论';
  const source = item.source.toUpperCase();
  
  const lines = [
    `${emoji} [${label}] ${item.title}`,
    `   背景：${item.summary?.背景 || '暂无'}`,
    `   核心：${item.summary?.核心 || '暂无'}`,
    `   意义：${item.summary?.意义 || '暂无'}`,
    `   📎 ${item.url}`,
    '',  // 空行分隔
  ];
  
  return lines.join('\n');
}

/**
 * 格式化全部内容
 */
function format(items) {
  const today = new Date().toISOString().slice(0, 10);
  
  const header = `📰 AI Daily | ${today}\n\n`;
  
  const body = items.map((item, i) => formatItem(item, i, items.length)).join('\n');
  
  let message = header + body;
  
  // 如果超长，拆分成多条
  if (message.length > MAX_MESSAGE_LENGTH) {
    const parts = [];
    let remaining = message;
    
    while (remaining.length > MAX_MESSAGE_LENGTH) {
      // 找到最后一个换行符位置
      const lastNewline = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
      if (lastNewline < MAX_MESSAGE_LENGTH / 2) {
        // 找不到合适断点，强制截断
        parts.push(remaining.slice(0, MAX_MESSAGE_LENGTH));
        remaining = remaining.slice(MAX_MESSAGE_LENGTH);
      } else {
        parts.push(remaining.slice(0, lastNewline));
        remaining = remaining.slice(lastNewline + 1);
      }
    }
    
    if (remaining.length > 0) {
      parts.push(remaining);
    }
    
    return parts;
  }
  
  return [message];
}

module.exports = { format };