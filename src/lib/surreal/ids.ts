function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function toUserThingId(rawUserId: string): string {
  const userId = safeDecode(rawUserId.trim());
  if (!userId) return '';
  return userId.startsWith('users:') ? userId : `users:${userId}`;
}

/** Часть идентификатора записи для Surreal `type::thing("users", $id)` (без префикса `users:`). */
export function parseUsersRecordKey(rawUserId: string): string {
  if (!rawUserId) return '';
  const s = safeDecode(rawUserId.trim());
  return s.startsWith('users:') ? s.slice('users:'.length) : s;
}

export function toGroupThingId(rawGroupId: string): string {
  const groupId = safeDecode(rawGroupId.trim());
  if (!groupId) return '';
  return groupId.startsWith('groups:') ? groupId : `groups:${groupId}`;
}
