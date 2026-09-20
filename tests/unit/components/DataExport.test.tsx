import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataExport } from '@/components/settings/DataExport';
import { server } from '@/mocks/node';
import { http, HttpResponse } from 'msw';
import { signIn, signOut } from '@/mocks/sessionFixture';
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

/**
 * What the anchor was handed. jsdom has no download, so the two things worth
 * pinning are the name the file is saved under and the bytes behind the
 * object URL.
 */
let saved: { name: string; type: string; text: string } | undefined;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  saved = undefined;

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    void (blob as Blob).text().then((text) => {
      saved = { ...(saved ?? { name: '', type: '' }), type: (blob as Blob).type, text };
    });
    return 'blob:export';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved = { ...(saved ?? { type: '', text: '' }), name: this.download };
  });
});

/**
 * The portability half of § 57.5, which three pieces of published copy
 * already promise: the privacy policy's list of rights, the terms, and the
 * sentence shown when generation is paused. The endpoint and its client
 * functions existed for two stages with nothing calling them.
 */
describe('taking your data with you', () => {
  it('saves the complete copy as JSON, named for the day it was made', async () => {
    signIn();

    render(<DataExport />, { wrapper: wrapperFor('en') });

    await userEvent.click(screen.getByRole('button', { name: 'Download JSON' }));

    await waitFor(() => expect(saved?.name).toMatch(/^atomcv-profile-\d{4}-\d{2}-\d{2}\.json$/));
    expect(saved?.type).toBe('application/json');

    const parsed = JSON.parse(saved!.text);
    expect(parsed.profile.headline).toBe('Senior Backend Engineer');
    expect(parsed.sections.length).toBeGreaterThan(0);
  });

  it('saves the readable copy as Markdown rather than as JSON in a .md', async () => {
    signIn();

    render(<DataExport />, { wrapper: wrapperFor('en') });

    await userEvent.click(screen.getByRole('button', { name: 'Download Markdown' }));

    await waitFor(() => expect(saved?.name).toMatch(/\.md$/));
    expect(saved?.type).toBe('text/markdown');
    expect(saved?.text.startsWith('# ')).toBe(true);
    expect(saved?.text).toContain('## Experience');
  });

  /**
   * § 58.2 makes portability unconditional, and an anonymous profile expires
   * in two hours — which is the case where taking a copy matters most. The
   * endpoint declares no `401` and `capabilities` carries no flag, so there
   * is nothing here to gate on.
   */
  it('is offered without an account too', async () => {
    signOut();

    render(<DataExport />, { wrapper: wrapperFor('en') });

    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download Markdown' })).toBeEnabled();
  });

  /** Rule 7: the server's refusal is rendered, not a sentence of our own. */
  it('shows the server refusal instead of saving a broken file', async () => {
    signIn();
    server.use(
      http.get('*/api/v1/profile/export', () =>
        HttpResponse.json(
          {
            type: '/errors/validation-failed',
            title: 'VALIDATION_FAILED',
            status: 400,
            instance: '/api/v1/profile/export',
            code: 'VALIDATION_FAILED',
            params: { fields: ['format'] },
          },
          { status: 400 },
        ),
      ),
    );

    render(<DataExport />, { wrapper: wrapperFor('en') });

    await userEvent.click(screen.getByRole('button', { name: 'Download JSON' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(saved).toBeUndefined();
  });

  it('has no axe violations', async () => {
    signIn();

    const { container } = render(<DataExport />, { wrapper: wrapperFor('en') });

    expect(await axe(container)).toHaveNoViolations();
  });
});
