import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfPreview } from '@/components/generation/PdfPreview';
import { formats } from '@/lib/i18n/formats';
import { server } from '@/mocks/node';
import en from '@/messages/en.json';

let client: QueryClient;
let downloads = 0;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} formats={formats}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  downloads = 0;
  // jsdom has no object URLs; the frame only needs a string to point at.
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:pdf' }));
  URL.revokeObjectURL = () => {};
  server.use(
    http.get('*/api/v1/generations/:id/download', () => {
      downloads += 1;
      return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
        headers: { 'Content-Type': 'application/pdf' },
      });
    }),
  );
});

describe('the PDF preview', () => {
  /**
   * Opening it renders the document again, so a result visited only to press
   * "Download" must not pay for a compilation it never looks at.
   */
  it('waits to be asked on a result that is not new', async () => {
    const user = userEvent.setup();
    render(<PdfPreview generationId="gen-1" />, { wrapper: Wrapper });

    expect(screen.queryByTitle(en.Result.previewFrame)).toBeNull();
    expect(downloads).toBe(0);

    await user.click(screen.getByRole('button', { name: en.Result.previewShow }));

    expect(await screen.findByTitle(en.Result.previewFrame)).toBeInTheDocument();
    expect(downloads).toBe(1);
  });

  /** The person has just waited for this page; seeing it is why they came. */
  it('opens by itself on a result that was just made', async () => {
    render(<PdfPreview generationId="gen-1" fresh />, { wrapper: Wrapper });

    expect(await screen.findByTitle(en.Result.previewFrame)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.Result.previewShow })).toBeNull();
  });
});
