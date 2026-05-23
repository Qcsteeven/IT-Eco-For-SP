export interface UserData {
  full_name: string;
  email: string;
  bscp_rating: number;
  codeforces_karma?: number;
  phone?: string;
  cf_username?: string | null;
  atcoder_username?: string | null;
}

export interface HistoryItem {
  date_recorded: string;
  placement: string;
  mmr_change: number;
  is_manual: boolean;
  source_rating_change: string;
  contest: {
    title: string;
    platform: string;
    id?: string;
  };
}

export interface AtCoderSubmission {
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

export interface CFSubmission {
  contest_id: string;
  contest_name: string;
  user_rank: number;
  user_old_rating: number;
  user_new_rating: number;
  user_rating_change: number;
  contest_end_time: string;
  is_rated: boolean;
}

export interface AtCoderUserInfo {
  rating: number;
  rank: string;
  attended_contests_count: number;
  rated_point_sum: number;
}

export interface CFUserInfo {
  rating: number;
  rank: string;
  max_rating: number;
  attended_contests_count: number;
}

export interface ContestProblem {
  contestId: number;
  problemIndex: string;
  problemName: string;
  problemUrl: string;
}

export interface AtCoderData {
  connected: boolean;
  atcoder_username: string | null;
  user_info?: AtCoderUserInfo;
  submissions: AtCoderSubmission[];
  pending_verification?: boolean;
  pending_atcoder_username?: string | null;
  verification_code?: string;
}

export interface CFData {
  connected: boolean;
  cf_username: string | null;
  user_info?: CFUserInfo;
  submissions: CFSubmission[];
  pending_verification?: boolean;
  pending_cf_username?: string | null;
  verification_code?: string;
}

export interface ProfileApiResponse {
  ok: boolean;
  data?: {
    user: UserData;
    history: HistoryItem[];
  };
  error?: string;
}

export interface AtCoderApiResponse {
  ok: boolean;
  data?: AtCoderData;
  error?: string;
}

export type VerificationStep = 'input_username' | 'show_code' | 'verifying';

export type RatingSort = 'none' | 'asc' | 'desc';

export interface CfKarmaData {
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
    unknownCount?: number;
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
  problems?: Array<{
    contestId: number;
    problemIndex: string;
    problemName?: string;
    solvedAt: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
    karma: number;
    tags?: string[];
    rating?: number;
  }>;
}
