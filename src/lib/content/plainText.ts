import type { RichContent, Run } from './richContent';

/**
 * The text of a piece of content with all markup removed.
 *
 * This is what the server hashes into `content_hash` (EK D.2), which is why
 * re-marking a sentence leaves the hash — and the measured render costs —
 * alone. Anything here that asked "did this change enough to re-measure"
 * would have to compare hashes, not run structures, but the client does not
 * compute the hash: the server derives it on write.
 *
 * Use this for character counts, previews and search, never for rendering —
 * rendering is what marks exist for.
 */
export function plainText(content: RichContent | Run[]): string {
  const runs = Array.isArray(content) ? content : content.runs;
  return runs.map((run) => run.t).join('');
}
