import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_DEBOUNCE_MS, useAutosave } from '@/hooks/useAutosave';
import { ApiError } from '@/lib/api/errors';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A save that resolves when the test says so, so flight can be observed. */
function deferredSave() {
  const calls: unknown[] = [];
  let settle: { resolve: () => void; reject: (error: unknown) => void } | undefined;

  const save = vi.fn((value: unknown) => {
    calls.push(value);
    return new Promise<void>((resolve, reject) => {
      settle = { resolve: () => resolve(), reject };
    });
  });

  return {
    save,
    calls,
    resolve: async () => {
      settle?.resolve();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    },
    reject: async (error: unknown) => {
      settle?.reject(error);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    },
  };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('the debounce belongs to the gesture', () => {
  /** Bölüm 37.1. These are the numbers, not a preference. */
  it('waits per trigger', () => {
    expect(SAVE_DEBOUNCE_MS).toEqual({ text: 1200, slider: 500, toggle: 0, reorder: 0 });
  });

  it('sends one request for a burst of typing, carrying the last value', async () => {
    const { save, calls } = deferredSave();
    const { result } = renderHook(() => useAutosave<string>({ save, trigger: 'text' }));

    act(() => result.current.change('a'));
    await advance(400);
    act(() => result.current.change('ab'));
    await advance(400);
    act(() => result.current.change('abc'));

    // Still inside the window opened by the *last* keystroke.
    await advance(1199);
    expect(save).not.toHaveBeenCalled();

    await advance(1);
    expect(calls).toEqual(['abc']);
  });

  it('sends a toggle at once, because the click is the whole decision', async () => {
    const { save } = deferredSave();
    const { result } = renderHook(() => useAutosave<boolean>({ save, trigger: 'toggle' }));

    act(() => result.current.change(true));

    expect(save).toHaveBeenCalledWith(true);
  });
});

describe('the status a live region reads', () => {
  it('runs idle → dirty → saving → saved → idle', async () => {
    const deferred = deferredSave();
    const { result } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'text' }),
    );

    expect(result.current.status).toBe('idle');

    act(() => result.current.change('typed'));
    expect(result.current.status).toBe('dirty');

    await advance(SAVE_DEBOUNCE_MS.text);
    expect(result.current.status).toBe('saving');

    await deferred.resolve();
    expect(result.current.status).toBe('saved');

    // "Saved" is a message, not a resting state — Bölüm 37.3 gives it 2s.
    await advance(2000);
    expect(result.current.status).toBe('idle');
  });

  /**
   * The indicator must not say "saved" while an edit made during the request
   * is still only in the browser. That is the exact moment a user stops
   * worrying about work that is not stored.
   */
  it('sends an edit that arrived mid-flight instead of reporting saved', async () => {
    const deferred = deferredSave();
    const { result } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'toggle' }),
    );

    act(() => result.current.change('first'));
    expect(result.current.status).toBe('saving');

    act(() => result.current.change('second'));
    await deferred.resolve();

    expect(result.current.status).toBe('saving');
    expect(deferred.calls).toEqual(['first', 'second']);
  });
});

describe('a refused save', () => {
  it('keeps the value so retry has something to send', async () => {
    const deferred = deferredSave();
    const { result } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'toggle' }),
    );

    act(() => result.current.change('mine'));
    await deferred.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));

    expect(result.current.status).toBe('error');
    expect(result.current.hasPending).toBe(true);

    act(() => result.current.retry());
    expect(deferred.calls).toEqual(['mine', 'mine']);
  });

  /**
   * Bölüm 37.4: a 412 is not a failure to repeat, it is someone else's work
   * on the server. Automatic merging is ruled out at this scale, so the hook
   * has to stop at a state that offers a choice rather than a retry.
   */
  it('is a conflict, not an error, when the version has moved', async () => {
    const deferred = deferredSave();
    const { result } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'toggle' }),
    );

    act(() => result.current.change('mine'));
    await deferred.reject(
      new ApiError({
        status: 412,
        code: 'VERSION_CONFLICT',
        resolutions: [{ action: 'retry' }],
      }),
    );

    expect(result.current.status).toBe('conflict');
  });

  it('lets the local value be abandoned for the server copy', async () => {
    const deferred = deferredSave();
    const { result } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'toggle' }),
    );

    act(() => result.current.change('mine'));
    await deferred.reject(new ApiError({ status: 412, code: 'VERSION_CONFLICT' }));

    act(() => result.current.discard());

    expect(result.current.status).toBe('idle');
    expect(result.current.hasPending).toBe(false);
  });
});

/**
 * Bölüm 37.3. The browser owns the wording; we only decide when it is asked
 * for. `conflict` is the one that reads as "handled" and is not: until the
 * user picks a side, the edit is exactly as unsaved as a failed one.
 */
describe('closing the tab with work that is not on the server', () => {
  function isGuarded() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('is not guarded while nothing is pending', () => {
    const { save } = deferredSave();
    renderHook(() => useAutosave<string>({ save, trigger: 'text' }));

    expect(isGuarded()).toBe(false);
  });

  it('is guarded while an edit is still only in the browser', async () => {
    const { save } = deferredSave();
    const { result } = renderHook(() => useAutosave<string>({ save, trigger: 'text' }));

    act(() => result.current.change('typed'));

    expect(isGuarded()).toBe(true);
  });

  it('is still guarded once a conflict is waiting on the user', async () => {
    const deferred = deferredSave();
    const { result } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'toggle' }),
    );

    act(() => result.current.change('mine'));
    await deferred.reject(new ApiError({ status: 412, code: 'VERSION_CONFLICT' }));

    expect(result.current.status).toBe('conflict');
    expect(isGuarded()).toBe(true);
  });
});

/**
 * P8: a collapsing section is not a way to lose a finished sentence. The
 * component is gone, but the edit is still the user's.
 */
describe('unmounting with an edit still waiting', () => {
  it('sends it rather than dropping it', async () => {
    const { save, calls } = deferredSave();
    const { result, unmount } = renderHook(() => useAutosave<string>({ save, trigger: 'text' }));

    act(() => result.current.change('half-typed'));
    await advance(300);
    expect(save).not.toHaveBeenCalled();

    unmount();

    expect(calls).toEqual(['half-typed']);
  });

  it('does not send twice when the value is already in flight', async () => {
    const deferred = deferredSave();
    const { result, unmount } = renderHook(() =>
      useAutosave<string>({ save: deferred.save, trigger: 'toggle' }),
    );

    act(() => result.current.change('sent'));
    unmount();

    expect(deferred.calls).toEqual(['sent']);
  });
});
