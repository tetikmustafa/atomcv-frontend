import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { MarketingHeader } from './MarketingHeader';

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

/**
 * Renders a legal document as titled sections.
 *
 * Sections are headings rather than paragraphs so the document is navigable
 * by heading with a screen reader — these are the pages a user reaches when
 * looking for one specific answer, not ones they read start to finish.
 */
export async function LegalDocument({
  title,
  sections,
  path,
}: {
  title: string;
  sections: LegalSection[];
  /** This page's path without the locale, so the language links keep it. */
  path: string;
}) {
  const t = await getTranslations('Legal');

  return (
    <>
      <MarketingHeader path={path} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[14rem_1fr] lg:px-8">
          {/*
            The contents, beside the text on a wide screen. These are pages
            people open looking for one answer, so the section list is the
            fastest way to it — and it is a list of in-page links, which needs
            no script.
          */}
          <nav aria-labelledby="contents-heading" className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-3">
              <p id="contents-heading" className="text-sm font-medium">
                {title}
              </p>
              <ul className="text-muted-foreground flex flex-col gap-2 border-l text-sm">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="hover:text-foreground -ml-px block border-l border-transparent pl-3 hover:border-current"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="flex max-w-3xl flex-col gap-8">
            <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
            <p
              role="note"
              className="bg-muted text-muted-foreground rounded-xl border px-4 py-3 text-sm"
            >
              {t('draftNotice')}
            </p>

            {sections.map((section) => (
              <section
                key={section.id}
                aria-labelledby={section.id}
                className="flex scroll-mt-24 flex-col gap-2"
              >
                <h2 id={section.id} className="text-xl font-semibold">
                  {section.heading}
                </h2>
                <div className="text-muted-foreground max-w-prose leading-relaxed">
                  {section.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>
    </>
  );
}
