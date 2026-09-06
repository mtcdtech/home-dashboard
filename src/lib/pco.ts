import { isSafeUrl } from "@/lib/ssrf";

export interface PcoPersonItem {
  id: string;
  personId: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  type: "birthday" | "anniversary";
  dateRaw: string; // e.g. "1990-09-14"
  dateMonthDay: string; // e.g. "09-14"
  monthStr: string; // e.g. "SEP"
  dayStr: string; // e.g. "14"
  formattedDate: string; // e.g. "SEP-14"
  daysUntil: number; // Signed days from today (0 = today, -3 = 3 days ago, 5 = in 5 days)
  yearOfEvent?: number;
  gender?: string; // "M", "F", "male", "female"
  phone?: string;
  email?: string;
  pcoUrl: string;
  // Anniversary paired properties
  isCombinedAnniversary?: boolean;
  spousePersonId?: string;
  spouseName?: string;
  spousePhotoUrl?: string;
  primaryPcoUrl?: string;
}

/**
 * Basic Auth Header builder for PCO API v2
 */
export function getPcoAuthHeader(appId: string, appSecret: string): string {
  const credentials = `${appId.trim()}:${appSecret.trim()}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

const MONTH_NAMES_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Calculate signed days from today for a month & day (0 = today, negative = past days, positive = future days)
 */
export function getDaysUntilEvent(monthDay: string): { 
  daysUntil: number; 
  monthStr: string; 
  dayStr: string; 
  formattedDate: string;
  nextDate: Date;
} {
  const [mStr, dStr] = monthDay.split("-");
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  const day = parseInt(dStr, 10);

  const now = new Date();
  const currentYear = now.getFullYear();
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  
  let target = new Date(currentYear, month, day);

  const diffTime = target.getTime() - today.getTime();
  let daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // If the date passed earlier this year by more than 180 days, consider next year's occurrence for future sorting
  if (daysUntil < -180) {
    target = new Date(currentYear + 1, month, day);
    daysUntil = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } else if (daysUntil > 180) {
    // If date is more than 180 days in the future, it could be late last year's date window if checking daysBefore
    const prevYearTarget = new Date(currentYear - 1, month, day);
    const prevDays = Math.round((prevYearTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (Math.abs(prevDays) < Math.abs(daysUntil)) {
      daysUntil = prevDays;
      target = prevYearTarget;
    }
  }

  const monthStr = MONTH_NAMES_SHORT[month] || "MMM";
  const dayStr = String(day).padStart(2, "0");
  const formattedDate = `${monthStr}-${dayStr}`;

  return { daysUntil, monthStr, dayStr, formattedDate, nextDate: target };
}

/**
 * Format a Date object into human-readable month day (e.g. "SEP-14")
 */
export function formatMonthDay(monthDay: string): string {
  const { formattedDate } = getDaysUntilEvent(monthDay);
  return formattedDate;
}

/**
 * Multi-select 2-layer filter for date range options:
 * - Layer 1 (Calendar Month Window): "prev_month", "current_month", "next_month"
 * - Layer 2 (Relative Date Window): "prev_x_days" (-daysBefore <= daysUntil <= 0), "next_x_days" (0 <= daysUntil <= daysAfter)
 * - Special Filter Option: "show_overdue" (includes all uncalled past celebrations regardless of month/window)
 *
 * Rules:
 * 1. If an item is an overdue uncalled celebration and "show_overdue" is selected, it passes immediately.
 * 2. If month filter(s) are selected, the item's month must match the selected months.
 * 3. If past x days is NOT selected and a month filter is active, all past days of the selected month(s) are included.
 *    If past x days IS selected, past days are constrained to item.daysUntil >= -Math.abs(daysBefore).
 * 4. If next x days is NOT selected and a month filter is active, all future days of the selected month(s) are included.
 *    If next x days IS selected, future days are constrained to item.daysUntil <= Math.abs(daysAfter).
 * 5. If no month filter is selected, relative filters constrain past/future accordingly (or all pass if no relative filters).
 */
export function filterByMultiDateRanges(
  items: PcoPersonItem[],
  selectedRanges: string[] = [],
  daysBefore: number = 7,
  daysAfter: number = 30,
  callRecords: Record<string, { year: number; checked: boolean }> = {}
): PcoPersonItem[] {
  if (!selectedRanges || selectedRanges.length === 0 || selectedRanges.includes("all")) {
    const minDays = -Math.abs(daysBefore);
    const maxDays = Math.abs(daysAfter);
    return items.filter((item) => item.daysUntil >= minDays && item.daysUntil <= maxDays);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const prevMonth = (currentMonth - 1 + 12) % 12;
  const nextMonth = (currentMonth + 1) % 12;

  const minDays = -Math.abs(daysBefore);
  const maxDays = Math.abs(daysAfter);

  const monthRanges = selectedRanges.filter((r) => ["prev_month", "current_month", "next_month"].includes(r));
  const relativeRanges = selectedRanges.filter((r) => ["prev_x_days", "next_x_days"].includes(r));
  const includeOverdue = selectedRanges.includes("show_overdue") || selectedRanges.includes("include_overdue");

  const hasMonthFilter = monthRanges.length > 0;
  const hasPastRelFilter = relativeRanges.includes("prev_x_days");
  const hasFutureRelFilter = relativeRanges.includes("next_x_days");

  return items.filter((item) => {
    const [mStr] = item.dateMonthDay.split("-");
    const itemMonth = parseInt(mStr, 10) - 1;

    // Check if this is an overdue uncalled celebration
    const rec = callRecords[`${item.personId}_${item.type}`];
    const isCalled = rec && rec.year === currentYear && rec.checked;
    const isOverdue = item.daysUntil < 0 && !isCalled;

    if (includeOverdue && isOverdue) {
      return true;
    }

    // Month boundary check
    let inMonthWindow = true;
    if (hasMonthFilter) {
      inMonthWindow =
        (monthRanges.includes("prev_month") && itemMonth === prevMonth) ||
        (monthRanges.includes("current_month") && itemMonth === currentMonth) ||
        (monthRanges.includes("next_month") && itemMonth === nextMonth);
    }

    if (!inMonthWindow) {
      return false;
    }

    // Relative constraints
    if (item.daysUntil < 0) {
      // Past day
      if (hasPastRelFilter) {
        return item.daysUntil >= minDays;
      }
      // If past x days is NOT selected:
      // If month filter is active, entire past month/current month is included
      if (hasMonthFilter) {
        return true;
      }
      // If no month filter and only future rel filter was selected, exclude past
      if (hasFutureRelFilter) {
        return false;
      }
      return true;
    } else if (item.daysUntil > 0) {
      // Future day
      if (hasFutureRelFilter) {
        return item.daysUntil <= maxDays;
      }
      // If next x days is NOT selected:
      // If month filter is active, entire future month/current month is included
      if (hasMonthFilter) {
        return true;
      }
      // If no month filter and only past rel filter was selected, exclude future
      if (hasPastRelFilter) {
        return false;
      }
      return true;
    } else {
      // Today (daysUntil === 0)
      return true;
    }
  });
}

/**
 * Backward compatible filter
 */
export function filterByDateRange(
  items: PcoPersonItem[], 
  daysBefore: number = 0, 
  daysAfter: number = 30
): PcoPersonItem[] {
  return filterByMultiDateRanges(items, [], daysBefore, daysAfter);
}
