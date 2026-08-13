import { notFound } from 'next/navigation';
import { MockHarness } from './MockHarness';

/**
 * Development-only route. It does not exist in a production build, so it can
 * never become accidental product surface — Bölüm 51.5 asks the same of the
 * backend's dev endpoints.
 *
 * XI-B.3 has no `dev/` folder. This is a deliberate addition: without a route
 * under `(app)`, the shell, the providers and the mock worker never mount,
 * and nothing could verify them.
 */
export default function MockHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <MockHarness />;
}
