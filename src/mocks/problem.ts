import type { ProblemDetail } from '@/types/domain';

/**
 * An RFC 7807 body in the shape the real API sends.
 *
 * Shared by every mock so the envelope cannot drift between two copies:
 * `type` is relative, `params` and `resolutions` are **absent** rather than
 * empty when a code declares none, and `title` is the developer-facing
 * string the client is required to ignore (§ 35.4).
 */
export function problem(
  status: number,
  code: string,
  instance: string,
  resolutions: ProblemDetail['resolutions'] = [],
  params?: Record<string, unknown>,
): ProblemDetail {
  return {
    type: `/errors/${code.toLowerCase().replaceAll('_', '-')}`,
    title: code,
    status,
    instance,
    code,
    ...(params ? { params } : {}),
    ...(resolutions.length ? { resolutions } : {}),
  };
}
