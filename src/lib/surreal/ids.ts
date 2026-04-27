export function toUserThingId(rawUserId: string): string {
  if (!rawUserId) return '';
  return rawUserId.startsWith('users:') ? rawUserId : `users:${rawUserId}`;
}

export function toGroupThingId(rawGroupId: string): string {
  if (!rawGroupId) return '';
  return rawGroupId.startsWith('groups:') ? rawGroupId : `groups:${rawGroupId}`;
}

