import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SaveStatus } from '@/components/editor/SaveStatus';
import type { SaveStatus as Status } from '@/hooks/useAutosave';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

function renderStatus(status: Status, messages: typeof en = en, locale: 'en' | 'tr' = 'en') {
  const onRetry = vi.fn();
  const onDiscard = vi.fn();

  const utils = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SaveStatus status={status} onRetry={onRetry} onDiscard={onDiscard} />
    </NextIntlClientProvider>,
  );

  return { ...utils, onRetry, onDiscard };
}

describe('the save indicator', () => {
  /**
   * Rule 6. A coloured dot is the whole signal for a sighted user and no
   * signal at all for anyone else, so every state that means something has
   * to say it in words.
   */
  it('states each meaningful status in text, not only in colour', () => {
    renderStatus('saving');
    expect(screen.getByRole('status')).toHaveTextContent('Saving');

    renderStatus('saved');
    expect(screen.getAllByRole('status')[1]).toHaveTextContent('Saved');
  });

  /**
   * The region has to exist before it has anything to say: assistive
   * technology must already be observing the node when its content changes,
   * so one that appears along with its message is often never announced.
   */
  it('renders the live region even when there is nothing to announce', () => {
    renderStatus('idle');

    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('');
  });

  /** Typing is not an event worth narrating on every pause. */
  it('says nothing while an edit is merely pending', () => {
    renderStatus('dirty');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('offers a retry when a save failed', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderStatus('error');

    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save.");
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  /**
   * Bölüm 37.4: no automatic merge. Both ways out are offered, and neither is
   * pre-selected — the choice is which version of the user's own work
   * survives, which the app cannot make for them.
   */
  it('offers both sides of a conflict and picks neither', async () => {
    const user = userEvent.setup();
    const { onRetry, onDiscard } = renderStatus('conflict');

    expect(screen.getByRole('status')).toHaveTextContent('You changed this item in another tab.');

    await user.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Use the other version' }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  /**
   * Bölüm 37.4 fixes this Turkish wording. The English source was authored to
   * match it, so the translation direction cannot quietly reword the spec.
   */
  it('uses the wording the specification fixes, in Turkish', () => {
    renderStatus('conflict', tr as typeof en, 'tr');

    expect(screen.getByRole('status')).toHaveTextContent(
      'Bu maddeyi başka bir sekmede değiştirmişsin.',
    );
    expect(screen.getByRole('button', { name: 'Benim halimi kullan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Diğer halini kullan' })).toBeInTheDocument();
  });

  it('has no accessibility violations in its loudest state', async () => {
    const { container } = renderStatus('conflict');
    expect(await axe(container)).toHaveNoViolations();
  });
});
