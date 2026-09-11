import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvAppearance } from '@/components/settings/CvAppearance';
import { fixture } from '@/mocks/profileFixture';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => '/settings',
}));

let client: QueryClient;

function wrapperFor(locale: 'en' | 'tr') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={locale === 'en' ? en : tr}
        formats={formats}
      >
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

/**
 * The template and the five things about it (§ 33, `B-090`-`B-092`).
 *
 * What is worth pinning is not that a `PUT` goes out. It is the three places
 * this screen is easy to get wrong: the list is the server's, an untouched
 * control is the **template's** rather than a value of ours, and a `PUT`
 * carries the whole preferences object or it clears the half it left out.
 */
describe('how the CV looks', () => {
  it('draws the templates the server published, in its order', async () => {
    signIn();

    render(<CvAppearance />, { wrapper: wrapperFor('en') });

    /*
      Scoped to the template group, and it has to be: the typeface control
      offers a "Modern" of its own, and an unscoped query for radios named
      Modern finds both. A test that matched four values and called it three
      would be describing a screen nobody has.
    */
    const group = await screen.findByRole('group', { name: en.Appearance.template });
    const templates = within(group).getAllByRole('radio');

    expect(templates.map((input) => (input as HTMLInputElement).value)).toEqual([
      'classic',
      'compact',
      'modern',
    ]);
  });

  /**
   * `B-091`: leaving a field out means the template's own setting, so an
   * untouched control must not print a number. A form that showed one would
   * be asserting something about a template it has never seen — and `modern`
   * is the case that makes it visible, because its accent is not black.
   */
  it('says a value is the template’s until somebody moves it', async () => {
    signIn();

    render(<CvAppearance />, { wrapper: wrapperFor('en') });

    await screen.findByText(en.Appearance.template);

    const unset = screen.getAllByText(en.Appearance.templateDefault);
    // Three sliders and the typeface's own "template's own" option.
    expect(unset.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByLabelText(en.Appearance.accentColor)).toHaveValue('');
  });

  it('warns about 9pt without refusing it', async () => {
    signIn();
    const user = userEvent.setup();

    render(<CvAppearance />, { wrapper: wrapperFor('en') });

    const slider = await screen.findByRole('slider', { name: en.Appearance.fontSize });
    slider.focus();
    // Home is the bottom of the range, which is 9pt — § 33.2's warned-about
    // but permitted value.
    await user.keyboard('{Home}');

    expect(screen.getByTestId('font-size-warning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Appearance.save })).toBeEnabled();
  });

  /**
   * The write is a replace, one resource down from the head: a body carrying
   * only `defaults` clears the writing style. This is the assertion that
   * would have caught it.
   */
  it('sends the whole preferences object, not the part that changed', async () => {
    signIn();
    const user = userEvent.setup();

    render(<CvAppearance />, { wrapper: wrapperFor('en') });

    const group = await screen.findByRole('group', { name: en.Appearance.template });
    await user.click(within(group).getByRole('radio', { name: 'Compact' }));
    await user.click(screen.getByRole('button', { name: en.Appearance.save }));

    await waitFor(() => {
      expect(fixture.profile.preferences?.defaults?.templateId).toBe('compact');
    });

    // The half that was never on this screen, and that a partial body would
    // have thrown away.
    expect(fixture.profile.preferences?.writingStyle?.tone).toBe('formal');
  });

  /** The colour is the one free change (§ 33.1), stored without a `#`. */
  it('stores an accent colour as six hex digits', async () => {
    signIn();
    const user = userEvent.setup();

    render(<CvAppearance />, { wrapper: wrapperFor('en') });

    await user.type(await screen.findByLabelText(en.Appearance.accentColor), '1D4ED8');
    await user.click(screen.getByRole('button', { name: en.Appearance.save }));

    await waitFor(() => {
      expect(fixture.profile.preferences?.defaults?.appearance?.accentColor).toBe('1D4ED8');
    });
  });

  /**
   * Layer B is `canCustomizeTemplate`, and an anonymous caller does not have
   * it. The templates stay: § 9's product is narrower, not lesser, and preset
   * templates are part of what anonymous mode has.
   */
  it('offers the templates and not the sliders without an account', async () => {
    render(<CvAppearance />, { wrapper: wrapperFor('en') });

    await screen.findByText(en.Appearance.template);

    const group = screen.getByRole('group', { name: en.Appearance.template });
    expect(within(group).getByRole('radio', { name: 'Modern' })).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(en.Appearance.accentColor)).not.toBeInTheDocument();
  });

  /** Rule 9: the number beside a slider goes through `Intl` like any other. */
  it('prints the value in the reader’s own number format', async () => {
    signIn();
    const user = userEvent.setup();

    render(<CvAppearance />, { wrapper: wrapperFor('tr') });

    const slider = await screen.findByRole('slider', { name: tr.Appearance.margin });
    slider.focus();
    await user.keyboard('{Home}');

    // 0.4 inches, with the separator Turkish uses.
    expect(screen.getByText('0,4 inç')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    signIn();

    const { container } = render(<CvAppearance />, { wrapper: wrapperFor('en') });

    await screen.findByText(en.Appearance.template);
    expect(await axe(container)).toHaveNoViolations();
  });
});
