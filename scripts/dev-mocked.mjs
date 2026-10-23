// `next dev` against the MSW handlers on port 3200, whatever `.env.local` says.
//
// The e2e suite does the same on 3100 through Playwright's `webServer.env`;
// this is that for a person (or a preview pane) looking at the screens without
// a backend. The process environment outranks `.env.local` in Next's loader,
// so the flag here wins over a `disabled` written there.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The repository root, wherever this was started from.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const child = spawn('npx', ['next', 'dev', '--port', '3200'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_API_MOCKING: 'enabled' },
});

child.on('exit', (code) => process.exit(code ?? 0));
