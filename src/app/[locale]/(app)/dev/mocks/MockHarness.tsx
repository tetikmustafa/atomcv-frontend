'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { JobAccepted, SessionResponse } from '@/mocks/contracts';
import { announce } from '@/stores/announcerStore';

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
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionResponse>('/auth/session'),
  });

  useEffect(() => {
    if (!streamUrl) return;

    const source = new EventSource(streamUrl);
    sourceRef.current = source;

    source.addEventListener('phase', (event) => {
      const phase = JSON.parse((event as MessageEvent<string>).data) as Phase;
      setPhases((current) => [...current, phase]);
      announce(`${phase.label}, ${phase.pct} percent`);
    });

    source.addEventListener('completed', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { generationId: string };
      setCompleted(payload.generationId);
      announce('Generation complete');
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
    const job = await api.post<JobAccepted>('/generations', {
      jobDescription: 'Senior Backend Engineer',
      options: { maxPages: 1 },
    });
    setStreamUrl(job.streamUrl);
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
            <dt>maxAtoms</dt>
            <dd data-testid="max-atoms">{session.data.capabilities.maxAtoms}</dd>
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
          {phases.map((phase) => (
            <li key={phase.phase} data-testid="phase">
              {phase.phase} — {phase.label} ({phase.pct}%)
            </li>
          ))}
        </ol>
        {completed && <p data-testid="completed">completed: {completed}</p>}
      </section>
    </div>
  );
}
