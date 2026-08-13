/**
 * Landing page (SSG). Placeholder until the real content lands — strings here
 * are intentionally not translated yet; next-intl arrives in a later step.
 */
export default async function LandingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">AtomCV</h1>
      <p className="text-base">
        Build your profile once, generate a tailored resume for every job posting.
      </p>
      <p className="text-sm opacity-60">Locale: {locale}</p>
    </main>
  );
}
