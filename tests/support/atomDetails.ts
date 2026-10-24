import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Opens every atom's details on screen.
 *
 * An atom's controls — importance, the locks, the tag lists, its labels, a
 * second wording — sit behind a "Details" toggle, closed by default so a long
 * section reads as a CV rather than as two hundred forms. A test about one of
 * those controls opens it the way a person would, by pressing the button.
 */
export async function openAtomDetails() {
  const user = userEvent.setup();
  const toggles = await screen.findAllByRole('button', { name: /^Show the details of/ });

  for (const toggle of toggles) await user.click(toggle);
}
