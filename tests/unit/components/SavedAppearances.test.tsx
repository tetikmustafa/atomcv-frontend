import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvAppearance } from '@/components/settings/CvAppearance';
import { getSession } from '@/lib/api/endpoints/auth';
import { getProfile, listTemplates } from '@/lib/api/endpoints/profile';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';
import { formats } from '@/lib/i18n/formats';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/settings',
}));

let client: QueryClient;

/** Every customization request, with its body. */
let calls: { method: string; url: string; body: Promise<string> }[] = [];

function record({ request }: { request: Request }) {
  if (request.url.includes('/customizations')) {
    calls.push({ method: request.method, url: request.url, body: request.clone().text() });
  }
}

beforeEach(() => {
  calls = [];
  server.events.on('request:start', record);
  return () => server.events.removeListener('request:start', record);
});

/** Signed in: Layer B and everything that keeps it belong to an account. */
async function renderAppearance({ account = true } = {}) {
  if (account) signIn();

  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await client.prefetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });
  await client.prefetchQuery({ queryKey: profileKeys.head(), queryFn: () => getProfile() });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={en} formats={formats}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  return render(<CvAppearance />, { wrapper: Wrapper });
}

const nameField = () => screen.getByLabelText(en.Appearance.presets.nameLabel);

/**
 * § 33.5's capacity, and the sets a profile keeps (`F-038`).
 *
 * Both were on the wire with nothing reading them. The chooser showed three
 * names and no density, which is the state the endpoint's own description
 * calls picking blind.
 */
describe('what the CV looks like', () => {
  it('says what each template holds, so nobody picks blind', async () => {
    /*
      Read off the endpoint rather than written down here, and the reason is a
      measurement: the registry publishes 53 for classic where § 33.5's table
      says ~54, because the table is written as an approximation "for the
      catalogue" and the endpoint exists to give the measured answer. A test
      carrying either number would pin a figure rather than the claim — which
      is that the screen prints **what the server said**, and would fail the
      day somebody hardcoded a plausible one.
    */
    const registry = await listTemplates();
    await renderAppearance();

    for (const template of registry) {
      expect(await screen.findByTestId(`template-capacity-${template.id}`)).toHaveTextContent(
        `About ${template.approximateLinesPerPage} lines a page`,
      );
    }
  });

  /**
   * **Described by, not named by.** Folding the density into the label made
   * the radio's accessible name "ClassicAbout 54 lines a page": the template
   * stopped being findable by its own name, and a screen reader read two
   * facts as one. The name is what this is, the density is what is true about
   * it — which is what a description is for.
   */
  it('leaves each template findable by its own name', async () => {
    await renderAppearance();
    await screen.findByTestId('template-capacity-classic');

    const classic = screen.getByRole('radio', { name: 'Classic' });
    const registry = await listTemplates();
    const lines = registry.find((template) => template.id === 'classic')?.approximateLinesPerPage;

    expect(classic).toBeInTheDocument();
    expect(classic).toHaveAccessibleDescription(`About ${lines} lines a page`);
  });
});

describe('keeping a set of appearance settings', () => {
  /**
   * The working set is still the working set: `preferences.appearance` is
   * what every generation uses when it names nothing, and a profile with none
   * of these kept is what nearly every profile looks like.
   */
  it('starts with none, and asks for a name rather than a second set of sliders', async () => {
    await renderAppearance();

    expect(await screen.findByText(en.Appearance.presets.title)).toBeInTheDocument();
    expect(nameField()).toHaveValue('');
    // No second geometry form: the question is what to call the settings
    // above, not what they should be.
    expect(screen.getAllByRole('slider')).toHaveLength(3);
  });

  it('keeps the working set under the name it was given', async () => {
    const user = userEvent.setup();
    await renderAppearance();

    await user.type(nameField(), 'Compact, one page');
    await user.click(screen.getByRole('button', { name: en.Appearance.presets.keep }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));

    const sent = JSON.parse(await calls.find((call) => call.method === 'POST')!.body);
    expect(sent).toMatchObject({ name: 'Compact, one page', baseTemplateId: 'classic' });

    expect(await screen.findByText('Compact, one page')).toBeInTheDocument();
  });

  /**
   * Deleting warns about nothing, and that is correct rather than careless: a
   * generation made with a set holds the settings themselves in its snapshot
   * rather than an id, so every resume already sent still re-renders exactly
   * as it was.
   */
  it('deletes one without claiming old resumes are at risk', async () => {
    const user = userEvent.setup();
    await renderAppearance();

    await user.type(nameField(), 'Roomy');
    await user.click(screen.getByRole('button', { name: en.Appearance.presets.keep }));
    await screen.findByText('Roomy');

    await user.click(
      screen.getByRole('button', {
        name: en.Appearance.presets.remove.replace('{name}', 'Roomy'),
      }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(en.Appearance.presets.removeBody)).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: en.Appearance.presets.removeConfirm }),
    );

    await waitFor(() => expect(screen.queryByText('Roomy')).toBeNull());
  });

  /**
   * Behind `canCustomizeTemplate`, like the sliders it saves. An anonymous
   * caller has no Layer B to keep, so the control would be a name for
   * nothing — and it must not cost a request either.
   */
  it('draws nothing, and asks for nothing, without an account', async () => {
    await renderAppearance({ account: false });

    await screen.findByText(en.Appearance.template);
    expect(screen.queryByText(en.Appearance.presets.title)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
