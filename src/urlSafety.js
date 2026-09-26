import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const PRIVATE_IPV4_RANGES = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
];

function unsafeUrlError(message) {
  const error = new Error(message);
  error.code = 'ERR_UNSAFE_URL';
  return error;
}

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

function mappedIpv4(hostname) {
  if (isIP(hostname) !== 6) return null;
  const lower = hostname.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function isPrivateIPv6(hostname) {
  if (isIP(hostname) !== 6) return false;
  const mapped = mappedIpv4(hostname);
  if (mapped) return isPrivateIPv4(mapped);
  const normalized = hostname.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return /^fe[89ab][0-9a-f]:/.test(normalized);
}

function unwrapHostname(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function isBlockedHostname(hostname) {
  const normalized = unwrapHostname(hostname);
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    isPrivateIPv4(normalized) ||
    isPrivateIPv6(normalized)
  );
}

/**
 * Validate URL safety policy before performing outbound requests.
 * Private and local targets are rejected unless allowPrivateNetwork is true.
 *
 * @param {string} urlString
 * @param {{allowPrivateNetwork?: boolean}} [options]
 * @returns {URL}
 */
export function validateTargetUrl(urlString, options = {}) {
  const { allowPrivateNetwork = false } = options;
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw unsafeUrlError('Invalid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw unsafeUrlError('Only http/https URLs are supported.');
  }
  if (!allowPrivateNetwork && isBlockedHostname(url.hostname)) {
    throw unsafeUrlError('Target URL points to a private or local network address.');
  }
  return url;
}

/**
 * DNS lookup that rejects addresses on private or local networks.
 * Returned records are safe to pass to axios as a custom lookup.
 *
 * @param {typeof lookup} [dnsLookup]
 */
export function createPublicLookup(dnsLookup = lookup) {
  return async function publicLookup(hostname) {
    if (isIP(hostname)) {
      if (isBlockedHostname(hostname)) {
        throw unsafeUrlError('Target URL resolves to a private or local network address.');
      }
      return [{ address: hostname, family: isIP(hostname) }];
    }

    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    if (!Array.isArray(records) || records.length === 0) {
      const error = new Error(`No addresses found for ${hostname}`);
      error.code = 'ENOTFOUND';
      throw error;
    }
    for (const record of records) {
      if (isBlockedHostname(record.address)) {
        throw unsafeUrlError('Target URL resolves to a private or local network address.');
      }
    }
    return records;
  };
}
