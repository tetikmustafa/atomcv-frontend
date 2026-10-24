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

/**
 * Chrome on Android draws no PDF in a frame, and a fresh result on a phone
 * opened a blank rectangle by itself. The browser says so, and is believed.
 */
describe('where the browser cannot show a PDF in the page', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { ...navigator, pdfViewerEnabled: false });
  });

  it('does not fetch by itself, even for a result that was just made', () => {
    render(<PdfPreview generationId="gen-1" fresh />, { wrapper: Wrapper });

    expect(screen.getByText(en.Result.previewNoViewer)).toBeInTheDocument();
    expect(downloads).toBe(0);
  });

  it('offers the file in a tab of its own instead of a frame', async () => {
    const user = userEvent.setup();
    render(<PdfPreview generationId="gen-1" />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: en.Result.previewPrepare }));

    const link = await screen.findByRole('link', { name: en.Result.previewOpen });
    expect(link).toHaveAttribute('href', 'blob:pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByTitle(en.Result.previewFrame)).toBeNull();
  });
});
