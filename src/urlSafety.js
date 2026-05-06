import { isIP } from 'node:net';

const PRIVATE_IPV4_RANGES = [
  ['10.0.0.0', '10.255.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
];

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(hostname) {
  if (isIP(hostname) !== 4) return false;
  const value = ipv4ToInt(hostname);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => {
    const from = ipv4ToInt(start);
    const to = ipv4ToInt(end);
    return value >= from && value <= to;
  });
}

function isPrivateIPv6(hostname) {
  if (isIP(hostname) !== 6) return false;
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

function isBlockedHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    isPrivateIPv4(normalized) ||
    isPrivateIPv6(normalized)
  );
}

/**
 * Validate URL safety policy before performing outbound requests.
 *
 * @param {string} urlString
 * @param {{allowPrivateNetwork?: boolean}} [options]
 * @returns {URL}
 */
export function validateTargetUrl(urlString, options = {}) {
  const { allowPrivateNetwork = true } = options;
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are supported.');
  }
  if (!allowPrivateNetwork && isBlockedHostname(url.hostname)) {
    throw new Error('Target URL points to a private or local network address.');
  }
  return url;
}
