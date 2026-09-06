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
 * Items must pass BOTH active layers (Layer 1 AND Layer 2).
 */
export function filterByMultiDateRanges(
  items: PcoPersonItem[],
  selectedRanges: string[] = [],
  daysBefore: number = 7,
  daysAfter: number = 30
): PcoPersonItem[] {
  if (!selectedRanges || selectedRanges.length === 0 || selectedRanges.includes("all")) {
    const minDays = -Math.abs(daysBefore);
    const maxDays = Math.abs(daysAfter);
    return items.filter((item) => item.daysUntil >= minDays && item.daysUntil <= maxDays);
  }

  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const prevMonth = (currentMonth - 1 + 12) % 12;
  const nextMonth = (currentMonth + 1) % 12;

  const minDays = -Math.abs(daysBefore);
  const maxDays = Math.abs(daysAfter);

  const monthRanges = selectedRanges.filter((r) => ["prev_month", "current_month", "next_month"].includes(r));
  const relativeRanges = selectedRanges.filter((r) => ["prev_x_days", "next_x_days"].includes(r));

  return items.filter((item) => {
    const [mStr] = item.dateMonthDay.split("-");
    const itemMonth = parseInt(mStr, 10) - 1;

    // Layer 1: Calendar Month Filter (passes if no month filters are selected, or matches any selected month)
    let passesMonthLayer = true;
    if (monthRanges.length > 0) {
      passesMonthLayer =
        (monthRanges.includes("prev_month") && itemMonth === prevMonth) ||
        (monthRanges.includes("current_month") && itemMonth === currentMonth) ||
        (monthRanges.includes("next_month") && itemMonth === nextMonth);
    }

    // Layer 2: Relative Date Window Filter (passes if no relative filters are selected, or matches any selected relative range)
    let passesRelativeLayer = true;
    if (relativeRanges.length > 0) {
      passesRelativeLayer =
        (relativeRanges.includes("prev_x_days") && item.daysUntil >= minDays && item.daysUntil <= 0) ||
        (relativeRanges.includes("next_x_days") && item.daysUntil >= 0 && item.daysUntil <= maxDays);
    }

    // Must satisfy BOTH layers
    return passesMonthLayer && passesRelativeLayer;
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
