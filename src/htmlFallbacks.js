/**
 * Structured HTML fallbacks when CSS selectors match nothing (common on JS-heavy sites).
 */

/**
 * @param {string} html
 * @returns {boolean}
 */
export function isBotChallengeHtml(html) {
  if (typeof html !== 'string' || html.length === 0) return false;
  const sample = html.slice(0, 8000).toLowerCase();
  return (
    sample.includes('awswafintegration') ||
    sample.includes('id="challenge-container"') ||
    (sample.includes('javascript is disabled') && sample.includes('robot'))
  );
}

/**
 * @param {number | undefined} seconds
 * @returns {string}
 */
export function formatRuntimeSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '';
}

/**
 * @param {string | undefined} iso
 * @returns {string}
 */
export function formatIsoDuration(iso) {
  if (typeof iso !== 'string' || !iso.startsWith('PT')) return '';
  const hours = iso.match(/(\d+)H/i)?.[1];
  const minutes = iso.match(/(\d+)M/i)?.[1];
  const h = hours ? Number(hours) : 0;
  const m = minutes ? Number(minutes) : 0;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '';
}

/**
 * @param {unknown[]} elements
 * @returns {Array<Record<string, string>>}
 */
function mapJsonLdItemListElements(elements) {
  return elements.map((entry, index) => {
    const row = entry && typeof entry === 'object' ? entry : {};
    const item = row.item && typeof row.item === 'object' ? row.item : row;
    const rating = item.aggregateRating?.ratingValue;
    const yearSource = item.datePublished || item.releaseDate || '';
    const year = typeof yearSource === 'string' ? yearSource.slice(0, 4) : '';
    return {
      rankingNumber: String(row.position ?? index + 1),
      name: typeof item.name === 'string' ? item.name : '',
      year,
      length: formatIsoDuration(item.duration) || '',
      stars: rating != null ? String(rating) : '',
    };
  });
}

/**
 * @param {string} html
 * @returns {Array<Record<string, string>> | null}
 */
export function extractJsonLdItemList(html) {
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const blocks = Array.isArray(data) ? data : [data];
    for (const block of blocks) {
      if (block?.['@type'] === 'ItemList' && Array.isArray(block.itemListElement) && block.itemListElement.length > 0) {
        return mapJsonLdItemListElements(block.itemListElement);
      }
    }
  }
  return null;
}

/**
 * @param {string} html
 * @returns {Array<Record<string, string>> | null}
 */
export function extractImdbChartFromNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const edges = data?.props?.pageProps?.pageData?.chartTitles?.edges;
    if (!Array.isArray(edges) || edges.length === 0) return null;
    return edges.map((edge) => {
      const node = edge?.node || {};
      return {
        rankingNumber: edge?.currentRank != null ? String(edge.currentRank) : '',
        name: node.titleText?.text || node.originalTitleText?.text || '',
        year: node.releaseYear?.year != null ? String(node.releaseYear.year) : '',
        length: formatRuntimeSeconds(node.runtime?.seconds),
        stars:
          node.ratingsSummary?.aggregateRating != null ? String(node.ratingsSummary.aggregateRating) : '',
      };
    });
  } catch {
    return null;
  }
}

/**
 * @param {URL} pageUrl
 * @returns {boolean}
 */
export function isImdbChartUrl(pageUrl) {
  return pageUrl.hostname.endsWith('imdb.com') && pageUrl.pathname.includes('/chart/');
}

/**
 * @param {string} html
 * @param {URL} pageUrl
 * @returns {Array<Record<string, string>> | null}
 */
export function extractImdbChartItems(html, pageUrl) {
  if (!isImdbChartUrl(pageUrl)) return null;
  return extractImdbChartFromNextData(html) || extractJsonLdItemList(html);
}
