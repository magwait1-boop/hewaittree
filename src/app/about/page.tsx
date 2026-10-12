import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { aboutContent, type AboutBlock } from './content';
import styles from './page.module.css';
import ThemeToggle from '@/app/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'من نحن | عائلة حويت',
  description: 'عائلة حويت… تاريخ نحفظه، ورحم نصله، وإرث نورثه',
};

function InlineText({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**')) {
      return (
        <strong key={index} className="font-bold text-amber-200">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*')) {
      return (
        <em key={index} className="not-italic text-amber-300/80">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function ContentBlock({ block }: { block: AboutBlock }) {
  if (block.kind === 'divider') {
    return <hr className="my-8 border-amber-500/20" />;
  }
  if (block.kind === 'list') {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((name) => (
          <li
            key={name}
            className="flex items-start gap-3 rounded-xl border border-amber-900/40 bg-slate-950/50 px-4 py-3 text-sm leading-7 text-amber-100 sm:text-base"
          >
            <span aria-hidden="true" className="mt-1 text-amber-500">
              ✦
            </span>
            <span>{name}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === 'heading') {
    return (
      <h3 className="text-xl font-bold leading-relaxed text-amber-300 sm:text-2xl">{block.text}</h3>
    );
  }
  return (
    <p className="text-base leading-[2] text-slate-300 sm:text-lg">
      <InlineText text={block.text} />
    </p>
  );
}

const sections: { title: string; blocks: AboutBlock[] }[] = [];
const introduction: AboutBlock[] = [];
for (const block of aboutContent.slice(3)) {
  if (block.kind === 'heading' && block.level === 2) {
    sections.push({ title: block.text, blocks: [] });
  } else if (sections.length) {
    sections[sections.length - 1].blocks.push(block);
  } else {
    introduction.push(block);
  }
}

function SectionContent({ blocks }: { blocks: AboutBlock[] }) {
  const lead: AboutBlock[] = [];
  const cards: { title: string; blocks: AboutBlock[] }[] = [];
  const ending: AboutBlock[] = [];
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 3) {
      cards.push({ title: block.text, blocks: [] });
    } else if (cards.length) {
      cards[cards.length - 1].blocks.push(block);
    } else {
      lead.push(block);
    }
  }
  // The final tribute belongs to the whole team, after the four biographies.
  if (cards.length === 4) {
    const lastCard = cards[cards.length - 1];
    const tribute = lastCard.blocks.pop();
    if (tribute) ending.push(tribute);
  }
  return (
    <>
      <div className="space-y-5">
        {lead.map((block, index) => (
          <ContentBlock key={index} block={block} />
        ))}
      </div>
      {cards.length > 0 && (
        <div className="mt-8 grid items-start gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <article
              key={card.title}
              className="space-y-4 rounded-2xl border border-slate-800 border-r-4 border-r-amber-500 bg-slate-900/90 p-5 sm:p-7"
            >
              <h3 className="text-xl font-bold leading-relaxed text-amber-300">{card.title}</h3>
              {card.blocks.map((block, index) => (
                <ContentBlock key={index} block={block} />
              ))}
            </article>
          ))}
        </div>
      )}
      {ending.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 sm:p-7">
          {ending.map((block, index) => (
            <ContentBlock key={index} block={block} />
          ))}
        </div>
      )}
    </>
  );
}

export default function AboutUsPage() {
  return (
    <div
      dir="rtl"
      className={`${styles.page} fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-200 selection:bg-amber-600 selection:text-white`}
    >
      <header className="sticky top-0 z-20 border-b border-amber-900/30 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <Link href="/about" className="text-lg font-bold text-amber-400 sm:text-xl">
              عائلة حويت
            </Link>
            <p className="hidden text-xs text-slate-400 sm:block">وثيقة وفاء وتاريخ</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-600/15 px-3 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 sm:px-4"
            >
              <span aria-hidden="true">←</span> العودة إلى الشجرة
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:py-16 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 max-w-full rounded-full bg-amber-600/10 blur-[100px]"
        />
        <section aria-labelledby="about-title" className="relative mb-10 text-center sm:mb-14">
          <p className="mb-6 text-4xl leading-relaxed text-amber-300 sm:text-5xl">﷽</p>
          <div
            aria-hidden="true"
            className="mb-5 flex items-center justify-center gap-4 text-amber-500"
          >
            <span className="h-px w-12 bg-amber-500/40" />۞
            <span className="h-px w-12 bg-amber-500/40" />
          </div>
          <h1
            id="about-title"
            className="bg-gradient-to-l from-amber-200 via-amber-400 to-amber-600 bg-clip-text pb-3 text-3xl font-bold leading-relaxed text-transparent sm:text-5xl"
          >
            من نحن | عائلة حويت
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-loose text-amber-200/90 sm:text-2xl">
            عائلة حويت… تاريخ نحفظه، ورحم نصله، وإرث نورثه
          </p>
          <div className="mx-auto mt-8 max-w-3xl space-y-5 rounded-3xl border border-amber-900/40 bg-slate-900/70 p-5 sm:p-8">
            {introduction.map((block, index) => (
              <ContentBlock key={index} block={block} />
            ))}
          </div>
        </section>

        <nav
          aria-label="أقسام صفحة من نحن"
          className="relative mb-10 flex flex-wrap justify-center gap-2 sm:mb-14"
        >
          {['عن العائلة', 'رحلة التوثيق', 'جهود سابقة', 'شكر وتقدير', 'رسالتنا', 'كلمة أخيرة'].map(
            (label, index) => (
              <a
                key={label}
                href={`#about-section-${index}`}
                className="inline-flex min-h-11 items-center rounded-full border border-amber-900/40 bg-slate-900 px-4 py-2 text-sm text-amber-200 transition-colors hover:border-amber-500/60 hover:bg-amber-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                {label}
              </a>
            )
          )}
        </nav>

        <div className="relative space-y-8 sm:space-y-12">
          {sections.map((section, index) => (
            <section
              key={section.title}
              id={`about-section-${index}`}
              aria-labelledby={`about-heading-${index}`}
              className="scroll-mt-28 rounded-3xl border border-amber-900/30 bg-slate-900/40 p-5 sm:p-8 lg:p-10"
            >
              <div className="mb-6 flex items-start gap-3 sm:mb-8">
                <span aria-hidden="true" className="mt-1 text-xl text-amber-500">
                  ❖
                </span>
                <h2
                  id={`about-heading-${index}`}
                  className="text-xl font-bold leading-relaxed text-amber-400 sm:text-3xl"
                >
                  {section.title}
                </h2>
              </div>
              <SectionContent blocks={section.blocks} />
            </section>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="mt-10 flex items-center justify-center gap-4 text-amber-500/50"
        >
          <span className="h-px w-16 bg-amber-500/30" />✦
          <span className="h-px w-16 bg-amber-500/30" />
        </div>
      </main>
    </div>
  );
}
