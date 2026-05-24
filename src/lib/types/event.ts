export type EventVisibility = 'public' | 'private';

export type EventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export type EventPlatform = 'codeforces' | 'atcoder' | 'custom' | 'other';

export interface Event {
  id: string;
  title: string;
  description?: string;
  platform: EventPlatform;
  status: EventStatus;
  start_time_utc: string;
  end_time_utc: string;
  external_link: string;
  visibility_type: EventVisibility;
  participant_list: string[];
  target_groups?: string[];
  participant_snapshot?: string[];
  created_by?: string;
  platform_contest_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEventData {
  title: string;
  description?: string;
  platform: EventPlatform;
  status: EventStatus;
  start_time_utc: string;
  end_time_utc: string;
  external_link: string;
  visibility_type: EventVisibility;
  participant_list?: string[];
  target_groups?: string[];
  platform_contest_id?: string;
}

export interface UpdateEventData extends Partial<CreateEventData> {
  id: string;
}

export interface EventFilter {
  my_events?: boolean;
  platform?: EventPlatform;
  status?: EventStatus;
}
