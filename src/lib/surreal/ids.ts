export function toUserThingId(rawUserId: string): string {
  if (!rawUserId) return '';
  return rawUserId.startsWith('users:') ? rawUserId : `users:${rawUserId}`;
}

/** Часть идентификатора записи для Surreal `type::thing("users", $id)` (без префикса `users:`). */
export function parseUsersRecordKey(rawUserId: string): string {
  if (!rawUserId) return '';
  const s = rawUserId.trim();
  return s.startsWith('users:') ? s.slice('users:'.length) : s;
}

export function toGroupThingId(rawGroupId: string): string {
  if (!rawGroupId) return '';
  return rawGroupId.startsWith('groups:') ? rawGroupId : `groups:${rawGroupId}`;
}

