/**
 * Calculate elapsed business hours between two dates, excluding
 * non-business hours and optionally weekends. Uses UTC for simplicity.
 */

interface BusinessHoursPolicy {
  businessHoursStart: number; // 0-23 hour (UTC)
  businessHoursEnd: number;   // 0-23 hour (UTC)
  excludeWeekends: boolean;
}

/**
 * Returns elapsed milliseconds of business time between startDate and endDate.
 * Only counts time within businessHoursStart..businessHoursEnd on qualifying days.
 * Weekend = Saturday (6) and Sunday (0) in UTC.
 */
export function calculateBusinessMs(
  startDate: Date,
  endDate: Date,
  policy: BusinessHoursPolicy,
): number {
  const start = startDate.getTime();
  const end = endDate.getTime();

  if (end <= start) return 0;

  const { businessHoursStart, businessHoursEnd, excludeWeekends } = policy;

  // If business hours span all day (0-24 or start >= end meaning full day),
  // and weekends are not excluded, just return wall-clock time
  if (businessHoursStart >= businessHoursEnd && !excludeWeekends) {
    return end - start;
  }

  const hoursPerDay = businessHoursEnd > businessHoursStart
    ? businessHoursEnd - businessHoursStart
    : 24; // If misconfigured, assume full day
  const msPerBusinessDay = hoursPerDay * 3600_000;

  let totalMs = 0;

  // Walk day by day for accuracy
  const cursor = new Date(startDate);
  cursor.setUTCMinutes(0, 0, 0);

  while (cursor.getTime() < end) {
    const dayStart = new Date(cursor);
    dayStart.setUTCHours(businessHoursStart, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setUTCHours(businessHoursEnd, 0, 0, 0);

    const dayOfWeek = cursor.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (excludeWeekends && isWeekend) {
      // Skip weekend day entirely
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
      continue;
    }

    if (businessHoursEnd <= businessHoursStart) {
      // Full-day config: count all time in this day that falls within [start, end]
      const dayBegin = new Date(cursor);
      dayBegin.setUTCHours(0, 0, 0, 0);
      const dayFinish = new Date(dayBegin);
      dayFinish.setUTCDate(dayFinish.getUTCDate() + 1);

      const effectiveStart = Math.max(start, dayBegin.getTime());
      const effectiveEnd = Math.min(end, dayFinish.getTime());
      if (effectiveEnd > effectiveStart) {
        totalMs += effectiveEnd - effectiveStart;
      }
    } else {
      // Normal business hours: only count time within [dayStart, dayEnd]
      const effectiveStart = Math.max(start, dayStart.getTime());
      const effectiveEnd = Math.min(end, dayEnd.getTime());

      if (effectiveEnd > effectiveStart) {
        totalMs += effectiveEnd - effectiveStart;
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }

  // Cap at theoretical maximum to avoid floating-point issues
  const totalDays = Math.ceil((end - start) / 86_400_000) + 1;
  const maxMs = totalDays * msPerBusinessDay;
  return Math.min(totalMs, maxMs);
}
