/**
 * Renders run/mark content.
 *
 * Marks are semantic, not stylistic (Bölüm 12.3, EK D.2) — the template
 * decides what `technology` looks like in a CV, and this is the editor's own
 * decision about what it looks like on screen. They are two different
 * questions with two different answers, which is the point of storing meaning
 * rather than formatting.
 *
 * A mark this build does not recognise renders as plain text and keeps its
 * name in `data-mark`. That is the display half of the invariant
 * `richContent.ts` enforces on the data half: a newer version's markup
 * survives being looked at, just as it survives being saved.
 */

import { isKnownMark, type Run } from '@/lib/content/richContent';

const MARK_CLASS: Record<string, string> = {
  technology: 'font-medium text-foreground',
  metric: 'font-semibold text-foreground',
  emphasis: 'italic',
  organization: 'font-medium',
  link: 'underline underline-offset-2',
};

function classesFor(marks: string[]): string {
  return marks
    .filter(isKnownMark)
    .map((mark) => MARK_CLASS[mark] ?? '')
    .join(' ');
}

export function RichText({ runs }: { runs: Run[] }) {
  return (
    <span>
      {runs.map((run, index) => {
        const className = classesFor(run.m);
        // Only `link` runs carry an href, and they always do — the invariant
        // is enforced on the way in, so this needs no fallback.
        const content = run.href ? (
          <a href={run.href} className={className}>
            {run.t}
          </a>
        ) : (
          <span className={className}>{run.t}</span>
        );

        return (
          // Index keys: runs have no ids, and this list is replaced whole on
          // every edit rather than reordered.
          <span key={index} data-mark={run.m.join(' ') || undefined}>
            {content}
          </span>
        );
      })}
    </span>
  );
}
