/**
 * Get the Friday, Saturday, Sunday dates for the current (or next upcoming) weekend.
 * If today is Monday-Thursday, returns the upcoming Fri/Sat/Sun.
 * If today is Friday-Sunday, returns this Fri/Sat/Sun.
 */
export function getCurrentWeekendDates(): {
  friday: string;
  saturday: string;
  sunday: string;
} {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  let friday: Date;

  if (dayOfWeek === 5) {
    friday = new Date(now);
  } else if (dayOfWeek === 6) {
    friday = new Date(now);
    friday.setDate(friday.getDate() - 1);
  } else if (dayOfWeek === 0) {
    friday = new Date(now);
    friday.setDate(friday.getDate() - 2);
  } else {
    friday = new Date(now);
    const daysUntilFriday = 5 - dayOfWeek;
    friday.setDate(friday.getDate() + daysUntilFriday);
  }

  const saturday = new Date(friday);
  saturday.setDate(saturday.getDate() + 1);

  const sunday = new Date(friday);
  sunday.setDate(sunday.getDate() + 2);

  return {
    friday: formatDate(friday),
    saturday: formatDate(saturday),
    sunday: formatDate(sunday),
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
