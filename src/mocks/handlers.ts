import { http, HttpResponse } from 'msw';
import type { ProblemDetail } from '@/types/domain';
import type { Capabilities, JobAccepted, SessionResponse } from './contracts';
import { profileHandlers } from './profileHandlers';

/**
 * Mock API surface. One set of handlers, shared by the browser worker, Vitest
 * and Playwright — so a behaviour verified in a test is the same one seen in
 * the browser.
 *
 * These encode *behaviour*, not sample payloads. The point is to exercise the
 * paths that are easy to get wrong: capability-gated UI, a preflight error
 * that arrives with resolutions, and a job whose progress streams in.
 *
 * Paths use a `*` origin prefix so the same handler matches a relative request
 * in the browser and an absolute one under Node.
 */

/** Bölüm 9 (Aşama 0): narrower in scope, never lower in quality. */
const ANONYMOUS_CAPABILITIES: Capabilities = {
  allowedLanguages: ['en'],
  allowedTemplates: ['classic', 'modern', 'compact'],
  canCustomizeTemplate: false,
  canEditAtomControls: false,
  canAddAlternatives: false,
  canSaveHistory: false,
  dailyGenerationQuota: 5,
  generationsUsedToday: 0,
  dailyProfileQuota: 3,
  profilesUsedToday: 0,
  maxAtoms: 60,
};

type GenerationRequest = {
  jobDescription?: string;
  directives?: { includeAtoms?: string[] };
  options?: { maxPages?: number };
};

const PIPELINE_PHASES = [
  { phase: 'A', label: 'Analysing the posting', pct: 15 },
  { phase: 'B', label: 'Scoring your content', pct: 35 },
  { phase: 'C', label: 'Fitting the page budget', pct: 50 },
  { phase: 'D', label: 'Adapting wording', pct: 70, detail: '4/7' },
  { phase: 'E', label: 'Rendering', pct: 85 },
  { phase: 'F', label: 'Verifying', pct: 95 },
];

function sseFrame(event: string, data: unknown, id: number) {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const handlers = [
  // Stage 1, typed from the generated schema. Kept in their own file because
  // they carry state — versions that move — and the rest of this file does not.
  ...profileHandlers,

  /**
   * Anonymous by default. The UI must gate itself on this object rather than
   * on hardcoded assumptions about what anonymous users can do.
   */
  http.get('*/api/v1/auth/session', () =>
    HttpResponse.json<SessionResponse>({
      authenticated: false,
      capabilities: ANONYMOUS_CAPABILITIES,
    }),
  ),

  /**
   * Preflight runs synchronously: an impossible request is refused before a
   * job is queued, so no cost is incurred (Bölüm 35.3, P5).
   *
   * The conflict is modelled on the real rule rather than a magic string —
   * more pinned content than a one-page budget can hold (Bölüm 11.4).
   */
  http.post('*/api/v1/generations', async ({ request }) => {
    const body = (await request.json()) as GenerationRequest;
    const pinned = body.directives?.includeAtoms?.length ?? 0;
    const maxPages = body.options?.maxPages ?? 1;

    if (pinned > 3 * maxPages) {
      // Annotated on the way in rather than at HttpResponse.json, which infers
      // the resolver's whole body type from its first call and would then
      // reject the 202 below.
      const problem: ProblemDetail = {
        // Relative, as D.9 · 12 settled it. An absolute URL here would let
        // the mock train the client on a shape the server does not send.
        type: '/errors/conflicting-preferences',
        title: 'Pinned content exceeds the page limit',
        status: 409,
        instance: '/api/v1/generations',
        code: 'CONFLICTING_PREFERENCES',
        params: { pinnedPages: 2.3, maxPages },
        resolutions: [
          { action: 'increase_page_limit', params: { maxPages: 3 } },
          { action: 'review_pins' },
          { action: 'keep_top_pinned', params: { keep: 3 } },
        ],
      };

      return HttpResponse.json(problem, { status: 409 });
    }

    return HttpResponse.json<JobAccepted>(
      {
        jobId: 'job-1',
        status: 'queued',
        streamUrl: '/api/v1/jobs/job-1/stream',
      },
      { status: 202, headers: { Location: '/api/v1/jobs/job-1' } },
    );
  }),

  /**
   * Progress stream. Frames carry an `id` so a reconnect can resume, which
   * EK D.6 accepted for Stage 2 in exactly this shape. The endpoint is not in
   * the published schema yet, so the mock is the only place it exists.
   */
  http.get('*/api/v1/jobs/:jobId/stream', () => {
    const encoder = new TextEncoder();
    let index = 0;

    const stream = new ReadableStream({
      pull(controller) {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const phase = PIPELINE_PHASES[index];

            if (phase) {
              controller.enqueue(encoder.encode(sseFrame('phase', phase, index)));
              index += 1;
            } else {
              controller.enqueue(
                encoder.encode(
                  sseFrame(
                    'completed',
                    { generationId: 'gen-1', pageCount: 1, matchLevel: 'STRONG' },
                    index,
                  ),
                ),
              );
              controller.close();
            }

            resolve();
          }, 400);
        });
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),

  /**
   * Polling fallback, so a dropped stream reconciles with one request instead
   * of leaving a spinner running forever.
   */
  http.get('*/api/v1/jobs/:jobId', ({ params }) =>
    HttpResponse.json({
      jobId: params.jobId,
      status: 'completed',
      generationId: 'gen-1',
    }),
  ),
];
