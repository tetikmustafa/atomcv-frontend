import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { server } from '@/mocks/node';
import { requireChallenge } from '@/mocks/authFixture';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<MagicLinkForm />, { wrapper: Wrapper });
}

/** Every body sent to the endpoint, in order. */
let bodies: Promise<string>[] = [];

function capture({ request }: { request: Request }) {
  if (request.method === 'POST' && request.url.endsWith('/auth/magic-link')) {
    bodies.push(request.clone().text());
  }
}

async function ask(address: string) {
  await userEvent.clear(screen.getByLabelText(en.Auth.emailLabel));
  await userEvent.type(screen.getByLabelText(en.Auth.emailLabel), address);
  await userEvent.click(screen.getByRole('button', { name: en.Auth.sendLink }));
}

beforeEach(() => {
  bodies = [];
  server.events.on('request:start', capture);
});

afterEach(() => {
  server.events.removeListener('request:start', capture);
});

describe('asking for a sign-in link', () => {
  /**
   * § 40.4: whether an address has an account is exactly what must not leak.
   * The server answers `202` either way and writes no sentence, so this is
   * the sentence — and there is only one of it.
   */
  it('says the same thing whatever the address', async () => {
    renderForm();
    await ask('someone@example.com');

    expect(await screen.findByText(en.Auth.linkSent)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.Auth.sendLink })).not.toBeInTheDocument();
  });

  /**
   * One of the two grounds `profileSchemas.ts` allows a client-side check on:
   * a round trip that would be wasted. Three requests per fifteen minutes is
   * the reader's own allowance, and a typo would spend one of them on mail to
   * nowhere.
   */
  it('does not spend an attempt on something that is not an address', async () => {
    renderForm();
    await ask('someone-at-example');

    expect(screen.getByRole('alert')).toHaveTextContent(en.Auth.emailInvalid);
    expect(bodies).toHaveLength(0);
  });

  it('stops complaining as soon as the value changes', async () => {
    renderForm();
    await ask('someone-at-example');
    await userEvent.type(screen.getByLabelText(en.Auth.emailLabel), '.com');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets the reader start over with another address', async () => {
    renderForm();
    await ask('someone@example.com');

    await userEvent.click(await screen.findByRole('button', { name: en.Auth.differentAddress }));

    expect(screen.getByLabelText(en.Auth.emailLabel)).toHaveValue('');
    expect(screen.getByRole('button', { name: en.Auth.sendLink })).toBeInTheDocument();
  });
});

describe('when the request is refused', () => {
  /**
   * `B-050` in one assertion. The window is fifteen minutes and the mock
   * sends it as `Retry-After: 900`; the sentence has to be built from that
   * rather than from the `resetsAt` in the body, because a duration is right
   * on a machine whose clock is wrong.
   */
  it('builds the wait out of the header, not the instant', async () => {
    renderForm();

    // Four attempts against § 40.5's allowance of three — and each one has to
    // go back through "use a different address", because the form does not
    // survive its own success. That is the shape a real fourth request has.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await ask('someone@example.com');
      await userEvent.click(await screen.findByRole('button', { name: en.Auth.differentAddress }));
    }
    await ask('someone@example.com');

    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent('about 15 minutes');
    // The body's own `resetsAt` still arrives; it simply is not the source.
    expect(panel).not.toHaveTextContent(/\d{1,2}:\d{2}/);
  });

  /**
   * A Turnstile token is single-use, so resending a spent one earns the same
   * refusal. The widget is remounted to get a fresh one — and it is remounted
   * on *any* refusal, because the server does not publish which of the three
   * limiter layers turned the request away, so there is no way to tell a
   * refusal that spent the token from one that did not.
   */
  it('starts the challenge again rather than reusing a spent token', async () => {
    requireChallenge();
    renderForm();

    const before = screen.getByTestId('turnstile');
    await ask('someone@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent('security check');
    await waitFor(() => expect(screen.getByTestId('turnstile')).not.toBe(before));
  });

  it('sends no challenge field at all where there is no token to send', async () => {
    renderForm();
    await ask('someone@example.com');

    await screen.findByText(en.Auth.linkSent);
    expect(JSON.parse(await bodies[0]!)).toEqual({ email: 'someone@example.com' });
  });
});
