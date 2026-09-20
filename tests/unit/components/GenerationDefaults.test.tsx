import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { GenerationDefaults } from '@/components/settings/GenerationDefaults';
import { fixture } from '@/mocks/profileFixture';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';

let client: QueryClient;

function wrapperFor(locale: 'en') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={en} formats={formats}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  };
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

async function save() {
  await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
}

/**
 * The seed profile may be rendered in English alone, which is the state the
 * chooser is deliberately absent in. A test about the chooser has to say so
 * rather than rely on a fixture that happens to have two.
 */
function enableTwoLanguages() {
  fixture.profile.enabledLanguages = ['en', 'tr'];
}

/**
 * The three preferences that were on the wire with nothing to set them, and
 * the writing style that was only ever preserved.
 */
describe('what every generation starts from', () => {
  /**
   * § 38.1's third axis. The options are the profile's `enabledLanguages` —
   * the languages it may be *rendered* in — rather than
   * `capabilities.allowedLanguages`, which says what a profile may hold: a
   * chooser built from the second would offer a language this profile has no
   * wordings for.
   */
  it('offers the languages the profile can be rendered in, plus following the posting', async () => {
    signIn();
    enableTwoLanguages();

    render(<GenerationDefaults />, { wrapper: wrapperFor('en') });

    const select = await screen.findByLabelText('CV language');
    const offered = Array.from(select.querySelectorAll('option')).map((option) => option.value);

    expect(offered).toEqual(['auto', ...fixture.profile.enabledLanguages!]);
  });

  /**
   * An anonymous profile has exactly one language, so this is the ordinary
   * state rather than an edge case — and a select with one option asks a
   * question whose answer is already fixed.
   */
  it('draws no language chooser when there is only one language', async () => {
    signIn();
    fixture.profile.enabledLanguages = ['en'];

    render(<GenerationDefaults />, { wrapper: wrapperFor('en') });

    await screen.findByLabelText('Page limit');
    expect(screen.queryByLabelText('CV language')).not.toBeInTheDocument();
  });

  it('sends the page limit, the languages and the whole writing style', async () => {
    signIn();
    enableTwoLanguages();

    render(<GenerationDefaults />, { wrapper: wrapperFor('en') });

    const pages = await screen.findByLabelText('Page limit');
    await userEvent.clear(pages);
    await userEvent.type(pages, '2');

    await userEvent.selectOptions(screen.getByLabelText('CV language'), 'tr');
    await userEvent.click(screen.getByLabelText('Technical'));
    await userEvent.click(screen.getByLabelText('Keep sentences short'));
    await save();

    await waitFor(() => expect(fixture.profile.preferences?.defaults?.maxPages).toBe(2));

    expect(fixture.profile.preferences?.defaults?.cvLanguage).toBe('tr');
    expect(fixture.profile.preferences?.writingStyle?.tone).toBe('technical');
    expect(fixture.profile.preferences?.writingStyle?.conciseSentences).toBe(false);
  });

  /**
   * `PUT` replaces, and this screen owns none of the appearance. The merge
   * lives in `useReplacePreferences`; this is the screen it was written for,
   * so it is worth proving from here too.
   */
  it('leaves the appearance alone', async () => {
    signIn();
    fixture.profile.preferences = {
      ...fixture.profile.preferences,
      defaults: { ...fixture.profile.preferences?.defaults, templateId: 'modern' },
    };

    render(<GenerationDefaults />, { wrapper: wrapperFor('en') });
    await save();

    await waitFor(() => expect(fixture.profile.preferences?.defaults?.templateId).toBe('modern'));
  });

  /**
   * The other half of the replace rule: one screen owns all four writing
   * style fields, so an emptied box is a deletion rather than an omission to
   * be filled in from what was there.
   */
  it('clears the custom instructions when the box is emptied', async () => {
    signIn();
    fixture.profile.preferences = {
      ...fixture.profile.preferences,
      writingStyle: { tone: 'formal', customInstructions: 'Lead with leadership' },
    };

    render(<GenerationDefaults />, { wrapper: wrapperFor('en') });

    await userEvent.clear(await screen.findByLabelText('Anything else'));
    await save();

    await waitFor(() =>
      expect(fixture.profile.preferences?.writingStyle?.customInstructions).toBeUndefined(),
    );
  });

  /** The bound is the server's; this keeps the control from offering a value it refuses. */
  it('refuses to save a page limit outside the range', async () => {
    signIn();

    render(<GenerationDefaults />, { wrapper: wrapperFor('en') });

    const pages = await screen.findByLabelText('Page limit');
    await userEvent.clear(pages);
    await userEvent.type(pages, '40');

    expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 10');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('has no axe violations', async () => {
    signIn();

    const { container } = render(<GenerationDefaults />, { wrapper: wrapperFor('en') });
    await screen.findByLabelText('Page limit');

    expect(await axe(container)).toHaveNoViolations();
  });
});
