'use client';

/**
 * An atom's wordings, one tab per language (Bölüm 37.6).
 *
 * Variants come back primary-first, and the primary is the wording used when
 * nothing more specific is asked for. Promoting one demotes the other
 * server-side, which is why `usePatchVariant` refetches on that write instead
 * of merging the response.
 *
 * **⚠️ `stale` is shown and cannot be acted on.** Bölüm 37.6 draws two
 * buttons next to a stale wording — regenerate, or keep mine — and Stage 1
 * publishes no endpoint for either. Rendering a "Regenerate" button that
 * cannot work would be worse than not having one, so the badge says what is
 * true and stops there. See `DOC-SYNC-REQUEST.md`.
 */

import { Tabs } from 'radix-ui';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Variant } from '@/lib/api/endpoints/profile';

export type VariantTabsProps = {
  variants: Variant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
  /** Resends the wording with `primary: true`. See the note in the editor. */
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

  // Rule 9: a language code is not a language name, and the name belongs in
  // the reader's language rather than in its own — "Turkish" for an English
  // interface, "Türkçe" for a Turkish one, from one source either way.
  const languageName = (code: string) => {
    if (!code) return t('unknownLanguage');
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  };

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
            <span>{labelFor(variant, languageName)}</span>

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
          {variant.stale && (
            <p role="status" className="text-muted-foreground pb-2 text-xs">
              {t('staleExplained')}
            </p>
          )}

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
