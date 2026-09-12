/**
 * WCAG contrast over the palette's own colour space.
 *
 * **This exists because axe cannot see the palette.** Every token in
 * `globals.css` is `oklch`, and Tailwind's alpha modifiers compile to
 * `oklab(… / 0.2)`. Measured against the running dev server: axe's
 * colour-contrast rule reports a node with such a background as **neither a
 * violation nor incomplete** — it drops it. So `bg-destructive/20` with
 * `text-destructive`, which is 3.16:1 and fails AA outright, passes the sweep
 * in silence.
 *
 * The browser sweep still earns its place — it is what catches composition,
 * covered elements and the pairs nobody thought to list. This covers the one
 * thing it cannot: the palette itself, including the states a sweep never
 * visits, like hover.
 *
 * The conversion is the standard OKLab matrix pair, and it is verified
 * against a number axe produced itself (see the test's first case).
 */

export type Rgb = [number, number, number];

/** oklch to **linear** sRGB, clamped to the gamut. */
export function oklch(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(1, Math.max(0, channel))) as Rgb;
}

/** What a browser paints for `bg-x/alpha`: `fg` composited over `bg`. */
export function over(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((channel, index) => channel * alpha + bg[index]! * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The `oklch(...)` custom properties declared under one selector.
 *
 * Read out of the stylesheet rather than restated here, so a token edited in
 * `globals.css` is measured as edited. A value that is not a plain `oklch()`
 * triple — `oklch(1 0 0 / 10%)`, which `--border` uses — is skipped: it is not
 * a text colour and compositing it needs to know what is behind it.
 */
export function tokensIn(css: string, selector: string): Record<string, Rgb> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in the stylesheet`);

  const block = css.slice(start, css.indexOf('\n}', start));
  const declarations = block.matchAll(/--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)\s*;/g);

  return Object.fromEntries(
    [...declarations].map(([, name, L, C, h]) => [name, oklch(Number(L), Number(C), Number(h))]),
  );
}

/** WCAG AA for normal text. Large text is 3:1, and nothing here relies on it. */
export const AA = 4.5;
