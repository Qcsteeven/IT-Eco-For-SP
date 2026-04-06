'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import './profile.scss';
import CodeforcesStats from '@/components/CodeforcesStats';
import CodeforcesProblems from '@/components/CodeforcesProblems';

interface UserData {
  full_name: string;
  email: string;
  bscp_rating: number;
  codeforces_karma?: number;
  phone?: string;
  cf_username?: string | null;
  atcoder_username?: string | null;
}

interface HistoryItem {
  date_recorded: string; // ISO string
  placement: string; // e.g. "5376"
  mmr_change: number; // e.g. 72
  is_manual: boolean;
  source_rating_change: string;
  contest: {
    title: string;
    platform: string;
    id?: string; // ID соревнования для кликабельности
  };
}

interface AtCoderSubmission {
  contest_id: string;
  contest_name: string;
  user_rank: number;
  user_old_rating: number;
  user_new_rating: number;
  user_rating_change: number;
  user_performance: number;
  contest_end_time: string;
  is_rated: boolean;
}

interface CFSubmission {
  contest_id: string;
  contest_name: string;
  user_rank: number;
  user_old_rating: number;
  user_new_rating: number;
  user_rating_change: number;
  contest_end_time: string;
  is_rated: boolean;
}

interface AtCoderUserInfo {
  rating: number;
  rank: string;
  attended_contests_count: number;
  rated_point_sum: number;
}

interface CFUserInfo {
  rating: number;
  rank: string;
  max_rating: number;
  attended_contests_count: number;
}

interface ContestProblem {
  contestId: number;
  problemIndex: string;
  problemName: string;
  problemUrl: string;
}

interface AtCoderData {
  connected: boolean;
  atcoder_username: string | null;
  user_info?: AtCoderUserInfo;
  submissions: AtCoderSubmission[];
  pending_verification?: boolean;
  pending_atcoder_username?: string | null;
  verification_code?: string;
}

interface CFData {
  connected: boolean;
  cf_username: string | null;
  user_info?: CFUserInfo;
  submissions: CFSubmission[];
  pending_verification?: boolean;
  pending_cf_username?: string | null;
  verification_code?: string;
}

interface ProfileApiResponse {
  ok: boolean;
  data?: {
    user: UserData;
    history: HistoryItem[];
  };
  error?: string;
}

