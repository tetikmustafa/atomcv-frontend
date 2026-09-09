import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountResolution } from '@/hooks/useAccountResolution';

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  // The editor's own route, unprefixed — next-intl's router adds the locale.
  usePathname: () => '/profile',
}));

beforeEach(() => push.mockClear());

/**
 * The way out of § 35.7.2's three refusals (`B-081`).
 *
 * Before this existed the profile editor drew the server's `sign_up` button
 * and did nothing when it was pressed: `ErrorPanel` defaults to rendering
 * every resolution it can name, and no caller in the editor passed an
 * `onResolve`. A button that looks like the way forward and does nothing is
 * the one thing the panel is written to avoid.
 */
describe('the account resolution', () => {
  it('sends the reader to sign in, and back to where they were', () => {
    const { result } = renderHook(() => useAccountResolution());

    result.current.onResolve({ action: 'sign_up' });

    expect(push).toHaveBeenCalledWith('/login?next=%2Fprofile');
  });

  it('claims only the action it can carry out', () => {
    const { result } = renderHook(() => useAccountResolution());

    expect(result.current.canResolve('sign_up')).toBe(true);
    // Dropped rather than drawn: the editor cannot replace a profile or open
    // a page limit, and a button that does nothing is worse than one that was
    // never offered.
    expect(result.current.canResolve('replace_profile')).toBe(false);
    expect(result.current.canResolve('an_action_from_the_future')).toBe(false);
  });

  it('does nothing at all for an action it did not claim', () => {
    const { result } = renderHook(() => useAccountResolution());

    result.current.onResolve({ action: 'retry' });

    expect(push).not.toHaveBeenCalled();
  });
});
