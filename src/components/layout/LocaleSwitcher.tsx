'use client';

/**
 * The interface language — the first of § 38.1's three axes, and the only one
 * this control touches.
 *
 * It had no control at all: next-intl read the browser's preference once and
 * the URL prefix kept it, so somebody whose browser said English and who
 * wanted Turkish had to edit the address bar. The content language (what a
 * profile is written in) and the output language (what a CV is printed in)
 * are elsewhere and unaffected — switching this re-labels the screen and
 * nothing else.
 *
 * A native select, for the reason `ThemeToggle` gives: a cycling button never
 * says what the next press does. The query string is kept, so a review screen
 * with `?job=` reopens on the same job.
 */

import { useId, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NativeSelect } from '@/components/ui/native-select';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { locales, type Locale } from '@/lib/i18n/locales';

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('Locale');
  const id = useId();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    const search = typeof window === 'undefined' ? '' : window.location.search;
    startTransition(() => router.replace(`${pathname}${search}`, { locale: next }));
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {t('label')}
      </label>
      <NativeSelect
        id={id}
        value={locale}
        disabled={pending}
        onChange={(event) => choose(event.target.value as Locale)}
        className="sm:w-full"
      >
        {locales.map((option) => (
          // Each language in its own name, so somebody who cannot read the
          // current one can still find theirs.
          <option key={option} value={option} lang={option}>
            {t(`names.${option}`)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
