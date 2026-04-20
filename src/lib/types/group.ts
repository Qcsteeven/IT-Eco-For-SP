export interface Group {
  id: string;
  name: string;
  description?: string;
  is_archived?: boolean;
  created_by: string; // users:...
  created_at?: string;
  updated_at?: string;
}

export interface GroupCoach {
  group_id: string; // groups:...
  coach_id: string; // users:...
  role_in_group?: 'owner' | 'coach';
  added_at?: string;
}

export interface GroupMember {
  group_id: string; // groups:...
  user_id: string; // users:...
  joined_at?: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
}

export interface UpdateGroupData extends Partial<CreateGroupData> {
  is_archived?: boolean;
}

