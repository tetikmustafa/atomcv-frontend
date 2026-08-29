'use client';

/**
 * Cloudflare Turnstile, on the one form that asks for it (§ 40.5.1).
 *
 * The challenge sits in front of the per-address rate limiter on purpose, and
 * the ordering is the interesting part: that limiter fills after three
 * requests, so a limiter reachable without proving you are a person would be
 * a way to **lock a stranger out of their own account**. Turnstile is what
 * makes that cost something.
 *
 * **A deployment without a site key draws nothing**, and that is the
 * documented local case: without a secret the server has the challenge
 * switched off and lets the request through (`B-050`). It is a convenience,
 * not a contract — in production an empty `challengeToken` is a `403` — which
 * is why the widget is wired from the start rather than added later.
 *
 * **Resetting is the caller's job, by remounting.** The token is single-use,
 * so resending a spent one earns the same `403` again; the form gives this a
 * `key` it bumps on refusal, which is a reset with no imperative handle to
 * get out of step with the render.
 */

import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';

/**
 * Public by design — it identifies the widget, and Cloudflare expects it in
 * the page. The secret is the server's and never reaches here.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Only the corner of the API this file touches. */
type Turnstile = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
    },
  ) => string | undefined;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export type TurnstileWidgetProps = {
  /**
   * Called with the token, or with `undefined` whenever there is no longer a
   * usable one — the widget errored, or the token expired sitting on screen
   * while the reader typed. Sending an expired token is a refusal the form
   * can avoid by knowing it has none.
   */
  onToken: (token: string | undefined) => void;
};

export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string>(undefined);

  // Through a ref so `render` does not have to change when the parent
  // re-renders: a new callback identity would tear down and rebuild the
  // widget, and a challenge that restarts on every keystroke is one nobody
  // can finish. Kept in sync from an effect rather than during render —
  // writing a ref while rendering is the kind of update React is allowed to
  // throw away, and `react-hooks/refs` says so.
  const notify = useRef(onToken);
  useEffect(() => {
    notify.current = onToken;
  }, [onToken]);

  const render = useCallback(() => {
    if (!SITE_KEY || !container.current || widgetId.current || !window.turnstile) return;

    widgetId.current = window.turnstile.render(container.current, {
      sitekey: SITE_KEY,
      // The challenge speaks the language the rest of the page does. It is a
      // control the reader has to understand, not decoration.
      language: locale,
      callback: (token) => notify.current(token),
      'error-callback': () => notify.current(undefined),
      'expired-callback': () => notify.current(undefined),
    });
  }, [locale]);

  useEffect(() => {
    // Covers the second mount, when the script is already loaded and
    // `onReady` has nothing left to announce.
    render();

    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [render]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={container} data-testid="turnstile" />
    </>
  );
}
