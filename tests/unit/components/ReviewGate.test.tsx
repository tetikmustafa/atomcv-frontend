import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewGate } from '@/components/onboarding/ReviewGate';
import { generations, TERMINAL_AT, type MockJob } from '@/mocks/generationFixture';
import { fixture } from '@/mocks/profileFixture';
import { useEditorUiStore } from '@/stores/editorUiStore';
import en from '@/messages/en.json';

const push = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/onboarding/review',
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const JOB = 'job-1';

type Warnings = NonNullable<NonNullable<MockJob['imported']>['warnings']>;

/**
 * An import that has already finished, put where the mock keeps jobs.
 *
 * Seeded into the fixture rather than into the query cache, so the screen
 * reads it the way a reloaded tab does — over `GET /jobs/{id}`. That is the
 * path `B-067` opened, and a test that wrote the answer straight into the
 * cache would pass whether or not the endpoint said anything.
 *
 * `startedAt` is far enough in the past that the job is terminal on the first
 * read; the mock advances jobs on wall-clock time, and waiting two real
 * seconds for that would test the clock.
 */
function seedImport(warnings: Warnings) {
  generations.jobs.push({
    jobId: JOB,
    kind: 'import',
    generationId: '',
    startedAt: Date.now() - TERMINAL_AT - 1,
    outcome: 'completed',
    imported: {
      profileId: 'profile-1',
      sectionCount: 3,
      atomCount: 4,
      warningCount: warnings.length,
      detectedLanguage: 'en',
      warnings,
    },
  });
}

function renderGate({ jobId }: { jobId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<ReviewGate {...(jobId ? { jobId } : {})} />, { wrapper: Wrapper });
}

beforeEach(() => {
  push.mockClear();
  useEditorUiStore.getState().reset();
});

