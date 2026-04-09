/**
 * Reddit r/MachineLearning Fetcher
 * 抓取热门帖子
 */

const REDDIT_API = 'https://www.reddit.com/r/MachineLearning/hot.json?limit=10';
const MAX_ITEMS = 5;

/**
 * 抓取 Reddit
 */
async function fetch() {
  console.log('[Reddit Fetcher] 开始抓取...');
  
  try {
    const resp = await fetch(REDDIT_API, {
      headers: {
        'User-Agent': 'AI-News-Hub/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    
    const data = await resp.json();
    const posts = data.data?.children || [];
    
    const items = posts.slice(0, MAX_ITEMS).map(post => {
      const d = post.data;
      return {
        source: 'reddit',
        sourceType: '讨论',
        title: d.title || '无标题',
        abstract: d.selftext || '',
        url: d.url || `https://reddit.com${d.permalink}`,
        authors: [d.author] || [],
        published: new Date(d.created_utc * 1000).toISOString(),
        points: d.score,
        numComments: d.num_comments,
      };
    });
    
    console.log(`[Reddit Fetcher] 抓取完成，获取 ${items.length} 条`);
    return items;
  } catch (err) {
    console.error('[Reddit Fetcher] 抓取失败:', err.message);
    return [];
  }
}

module.exports = { fetch };