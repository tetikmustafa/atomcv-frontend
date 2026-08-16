import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SortableList } from '@/components/profile/SortableList';
import en from '@/messages/en.json';

type Item = { id: string; name: string };

const ITEMS: Item[] = [
  { id: 'a', name: 'First' },
  { id: 'b', name: 'Second' },
  { id: 'c', name: 'Third' },
];

function renderList(items = ITEMS) {
  const onReorder = vi.fn();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    );
  }

  const utils = render(
    <SortableList
      items={items}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      onReorder={onReorder}
    >
      {(item) => <span>{item.name}</span>}
    </SortableList>,
    { wrapper: Wrapper },
  );

  return { ...utils, onReorder };
}

/**
 * Rule 5 asks for two things, and the second is the one that gets dropped:
 * a keyboard sensor is a *mode* you have to know about and enter, while the
 * buttons are the same operation with no mode at all — and the only form a
 * switch device or voice control can reach.
 */
describe('moving an item without dragging it', () => {
  it('offers a named move control in each direction', () => {
    renderList();

    expect(screen.getByRole('button', { name: 'Move Second up' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Second down' })).toBeEnabled();
  });

  it('sends the complete list in its new order, not just what moved', async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();

    await user.click(screen.getByRole('button', { name: 'Move Third up' }));

    // D.9 · 19: a partial list is a 400, and `displayOrder` cannot be patched
    // directly — so every id travels, every time.
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('moves down as well as up', async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();

    await user.click(screen.getByRole('button', { name: 'Move First down' }));

    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  /** The ends have nowhere to go, and a control that does nothing is a lie. */
  it('disables the direction that would fall off the list', () => {
    renderList();

    expect(screen.getByRole('button', { name: 'Move First up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Third down' })).toBeDisabled();
  });

  it('reaches every control by keyboard alone, in list order', async () => {
    const user = userEvent.setup();
    renderList();

    // The handle must be a real button, or it is mouse-only: a `div` carrying
    // drag listeners never enters the tab order. Disabled ends are skipped,
    // which is why the sequence is asserted rather than counted.
    const expected = [
      'Reorder First',
      'Move First down',
      'Move Second up',
      'Reorder Second',
      'Move Second down',
      'Move Third up',
      'Reorder Third',
    ];

    for (const name of expected) {
      await user.tab();
      expect(screen.getByRole('button', { name })).toHaveFocus();
    }
  });
});

describe('the drag affordance', () => {
  it('names the item it would move', () => {
    renderList();

    expect(screen.getByRole('button', { name: 'Reorder Second' })).toBeInTheDocument();
  });

  /**
   * dnd-kit speaks a drag into its own live region, and its defaults are
   * English whatever the interface language is. Rule 6 applies to a drag as
   * much as to a save.
   */
  it('describes the drag through the translated catalogue', () => {
    renderList();

    expect(en.Editor.reorder.picked).toContain('{label}');
    expect(en.Editor.reorder.dropped).toContain('{position, number}');
  });
});

describe('accessibility', () => {
  it('has no violations', async () => {
    const { container } = renderList();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a list, so its length and positions are announced', () => {
    renderList();

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
