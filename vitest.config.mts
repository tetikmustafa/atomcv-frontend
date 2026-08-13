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
  },
});
