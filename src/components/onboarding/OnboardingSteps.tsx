'use client';

/**
 * Where the reader is in the first-run path: upload, read, review, first
 * resume — concept § 9's "value first, effort later", drawn.
 *
 * A list with `aria-current="step"` on the one in progress, and each step's
 * state in words beside its number (rule 6): a filled circle is a picture of
 * "done", and the sentence is what a screen reader hears.
 */

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['upload', 'read', 'review', 'generate'] as const;

export type OnboardingStep = (typeof STEPS)[number];

export function OnboardingSteps({ current }: { current: OnboardingStep }) {
  const t = useTranslations('Onboarding');
  const at = STEPS.indexOf(current);

  return (
    <nav aria-label={t('stepsLabel')}>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((step, index) => {
          const state = index < at ? 'done' : index === at ? 'current' : 'todo';

          return (
            <li
              key={step}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex flex-col gap-2"
            >
              <span
                aria-hidden="true"
                className={cn('h-1 rounded-full', state === 'todo' ? 'bg-muted' : 'bg-primary')}
              />
              <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                    state === 'done' && 'bg-primary text-primary-foreground border-transparent',
                    state === 'current' && 'border-foreground',
                    state === 'todo' && 'text-muted-foreground',
                  )}
                >
                  {state === 'done' ? <Check className="size-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'truncate',
                    state === 'todo' ? 'text-muted-foreground' : 'font-medium',
                  )}
                >
                  {t(`steps.${step}`)}
                </span>
                <span className="sr-only">({t('stepState', { state })})</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
