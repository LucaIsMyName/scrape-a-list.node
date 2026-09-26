import { normalizeAttributeValue } from './attrUrl.js';

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Element} itemEl
 * @param {string} selector
 */
export function resolveFieldNode($, itemEl, selector) {
  const $item = $(itemEl);
  let $node = $item.filter(selector);
  if (!$node.length) {
    $node = $item.find(selector);
  }
  // e.g. ".job-offer-item a" inside an <a class="job-offer-item"> row, or redundant wrapper in selector
  if (!$node.length && selector.includes(' ')) {
    const tail = selector.trim().split(/\s+/).pop();
    if (tail) {
      $node = $item.filter(tail);
      if (!$node.length) {
        $node = $item.find(tail);
      }
    }
  }
  return $node.first();
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Element} itemEl
 * @param {{ name: string, selector: string, attribute?: string }} field
 * @param {string} pageUrl
 * @returns {string}
 */
export function extractFieldValue($, itemEl, field, pageUrl) {
  const $node = resolveFieldNode($, itemEl, field.selector);
  if (!$node.length) return '';
  if (!field.attribute) {
    return $node.text().replace(/\s+/g, ' ').trim();
  }
  const raw = $node.attr(field.attribute);
  return normalizeAttributeValue(field.attribute, raw, pageUrl);
}
