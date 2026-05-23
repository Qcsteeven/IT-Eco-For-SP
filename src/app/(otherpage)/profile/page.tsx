'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import './profile.scss';
import CodeforcesStats from '@/components/CodeforcesStats';
import CodeforcesProblems from '@/components/CodeforcesProblems';
import AtCoderConnectModal from './components/AtCoderConnectModal';
import CodeforcesConnectModal from './components/CodeforcesConnectModal';
import ExternalSystemsCard from './components/ExternalSystemsCard';
import ProfileEditForm from './components/ProfileEditForm';
import ProfileHistoryCard from './components/ProfileHistoryCard';
import ProfileSummaryCard from './components/ProfileSummaryCard';
import {
  AtCoderStatsSection,
  CodeforcesStatsSection,
} from './components/PlatformStatsSection';
import type {
  AtCoderApiResponse,
  AtCoderData,
  CFData,
  CfKarmaData,
  ContestProblem,
  HistoryItem,
  ProfileApiResponse,
  RatingSort,
  UserData,
} from './types';

const ProfilePage: React.FC = () => {
  const { status } = useSession();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AtCoder состояния
  const [atCoderData, setAtCoderData] = useState<AtCoderData | null>(null);
  const [showAtCoderModal, setShowAtCoderModal] = useState(false);
  const [atCoderInput, setAtCoderInput] = useState('');
  const [atCoderLoading, setAtCoderLoading] = useState(false);
  const [atCoderError, setAtCoderError] = useState<string | null>(null);
  const [showAtCoderSubmissions, setShowAtCoderSubmissions] = useState(false);
  const [generatedVerificationCode, setGeneratedVerificationCode] =
    useState('');
  const [verificationStep, setVerificationStep] =
    useState<'input_username' | 'show_code' | 'verifying'>('input_username');

  // Codeforces состояния
  const [cfData, setCfData] = useState<CFData | null>(null);
  const [showCFModal, setShowCFModal] = useState(false);
  const [cfInput, setCfInput] = useState('');
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState<string | null>(null);
  const [showCFSubmissions, setShowCFSubmissions] = useState(false);
  const [cfGeneratedCode, setCfGeneratedCode] = useState('');
  const [cfVerificationStep, setCfVerificationStep] =
    useState<'input_username' | 'show_code' | 'verifying'>('input_username');
  const [cfAutoVerifyCountdown, setCfAutoVerifyCountdown] = useState<number>(5);

  // Состояния для задач соревнования
  const [expandedContestId, setExpandedContestId] = useState<string | null>(
    null,
  );
  const [contestProblems, setContestProblems] = useState<
    Record<string, ContestProblem[]>
  >({});
  const [contestProblemsLoading, setContestProblemsLoading] = useState<
    Record<string, boolean>
  >({});

  // Фильтры
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [placeFrom, setPlaceFrom] = useState<string>('');
  const [placeTo, setPlaceTo] = useState<string>('');
  const [ratingSort, setRatingSort] = useState<RatingSort>('none');
  const [historyLimit, setHistoryLimit] = useState(6);
  const [isEditing, setIsEditing] = useState(false);

  // Codeforces Karma состояния
  const [cfKarmaData, setCfKarmaData] = useState<CfKarmaData | null>(null);
  const [cfKarmaLoading, setCfKarmaLoading] = useState(false);
  const [showCFStats, setShowCFStats] = useState(false);
  const [showCFProblems, setShowCFProblems] = useState(false);

  // Кэш кармы AtCoder (данные подгружаются для будущего UI; референс не триггерит ререндер)
  const atcoderKarmaCacheRef = useRef<unknown>(null);

  // Редирект при неавторизованном доступе
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  // Загрузка данных
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchProfileData = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/profile');
          const result: ProfileApiResponse = await response.json();

          console.log('[Profile API] Response:', result);

          if (response.ok && result.ok && result.data) {
            setUserData(result.data.user);
            setHistoryData(result.data.history);
            console.log(
              '[Profile] History loaded:',
              result.data.history.length,
              'items',
            );
            console.log('[Profile] Platforms:', [
              ...new Set(
                result.data.history.map(
                  (item: HistoryItem) => item.contest.platform,
                ),
              ),
            ]);
          } else {
            setError(result.error || 'Не удалось загрузить данные профиля.');
            if (response.status === 401) signOut();
          }
        } catch (err) {
          console.error('Fetch error:', err);
          setError('Сетевая ошибка при загрузке данных.');
        } finally {
          setLoading(false);
        }
      };

      fetchProfileData();
    }
  }, [status]);

  // Загрузка данных AtCoder
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAtCoderData = async () => {
        try {
          const response = await fetch('/api/profile/atcoder');
          const result: AtCoderApiResponse = await response.json();

          if (response.ok && result.ok && result.data) {
            setAtCoderData(result.data);

            // AtCoder история теперь загружается через основной API /api/profile
            // Здесь ничего не делаем, данные уже есть в historyData
          }
        } catch (err) {
          console.error('AtCoder fetch error:', err);
        }
      };

      fetchAtCoderData();
    }
  }, [status]);

  // Загрузка данных Codeforces
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchCFData = async () => {
        try {
          const response = await fetch('/api/profile/codeforces');
          const result: CFData = await response.json();

          console.log('[CF Data] Response:', response.status, result);

          if (response.ok && result) {
            setCfData(result);
            console.log(
              '[CF Data] Connected:',
              result.connected,
              'Username:',
              result.cf_username,
            );
          }
        } catch (err) {
          console.error('Codeforces fetch error:', err);
        }
      };

      fetchCFData();
    }
  }, [status]);

  // Загрузка данных кармы Codeforces
  useEffect(() => {
    if (status === 'authenticated' && cfData?.connected) {
      const fetchCFKarma = async () => {
        try {
          setCfKarmaLoading(true);
          const response = await fetch('/api/codeforces/karma?refresh=1', {
            cache: 'no-store',
          });
          const result = await response.json();

          console.log('[CF Karma] Response:', response.status, result);

          if (response.ok && result.ok && result.data) {
            console.log('[CF Karma] Data:', result.data);
            setCfKarmaData(result.data);

            setUserData((u) =>
              u && result.data.karma !== u.codeforces_karma
                ? { ...u, codeforces_karma: result.data.karma }
                : u,
            );
          } else {
            console.error('[CF Karma] Error:', result);
          }
        } catch (err) {
          console.error('[CF Karma] Fetch error:', err);
        } finally {
          setCfKarmaLoading(false);
        }
      };

      fetchCFKarma();
    }
  }, [status, cfData?.connected]);

  // Загрузка данных кармы AtCoder (кэш в ref для будущего UI)
  useEffect(() => {
    if (status === 'authenticated' && atCoderData?.connected) {
      const fetchAtCoderKarma = async () => {
        try {
          const response = await fetch('/api/atcoder/problems');
          const result = await response.json();

          console.log('[AtCoder Karma] Response:', response.status, result);

          if (response.ok && result.ok && result.data) {
            console.log('[AtCoder Karma] Data:', result.data);
            atcoderKarmaCacheRef.current = result.data;
          } else {
            console.error('[AtCoder Karma] Error:', result);
          }
        } catch (err) {
          console.error('[AtCoder Karma] Fetch error:', err);
        }
      };

      fetchAtCoderKarma();
    }
  }, [status, atCoderData?.connected]);

  // Автоматическая проверка кода верификации Codeforces
  useEffect(() => {
    if (cfVerificationStep === 'verifying' && cfGeneratedCode) {
      setCfAutoVerifyCountdown(5);

      // Обратный отсчёт
      const countdownInterval = setInterval(() => {
        setCfAutoVerifyCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Ждём 5 секунд, затем проверяем
      const timer = setTimeout(() => {
        handleVerifyCFFirstName();
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearInterval(countdownInterval);
      };
    }
    // Запуск однократного таймера при входе в шаг verifying; handleVerify стабилен по смыслу сценария
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-arming countdown on every render
  }, [cfVerificationStep]);

  // Уникальные платформы
  const platforms = useMemo(() => {
    const unique = new Set<string>();
    historyData.forEach((item) => unique.add(item.contest.platform));
    return Array.from(unique).sort();
  }, [historyData]);

  // Фильтрация и сортировка
  const filteredAndSortedHistory = useMemo(() => {
    let result = [...historyData];

    // Фильтр по дате
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(
        (item) => new Date(item.date_recorded) >= fromDate,
      );
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // до конца дня
      result = result.filter((item) => new Date(item.date_recorded) <= toDate);
    }

    // Фильтр по платформе
    if (platformFilter !== 'all') {
      result = result.filter(
        (item) => item.contest.platform === platformFilter,
      );
    }

    // Фильтр по месту (placement)
    if (placeFrom || placeTo) {
      const minPlace = placeFrom ? parseInt(placeFrom, 10) : -Infinity;
      const maxPlace = placeTo ? parseInt(placeTo, 10) : Infinity;

      if (!isNaN(minPlace) || !isNaN(maxPlace)) {
        result = result.filter((item) => {
          const placeNum = parseInt(item.placement, 10);
          if (isNaN(placeNum)) return false;
          return placeNum >= minPlace && placeNum <= maxPlace;
        });
      }
    }

    // Сортировка по рейтингу БЦСП (mmr_change)
    if (ratingSort !== 'none') {
      result.sort((a, b) => {
        if (ratingSort === 'asc') {
          return a.mmr_change - b.mmr_change;
        } else {
          return b.mmr_change - a.mmr_change;
        }
      });
    }

    return result;
  }, [
    historyData,
    dateFrom,
    dateTo,
    platformFilter,
    placeFrom,
    placeTo,
    ratingSort,
  ]);

  const visibleHistory = useMemo(
    () => filteredAndSortedHistory.slice(0, historyLimit),
    [filteredAndSortedHistory, historyLimit],
  );

  // Обработка открытия модального окна AtCoder
  const handleAtCoderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (atCoderData?.connected) {
      // Если уже подключен - показываем/скрываем сабмишены
      setShowAtCoderSubmissions(!showAtCoderSubmissions);
    } else if (atCoderData?.pending_verification) {
      // Если есть активная верификация — показываем код
      setVerificationStep('show_code');
      setAtCoderInput(atCoderData.pending_atcoder_username || '');
      setGeneratedVerificationCode(atCoderData.verification_code || '');
      setAtCoderError(null);
      setShowAtCoderModal(true);
    } else {
      // Если не подключен - открываем модальное окно с вводом username
      setVerificationStep('input_username');
      setAtCoderInput('');
      setGeneratedVerificationCode('');
      setAtCoderError(null);
      setShowAtCoderModal(true);
    }
  };

  // Обработка начала привязки AtCoder (отправка username)
  const handleConnectAtCoder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atCoderInput.trim()) {
      setAtCoderError('Введите имя пользователя AtCoder');
      return;
    }

    setAtCoderLoading(true);
    setAtCoderError(null);

    try {
      const response = await fetch('/api/profile/atcoder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atcoder_username: atCoderInput.trim() }),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        // Сохраняем код и показываем экран с инструкцией
        setGeneratedVerificationCode(result.verification_code);
        setVerificationStep('show_code');
      } else {
        setAtCoderError(result.error || 'Ошибка при привязке аккаунта');
      }
    } catch {
      setAtCoderError('Ошибка соединения с сервером.');
    } finally {
      setAtCoderLoading(false);
    }
  };

  // Обработка проверки кода в Affiliation
  const handleVerifyAffiliation = async () => {
    setAtCoderLoading(true);
    setAtCoderError(null);

    try {
      const response = await fetch('/api/profile/atcoder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        alert(`Аккаунт AtCoder "${atCoderInput.trim()}" успешно привязан!`);
        setShowAtCoderModal(false);
        setAtCoderInput('');
        setGeneratedVerificationCode('');
        setVerificationStep('input_username');

        // Обновляем данные AtCoder
        const atCoderResponse = await fetch('/api/profile/atcoder');
        const atCoderResult = await atCoderResponse.json();
        if (atCoderResponse.ok && atCoderResult.ok && atCoderResult.data) {
          setAtCoderData(atCoderResult.data);
        }

        // Перезагружаем профиль, чтобы обновить bscp_rating (MAX из CF и AtCoder)
        const profileResponse = await fetch('/api/profile');
        const profileResult: ProfileApiResponse = await profileResponse.json();

        if (profileResponse.ok && profileResult.ok && profileResult.data) {
          setUserData(profileResult.data.user);
          setHistoryData(profileResult.data.history);
        }
      } else {
        setAtCoderError(result.error || 'Код не найден в Affiliation');
      }
    } catch {
      setAtCoderError('Ошибка соединения с сервером.');
    } finally {
      setAtCoderLoading(false);
    }
  };

  // Обработка отвязки AtCoder
  const handleDisconnectAtCoder = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!atCoderData?.atcoder_username) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите отвязать AtCoder аккаунт: ${atCoderData.atcoder_username}?`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/profile/atcoder', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        alert('Аккаунт AtCoder отвязан.');

        // Очищаем историю рейтинга AtCoder
        setHistoryData((prev) =>
          prev.filter((item) => item.contest.platform !== 'AtCoder'),
        );

        // Сбрасываем карму AtCoder
        atcoderKarmaCacheRef.current = null;
        setAtCoderData({
          connected: false,
          atcoder_username: null,
          submissions: [],
        });
        setShowAtCoderSubmissions(false);

        // Перезагружаем профиль, чтобы получить актуальный рейтинг (из Codeforces, если подключён)
        const profileResponse = await fetch('/api/profile');
        const profileResult: ProfileApiResponse = await profileResponse.json();

        if (profileResponse.ok && profileResult.ok && profileResult.data) {
          setUserData(profileResult.data.user);
          // Обновляем историю (без AtCoder)
          setHistoryData(profileResult.data.history);
        }
      } else {
        alert(result.error || 'Ошибка при отвязке аккаунта');
      }
    } catch {
      alert('Ошибка соединения с сервером.');
    }
  };

  // Сброс модального окна
  const handleCloseModal = () => {
    setShowAtCoderModal(false);
    setAtCoderError(null);
    setGeneratedVerificationCode('');
    setVerificationStep('input_username');
  };

  // Codeforces функции
  const handleCFClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (cfData?.connected) {
      setShowCFSubmissions(!showCFSubmissions);
    } else if (cfData?.pending_verification) {
      // Если есть активная верификация — показываем код
      setCfVerificationStep('show_code');
      setCfInput(cfData.pending_cf_username || '');
      setCfGeneratedCode(cfData.verification_code || '');
      setCfError(null);
      setShowCFModal(true);
    } else {
      setCfVerificationStep('input_username');
      setCfInput('');
      setCfGeneratedCode('');
      setCfError(null);
      setShowCFModal(true);
    }
  };

  const handleConnectCF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfInput.trim()) {
      setCfError('Введите хендл Codeforces');
      return;
    }

    setCfLoading(true);
    setCfError(null);

    try {
      const response = await fetch('/api/profile/codeforces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cf_handle: cfInput.trim() }),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        setCfGeneratedCode(result.verification_code);
        setCfVerificationStep('show_code');
      } else {
        setCfError(result.error || 'Ошибка при привязке аккаунта');
      }
    } catch {
      setCfError('Ошибка соединения с сервером.');
    } finally {
      setCfLoading(false);
    }
  };

  const handleVerifyCFFirstName = async () => {
    setCfLoading(true);
    setCfError(null);

    try {
      const response = await fetch('/api/profile/codeforces', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        alert(`Аккаунт Codeforces "${cfInput.trim()}" успешно привязан!`);
        setShowCFModal(false);
        setCfInput('');
        setCfGeneratedCode('');
        setCfVerificationStep('input_username');

        // Обновляем данные Codeforces
        const cfResponse = await fetch('/api/profile/codeforces');
        const cfResult = await cfResponse.json();
        if (cfResponse.ok && cfResult) {
          setCfData(cfResult);
        }

        // Перезагружаем профиль, чтобы обновить bscp_rating (MAX из CF и AtCoder)
        const profileResponse = await fetch('/api/profile');
        const profileResult: ProfileApiResponse = await profileResponse.json();

        if (profileResponse.ok && profileResult.ok && profileResult.data) {
          setUserData(profileResult.data.user);
          setHistoryData(profileResult.data.history);
        }
      } else {
        setCfError(result.error || 'Код не найден в First Name');
      }
    } catch {
      setCfError('Ошибка соединения с сервером.');
    } finally {
      setCfLoading(false);
    }
  };

  const handleDisconnectCFNew = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!cfData?.cf_username) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите отвязать Codeforces аккаунт: ${cfData.cf_username}? Рейтинг будет пересчитан.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/profile/codeforces', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        alert('Аккаунт Codeforces отвязан. Рейтинг обновлен.');

        // Очищаем историю рейтинга Codeforces
        setHistoryData((prev) =>
          prev.filter((item) => item.contest.platform !== 'Codeforces'),
        );

        // Сбрасываем карму
        setCfKarmaData(null);
        setCfData({ connected: false, cf_username: null, submissions: [] });
        setShowCFSubmissions(false);

        // Перезагружаем профиль, чтобы получить актуальный рейтинг (из AtCoder, если подключён)
        const profileResponse = await fetch('/api/profile');
        const profileResult: ProfileApiResponse = await profileResponse.json();

        if (profileResponse.ok && profileResult.ok && profileResult.data) {
          setUserData(profileResult.data.user);
          // Обновляем историю (без Codeforces)
          setHistoryData(profileResult.data.history);
        }
      } else {
        alert(result.error || 'Ошибка при отвязке аккаунта');
      }
    } catch {
      alert('Ошибка соединения с сервером.');
    }
  };

  const handleCFCloseModal = () => {
    setShowCFModal(false);
    setCfError(null);
    setCfGeneratedCode('');
    setCfVerificationStep('input_username');
    setCfAutoVerifyCountdown(5);
  };

  // Загрузка задач соревнования
  const handleContestClick = async (
    contestId: string,
    contestName: string,
    platform: string,
  ) => {
    const uniqueKey = `${platform}_${contestId}`;

    // Если уже раскрыто - сворачиваем
    if (expandedContestId === uniqueKey) {
      setExpandedContestId(null);
      return;
    }

    setExpandedContestId(uniqueKey);

    // Если уже загружено - не загружаем снова
    if (contestProblems[uniqueKey]) {
      return;
    }

    setContestProblemsLoading((prev) => ({ ...prev, [uniqueKey]: true }));

    // Для Codeforces и AtCoder используем клиентский fetch
    if (platform.toLowerCase() === 'codeforces') {
      await loadCFProblemsClientSide(contestId, uniqueKey);
    } else if (platform.toLowerCase() === 'atcoder') {
      await loadAtCoderProblemsClientSide(contestId, uniqueKey);
    }
  };

  // Загрузка задач Codeforces - показываем только решённые
  const loadCFProblemsClientSide = async (
    contestId: string,
    uniqueKey: string,
  ) => {
    console.log(
      `[CF Client] Fetching solved problems for contest ${contestId}`,
    );

    try {
      // Получаем данные пользователя
      const profileResponse = await fetch('/api/profile/codeforces');
      const profileData = await profileResponse.json();

      if (!profileData.connected || !profileData.cf_username) {
        console.error('[CF Client] Codeforces not connected');
        setContestProblems((prev) => ({ ...prev, [uniqueKey]: [] }));
        setContestProblemsLoading((prev) => ({ ...prev, [uniqueKey]: false }));
        return;
      }

      const cfHandle = profileData.cf_username;
      console.log(`[CF Client] Using handle: ${cfHandle}`);

      // Получаем submission'ы пользователя
      const submissionsRes = await fetch(
        `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=10000`,
      );
      const submissionsData = await submissionsRes.json();

      const solvedProblems = new Map<string, { name: string }>();

      if (submissionsData.status === 'OK' && submissionsData.result) {
        const submissions: unknown[] = submissionsData.result;
        console.log(`[CF Client] Found ${submissions.length} submissions`);

        // Фильтруем только решённые задачи для этого конкурса
        submissions.forEach((sub: unknown) => {
          const submission = sub as {
            problem?: { contestId?: number; index?: string; name?: string };
            verdict?: string;
          };

          if (
            submission.problem?.contestId === parseInt(contestId) &&
            submission.verdict === 'OK'
          ) {
            const idx = submission.problem.index || 'Unknown';
            solvedProblems.set(idx, {
              name: submission.problem.name || `Problem ${idx}`,
            });
          }
        });

        console.log(
          `[CF Client] Solved problems:`,
          Array.from(solvedProblems.keys()),
        );
      }

      // Формируем список только решённых задач
      const problems: ContestProblem[] = Array.from(
        solvedProblems.entries(),
      ).map(([index, data]) => ({
        contestId: parseInt(contestId),
        problemIndex: index,
        problemName: data.name,
        problemType: 'PROGRAMMING',
        tags: [],
        solved: true,
        problemUrl: `https://codeforces.com/contest/${contestId}/problem/${index}`,
      }));

      // Сортируем по индексу (A, B, C...)
      problems.sort((a, b) => a.problemIndex.localeCompare(b.problemIndex));

      console.log(`[CF Client] Total solved: ${problems.length}`);
      console.log(`[CF Client] Problems:`, problems);

      setContestProblems((prev) => ({ ...prev, [uniqueKey]: problems }));
    } catch (err) {
      console.error('[CF Client] Error loading problems:', err);
      setContestProblems((prev) => ({ ...prev, [uniqueKey]: [] }));
    } finally {
      setContestProblemsLoading((prev) => ({ ...prev, [uniqueKey]: false }));
    }
  };

  // Загрузка задач AtCoder - показываем только решённые
  const loadAtCoderProblemsClientSide = async (
    contestId: string,
    uniqueKey: string,
  ) => {
    console.log(
      `[AtCoder Client] Fetching solved problems for contest ${contestId}, uniqueKey: ${uniqueKey}`,
    );

    try {
      // Шаг 1: Получаем список решённых problem IDs через GET
      const getResponse = await fetch(`/api/atcoder/${contestId}/solved`);
      const getResult = await getResponse.json();

      console.log('[AtCoder Client] GET response:', getResult);

      if (
        !getResponse.ok ||
        !getResult.ok ||
        !getResult.problemIds ||
        getResult.problemIds.length === 0
      ) {
        console.log('[AtCoder Client] No solved problems found');
        setContestProblems((prev) => ({ ...prev, [uniqueKey]: [] }));
        setContestProblemsLoading((prev) => ({ ...prev, [uniqueKey]: false }));
        return;
      }

      // Шаг 2: Получаем названия задач через POST
      const postResponse = await fetch(`/api/atcoder/${contestId}/solved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemIds: getResult.problemIds,
        }),
      });

      const postResult = await postResponse.json();
      console.log('[AtCoder Client] POST response:', postResult);

      if (postResponse.ok && postResult.ok && postResult.problems) {
        console.log(
          `[AtCoder Client] Total solved: ${postResult.problems.length}`,
        );
        console.log(`[AtCoder Client] Problems:`, postResult.problems);

        setContestProblems((prev) => ({
          ...prev,
          [uniqueKey]: postResult.problems,
        }));
      } else {
        console.error(`[AtCoder Client] Error:`, postResult.error);
        setContestProblems((prev) => ({ ...prev, [uniqueKey]: [] }));
      }
    } catch (err) {
      console.error('[AtCoder Client] Error loading problems:', err);
      setContestProblems((prev) => ({ ...prev, [uniqueKey]: [] }));
    } finally {
      setContestProblemsLoading((prev) => ({ ...prev, [uniqueKey]: false }));
    }
  };

  // Сохранение формы
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      oldPassword: formData.get('oldPassword'),
      newPassword: formData.get('newPassword'),
    };

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Данные успешно сохранены!');
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                full_name: payload.full_name as string,
                phone: payload.phone as string,
              }
            : null,
        );
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Ошибка при сохранении');
      }
    } catch {
      alert('Ошибка соединения с сервером.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPlatformFilter('all');
    setPlaceFrom('');
    setPlaceTo('');
    setRatingSort('none');
  };

  if (status === 'loading' || loading) {
    return (
      <main>
        <section id="profile">
          <p className="status-msg">Загрузка профиля...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <section id="profile">
          <h1 className="error-title">Ошибка</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!userData) {
    return (
      <main>
        <section id="profile">
          <p>Данные профиля не найдены.</p>
          <button onClick={() => signOut()} className="btn-logout">
            Выйти
          </button>
        </section>
      </main>
    );
  }

  const canOpenKarmaDetails = Boolean(
    cfData?.connected && cfKarmaData && !cfKarmaLoading,
  );
  const karmaDetailsTitle = cfKarmaLoading
    ? 'Статистика кармы загружается'
    : !cfData?.connected
      ? 'Привяжите Codeforces, чтобы посмотреть задачи'
      : !cfKarmaData
        ? 'Статистика кармы ещё не загружена'
        : 'Открыть решённые задачи Codeforces';

  return (
    <main>
      <section
        id="profile"
        className="profile-page"
        style={{ display: 'block' }}
        data-cf-karma-loading={cfKarmaLoading}
      >
        <ProfileSummaryCard
          userData={userData}
          onToggleEdit={() => setIsEditing((v) => !v)}
          onSignOut={() => signOut()}
          onOpenKarmaDetails={() => setShowCFProblems(true)}
          isKarmaDetailsDisabled={!canOpenKarmaDetails}
          karmaDetailsTitle={karmaDetailsTitle}
        />

        <ExternalSystemsCard
          cfData={cfData}
          atCoderData={atCoderData}
          onCFClick={handleCFClick}
          onAtCoderClick={handleAtCoderClick}
        />

        {showCFModal && (
          <CodeforcesConnectModal
            step={cfVerificationStep}
            input={cfInput}
            loading={cfLoading}
            error={cfError}
            generatedCode={cfGeneratedCode}
            autoVerifyCountdown={cfAutoVerifyCountdown}
            onInputChange={setCfInput}
            onClose={handleCFCloseModal}
            onConnect={handleConnectCF}
            onVerify={handleVerifyCFFirstName}
            onResetCode={() => {
              setCfGeneratedCode('');
              setCfVerificationStep('input_username');
            }}
            onStartVerify={() => setCfVerificationStep('verifying')}
          />
        )}

        {showAtCoderModal && (
          <AtCoderConnectModal
            step={verificationStep}
            input={atCoderInput}
            loading={atCoderLoading}
            error={atCoderError}
            generatedCode={generatedVerificationCode}
            onInputChange={setAtCoderInput}
            onClose={handleCloseModal}
            onConnect={handleConnectAtCoder}
            onVerify={handleVerifyAffiliation}
            onResetCode={() => {
              setGeneratedVerificationCode('');
              setVerificationStep('input_username');
            }}
            onStartVerify={() => setVerificationStep('verifying')}
          />
        )}

        {atCoderData?.connected && showAtCoderSubmissions && (
          <AtCoderStatsSection
            data={atCoderData}
            onDisconnect={handleDisconnectAtCoder}
          />
        )}

        {cfData?.connected && showCFSubmissions && (
          <CodeforcesStatsSection
            data={cfData}
            onDisconnect={handleDisconnectCFNew}
          />
        )}

        <ProfileHistoryCard
          visibleHistory={visibleHistory}
          filteredCount={filteredAndSortedHistory.length}
          platforms={platforms}
          dateFrom={dateFrom}
          dateTo={dateTo}
          platformFilter={platformFilter}
          placeFrom={placeFrom}
          placeTo={placeTo}
          ratingSort={ratingSort}
          contestProblems={contestProblems}
          contestProblemsLoading={contestProblemsLoading}
          expandedContestId={expandedContestId}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onPlatformFilterChange={setPlatformFilter}
          onPlaceFromChange={setPlaceFrom}
          onPlaceToChange={setPlaceTo}
          onRatingSortChange={setRatingSort}
          onResetFilters={handleResetFilters}
          onContestClick={handleContestClick}
          onLoadMore={() => setHistoryLimit((v) => v + 6)}
        />

        {isEditing && (
          <ProfileEditForm
            userData={userData}
            saving={saving}
            onSubmit={handleSubmit}
          />
        )}
      </section>

      {/* Модальное окно статистики Codeforces */}
      {showCFStats && cfKarmaData && (
        <CodeforcesStats
          karma={cfKarmaData.karma}
          karmaLevel={cfKarmaData.karmaLevel}
          karmaColor={cfKarmaData.karmaColor}
          breakdown={cfKarmaData.breakdown}
          details={cfKarmaData.details}
          difficultyDistribution={cfKarmaData.difficultyDistribution}
          tagStats={cfKarmaData.tagStats}
          onClose={() => setShowCFStats(false)}
        />
      )}

      {/* Модальное окно со списком задач */}
      {showCFProblems && cfKarmaData && cfKarmaData.problems && (
        <CodeforcesProblems
          problems={cfKarmaData.problems}
          karma={cfKarmaData.karma}
          karmaLevel={cfKarmaData.karmaLevel}
          karmaColor={cfKarmaData.karmaColor}
          details={cfKarmaData.details}
          onClose={() => setShowCFProblems(false)}
        />
      )}
    </main>
  );
};

export default ProfilePage;
