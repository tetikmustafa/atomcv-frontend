import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolves the `@/*` alias from tsconfig. Native since Vite 7 — the
    // vite-tsconfig-paths plugin is no longer needed.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Playwright owns tests/e2e; running those here would try to start a
    // browser inside jsdom.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    /**
     * The unit suite describes a **configured** deployment.
     *
     * `TurnstileWidget` reads its site key at module scope and draws nothing
     * without one, which is the correct behaviour for a deployment whose
     * backend has no Turnstile secret (`B-050`) — and is also the shape the
     * dev server and the e2e suite run in. Without a key here, the challenge
     * would be untestable in the one place it can be tested cheaply: whether
     * a refusal actually resets the widget.
     *
     * Cloudflare's own always-passing test key, so the value is not a secret
     * and not a fiction. Nothing loads their script in jsdom, so the widget
     * renders its container and nothing else.
     */
    env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' },
  },
});
