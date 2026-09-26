/**
 * @param {string | undefined} raw
 * @param {string} currentUrl
 * @returns {string | null}
 */
export function resolveAttrUrl(raw, currentUrl) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  try {
    return new URL(value, currentUrl).href;
  } catch {
    return null;
  }
}

/**
 * @param {string} attribute
 * @param {string} raw
 * @returns {boolean}
 */
export function shouldResolveAttributeAsUrl(attribute, raw) {
  if (attribute === 'href' || attribute === 'src') return true;
  const trimmed = raw.trim();
  if (!attribute.startsWith('data-') || !trimmed) return false;
  return /^(\/|https?:)/i.test(trimmed);
}

/**
 * @param {string} attribute
 * @param {string | undefined} raw
 * @param {string} pageUrl
 * @returns {string}
 */
export function normalizeAttributeValue(attribute, raw, pageUrl) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '';
  if (shouldResolveAttributeAsUrl(attribute, value)) {
    return resolveAttrUrl(value, pageUrl) ?? value;
  }
  return value;
}
