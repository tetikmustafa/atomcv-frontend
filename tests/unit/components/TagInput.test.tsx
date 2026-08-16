import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TagInput } from '@/components/profile/TagInput';
import en from '@/messages/en.json';

function renderInput(values: string[] = ['ETL']) {
  const onChange = vi.fn();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    );
  }

  const utils = render(
    <TagInput
      label="Skills"
      hint="Canonical names used to match this against a posting."
      values={values}
      onChange={onChange}
      maxLength={80}
    />,
    { wrapper: Wrapper },
  );

  return { ...utils, onChange };
}

describe('the tag field', () => {
  /** `AtomPatch` replaces each list whole — a partial one is the same trap as a partial reorder. */
  it('hands back the complete list, not the change', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput(['ETL']);

    await user.type(screen.getByLabelText('Skills'), 'Kafka{Enter}');

    expect(onChange).toHaveBeenCalledWith(['ETL', 'Kafka']);
  });

  it('removes a tag by name', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput(['ETL', 'Kafka']);

    await user.click(screen.getByRole('button', { name: 'Remove ETL' }));

    expect(onChange).toHaveBeenCalledWith(['Kafka']);
  });

  /**
   * A skill stored twice is scored twice. Refusing the duplicate silently is
   * right: the user asked for it to be in the list, and it is.
   */
  it('ignores a duplicate rather than storing it twice', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput(['ETL']);

    await user.type(screen.getByLabelText('Skills'), 'ETL{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores an empty entry', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput([]);

    await user.type(screen.getByLabelText('Skills'), '   {Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  /** The convention every tag field has, and the only mouse-free way to undo a typo. */
  it('removes the last tag on backspace in an empty field', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput(['ETL', 'Kafka']);

    await user.click(screen.getByLabelText('Skills'));
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['ETL']);
  });

  it('leaves the tags alone when backspace has text to delete instead', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput(['ETL']);

    await user.type(screen.getByLabelText('Skills'), 'Kafk');
    await user.keyboard('{Backspace}');

    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * A value typed and then abandoned is still something the user meant to
   * add. Discarding it on blur is the quiet loss P8 is about, in miniature.
   */
  it('commits a value the user typed and then clicked away from', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput([]);

    await user.type(screen.getByLabelText('Skills'), 'Kafka');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(['Kafka']);
  });

  /**
   * Removing a tag destroys the button that had focus. Without moving it, a
   * keyboard user lands on `body` and loses their place in the form.
   */
  it('keeps focus in the field after a removal', async () => {
    const user = userEvent.setup();
    renderInput(['ETL', 'Kafka']);

    await user.click(screen.getByRole('button', { name: 'Remove ETL' }));

    expect(screen.getByLabelText('Skills')).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInput(['ETL', 'Kafka']);
    expect(await axe(container)).toHaveNoViolations();
  });
});
