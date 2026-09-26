/**
 * Sleep for ms, rejecting early if signal aborts.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
export async function sleep(ms, signal) {
  if (!(ms > 0)) return;
  await new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const aborted = new Error('Request aborted');
      aborted.name = 'AbortError';
      aborted.code = 'ERR_CANCELED';
      reject(aborted);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const aborted = new Error('Request aborted');
      aborted.name = 'AbortError';
      aborted.code = 'ERR_CANCELED';
      reject(aborted);
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}
