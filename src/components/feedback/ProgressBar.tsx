/**
 * A bar, and the accessible description of what it is showing.
 *
 * Extracted when profile import became the second thing with a job to wait
 * on. Only the markup and the ARIA are shared: **what** to announce is the
 * caller's, because a live region that says "reading your CV" during a
 * generation is worse than two copies of four attributes.
 *
 * `aria-valuetext` rather than a second live region, deliberately. The caller
 * announces phase changes; a screen reader that also read the bar's caption
 * would say every step twice.
 */
export type ProgressBarProps = {
  /** 0-100. */
  pct: number;
  /** What the bar is measuring, for a reader who cannot see it. */
  label: string;
  /** Where it has got to, in words. */
  valueText: string;
};

export function ProgressBar({ pct, label, valueText }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className="bg-primary h-full transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
