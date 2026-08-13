import type { ReactNode } from 'react';

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
export function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <article className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-2">
          <h2 id={section.id} className="text-xl font-medium">
            {section.heading}
          </h2>
          <div className="text-muted-foreground max-w-prose">{section.body}</div>
        </section>
      ))}
    </article>
  );
}
