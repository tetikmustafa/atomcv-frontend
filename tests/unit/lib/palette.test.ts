import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AA, contrast, oklch, over, tokensIn, type Rgb } from '../../support/contrast';

const css = readFileSync('src/styles/globals.css', 'utf8');

const light = tokensIn(css, ':root');
const dark = tokensIn(css, '.dark');

/**
 * Every pair of colours the product actually paints text in, in both themes.
 *
 * **The axe sweep cannot do this.** The palette is `oklch` and Tailwind's
 * alpha modifiers compile to `oklab(… / α)`; measured against the running dev
 * server, axe's colour-contrast rule drops such a node entirely — not a
 * violation, not even incomplete. A button whose text sits at 3.16:1 passes
 * the sweep in silence. So the two checks are complementary rather than
 * redundant: the sweep reads composition in a browser, this reads the
 * palette.
 *
 * It also covers what a sweep can never reach: **hover**. A button that
 * clears AA at rest and fails the moment a pointer is over it is a real
 * failure and an unobservable one.
 *
 * Pairs are listed rather than derived. A generated cross-product would
 * measure combinations nothing renders and go red for a colour nobody paints
 * on another.
 */
type Pair = { name: string; fg: Rgb; bg: Rgb };

function pairs(tokens: Record<string, Rgb>, theme: 'light' | 'dark'): Pair[] {
  const t = (name: string) => {
    const value = tokens[name];
    if (!value) throw new Error(`No --${name} in the ${theme} palette`);
    return value;
  };

  const destructiveButton: Pair[] =
    theme === 'light'
      ? [
          // `bg-destructive/10 text-destructive`, and the hover that takes it
          // to /20.
          {
            name: 'destructive button',
            fg: t('destructive'),
            bg: over(t('destructive'), t('background'), 0.1),
          },
          {
            name: 'destructive button, hovered',
            fg: t('destructive'),
            bg: over(t('destructive'), t('background'), 0.2),
          },
        ]
      : [
          // Solid in dark, because red on a tint of itself over a near-black
          // page cannot reach AA at any lightness — the background is made of
          // the same colour as the text.
          { name: 'destructive button', fg: t('background'), bg: t('destructive') },
          {
            name: 'destructive button, hovered',
            fg: t('background'),
            bg: over(t('destructive'), t('background'), 0.9),
          },
        ];

  return [
    { name: 'body text', fg: t('foreground'), bg: t('background') },
    { name: 'body text on a card', fg: t('card-foreground'), bg: t('card') },
    { name: 'body text in a popover', fg: t('popover-foreground'), bg: t('popover') },
    // The secondary sentence, which is the one that fails first: it is a grey
    // and it is drawn on three different grounds.
    { name: 'secondary text', fg: t('muted-foreground'), bg: t('background') },
    { name: 'secondary text on a muted panel', fg: t('muted-foreground'), bg: t('muted') },
    { name: 'secondary text on a card', fg: t('muted-foreground'), bg: t('card') },
    { name: 'primary button', fg: t('primary-foreground'), bg: t('primary') },
    { name: 'secondary button', fg: t('secondary-foreground'), bg: t('secondary') },
    { name: 'accent', fg: t('accent-foreground'), bg: t('accent') },
    // Field errors and the error panel: destructive text on the page, and on
    // the panel's own faint tint.
    { name: 'error text', fg: t('destructive'), bg: t('background') },
    {
      name: 'error panel',
      fg: t('destructive'),
      bg: over(t('destructive'), t('background'), 0.05),
    },
    ...destructiveButton,
  ];
}

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('the %s palette', (theme, tokens) => {
  it.each(pairs(tokens, theme).map((pair) => [pair.name, pair] as const))(
    'clears AA for %s',
    (_name, pair) => {
      expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(AA);
    },
  );
});

/**
 * The conversion itself, against a number produced by something else.
 *
 * axe measured `#737373` on `#f5f5f5` at **4.34** in the browser, on the
 * stylesheet as it stood before the palette was corrected. If this maths
 * reproduces that, the numbers above mean what they say; if it drifts, every
 * assertion in this file is measuring the wrong thing and would go on
 * passing.
 */
describe('the conversion', () => {
  it('reproduces a ratio axe measured in a real browser', () => {
    const foreground = oklch(0.556, 0, 0); // shadcn's muted-foreground, #737373
    const background = oklch(0.97, 0, 0); // --muted, #f5f5f5

    expect(contrast(foreground, background)).toBeCloseTo(4.34, 2);
  });
});
