/**
 * Get the Friday, Saturday, Sunday dates for the current (or next upcoming) weekend.
 * If today is Monday, returns the previous Fri/Sat/Sun (so results stay visible).
 * If today is Tuesday-Thursday, returns the upcoming Fri/Sat/Sun.
 * If today is Friday-Sunday, returns this Fri/Sat/Sun.
 */
const NHL_TIME_ZONE = "America/New_York";

function getTimeZoneDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    dayOfWeek: weekdayMap[part("weekday")] ?? 0,
  };
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getCurrentWeekendDates(): {
  friday: string;
  saturday: string;
  sunday: string;
} {
  const now = new Date();
  const todayInNhlTz = getTimeZoneDateParts(now, NHL_TIME_ZONE);
  const todayUtc = new Date(
    Date.UTC(
      todayInNhlTz.year,
      todayInNhlTz.month - 1,
      todayInNhlTz.day,
      12,
      0,
      0
    )
  );

  let friday = new Date(todayUtc);

  if (todayInNhlTz.dayOfWeek === 1) {
    // Monday: keep showing the previous weekend.
    friday.setUTCDate(friday.getUTCDate() - 3);
  } else if (todayInNhlTz.dayOfWeek === 6) {
    friday.setUTCDate(friday.getUTCDate() - 1);
  } else if (todayInNhlTz.dayOfWeek === 0) {
    friday.setUTCDate(friday.getUTCDate() - 2);
  } else if (todayInNhlTz.dayOfWeek >= 2 && todayInNhlTz.dayOfWeek <= 4) {
    const daysUntilFriday = 5 - todayInNhlTz.dayOfWeek;
    friday.setUTCDate(friday.getUTCDate() + daysUntilFriday);
  } else {
    // If already Friday in NHL timezone, keep the same date.
  }

  const saturday = new Date(friday);
  saturday.setUTCDate(saturday.getUTCDate() + 1);

  const sunday = new Date(friday);
  sunday.setUTCDate(sunday.getUTCDate() + 2);

  return {
    friday: formatUtcDate(friday),
    saturday: formatUtcDate(saturday),
    sunday: formatUtcDate(sunday),
  };
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatGameTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function isWeekendLocked(lockTime: string | null): boolean {
  if (!lockTime) return false;
  return new Date() >= new Date(lockTime);
}
