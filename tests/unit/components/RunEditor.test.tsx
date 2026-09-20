import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RunEditor } from '@/components/profile/RunEditor';
import { createRun, type Run } from '@/lib/content/richContent';
import en from '@/messages/en.json';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

function renderEditor(runs: Run[]) {
  const onChange = vi.fn();
  const utils = render(<RunEditor runs={runs} onChange={onChange} />, { wrapper: Wrapper });
  return { ...utils, onChange };
}

const last = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)?.[0] as Run[] | undefined;

const t = en.Editor.runs;

/**
 * Editing a wording without losing its marks (absolute rule 4, § 14.1, D13).
 *
 * The gap this closes was honest about itself — plain-text editing drops
 * every mark, and the warning next to it was a bridge rather than a design.
 * What is worth pinning here is not that fields render: it is the three
 * invariants the run/mark model has, and the one state the model cannot hold.
 */
describe('editing a wording as parts', () => {
  it('keeps the marks on a part whose text was rewritten', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([
      createRun('Built a monitor that reached '),
      createRun('900 stars', ['metric']),
    ]);

    await user.type(screen.getByLabelText('Part 2'), '!');

    // The whole point: the text moved and the mark did not.
    expect(last(onChange)?.[1]).toMatchObject({ t: '900 stars!', m: ['metric'] });
  });

  /**
   * Forward compatibility is symmetric (EK D.9 · 2). The backend does not
   * drop a mark it does not recognise, so neither may this — otherwise a
   * newer version's markup is deleted the moment somebody fixes a typo here.
   */
  it('carries a mark it does not understand through an edit, untouched', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([createRun('Kubernetes', ['technology', 'from-the-future'])]);

    // Said, so the reader knows why there is no box for it.
    expect(screen.getByTestId(/unknown$/)).toHaveTextContent('from-the-future');

    await user.type(screen.getByLabelText('Part 1'), 'x');

    expect(last(onChange)?.[0]?.m).toEqual(['technology', 'from-the-future']);
  });

  it('offers no way to remove one, because it cannot say what it would remove', async () => {
    renderEditor([createRun('Kubernetes', ['from-the-future'])]);

    const boxes = screen.getAllByRole('checkbox').map((box) => box.getAttribute('name'));
    expect(boxes).not.toContain('from-the-future');
    expect(screen.getAllByRole('checkbox')).toHaveLength(Object.keys(t.marks).length);
  });

  /**
   * A link must carry an address and a non-link must not (EK D.9 · 1), and
   * `createRun` throws on either — which is right for content and wrong for
   * the instant after the box is ticked. So the half-finished state lives in
   * the draft, is said on the row, and never reaches the caller.
   */
  it('says a link needs an address, and sends nothing until it has one', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([createRun('the repository')]);

    await user.click(screen.getByRole('checkbox', { name: t.marks.link }));

    expect(screen.getByRole('alert')).toHaveTextContent(t.hrefMissing);
    expect(screen.getByLabelText(t.hrefLabel)).toHaveAttribute('aria-invalid', 'true');
    // Nothing whole to report: the draft is not content yet.
    expect(onChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(t.hrefLabel), 'https://example.com');

    expect(last(onChange)?.[0]).toMatchObject({
      t: 'the repository',
      m: ['link'],
      href: 'https://example.com',
    });
  });

  /**
   * The other direction of the same invariant. An `href` left on a run that
   * is no longer a link is stored, never rendered and silently lost — and
   * would be refused on save, long after the box was unticked.
   */
  it('clears the address in the same step as the link mark', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([createRun('the repo', ['link'], 'https://example.com')]);

    await user.click(screen.getByRole('checkbox', { name: t.marks.link }));

    expect(screen.queryByLabelText(t.hrefLabel)).toBeNull();
    expect(last(onChange)?.[0]).not.toHaveProperty('href');
  });

  it('adds and removes parts, and never removes the last one', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([createRun('one')]);

    // Nothing to remove while there is one: an empty wording is content with
    // nothing in it, which the server refuses.
    expect(screen.queryByRole('button', { name: /Remove part 1/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: t.addPart }));
    expect(last(onChange)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Remove part 2/ }));
    expect(last(onChange)).toHaveLength(1);
  });

  /**
   * The seed is compared by **value**, and that is not a refinement: `runs`
   * is parsed out of the cached content on every render, so a fresh array
   * arrives each time and an identity check re-seeds on every keystroke —
   * the field takes one character and snaps back to the saved sentence.
   */
  it('does not lose a keystroke to a re-rendered copy of the same content', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Host() {
      // A new array every render, exactly as `parseRichContent` produces one.
      return <RunEditor runs={[createRun('Built a monitor')]} onChange={onChange} />;
    }

    const { rerender } = render(<Host />, { wrapper: Wrapper });

    await user.type(screen.getByLabelText('Part 1'), '!');
    rerender(<Host />);

    expect(screen.getByLabelText('Part 1')).toHaveValue('Built a monitor!');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderEditor([
      createRun('Built a monitor that reached '),
      createRun('900 stars', ['metric']),
    ]);

    // The set of parts carries the name; a `<label>` names one control.
    expect(within(container).getByRole('list')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
