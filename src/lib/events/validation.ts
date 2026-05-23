export type EventScheduleStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled'
  | string;

export function getEventYearBounds(now = new Date()) {
  const currentYear = now.getFullYear();
  return {
    minYear: currentYear - 1,
    maxYear: currentYear + 5,
  };
}

export function validateEventSchedule({
  status,
  start,
  end,
  now = new Date(),
}: {
  status: EventScheduleStatus;
  start: string | Date;
  end: string | Date;
  now?: Date;
}): string | null {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 'Некорректная дата начала или окончания';
  }

  const { minYear, maxYear } = getEventYearBounds(now);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  if (
    startYear < minYear ||
    startYear > maxYear ||
    endYear < minYear ||
    endYear > maxYear
  ) {
    return `Год мероприятия должен быть в диапазоне ${minYear}-${maxYear}`;
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return 'Время окончания должно быть позже времени начала';
  }

  const nowMs = now.getTime();
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (status === 'upcoming' && startMs <= nowMs) {
    return 'Статус "Предстоящий" можно выбрать только для будущего мероприятия';
  }

  if (status === 'active' && (startMs > nowMs || endMs < nowMs)) {
    return 'Статус "Активный" должен соответствовать текущему времени между началом и окончанием';
  }

  if (status === 'completed' && endMs >= nowMs) {
    return 'Статус "Завершён" можно выбрать только после времени окончания';
  }

  return null;
}
