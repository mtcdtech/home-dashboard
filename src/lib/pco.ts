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
  formattedDate: string; // e.g. "Sep 14"
  daysUntil: number; // Days until upcoming date (0 = today)
  yearOfEvent?: number;
  phone?: string;
  email?: string;
  pcoUrl: string;
}

/**
 * Basic Auth Header builder for PCO API v2
 */
export function getPcoAuthHeader(appId: string, appSecret: string): string {
  const credentials = `${appId.trim()}:${appSecret.trim()}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

/**
 * Calculate days until next occurrence of month & day (0 = today)
 */
export function getDaysUntilEvent(monthDay: string): { daysUntil: number; nextDate: Date } {
  const [mStr, dStr] = monthDay.split("-");
  const month = parseInt(mStr, 10) - 1; // 0-indexed
  const day = parseInt(dStr, 10);

  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Create date for this year
  let target = new Date(currentYear, month, day);
  
  // Set to start of day for accurate comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (target < today) {
    // Already passed this year, so it occurs next year
    target = new Date(currentYear + 1, month, day);
  }

  const diffTime = target.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return { daysUntil, nextDate: target };
}

/**
 * Format a Date object into human-readable month day (e.g. "Sep 14")
 */
export function formatMonthDay(monthDay: string): string {
  const [mStr, dStr] = monthDay.split("-");
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);
  const date = new Date(2000, month, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Filter event list by selected date range
 */
export function filterByDateRange(items: PcoPersonItem[], range: string): PcoPersonItem[] {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed

  return items.filter((item) => {
    const [mStr] = item.dateMonthDay.split("-");
    const itemMonth = parseInt(mStr, 10) - 1;

    switch (range) {
      case "this_month":
        return itemMonth === currentMonth;
      case "next_month":
        return itemMonth === (currentMonth + 1) % 12;
      case "this_and_next_month":
        return itemMonth === currentMonth || itemMonth === (currentMonth + 1) % 12;
      case "next_30_days":
        return item.daysUntil >= 0 && item.daysUntil <= 30;
      case "next_60_days":
        return item.daysUntil >= 0 && item.daysUntil <= 60;
      case "next_90_days":
        return item.daysUntil >= 0 && item.daysUntil <= 90;
      default:
        return true;
    }
  });
}
