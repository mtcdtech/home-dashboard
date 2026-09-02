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
 * Filter event list by custom date window (daysBefore and daysAfter)
 */
export function filterByDateRange(
  items: PcoPersonItem[], 
  daysBefore: number = 0, 
  daysAfter: number = 30
): PcoPersonItem[] {
  const minDays = -Math.abs(daysBefore);
  const maxDays = Math.abs(daysAfter);

  return items.filter((item) => {
    return item.daysUntil >= minDays && item.daysUntil <= maxDays;
  });
}
