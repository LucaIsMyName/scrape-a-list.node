/**
 * Whether the CLI may scrape private/local network targets.
 * Default: allowed (backward compatible). Set ALLOW_PRIVATE_NETWORK_TARGETS=false to block.
 * Pass allowPrivate=true from --allow-private to force allow for one run.
 *
 * @param {{ allowPrivate?: boolean }} [cliOptions]
 */
export function resolveCliAllowPrivateNetwork(cliOptions = {}) {
  if (cliOptions.allowPrivate === true) return true;
  if (cliOptions.allowPrivate === false) return false;
  const env = process.env.ALLOW_PRIVATE_NETWORK_TARGETS;
  if (env === 'false') return false;
  if (env === 'true') return true;
  return true;
}
