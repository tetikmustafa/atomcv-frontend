import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleEmails } from '@/components/settings/LifecycleEmails';
import { UnsubscribeScreen } from '@/components/settings/UnsubscribeScreen';
import { lifecycleEmails, signIn, UNSUBSCRIBE_TOKEN } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => '/settings',
}));

let client: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} formats={formats}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

/**
 * The closed list of two, and the switch that reaches one of them (§ 57.7,
 * `B-096`).
 */
describe('the email preference', () => {
  it('shows the server’s value rather than the press', async () => {
    signIn();
    const user = userEvent.setup();

    render(<LifecycleEmails />, { wrapper: Wrapper });

    const toggle = await screen.findByRole('switch', { name: en.Settings.emailsLabel });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    await waitFor(() => expect(lifecycleEmails()).toBe(false));
    expect(toggle).not.toBeChecked();
  });

  /**
   * § 57.4: being told your data has gone is not something anyone may switch
   * off, so the text beside the switch must not read as covering it. This is
   * the assertion that keeps a shorter label from quietly claiming otherwise.
   */
  it('says the deletion confirmation is not covered', async () => {
    signIn();

    render(<LifecycleEmails />, { wrapper: Wrapper });

    const note = await screen.findByText(/confirmation is sent either way/i);
    expect(note).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    signIn();

    const { container } = render(<LifecycleEmails />, { wrapper: Wrapper });

    await screen.findByRole('switch', { name: en.Settings.emailsLabel });
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * The page an inbox link lands on (§ 40.3).
 */
describe('unsubscribing from an inbox', () => {
  /**
   * The trap this page exists for: a gateway prefetching the address must not
   * unsubscribe anybody. Rendering is not pressing.
   */
  it('does nothing until the button is pressed', async () => {
    render(<UnsubscribeScreen token={UNSUBSCRIBE_TOKEN} />, { wrapper: Wrapper });

    await screen.findByRole('button', { name: en.Unsubscribe.confirm });
    expect(lifecycleEmails()).toBe(true);
  });

  it('stops the optional emails when it is', async () => {
    const user = userEvent.setup();

    render(<UnsubscribeScreen token={UNSUBSCRIBE_TOKEN} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('button', { name: en.Unsubscribe.confirm }));

    expect(await screen.findByText(en.Unsubscribe.done)).toBeInTheDocument();
    expect(lifecycleEmails()).toBe(false);
  });

  /**
   * A token nobody has ever heard of is answered `204` exactly like a live
   * one — a different answer would say which tokens exist. So there is no
   * "invalid link" screen, and this asserts that there is not.
   */
  it('says the same thing for a token the server does not know', async () => {
    const user = userEvent.setup();

    render(<UnsubscribeScreen token="11111111-2222-4333-8444-555555555555" />, {
      wrapper: Wrapper,
    });

    await user.click(await screen.findByRole('button', { name: en.Unsubscribe.confirm }));

    expect(await screen.findByText(en.Unsubscribe.done)).toBeInTheDocument();
  });

  it('says so when the link arrived without a token at all', async () => {
    render(<UnsubscribeScreen token={undefined} />, { wrapper: Wrapper });

    expect(screen.getByText(en.Unsubscribe.noToken)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.Unsubscribe.confirm })).not.toBeInTheDocument();
  });
});
