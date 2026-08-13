import type { ProblemDetail, Resolution } from '@/types/domain';

/**
 * A failed API call. Carries everything the error UI needs: a translation key
 * (`code`), its interpolation values (`params`), and the ways out
 * (`resolutions`), which render as buttons.
 *
 * The same shape arrives over two transports — a synchronous 4xx body for
 * preflight failures, and the SSE `failed` event once a job is running
 * (Bölüm 30.6, 35.3). Both go through here so there is one error renderer.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly params: Record<string, unknown>;
  readonly resolutions: Resolution[];

  constructor(problem: ProblemDetail) {
    // `title` is for developers reading logs; users never see this string.
    super(problem.title ?? problem.code);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.params = problem.params ?? {};
    this.resolutions = problem.resolutions ?? [];
  }

  /** The next-intl key holding this error's user-facing message. */
  get translationKey(): string {
    return `errors.${this.code}`;
  }
}

/**
 * The request never reached the server, or the response was unreadable.
 * Distinct from ApiError because there is no `code` to translate and no
 * resolution to offer — only "try again".
 */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('The request could not be completed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.status === 'number';
}

/**
 * Turns a failed response into an ApiError.
 *
 * A server that returns an unexpected body still has to produce a usable
 * error, so anything unparseable falls back to a synthetic code. Throwing
 * here instead would replace a meaningful HTTP status with a parse error.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (isProblemDetail(body)) {
    // Trust the HTTP status over the body's, so a mismatch cannot make the
    // client branch on a status the server did not actually send.
    return new ApiError({ ...body, status: response.status });
  }

  return new ApiError({
    status: response.status,
    code: 'UNEXPECTED_ERROR',
    title: `Unexpected ${response.status} response`,
  });
}

/**
 * Whether retrying could plausibly produce a different answer.
 *
 * 4xx answers are deterministic — an insufficient profile stays insufficient,
 * a quota stays exceeded — so retrying only wastes the user's time. 408 and
 * 429 are the exceptions, but 429 is a quota decision the user must see
 * rather than something to paper over (Bölüm 44.1).
 */
export function isRetriable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (!isApiError(error)) return false;
  if (error.status === 408) return true;
  return error.status >= 500;
}
