/**
 * An `EventSource` for jsdom, which ships none.
 *
 * It is a real client rather than a stub: it fetches the URL and parses the
 * frames, so the tests that use it run against **the same MSW handlers** as
 * the browser and Playwright. A hand-fed fake would only ever prove that the
 * hook can read the frames the test wrote for it.
 *
 * What it deliberately does not implement is reconnection. The real one
 * retries on its own, and the hook's whole job at that moment is to close it
 * and reconcile through `GET /jobs/{id}`; a double that reconnected would
 * hide the case rather than exercise it.
 */

/** Set by `dropStreamAfter`: how many frames to deliver before failing. */
let dropAfter: number | null = null;

/**
 * Makes the next stream fail after `frames` frames, the way a proxy that
 * times out or a worker that dies would leave it: no terminal event, no
 * explanation, just a stream that stops.
 */
export function dropStreamAfter(frames: number) {
  dropAfter = frames;
}

export function resetEventSource() {
  dropAfter = null;
}

class TestEventSource extends EventTarget {
  readonly url: string;
  onerror: ((event: Event) => void) | null = null;

  private readonly controller = new AbortController();
  private closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    void this.run();
  }

  close() {
    this.closed = true;
    this.controller.abort();
  }

  private fail() {
    if (this.closed) return;
    this.close();
    this.onerror?.(new Event('error'));
  }

  private async run() {
    let response: Response;

    try {
      response = await fetch(this.url, {
        headers: { Accept: 'text/event-stream' },
        signal: this.controller.signal,
      });
    } catch {
      this.fail();
      return;
    }

    if (!response.ok || !response.body) {
      this.fail();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let delivered = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let split = buffer.indexOf('\n\n');
        while (split !== -1) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);

          if (this.closed) return;

          if (dropAfter !== null && delivered >= dropAfter) {
            dropAfter = null;
            this.fail();
            return;
          }

          this.dispatch(block);
          delivered += 1;
          split = buffer.indexOf('\n\n');
        }
      }
    } catch {
      this.fail();
      return;
    }

    // A stream that ended without a terminal event is indistinguishable from
    // a stuck generation, and the real `EventSource` reports the closed
    // connection the same way.
    this.fail();
  }

  private dispatch(block: string) {
    const fields: Record<string, string> = {};

    for (const line of block.split('\n')) {
      const at = line.indexOf(':');
      if (at === -1) continue;
      fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }

    const type = fields.event ?? 'message';
    const event = new MessageEvent<string>(type, { data: fields.data ?? '' });

    this.dispatchEvent(event);
  }
}

export function installEventSource() {
  (globalThis as { EventSource?: unknown }).EventSource = TestEventSource;
}