interface AtCoderApiResponse {
  ok: boolean;
  data?: AtCoderData;
  error?: string;
}

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
  const [verificationStep, setVerificationStep] = useState<
    'input_username' | 'show_code' | 'verifying'
  >('input_username');

  // Codeforces состояния
  const [cfData, setCfData] = useState<CFData | null>(null);
  const [showCFModal, setShowCFModal] = useState(false);
  const [cfInput, setCfInput] = useState('');
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState<string | null>(null);
  const [showCFSubmissions, setShowCFSubmissions] = useState(false);
  const [cfGeneratedCode, setCfGeneratedCode] = useState('');
  const [cfVerificationStep, setCfVerificationStep] = useState<
    'input_username' | 'show_code' | 'verifying'
  >('input_username');
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
  const [ratingSort, setRatingSort] = useState<'none' | 'asc' | 'desc'>('none');

  // Codeforces Karma состояния
  const [cfKarmaData, setCfKarmaData] = useState<{
    karma: number;
    karmaLevel: string;
    karmaColor: string;
    breakdown: {
      easyKarma: number;
      mediumKarma: number;
      hardKarma: number;
      tagBonusKarma: number;
      diversityBonus: number;
    };
    details: {
      totalSolved: number;
      easyCount: number;
      mediumCount: number;
      hardCount: number;
      averageRating: number;
      uniqueTags: number;
    };
    difficultyDistribution: {
      easy: number;
      medium: number;
      hard: number;
    };
    tagStats: Array<{
      tag: string;
      solvedCount: number;
      averageRating: number;
    }>;
  } | null>(null);
  const [cfKarmaLoading, setCfKarmaLoading] = useState(false);
  const [showCFStats, setShowCFStats] = useState(false);
  const [showCFProblems, setShowCFProblems] = useState(false);

  // AtCoder Karma состояния
  const [atcoderKarmaData, setAtcoderKarmaData] = useState<{
    karma: number;
    karmaLevel: string;
    karmaColor: string;
    details: {
      totalSolved: number;
      easyCount: number;
      mediumCount: number;
      hardCount: number;
      unknownCount: number;
    };
    problems?: Array<{
      contestId: string;
      contestName: string;
      taskIndex: string;
      taskName: string;
      solvedAt: number;
      difficulty?: number;
      karma: number;
    }>;
  } | null>(null);
  const [atcoderKarmaLoading, setAtcoderKarmaLoading] = useState(false);
  const [showAtCoderProblems, setShowAtCoderProblems] = useState(false);

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
          const response = await fetch('/api/codeforces/karma');
          const result = await response.json();

          console.log('[CF Karma] Response:', response.status, result);

          if (response.ok && result.ok && result.data) {
            console.log('[CF Karma] Data:', result.data);
            setCfKarmaData(result.data);

            // Обновляем codeforces_karma в userData если есть
            if (userData && result.data.karma !== userData.codeforces_karma) {
              setUserData({ ...userData, codeforces_karma: result.data.karma });
            }
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

  // Загрузка данных кармы AtCoder
  useEffect(() => {
    if (status === 'authenticated' && atCoderData?.connected) {
      const fetchAtCoderKarma = async () => {
        try {
          setAtcoderKarmaLoading(true);
          const response = await fetch('/api/atcoder/problems');
          const result = await response.json();

          console.log('[AtCoder Karma] Response:', response.status, result);

          if (response.ok && result.ok && result.data) {
            console.log('[AtCoder Karma] Data:', result.data);
            setAtcoderKarmaData(result.data);
          } else {
            console.error('[AtCoder Karma] Error:', result);
          }
        } catch (err) {
          console.error('[AtCoder Karma] Fetch error:', err);
        } finally {
          setAtcoderKarmaLoading(false);
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
    } catch (err) {
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
    } catch (err) {
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
        setAtcoderKarmaData(null);
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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

  return (
    <main>
      <section id="profile" style={{ display: 'block' }}>
        <div className="profile-header">
          <h2>{userData.full_name || 'Неизвестный пользователь'}</h2>
          <div className="ratings-container">
            <div className="rating-block">
              <div className="rating">{userData.bscp_rating}</div>
              <div className="rating-label">Рейтинг БЦСП</div>
            </div>
            {cfData?.connected && (
              <div className="rating-block">
                {cfKarmaLoading ? (
                  <div className="rating karma-loading">...</div>
                ) : cfKarmaData ? (
                  <div
                    className="rating karma-rating"
                    style={{ color: cfKarmaData.karmaColor }}
                  >
                    {cfKarmaData.karma}
                  </div>
                ) : (
                  <div className="rating karma-rating">
                    {userData.codeforces_karma || 0}
                  </div>
                )}
                <div className="rating-label">
                  Карма Codeforces
                  {cfKarmaData && (
                    <span
                      className="karma-level"
                      style={{ color: cfKarmaData.karmaColor }}
                    >
                      {' '}
                      ({cfKarmaData.karmaLevel})
                    </span>
                  )}
                  {cfKarmaData && (
                    <button
                      className="cf-stats-btn"
                      onClick={() => setShowCFProblems(true)}
                      title="Показать все решённые задачи"
                    >
                      📊
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => signOut()} className="btn-logout">
            Выйти
          </button>
        </div>

        <h1>Вход во внешние системы</h1>
        <div className="systems-links">
          {/* Codeforces кнопка */}
          {cfData?.connected ? (
            <button
              onClick={handleCFClick}
              className="system-link connected-cf"
              title="Нажмите, чтобы посмотреть историю или отвязать"
            >
              <span className="status-indicator"></span>
              <div className="cf-info">
                <span className="cf-label">Подключено Codeforces</span>
                <span className="cf-nickname">{cfData.cf_username}</span>
              </div>
            </button>
          ) : cfData?.pending_verification ? (
            <button
              onClick={handleCFClick}
              className="system-link connected-cf"
              style={{
                backgroundColor: '#ffc107',
                color: '#333',
                border: '1px solid #e0a800',
              }}
              title="Нажмите, чтобы завершить верификацию"
            >
              <span
                className="status-indicator"
                style={{ backgroundColor: '#ffc107' }}
              ></span>
              <div className="cf-info">
                <span className="cf-label">Ожидает подтверждения</span>
                <span className="cf-nickname">
                  {cfData.pending_cf_username}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={handleCFClick}
              className="system-link"
              title="Нажмите, чтобы привязать"
            >
              Подключить Codeforces
            </button>
          )}

          {/* AtCoder кнопка */}
          {atCoderData?.connected ? (
            <button
              onClick={handleAtCoderClick}
              className="system-link connected-cf"
              title="Нажмите, чтобы отвязать или посмотреть submissions"
            >
              <span className="status-indicator"></span>
              <div className="cf-info">
                <span className="cf-label">Подключено AtCoder</span>
                <span className="cf-nickname">
                  {atCoderData.atcoder_username}
                </span>
              </div>
            </button>
          ) : atCoderData?.pending_verification ? (
            <button
              onClick={handleAtCoderClick}
              className="system-link connected-cf"
              style={{
                backgroundColor: '#ffc107',
                color: '#333',
                border: '1px solid #e0a800',
              }}
              title="Нажмите, чтобы завершить верификацию"
            >
              <span
                className="status-indicator"
                style={{ backgroundColor: '#ffc107' }}
              ></span>
              <div className="cf-info">
                <span className="cf-label">Ожидает подтверждения</span>
                <span className="cf-nickname">
                  {atCoderData.pending_atcoder_username}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={handleAtCoderClick}
              className="system-link"
              title="Нажмите, чтобы привязать"
            >
              Подключить AtCoder
            </button>
          )}

          <a
            href="https://contest.yandex.ru/enter"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в Yandex.Contest
          </a>
          <a
            href="https://leetcode.com/accounts/login/"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в LeetCode
          </a>
          <a
            href="https://icpc.global/login"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в ICPC
          </a>
        </div>

        {/* Модальное окно для привязки Codeforces */}
        {showCFModal && (
          <div className="modal-overlay" onClick={handleCFCloseModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {cfVerificationStep === 'input_username' ? (
                <>
                  <h2>Привязка аккаунта Codeforces</h2>
                  <p>Введите ваш хендл на Codeforces:</p>
                  <form onSubmit={handleConnectCF}>
                    <input
                      type="text"
                      value={cfInput}
                      onChange={(e) => setCfInput(e.target.value)}
                      placeholder="Например: tourist"
                      disabled={cfLoading}
                      autoFocus
                    />
                    {cfError && <p className="error-message">{cfError}</p>}
                    <div className="modal-buttons">
                      <button
                        type="button"
                        onClick={handleCFCloseModal}
                        disabled={cfLoading}
                        className="btn-cancel"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={cfLoading}
                        className="btn-submit"
                      >
                        {cfLoading ? 'Проверка...' : 'Далее'}
                      </button>
                    </div>
                  </form>
                </>
              ) : cfVerificationStep === 'show_code' ? (
                <>
                  <h2>Код верификации</h2>
                  <div className="verification-code-display">
                    <p>
                      <strong>Сохраните этот код!</strong>
                    </p>
                    <p>
                      Разместите его в вашем{' '}
                      <strong>профиле на Codeforces</strong> в поле{' '}
                      <strong>First Name</strong>:
                    </p>
                    <ol className="affiliation-steps">
                      <li>
                        Перейдите на{' '}
                        <a
                          href="https://codeforces.com/settings/social"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Codeforces Settings
                        </a>
                      </li>
                      <li>
                        Найдите поле <strong>First Name</strong> (Имя)
                      </li>
                      <li>Вставьте туда этот код (см. ниже)</li>
                      <li>
                        Нажмите <strong>Save Changes</strong> для сохранения
                      </li>
                      <li>Вернитесь сюда и нажмите &laquo;Проверить&raquo;</li>
                    </ol>
                    <div className="code-box">{cfGeneratedCode}</div>
                    <p className="code-warning">
                      💡 Если вы забыли код — нажмите кнопку ниже для генерации
                      нового
                    </p>
                  </div>
                  <div className="modal-buttons">
                    <button
                      type="button"
                      onClick={handleCFCloseModal}
                      disabled={cfLoading}
                      className="btn-cancel"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCfGeneratedCode('');
                        setCfVerificationStep('input_username');
                      }}
                      disabled={cfLoading}
                      className="btn-secondary"
                      style={{
                        backgroundColor: '#f59e0b',
                        color: '#fff',
                        marginRight: '10px',
                      }}
                    >
                      Новый код
                    </button>
                    <button
                      type="button"
                      onClick={() => setCfVerificationStep('verifying')}
                      disabled={cfLoading}
                      className="btn-submit"
                    >
                      Я разместил код в First Name
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Проверка привязки</h2>
                  <p className="verification-instructions">
                    Автоматическая проверка через{' '}
                    <strong>{cfAutoVerifyCountdown} сек...</strong>
                  </p>
                  <p className="verification-hint">
                    Убедитесь, что код размещён в поле{' '}
                    <strong>First Name</strong> на Codeforces
                  </p>
                  <div className="checking-status">
                    <div className="spinner"></div>
                    <p>
                      Проверка профиля <strong>{cfInput}</strong>...
                    </p>
                  </div>
                  {cfError && <p className="error-message">{cfError}</p>}
                  <div className="modal-buttons">
                    <button
                      type="button"
                      onClick={handleCFCloseModal}
                      disabled={cfLoading}
                      className="btn-cancel"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyCFFirstName}
                      disabled={cfLoading || cfAutoVerifyCountdown > 0}
                      className="btn-submit"
                    >
                      {cfLoading
                        ? 'Проверка...'
                        : cfAutoVerifyCountdown > 0
                          ? `Проверить (${cfAutoVerifyCountdown})`
                          : 'Проверить сейчас'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Модальное окно для привязки AtCoder */}
        {showAtCoderModal && (
          <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {verificationStep === 'input_username' ? (
                <>
                  <h2>Привязка аккаунта AtCoder</h2>
                  <p>Введите ваше имя пользователя на AtCoder:</p>
                  <form onSubmit={handleConnectAtCoder}>
                    <input
                      type="text"
                      value={atCoderInput}
                      onChange={(e) => setAtCoderInput(e.target.value)}
                      placeholder="Например: user123"
                      disabled={atCoderLoading}
                      autoFocus
                    />
                    {atCoderError && (
                      <p className="error-message">{atCoderError}</p>
                    )}
                    <div className="modal-buttons">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        disabled={atCoderLoading}
                        className="btn-cancel"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={atCoderLoading}
                        className="btn-submit"
                      >
                        {atCoderLoading ? 'Проверка...' : 'Далее'}
                      </button>
                    </div>
                  </form>
                </>
              ) : verificationStep === 'show_code' ? (
                <>
                  <h2>Код верификации</h2>
                  <div className="verification-code-display">
                    <p>
                      <strong>Сохраните этот код!</strong>
                    </p>
                    <p>
                      Разместите его в вашем <strong>профиле на AtCoder</strong>{' '}
                      в поле <strong>Affiliation</strong>:
                    </p>
                    <ol className="affiliation-steps">
                      <li>
                        Перейдите на{' '}
                        <a
                          href="https://atcoder.jp/settings"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          AtCoder Settings
                        </a>
                      </li>
                      <li>
                        Найдите поле <strong>Affiliation</strong>{' '}
                        (Организация/Компания)
                      </li>
                      <li>Вставьте туда этот код (см. ниже)</li>
                      <li>
                        Нажмите <strong>Update</strong> для сохранения
                      </li>
                      <li>Вернитесь сюда и нажмите &laquo;Проверить&raquo;</li>
                    </ol>
                    <div className="code-box">{generatedVerificationCode}</div>
                    <p className="code-warning">
                      💡 Если вы забыли код — нажмите кнопку ниже для генерации
                      нового
                    </p>
                  </div>
                  <div className="modal-buttons">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={atCoderLoading}
                      className="btn-cancel"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedVerificationCode('');
                        setVerificationStep('input_username');
                      }}
                      disabled={atCoderLoading}
                      className="btn-secondary"
                      style={{
                        backgroundColor: '#f59e0b',
                        color: '#fff',
                        marginRight: '10px',
                      }}
                    >
                      Новый код
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerificationStep('verifying')}
                      disabled={atCoderLoading}
                      className="btn-submit"
                    >
                      Я разместил код в Affiliation
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Проверка привязки</h2>
                  <p className="verification-instructions">
                    Проверяем, что код размещён в поле{' '}
                    <strong>Affiliation</strong> на AtCoder...
                  </p>
                  <div className="checking-status">
                    <div className="spinner"></div>
                    <p>
                      Проверка профиля <strong>{atCoderInput}</strong>...
                    </p>
                  </div>
                  {atCoderError && (
                    <p className="error-message">{atCoderError}</p>
                  )}
                  <div className="modal-buttons">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={atCoderLoading}
                      className="btn-cancel"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyAffiliation}
                      disabled={atCoderLoading}
                      className="btn-submit"
                    >
                      {atCoderLoading ? 'Проверка...' : 'Проверить'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Секция с данными AtCoder */}
        {atCoderData?.connected && showAtCoderSubmissions && (
          <div className="atcoder-section">
            <div className="atcoder-header">
              <h2>Данные AtCoder: {atCoderData.atcoder_username}</h2>
              <button
                onClick={handleDisconnectAtCoder}
                className="btn-disconnect"
                title="Отвязать аккаунт"
              >
                Отвязать
              </button>
            </div>

            {atCoderData.user_info && (
              <div className="atcoder-stats">
                <div className="stat-item">
                  <span className="stat-label">Рейтинг:</span>
                  <span className="stat-value">
                    {atCoderData.user_info.rating}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Ранг:</span>
                  <span className="stat-value">
                    {atCoderData.user_info.rank || 'N/A'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Участий в контестах:</span>
                  <span className="stat-value">
                    {atCoderData.user_info.attended_contests_count}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Сумма очков:</span>
                  <span className="stat-value">
                    {atCoderData.user_info.rated_point_sum}
                  </span>
                </div>
              </div>
            )}

            <h3>История участия в контестах</h3>
            {atCoderData.submissions && atCoderData.submissions.length > 0 ? (
              <table className="atcoder-submissions">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Контест</th>
                    <th>Место</th>
                    <th>Рейтинг до</th>
                    <th>Рейтинг после</th>
                    <th>Изменение</th>
                  </tr>
                </thead>
                <tbody>
                  {atCoderData.submissions
                    .slice()
                    .reverse()
                    .map((sub) => (
                      <tr key={sub.contest_id + sub.contest_end_time}>
                        <td>
                          {sub.contest_end_time
                            ? new Date(
                                sub.contest_end_time,
                              ).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>{sub.contest_name}</td>
                        <td>{sub.user_rank || 'N/A'}</td>
                        <td>{sub.user_old_rating || 'N/A'}</td>
                        <td>{sub.user_new_rating || 'N/A'}</td>
                        <td
                          className={
                            sub.user_rating_change >= 0
                              ? 'status-ac'
                              : 'rating-change negative'
                          }
                        >
                          {sub.user_rating_change >= 0 ? '+' : ''}
                          {sub.user_rating_change}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p>Нет данных об участии в контестах или данные загружаются...</p>
            )}
          </div>
        )}

        {/* Секция с данными Codeforces */}
        {cfData?.connected && showCFSubmissions && (
          <div className="atcoder-section">
            <div className="atcoder-header">
              <h2>Данные Codeforces: {cfData.cf_username}</h2>
              <button
                onClick={handleDisconnectCFNew}
                className="btn-disconnect"
                title="Отвязать аккаунт"
              >
                Отвязать
              </button>
            </div>

            {cfData.user_info && (
              <div className="atcoder-stats">
                <div className="stat-item">
                  <span className="stat-label">Рейтинг:</span>
                  <span className="stat-value">{cfData.user_info.rating}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Ранг:</span>
                  <span className="stat-value">
                    {cfData.user_info.rank || 'N/A'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Макс. рейтинг:</span>
                  <span className="stat-value">
                    {cfData.user_info.max_rating || 'N/A'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Участий в контестах:</span>
                  <span className="stat-value">
                    {cfData.user_info.attended_contests_count}
                  </span>
                </div>
              </div>
            )}

            <h3>История участия в контестах</h3>
            {cfData.submissions && cfData.submissions.length > 0 ? (
              <table className="atcoder-submissions">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Контест</th>
                    <th>Место</th>
                    <th>Рейтинг до</th>
                    <th>Рейтинг после</th>
                    <th>Изменение</th>
                  </tr>
                </thead>
                <tbody>
                  {cfData.submissions
                    .slice()
                    .reverse()
                    .map((sub) => (
                      <tr key={sub.contest_id + sub.contest_end_time}>
                        <td>
                          {sub.contest_end_time
                            ? new Date(
                                sub.contest_end_time,
                              ).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>{sub.contest_name}</td>
                        <td>{sub.user_rank || 'N/A'}</td>
                        <td>{sub.user_old_rating || 'N/A'}</td>
                        <td>{sub.user_new_rating || 'N/A'}</td>
                        <td
                          className={
                            sub.user_rating_change >= 0
                              ? 'status-ac'
                              : 'rating-change negative'
                          }
                        >
                          {sub.user_rating_change >= 0 ? '+' : ''}
                          {sub.user_rating_change}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p>Нет данных об участии в контестах или данные загружаются...</p>
            )}
          </div>
        )}

        <h1>История участия и изменения рейтинга</h1>

        {/* Фильтры */}
        <div className="filters-section">
          {/* Дата */}
          <div className="filter-group">
            <label>Дата (от):</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Дата (до):</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Платформа */}
          <div className="filter-group">
            <label>Платформа:</label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="all">Все</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Место (диапазон) */}
          <div className="filter-group">
            <label>Место от:</label>
            <input
              type="number"
              min="1"
              value={placeFrom}
              onChange={(e) => setPlaceFrom(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="filter-group">
            <label>Место до:</label>
            <input
              type="number"
              min="1"
              value={placeTo}
              onChange={(e) => setPlaceTo(e.target.value)}
              placeholder="1000"
            />
          </div>

          {/* Сортировка по рейтингу */}
          <div className="filter-group">
            <label>Рейтинг БЦСП:</label>
            <select
              value={ratingSort}
              onChange={(e) =>
                setRatingSort(e.target.value as 'none' | 'asc' | 'desc')
              }
            >
              <option value="none">Без сортировки</option>
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-reset-filters"
            onClick={handleResetFilters}
          >
            Сбросить
          </button>
        </div>

        {/* Таблица */}
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Соревнование</th>
              <th>Платформа</th>
              <th>Результат</th>
              <th>Рейтинг БЦСП</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedHistory.length > 0 ? (
              filteredAndSortedHistory.map((item, index) => {
                const uniqueKey = item.contest.id
                  ? `${item.contest.platform}_${item.contest.id}`
                  : null;
                const isExpanded = uniqueKey && expandedContestId === uniqueKey;
                const problems = uniqueKey ? contestProblems[uniqueKey] : null;
                const isLoading = uniqueKey
                  ? contestProblemsLoading[uniqueKey]
                  : false;

                console.log(`[Table] Item ${index}:`, {
                  title: item.contest.title,
                  platform: item.contest.platform,
                  id: item.contest.id,
                  uniqueKey,
                });

                return (
                  <React.Fragment key={index}>
                    <tr className={isExpanded ? 'expanded-row' : ''}>
                      <td>
                        {new Date(item.date_recorded).toLocaleDateString()}
                      </td>
                      <td>
                        {item.contest.id ? (
                          <button
                            className="contest-link"
                            onClick={() => {
                              console.log(
                                `[Table] Clicking contest:`,
                                item.contest,
                              );
                              handleContestClick(
                                item.contest.id!,
                                item.contest.title,
                                item.contest.platform,
                              );
                            }}
                            type="button"
                          >
                            {isExpanded ? '▼ ' : '▶ '}
                            {item.contest.title}
                          </button>
                        ) : (
                          item.contest.title
                        )}
                      </td>
                      <td>
                        <span
                          className={`platform-badge platform-${item.contest.platform.toLowerCase()}`}
                        >
                          {item.contest.platform === 'Codeforces' && '🔴 '}
                          {item.contest.platform === 'AtCoder' && '🟠 '}
                          {item.contest.platform}
                        </span>
                      </td>
                      <td>
                        {item.placement}
                        {item.is_manual && (
                          <span className="manual-tag">вручную</span>
                        )}
                      </td>
                      <td
                        className={`rating-change ${item.mmr_change < 0 ? 'negative' : ''}`}
                      >
                        {item.mmr_change > 0
                          ? `+${item.mmr_change}`
                          : item.mmr_change}
                      </td>
                    </tr>
                    {isExpanded && uniqueKey && (
                      <tr className="problems-expand-row">
                        <td colSpan={5}>
                          <div className="problems-container">
                            {isLoading ? (
                              <div className="loading-problems">
                                <div className="spinner"></div>
                                <p>Загрузка задач...</p>
                              </div>
                            ) : problems && problems.length > 0 ? (
                              <>
                                <div className="problems-summary">
                                  <p>
                                    Решено задач:{' '}
                                    <strong>{problems.length}</strong>
                                  </p>
                                </div>
                                <table className="problems-table">
                                  <thead>
                                    <tr>
                                      <th>Индекс</th>
                                      <th>Название</th>
                                      <th>Ссылка</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {problems.map((problem, idx) => (
                                      <tr
                                        key={`${uniqueKey}_${problem.problemIndex}_${idx}`}
                                        className="solved-row"
                                      >
                                        <td className="problem-index">
                                          {problem.problemIndex}
                                        </td>
                                        <td className="problem-name">
                                          {problem.problemName}
                                        </td>
                                        <td>
                                          <a
                                            href={problem.problemUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="problem-link-button"
                                          >
                                            Открыть задачу
                                          </a>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            ) : (
                              <div className="no-problems">
                                <p>
                                  Нет данных о задачах или произошла ошибка при
                                  загрузке.
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>Нет записей, соответствующих фильтрам.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h1>Изменение личных данных</h1>
        <form className="edit-form" onSubmit={handleSubmit}>
          <label htmlFor="name">ФИО</label>
          <input
            type="text"
            id="name"
            name="full_name"
            defaultValue={userData.full_name || ''}
            disabled={saving}
          />

          <label htmlFor="phone">Телефон</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            defaultValue={userData.phone || ''}
            disabled={saving}
          />

          <div className="form-section-title">
            <h3>Смена пароля</h3>
            <p>Заполните только для изменения пароля</p>
          </div>

          <label htmlFor="oldPassword">Старый пароль</label>
          <input
            type="password"
            id="oldPassword"
            name="oldPassword"
            placeholder="Текущий пароль"
            disabled={saving}
          />

          <label htmlFor="newPassword">Новый пароль</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            placeholder="Новый пароль"
            disabled={saving}
          />

          <div className="btn-save-container">
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
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
