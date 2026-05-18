import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, ExternalLink } from 'lucide-react';
import { getKnowledgeMaterial } from '@/lib/knowledge/materials';
import './guide.scss';

type KnowledgeGuidePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function KnowledgeGuidePage({
  params,
}: KnowledgeGuidePageProps) {
  const { slug } = await params;
  const material = getKnowledgeMaterial(decodeURIComponent(slug));

  if (!material) {
    notFound();
  }

  return (
    <main className="knowledge-guide">
      <div className="knowledge-guide__inner">
        <Link href="/base" className="knowledge-guide__back">
          <ArrowLeft size={18} aria-hidden="true" />
          Назад к материалам
        </Link>

        <header className="knowledge-guide__header">
          <div>
            <p className="knowledge-guide__group">{material.group.title}</p>
            <h1>{material.title}</h1>
            <p>{material.description}</p>
          </div>
          <aside>
            <span>{material.level}</span>
            <span>{material.duration}</span>
            {material.source &&
              (material.sourceUrl ? (
                <a href={material.sourceUrl} target="_blank" rel="noreferrer">
                  {material.source}
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              ) : (
                <span>{material.source}</span>
              ))}
          </aside>
        </header>

        <section
          className="knowledge-guide__goals"
          aria-labelledby="guide-goals"
        >
          <div className="knowledge-guide__section-title">
            <BookOpen size={24} aria-hidden="true" />
            <h2 id="guide-goals">Что получится после материала</h2>
          </div>
          <ul>
            {material.goals.map((goal) => (
              <li key={goal}>
                <CheckCircle2 size={20} aria-hidden="true" />
                {goal}
              </li>
            ))}
          </ul>
        </section>

        <div className="knowledge-guide__content">
          {material.sections.map((section) => (
            <section key={section.title} className="knowledge-guide__section">
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.code && (
                <pre>
                  <code>{section.code}</code>
                </pre>
              )}
            </section>
          ))}
        </div>

        <section
          className="knowledge-guide__practice"
          aria-labelledby="guide-practice"
        >
          <h2 id="guide-practice">Практика</h2>
          <ol>
            {material.practice.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ol>
        </section>

        {material.resources && material.resources.length > 0 && (
          <section
            className="knowledge-guide__resources"
            aria-labelledby="guide-resources"
          >
            <h2 id="guide-resources">Полезные ссылки</h2>
            <div>
              {material.resources.map((resource) => (
                <a
                  key={resource.href}
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {resource.label}
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
