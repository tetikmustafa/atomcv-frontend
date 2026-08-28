'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { getSession } from '@/lib/api/endpoints/auth';
import type { components } from '@/types/api';
import { announce } from '@/stores/announcerStore';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];

/**
 * The wire payload, rendered raw. `label` is a translation key rather than a
 * sentence (`B-038`) and the first frame is a snapshot carrying empty
 * strings (`F-010`) — this page exists to show what actually arrives, so it
 * resolves neither.
 */
type Phase = { phase: string; label: string; pct: number };

/**
 * Development harness for the Stage 0 plumbing.
 *
 * Its purpose is verification, not product surface: it is the only place
 * where the app shell, the providers, the mock worker, the API client and an
 * `EventSource` all mount together. Everything under `(app)` was otherwise
 * unexercised, and the open question of whether MSW's service worker can feed
 * a browser `EventSource` (Bölüm 36.4) had no way to be answered.
 */
export function MockHarness() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [completed, setCompleted] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const session = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
  });

  useEffect(() => {
    if (!streamUrl) return;

    const source = new EventSource(streamUrl);
    sourceRef.current = source;

    source.addEventListener('phase', (event) => {
      const phase = JSON.parse((event as MessageEvent<string>).data) as Phase;
      setPhases((current) => [...current, phase]);
      announce(`${phase.label || 'queued'}, ${phase.pct} percent`);
    });

    source.addEventListener('completed', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { generationId: string };
      setCompleted(payload.generationId);
      announce('Generation complete');
      source.close();
    });

    // A job can end either way, and a stream that only listens for success
    // leaves a failed one spinning forever.
    source.addEventListener('failed', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { code: string };
      setFailed(payload.code);
      announce('Generation failed', 'assertive');
      source.close();
    });

    source.onerror = () => {
      announce('Progress stream failed', 'assertive');
      source.close();
    };

    return () => source.close();
  }, [streamUrl]);

  async function startJob() {
    setPhases([]);
    setCompleted(null);
    setFailed(null);
    // No `jobDescription`: its absence is general mode (§ 35.3), which is the
    // shortest accepted request and keeps this page about the plumbing rather
    // than about the preflight.
    const job = await api.post<AcceptedJob>('/generations', { acknowledgePreflight: false });
    setStreamUrl(job.streamUrl ?? null);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-8 py-12">
      <section aria-labelledby="session-heading" className="flex flex-col gap-2">
        <h2 id="session-heading" className="text-xl font-medium">
          Session
        </h2>
        {session.isPending && <p>Loading…</p>}
        {session.data && (
          <dl data-testid="capabilities" className="grid grid-cols-2 gap-x-4 text-sm">
            <dt>authenticated</dt>
            <dd data-testid="authenticated">{String(session.data.authenticated)}</dd>
            <dt>allowedLanguages</dt>
            <dd data-testid="allowed-languages">
              {session.data.capabilities.allowedLanguages.join(', ')}
            </dd>
            {/*
              Both printed as they arrive, `undefined` included: in an account
              neither key is in the JSON at all (§ 35.7), and this page exists
              to show what the wire actually carries rather than a tidied
              version of it.
            */}
            <dt>maxAtoms</dt>
            <dd data-testid="max-atoms">{String(session.data.capabilities.maxAtoms)}</dd>
            <dt>anonymousExpiresAt</dt>
            <dd data-testid="anonymous-expires-at">
              {String(session.data.capabilities.anonymousExpiresAt)}
            </dd>
          </dl>
        )}
      </section>

      <section aria-labelledby="stream-heading" className="flex flex-col gap-3">
        <h2 id="stream-heading" className="text-xl font-medium">
          Progress stream
        </h2>
        <button
          type="button"
          onClick={startJob}
          data-testid="start-job"
          className="border-border hover:bg-muted w-fit rounded-md border px-4 py-2"
        >
          Start a job
        </button>
        <ol data-testid="phases" className="flex flex-col gap-1 text-sm">
          {phases.map((phase, index) => (
            // Indexed because `phase` is not a key: the snapshot carries an
            // empty one and `B` arrives twice, once measuring and once scoring.
            <li key={index} data-testid="phase">
              {phase.phase || '—'} {phase.label || '(queued)'} ({phase.pct}%)
            </li>
          ))}
        </ol>
        {completed && <p data-testid="completed">completed: {completed}</p>}
        {failed && <p data-testid="failed">failed: {failed}</p>}
      </section>
    </div>
  );
}
