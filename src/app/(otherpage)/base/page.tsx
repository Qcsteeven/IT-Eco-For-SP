'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  Search,
} from 'lucide-react';
import type {
  KnowledgeGroup,
  KnowledgeMaterial,
} from '@/lib/knowledge/materials';
import './base.scss';

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export default function BasePage() {
  const [groups, setGroups] = useState<KnowledgeGroup[]>([]);
  const [openedGroups, setOpenedGroups] = useState<string[]>([]);
  const [previewMaterial, setPreviewMaterial] =
    useState<KnowledgeMaterial | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  async function loadMaterials() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/knowledge', { cache: 'no-store' });
      const data = (await res.json()) as ApiResponse<KnowledgeGroup[]>;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось загрузить учебные материалы');
      }

      const loadedGroups = data.data || [];
      setGroups(loadedGroups);
      setOpenedGroups(loadedGroups[0] ? [loadedGroups[0].id] : []);
      setPreviewMaterial(loadedGroups[0]?.materials[0] ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить учебные материалы',
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        materials: group.materials.filter((material) =>
          [
            material.title,
            material.description,
            material.level,
            material.goals.join(' '),
            material.sections.map((section) => section.title).join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.materials.length > 0);
  }, [groups, query]);

  const toggleGroup = (groupId: string) => {
    setOpenedGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  };

  const setMaterialPreview = (groupId: string, material: KnowledgeMaterial) => {
    setPreviewMaterial(material);
    setOpenedGroups((current) =>
      current.includes(groupId) ? current : [...current, groupId],
    );
  };

  return (
    <section className="knowledge-page">
      <div className="knowledge-page__inner">
        <header className="knowledge-page__header">
          <div>
            <h1>Учебные материалы</h1>
            <p>
              Подборка коротких маршрутов для старта, тренировки алгоритмов и
              работы с Codeforces.
            </p>
          </div>

          <label className="knowledge-search">
            <Search size={20} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по материалам"
              type="search"
            />
          </label>
        </header>

        {loading ? (
          <div className="knowledge-state knowledge-state--loading">
            <Loader2 size={24} />
            Загрузка материалов...
          </div>
        ) : error ? (
          <div className="knowledge-state knowledge-state--error">
            <FileText size={24} />
            {error}
          </div>
        ) : (
          <div className="knowledge-layout">
            <div className="knowledge-accordion">
              {visibleGroups.length === 0 ? (
                <div className="knowledge-state">
                  <FileText size={24} />
                  Материалы по этому запросу не найдены.
                </div>
              ) : (
                visibleGroups.map((group) => {
                  const isOpen = openedGroups.includes(group.id);

                  return (
                    <section key={group.id} className="knowledge-group">
                      <button
                        type="button"
                        className="knowledge-group__toggle"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpen}
                      >
                        <span>{group.title}</span>
                        <span>
                          {isOpen ? 'Свернуть' : 'Развернуть'}
                          {isOpen ? (
                            <ChevronUp size={20} />
                          ) : (
                            <ChevronDown size={20} />
                          )}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="knowledge-cards">
                          {group.materials.map((material, index) => (
                            <article
                              key={material.id}
                              className="knowledge-card"
                              onMouseEnter={() => setPreviewMaterial(material)}
                              onFocus={() => setPreviewMaterial(material)}
                            >
                              <div>
                                <p className="knowledge-card__kicker">
                                  {material.level} · {material.duration}
                                </p>
                                <h2>{material.title}</h2>
                                <p>{material.description}</p>
                              </div>
                              <div className="knowledge-card__actions">
                                <button
                                  type="button"
                                  className="knowledge-card__ghost"
                                  onClick={() =>
                                    setMaterialPreview(group.id, material)
                                  }
                                >
                                  Справка
                                </button>
                                <Link
                                  href={`/base/${material.slug}`}
                                  className={`knowledge-card__button ${
                                    index === 0
                                      ? 'knowledge-card__button--primary'
                                      : ''
                                  }`}
                                >
                                  Открыть
                                  <ExternalLink size={17} aria-hidden="true" />
                                </Link>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>

            <aside className="knowledge-preview" aria-label="Краткая справка">
              {previewMaterial ? (
                <>
                  <div className="knowledge-preview__icon">
                    <BookOpen size={28} />
                  </div>
                  <p className="knowledge-preview__label">Краткая справка</p>
                  <h2>{previewMaterial.title}</h2>
                  <p>{previewMaterial.description}</p>
                  <ul>
                    {previewMaterial.goals.slice(0, 3).map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                  <Link
                    href={`/base/${previewMaterial.slug}`}
                    className="knowledge-preview__link"
                  >
                    Перейти к руководству
                  </Link>
                </>
              ) : (
                <>
                  <div className="knowledge-preview__icon">
                    <BookOpen size={28} />
                  </div>
                  <p>Наведите на карточку, чтобы увидеть краткое введение.</p>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