describe('the review after an import', () => {
  /**
   * The rule this screen exists for: extraction is never perfectly accurate,
   * and a mistake nobody looked at propagates into every CV made from the
   * profile afterwards. So there is no way past it that is not the button.
   */
  it('offers no way to skip it', () => {
    seedImport([]);
    renderGate({ jobId: JOB });

    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '');

    expect(labels.some((label) => /skip|later|not now/i.test(label))).toBe(false);
    expect(screen.getByRole('button', { name: en.Onboarding.confirm })).toBeInTheDocument();
  });

  it('leads on once the reader says it looks right', async () => {
    seedImport([]);
    renderGate({ jobId: JOB });

    await userEvent.click(screen.getByRole('button', { name: en.Onboarding.confirm }));

    expect(push).toHaveBeenCalledWith('/generate');
  });

  /**
   * § 31.6.4 deleted the rule that held this button closed until "critical
   * warnings" were resolved: `ExtractionWarningCode` is closed and all six of
   * its values describe a field the reader can fix on this very screen, so a
   * blocking class of warning never existed. Asserted with warnings present,
   * because that is the state the deleted rule was about.
   */
  it('lets the reader carry on even with warnings on the screen', async () => {
    seedImport([{ code: 'ambiguous_date', sectionOrder: 0, entryOrder: 1 }]);
    renderGate({ jobId: JOB });

    const confirm = await screen.findByRole('button', { name: en.Onboarding.confirm });
    await screen.findByTestId('review-warnings');

    expect(confirm).toBeEnabled();
  });

  it('says how many things extraction was unsure about', async () => {
    seedImport([
      { code: 'ambiguous_date', sectionOrder: 0, entryOrder: 1 },
      { code: 'ambiguous_date' },
    ]);
    renderGate({ jobId: JOB });

    expect(await screen.findByTestId('review-warnings')).toHaveTextContent('unsure about 2 things');
  });

  /**
   * A note, not a warning: nothing is broken and there is nothing to retry.
   * The same distinction the thin-profile note is drawn on.
   */
  it('says nothing when there was nothing to be unsure about', async () => {
    seedImport([]);
    renderGate({ jobId: JOB });

    // The heading first, so the absence below is checked after the screen has
    // had something to render rather than before anything has.
    await screen.findByRole('heading', { level: 1 });
    // By test id, not by role: the editor underneath has live regions of its
    // own — the save indicator is a `status` too — and an unscoped absence
    // check would pass or fail on which of them had rendered yet.
    expect(screen.queryByTestId('review-warnings')).not.toBeInTheDocument();
  });

  it('is correct without a job rather than guessing at one', async () => {
    renderGate();

    expect(
      await screen.findByRole('heading', { level: 1, name: en.Onboarding.reviewTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('review-warnings')).not.toBeInTheDocument();
  });
});

/**
 * § 31.6's second design rule, buildable since `B-067`: sections start closed
 * because two hundred atoms at once overwhelms, and the problematic ones open
 * themselves.
 */
describe('where the warnings are', () => {
  it('opens the section a warning points at', async () => {
    seedImport([{ code: 'ambiguous_date', sectionOrder: 2, entryOrder: 0 }]);
    renderGate({ jobId: JOB });

    // Education is `displayOrder: 2` in the profile fixture.
    const education = await screen.findByRole('button', { name: 'Education' });
    await waitFor(() => expect(education).toHaveAttribute('aria-expanded', 'true'));

    expect(screen.getByRole('button', { name: 'Experience' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  /**
   * `sectionOrder` is a `displayOrder`, and in the fixture that number
   * happens to equal the section's place in the list — so the test above
   * would pass on either reading. Here they are pulled apart: Education is
   * moved to `displayOrder: 0` while staying last in the response, and a
   * warning pointing at 0 has to open it rather than the section that is
   * listed first.
   */
  it('resolves the position as a display order, not as a place in the list', async () => {
    const [experience, , education] = fixture.sections;
    education!.displayOrder = 0;
    experience!.displayOrder = 2;

    seedImport([{ code: 'ambiguous_date', sectionOrder: 0 }]);
    renderGate({ jobId: JOB });

    const opened = await screen.findByRole('button', { name: 'Education' });
    await waitFor(() => expect(opened).toHaveAttribute('aria-expanded', 'true'));

    expect(screen.getByRole('button', { name: 'Experience' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  /**
   * A warning that names no section is document-level — something the model
   * dropped and could not place. Counted, because it is worth saying; opening
   * nothing, because there is nothing to point at.
   */
  it('counts a placeless warning without opening anything', async () => {
    seedImport([{ code: 'ambiguous_date' }]);
    renderGate({ jobId: JOB });

    const note = await screen.findByTestId('review-warnings');
    expect(note).toHaveTextContent('nowhere in particular');
    expect(note).not.toHaveTextContent(en.Onboarding.reviewWarningsOpened);

    const experience = await screen.findByRole('button', { name: 'Experience' });
    expect(experience).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * `B-069` published the six codes, so a warning can be **named** rather than
   * only counted. The one that knows where it is says so; the reader should
   * not have to guess which of four open sections the sentence is about.
   */
  it('says what each warning was, and where', async () => {
    seedImport([
      { code: 'ambiguous_date', sectionOrder: 0, entryOrder: 1 },
      { code: 'untranslatable_atom' },
    ]);
    renderGate({ jobId: JOB });

    const list = await screen.findByTestId('review-warning-list');
    const items = within(list).getAllByRole('listitem');

    expect(items[0]).toHaveTextContent('A date could not be read. In Experience.');
    expect(items[1]).toHaveTextContent('A line could not be given an English wording.');
    // The placeless one names no section, rather than naming the wrong one.
    expect(items[1]).not.toHaveTextContent('In ');
  });

  /**
   * `B-071`'s seventh code, and the one whose sentence has to point at the
   * document rather than at the reading of it: the pipeline caught the model
   * writing a name the uploaded file never contained — `SQL Server` for a
   * line that said `SQL`. Named like the other six, and located, because it
   * carries `sectionOrder`/`entryOrder` like them.
   */
  it('names the atom whose wording the file does not support', async () => {
    seedImport([{ code: 'unsupported_by_source', sectionOrder: 0, entryOrder: 1 }]);
    renderGate({ jobId: JOB });

    const list = await screen.findByTestId('review-warning-list');

    expect(within(list).getByRole('listitem')).toHaveTextContent(
      'A name here does not appear in the file you uploaded. In Experience.',
    );
    // Not the `other` branch: a seventh code that fell through would still
    // render a sentence, and only its wording would say the branch is missing.
    expect(within(list).getByRole('listitem')).not.toHaveTextContent(
      'Something could not be settled.',
    );
  });

  /**
   * The code is read **open**, exactly as `ResolutionAction` is. The field is
   * a `String` on the wire and the enum is its documentation (`B-069`), so a
   * row written before a rename carries a name this build has never seen —
   * and dropping it would make `warningCount` a lie.
   */
  it('still says something about a code it has never seen', async () => {
    seedImport([{ code: 'a_code_from_a_later_version', sectionOrder: 0 }]);
    renderGate({ jobId: JOB });

    const list = await screen.findByTestId('review-warning-list');

    expect(within(list).getByRole('listitem')).toHaveTextContent(
      'Something could not be settled. In Experience.',
    );
    expect(await screen.findByTestId('review-warnings')).toHaveTextContent(
      'unsure about one thing',
    );
  });

  /** Both kinds at once: the note has to say both things, not the louder one. */
  it('tells the reader about the placed and the placeless separately', async () => {
    seedImport([
      { code: 'ambiguous_date', sectionOrder: 0, entryOrder: 1 },
      { code: 'ambiguous_date' },
    ]);
    renderGate({ jobId: JOB });

    const note = await screen.findByTestId('review-warnings');
    expect(note).toHaveTextContent(en.Onboarding.reviewWarningsOpened);
    expect(note).toHaveTextContent('One of them pointed nowhere in particular');
  });

  /**
   * The reader's own doing outlives the screen's.
   *
   * Which sections are open is a module-level store, so it survives leaving
   * this screen and coming back — and the gate resolves its warnings again on
   * the way back in. Opening the problematic ones has to *add* to what is
   * open: a gate that set the list instead would close, on every return, the
   * section the reader had opened by hand.
   */
  it('leaves a section the reader opened alone when the screen comes back', async () => {
    seedImport([{ code: 'ambiguous_date', sectionOrder: 0, entryOrder: 1 }]);
    const first = renderGate({ jobId: JOB });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Experience' })).toHaveAttribute(
        'aria-expanded',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Skills' }));
    first.unmount();

    renderGate({ jobId: JOB });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Experience' })).toHaveAttribute(
        'aria-expanded',
        'true',
      ),
    );
    expect(screen.getByRole('button', { name: 'Skills' })).toHaveAttribute('aria-expanded', 'true');
  });
});
