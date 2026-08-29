// ── Asia/Dhaka Timezone Helpers ──
// Constitution Principle VIII: all server-side date/time logic — booking
// slot dates, "today"/dashboard-window calculations, report date ranges —
// MUST evaluate against Asia/Dhaka local time, not UTC or server-local
// time. `new Date().toISOString().split('T')[0]` is a common bug here: it
// reads the UTC calendar date, which is wrong for roughly 6 hours of every
// Dhaka day (Asia/Dhaka is UTC+6 — from local midnight to 6am, the UTC
// date is still "yesterday").

const DHAKA_TZ = 'Asia/Dhaka';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DHAKA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Current date/time as seen in Asia/Dhaka, regardless of server timezone.
 * @returns {{ dateString: string, timeString: string }} e.g. { dateString: '2026-08-28', timeString: '14:05' }
 */
export function getDhakaDateTime(reference = new Date()) {
  const parts = partsFormatter.formatToParts(reference);
  const get = (type) => parts.find((p) => p.type === type).value;
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    dateString: `${get('year')}-${get('month')}-${get('day')}`,
    timeString: `${hour}:${get('minute')}`,
  };
}

/** Today's date string (YYYY-MM-DD) in Asia/Dhaka. */
export function dhakaToday() {
  return getDhakaDateTime().dateString;
}

/**
 * A date string (YYYY-MM-DD) offset by `days` from today, in Asia/Dhaka
 * (negative for past dates, positive for future).
 */
export function dhakaDateOffset(days) {
  const { dateString } = getDhakaDateTime();
  const [y, m, d] = dateString.split('-').map(Number);
  // Construct as a UTC-noon instant to avoid any local-server-timezone DST/
  // rounding surprises when adding days, then re-read the calendar date —
  // since we're only ever moving by whole days, noon avoids boundary issues.
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  base.setUTCDate(base.getUTCDate() + days);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** First and last day-of-month date strings (YYYY-MM-DD) for the Dhaka-local current month. */
export function dhakaMonthBounds() {
  const { dateString } = getDhakaDateTime();
  const [y, m] = dateString.split('-').map(Number);
  const startOfMonth = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endOfMonth = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startOfMonth, endOfMonth };
}

export default { getDhakaDateTime, dhakaToday, dhakaDateOffset, dhakaMonthBounds };
