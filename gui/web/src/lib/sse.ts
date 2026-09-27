import type { SseEvent } from './types';

export function openScrapeEvents(
  jobId: string,
  handlers: {
    onEvent: (event: SseEvent) => void;
    onConnectionLost: () => void;
  },
): () => void {
  const source = new EventSource(`/api/scrape/events/${encodeURIComponent(jobId)}`);
  let closedReason: string | null = null;

  source.onmessage = (message) => {
    let event: SseEvent;
    try {
      event = JSON.parse(message.data) as SseEvent;
    } catch {
      return;
    }
    if (
      event.type === 'done' ||
      event.type === 'error' ||
      event.type === 'cancelled'
    ) {
      closedReason = event.type;
      source.close();
    }
    handlers.onEvent(event);
  };

  source.onerror = () => {
    source.close();
    if (closedReason) return;
    handlers.onConnectionLost();
  };

  return () => {
    closedReason = closedReason || 'manual';
    source.close();
  };
}
