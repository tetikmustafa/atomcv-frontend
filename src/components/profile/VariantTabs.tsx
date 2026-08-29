'use client';

/**
 * An atom's wordings, one tab per language (Bölüm 37.6).
 *
 * Variants come back primary-first, and the primary is the wording used when
 * nothing more specific is asked for. Promoting one demotes the other
 * server-side, which is why `usePatchVariant` refetches on that write instead
 * of merging the response.
 *
 * **The badge is all this draws about staleness.** What to *do* about an
 * out-of-date wording depends on who wrote it (§ 32.2's pair), and that
 * belongs to the wording rather than to the tab strip — `StaleWording`, next
 * to the field, so an atom with a single wording says it too.
 */

import { Tabs } from 'radix-ui';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { languageName } from '@/lib/i18n/languageNames';
import type { Variant } from '@/lib/api/endpoints/profile';

export type VariantTabsProps = {
  variants: Variant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
  /** Sends `{ primary: true }` and nothing else. See the note in the editor. */
  onPromote: (variant: Variant) => void;
  children: (variant: Variant) => React.ReactNode;
};

function labelFor(variant: Variant, languageName: (code: string) => string): string {
  const language = languageName(variant.language ?? '');
  return variant.tone ? `${language} · ${variant.tone}` : language;
}

export function VariantTabs({
  variants,
  selectedId,
  onSelect,
  onPromote,
  children,
}: VariantTabsProps) {
  const t = useTranslations('Editor.variants');
  const locale = useLocale();

  // Rule 9, and the rule itself lives in `languageNames` now that the result
  // screen needs it too. Only the sentence for "no language at all" is ours:
  // the helper returns `undefined` there rather than inventing one.
  const nameOf = (code: string) => languageName(code, locale) ?? t('unknownLanguage');

  const selected = variants.find((variant) => variant.id === selectedId);

  return (
    <Tabs.Root value={selectedId} onValueChange={onSelect}>
      <Tabs.List aria-label={t('listLabel')} className="flex flex-wrap gap-1">
        {variants.map((variant) => (
          <Tabs.Trigger
            key={variant.id}
            value={variant.id!}
            className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm outline-none focus-visible:ring-3"
          >
            <span>{labelFor(variant, nameOf)}</span>

            {variant.primary && (
              <span className="text-muted-foreground text-xs">{t('primary')}</span>
            )}

            {/*
              Not a colour dot. A wording being out of date is the reason a CV
              would go out with the wrong sentence in it, so it says so in
              words (rule 6).
            */}
            {variant.stale && <span className="text-destructive text-xs">{t('staleBadge')}</span>}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {variants.map((variant) => (
        <Tabs.Content key={variant.id} value={variant.id!} className="pt-3">
          {children(variant)}
        </Tabs.Content>
      ))}

      {selected && !selected.primary && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 self-start"
          onClick={() => onPromote(selected)}
        >
          {t('makePrimary')}
        </Button>
      )}
    </Tabs.Root>
  );
}
