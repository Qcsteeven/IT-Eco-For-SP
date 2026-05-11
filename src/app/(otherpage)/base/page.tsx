'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  Loader2,
  Search,
} from 'lucide-react';
import type { KnowledgeGroup, KnowledgeMaterial } from '@/lib/knowledge/materials';
import './base.scss';

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export default function BasePage() {
  const [groups, setGroups] = useState<KnowledgeGroup[]>([]);
  const [openedGroups, setOpenedGroups] = useState<string[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
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
      const res = await fetch('/api/knowledge');
      const data = (await res.json()) as ApiResponse<KnowledgeGroup[]>;
      if (!data.ok) throw new Error(data.error || 'Не удалось загрузить материалы');

      const loadedGroups = data.data || [];
      setGroups(loadedGroups);
      setOpenedGroups(loadedGroups.map((group) => group.id));

      const firstMaterial = loadedGroups[0]?.materials[0];
      setActiveGroupId(loadedGroups[0]?.id ?? null);
      setSelectedMaterialId(firstMaterial?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }

  const allOpened = groups.length > 0 && openedGroups.length === groups.length;

  const materials = useMemo(
    () => groups.flatMap((group) => group.materials.map((material) => ({ ...material, groupId: group.id }))),
    [groups],
  );

  const selectedMaterial = useMemo<KnowledgeMaterial | null>(
    () => materials.find((material) => material.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        materials: group.materials.filter((material) =>
          `${material.title} ${material.description} ${material.level} ${material.theory.join(' ')}`
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
    setActiveGroupId(groupId);
  };

  const toggleAll = () => {
    setOpenedGroups(allOpened ? [] : groups.map((group) => group.id));
  };

  const openMaterial = (groupId: string, materialId: string) => {
    setActiveGroupId(groupId);
    setSelectedMaterialId(materialId);
    setOpenedGroups((current) => (current.includes(groupId) ? current : [...current, groupId]));
  };

  return (
    <section className="knowledge-page">
      <div className="knowledge-page__inner">
        <div className="knowledge-page__header">
          <div>
            <p className="knowledge-page__eyebrow">База знаний</p>
            <h1>Учебные материалы</h1>
          </div>
          <button
            type="button"
            className="knowledge-page__toggle"
            onClick={toggleAll}
            disabled={loading || groups.length === 0}
          >
            {allOpened ? (
              <>
                <ChevronUp size={18} />
                Свернуть
              </>
            ) : (
              <>
                <ChevronDown size={18} />
                Развернуть
              </>
            )}
          </button>
        </div>

        <div className="knowledge-page__search">
          <Search size={20} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по материалам"
            type="search"
          />
        </div>

        {loading ? (
          <div className="knowledge-loading">
            <Loader2 size={24} />
            Загрузка материалов...
          </div>
        ) : error ? (
          <div className="knowledge-empty">
            <FileText size={28} />
            <p>{error}</p>
          </div>
        ) : (
          <div className="knowledge-page__layout">
            <aside className="knowledge-groups" aria-label="Группы материалов">
              {groups.map((group) => {
                const isActive = group.id === activeGroup?.id;
                const isOpen = openedGroups.includes(group.id);

                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`knowledge-groups__item ${isActive ? 'is-active' : ''}`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span className="knowledge-groups__icon">
                      <FolderOpen size={20} />
                    </span>
                    <span>
                      <strong>{group.title}</strong>
                      <small>{group.materials.length} материала</small>
                    </span>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                );
              })}
            </aside>

            <div className="knowledge-content">
              <div className="knowledge-content__intro">
                <BookOpen size={28} aria-hidden="true" />
                <div>
                  <h2>{activeGroup?.title ?? 'Материалы'}</h2>
                  <p>
                    {activeGroup?.subtitle ??
                      'Выберите материал слева, чтобы открыть его содержание.'}
                  </p>
                </div>
              </div>

              <div className="knowledge-content__list">
                {visibleGroups.length === 0 ? (
                  <div className="knowledge-empty">
                    <FileText size={28} />
                    <p>Материалы по этому запросу не найдены.</p>
                  </div>
                ) : (
                  visibleGroups.map((group) =>
                    openedGroups.includes(group.id) ? (
                      <section key={group.id} className="knowledge-section">
                        <h3>{group.title}</h3>
                        <div className="knowledge-materials">
                          {group.materials.map((material) => (
                            <article
                              key={material.id}
                              className={`knowledge-material ${
                                selectedMaterialId === material.id ? 'is-selected' : ''
                              }`}
                            >
                              <div className="knowledge-material__icon">
                                <FileText size={24} />
                              </div>
                              <div className="knowledge-material__body">
                                <div className="knowledge-material__meta">
                                  <span>{material.level}</span>
                                  <span>{material.duration}</span>
                                </div>
                                <h4>{material.title}</h4>
                                <p>{material.description}</p>
                              </div>
                              <button
                                type="button"
                                className="knowledge-material__button"
                                onClick={() => openMaterial(group.id, material.id)}
                              >
                                Открыть
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null,
                  )
                )}
              </div>
            </div>

            <article className="knowledge-reader" aria-live="polite">
              {selectedMaterial ? (
                <>
                  <div className="knowledge-reader__header">
                    <div>
                      <p>{selectedMaterial.level}</p>
                      <h2>{selectedMaterial.title}</h2>
                    </div>
                    <span>{selectedMaterial.duration}</span>
                  </div>

                  <section>
                    <h3>Цели</h3>
                    <ul>
                      {selectedMaterial.goals.map((goal) => (
                        <li key={goal}>
                          <CheckCircle2 size={18} />
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3>Теория</h3>
                    {selectedMaterial.theory.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </section>

                  <section>
                    <h3>Практика</h3>
                    <ol>
                      {selectedMaterial.practice.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ol>
                  </section>
                </>
              ) : (
                <div className="knowledge-reader__empty">
                  <BookOpen size={32} />
                  <p>Выберите материал, чтобы открыть содержание.</p>
                </div>
              )}
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
