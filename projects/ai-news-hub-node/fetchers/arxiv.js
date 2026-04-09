/**
 * arXiv Fetcher
 * 抓取 cs.AI, cs.LG, cs.CL 类别的最新论文
 */

const ARXIV_API = 'https://export.arxiv.org/api/query';
const CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL'];
const MAX_RESULTS = 15;

/**
 * 解析 arXiv XML 响应
 */
function parseArxivXml(xmlText) {
  const items = [];
  
  // 简单正则解析（不依赖 xml2js）
  const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entry = match[1];
    
    const getTag = (tag) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    
    const title = getTag('title').replace(/\s+/g, ' ');
    const abstract = getTag('summary').replace(/\s+/g, ' ');
    const published = getTag('published');
    const link = entry.match(/<id>([^<]+)<\/id>/)?.[1] || '';
    const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map(m => m[1]).slice(0, 3);
    
    items.push({
      source: 'arxiv',
      sourceType: '论文',
      title,
      abstract,
      url: link,
      authors,
      published,
    });
  }
  
  return items;
}

/**
 * 获取过去24小时内的论文
 */
function filterRecentPapers(items) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return items.filter(item => {
    const pubDate = new Date(item.published);
    return pubDate >= yesterday;
  });
}

/**
 * 抓取 arXiv
 */
async function fetch() {
  console.log('[ArXiv Fetcher] 开始抓取...');
  
  try {
    // 并行查询多个类别
    const responses = await Promise.all(
      CATEGORIES.map(cat =>
        fetch(`${ARXIV_API}?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=${MAX_RESULTS}`, {
          headers: { 'User-Agent': 'AI-News-Hub/1.0' },
        })
      )
    );
    
    const texts = await Promise.all(
      responses.map(r => r.text())
    );
    
    // 解析所有类别
    let allItems = [];
    for (const text of texts) {
      allItems = allItems.concat(parseArxivXml(text));
    }
    
    // 去重（按标题）
    const seen = new Set();
    allItems = allItems.filter(item => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    });
    
    // 过滤24小时内的
    const recent = filterRecentPapers(allItems);
    
    console.log(`[ArXiv Fetcher] 抓取完成，共 ${allItems.length} 篇，近24小时 ${recent.length} 篇`);
    
    // 如果24小时内没有，返回最新几篇
    return recent.length > 0 ? recent : allItems.slice(0, 5);
  } catch (err) {
    console.error('[ArXiv Fetcher] 抓取失败:', err.message);
    return [];
  }
}

module.exports = { fetch };