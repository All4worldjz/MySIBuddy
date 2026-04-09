/**
 * Hacker News Fetcher
 * 通过 Algolia API 抓取 AI 相关帖子
 */

const HN_API = 'https://hn.algolia.com/api/v1/search';
const KEYWORDS = ['AI', 'machine learning', 'LLM', 'neural network', 'deep learning'];
const MAX_PER_KEYWORD = 3;

/**
 * 抓取 HN
 */
async function fetch() {
  console.log('[HN Fetcher] 开始抓取...');
  
  try {
    // 并行查询多个关键词
    const responses = await Promise.all(
      KEYWORDS.map(kw =>
        fetch(`${HN_API}?query=${encodeURIComponent(kw)}&tags=story&hitsPerPage=${MAX_PER_KEYWORD}`, {
          headers: { 'User-Agent': 'AI-News-Hub/1.0' },
        })
      )
    );
    
    const data = await Promise.all(
      responses.map(r => r.json())
    );
    
    // 合并去重
    const seen = new Set();
    const items = [];
    
    for (const d of data) {
      for (const hit of d.hits || []) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);
        
        items.push({
          source: 'hackernews',
          sourceType: '讨论',
          title: hit.title || '无标题',
          abstract: hit.story_text || hit.comment_text || '',
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          authors: hit.author ? [hit.author] : [],
          published: hit.created_at,
          points: hit.points,
          numComments: hit.num_comments,
        });
      }
    }
    
    // 按时间排序
    items.sort((a, b) => new Date(b.published) - new Date(a.published));
    
    // 取最新 5 条
    const result = items.slice(0, 5);
    
    console.log(`[HN Fetcher] 抓取完成，获取 ${result.length} 条`);
    return result;
  } catch (err) {
    console.error('[HN Fetcher] 抓取失败:', err.message);
    return [];
  }
}

module.exports = { fetch };