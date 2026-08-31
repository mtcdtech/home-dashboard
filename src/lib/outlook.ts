import { prisma } from "./prisma";

export interface OutlookAuthConfig {
  clientId: string;
  clientSecret?: string;
  tenantId: string;
}

export interface OutlookCalendarItem {
  id: string;
  name: string;
  color?: string;
  hexColor?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  owner?: {
    name?: string;
    address?: string;
  };
}

export interface OutlookEventItem {
  id: string;
  subject: string;
  bodyPreview?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay: boolean;
  location?: string;
  calendarId?: string;
  calendarName?: string;
  calendarColor?: string;
  isOnlineMeeting?: boolean;
  teamsUrl?: string | null;
  webLink?: string;
  responseStatus?: string;
  importance?: "low" | "normal" | "high";
  categories?: string[];
  showAs?: string;
}

export interface OutlookWidgetConfig {
  connected?: boolean;
  accountEmail?: string | null;
  accountName?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  daysAhead?: number;
  selectedCalendarIds?: string[];
  [key: string]: unknown;
}

interface GraphCalendarResponse {
  id: string;
  name?: string;
  color?: string;
  hexColor?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  owner?: {
    name?: string;
    address?: string;
  };
}

interface GraphEventResponse {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay?: boolean;
  location?: {
    displayName?: string;
  };
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  onlineMeeting?: {
    joinUrl?: string;
  };
  onlineMeetingUrl?: string;
  webLink?: string;
  responseStatus?: {
    response?: string;
  };
  importance?: "low" | "normal" | "high";
  categories?: string[];
  showAs?: string;
  body?: {
    content?: string;
  };
}

export function getMicrosoftAuthConfig(customConfig?: {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
}): OutlookAuthConfig {
  const clientId =
    customConfig?.clientId?.trim() ||
    process.env.MICROSOFT_CLIENT_ID?.trim() ||
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ||
    process.env.AZURE_CLIENT_ID?.trim() ||
    "";

  const clientSecret =
    customConfig?.clientSecret?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ||
    process.env.AZURE_CLIENT_SECRET?.trim() ||
    undefined;

  const tenantId =
    customConfig?.tenantId?.trim() ||
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID?.trim() ||
    process.env.MICROSOFT_TENANT_ID?.trim() ||
    "common";

  return { clientId, clientSecret, tenantId };
}

export async function refreshOutlookToken(
  refreshToken: string,
  authConfig: OutlookAuthConfig
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  const tenant = authConfig.tenantId || "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", authConfig.clientId);
  if (authConfig.clientSecret) {
    params.append("client_secret", authConfig.clientSecret);
  }
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("scope", "offline_access openid profile User.Read Calendars.Read Calendars.Read.Shared");

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[outlook] Token refresh failed:", res.status, errText);
      return null;
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  } catch (err) {
    console.error("[outlook] Token refresh exception:", err);
    return null;
  }
}

export async function getValidAccessToken(
  sectionId: string,
  widgetConfig: OutlookWidgetConfig | null | undefined
): Promise<{ accessToken: string; updatedConfig?: OutlookWidgetConfig } | null> {
  if (!widgetConfig || !widgetConfig.refreshToken) {
    return null;
  }

  const authConfig = getMicrosoftAuthConfig({
    clientId: widgetConfig.clientId,
    clientSecret: widgetConfig.clientSecret,
    tenantId: widgetConfig.tenantId,
  });

  const now = Date.now();
  // If accessToken exists and has at least 5 minutes before expiration, reuse it
  if (widgetConfig.accessToken && widgetConfig.expiresAt && widgetConfig.expiresAt - now > 5 * 60 * 1000) {
    return { accessToken: widgetConfig.accessToken };
  }

  // Refresh token
  const refreshed = await refreshOutlookToken(widgetConfig.refreshToken, authConfig);
  if (!refreshed) {
    return null;
  }

  const updatedConfig: OutlookWidgetConfig = {
    ...widgetConfig,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  };

  // Persist the refreshed token back to the Section widgetConfig
  try {
    await prisma.section.update({
      where: { id: sectionId },
      data: { widgetConfig: JSON.parse(JSON.stringify(updatedConfig)) },
    });
  } catch (dbErr) {
    console.warn("[outlook] Failed to update section with refreshed token:", dbErr);
  }

  return { accessToken: refreshed.accessToken, updatedConfig };
}

export function extractTeamsMeetingUrl(event: GraphEventResponse): string | null {
  // 1. Direct joinUrl from onlineMeeting object
  if (event.onlineMeeting?.joinUrl) {
    return event.onlineMeeting.joinUrl;
  }

  // 2. onlineMeetingUrl property
  if (event.onlineMeetingUrl && event.onlineMeetingUrl.startsWith("http")) {
    return event.onlineMeetingUrl;
  }

  // 3. Check location displayName or address
  const locName = event.location?.displayName || "";
  const locMatch = locName.match(/https:\/\/(teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+|teams\.live\.com\/meet\/[^\s<>"]+)/i);
  if (locMatch) {
    return locMatch[0];
  }

  // 4. Regex scan bodyPreview
  const preview = event.bodyPreview || "";
  const previewMatch = preview.match(/https:\/\/(teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+|teams\.live\.com\/meet\/[^\s<>"]+)/i);
  if (previewMatch) {
    return previewMatch[0];
  }

  // 5. If isOnlineMeeting is true and onlineMeetingProvider is teamsForBusiness, fallback search in body content
  if (event.body?.content) {
    const bodyMatch = event.body.content.match(/https:\/\/(teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"'\\]+|teams\.live\.com\/meet\/[^\s<>"'\\]+)/i);
    if (bodyMatch) {
      return bodyMatch[0];
    }
  }

  return null;
}

export async function fetchOutlookCalendars(accessToken: string): Promise<OutlookCalendarItem[]> {
  const url = "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,color,hexColor,isDefaultCalendar,canEdit,owner&$top=50";
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch calendars (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawList: GraphCalendarResponse[] = data.value || [];

  return rawList.map((c) => ({
    id: c.id,
    name: c.name || "Calendar",
    color: c.color || "auto",
    hexColor: c.hexColor || undefined,
    isDefaultCalendar: !!c.isDefaultCalendar,
    canEdit: !!c.canEdit,
    owner: c.owner ? { name: c.owner.name, address: c.owner.address } : undefined,
  }));
}

export async function fetchOutlookEvents(
  accessToken: string,
  options: {
    daysAhead?: number;
    selectedCalendarIds?: string[];
    timeZone?: string;
  }
): Promise<OutlookEventItem[]> {
  const daysAhead = Math.min(Math.max(options.daysAhead ?? 7, 1), 60);
  const now = new Date();
  // Start slightly in the past (start of today) so today's ongoing events are included
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const startDateTime = start.toISOString();
  const endDateTime = end.toISOString();
  const tz = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const selectFields = [
    "id",
    "subject",
    "bodyPreview",
    "start",
    "end",
    "isAllDay",
    "location",
    "isOnlineMeeting",
    "onlineMeetingProvider",
    "onlineMeeting",
    "onlineMeetingUrl",
    "webLink",
    "responseStatus",
    "importance",
    "categories",
    "showAs",
  ].join(",");

  const selectedCalIds = options.selectedCalendarIds || [];

  // If no calendar filtering or empty array, query the primary calendarView across all default calendars
  if (selectedCalIds.length === 0) {
    const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(
      startDateTime
    )}&endDateTime=${encodeURIComponent(endDateTime)}&$select=${selectFields}&$top=100&$orderby=start/dateTime`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: `outlook.timezone="${tz}"`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to fetch events (${res.status}): ${err}`);
    }

    const data = await res.json();
    const rawEvents: GraphEventResponse[] = data.value || [];

    return rawEvents.map((ev) => ({
      id: ev.id,
      subject: ev.subject || "(No title)",
      bodyPreview: ev.bodyPreview,
      start: ev.start,
      end: ev.end,
      isAllDay: !!ev.isAllDay,
      location: ev.location?.displayName || undefined,
      isOnlineMeeting: !!ev.isOnlineMeeting || !!ev.onlineMeetingUrl,
      teamsUrl: extractTeamsMeetingUrl(ev),
      webLink: ev.webLink,
      responseStatus: ev.responseStatus?.response,
      importance: ev.importance,
      categories: ev.categories,
      showAs: ev.showAs,
    }));
  }

  // Fetch per-selected calendar in parallel
  const calPromises = selectedCalIds.map(async (calId) => {
    try {
      const url = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
        calId
      )}/calendarView?startDateTime=${encodeURIComponent(
        startDateTime
      )}&endDateTime=${encodeURIComponent(endDateTime)}&$select=${selectFields}&$top=100&$orderby=start/dateTime`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: `outlook.timezone="${tz}"`,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[outlook] Failed to fetch events for calendar ${calId}:`, res.status);
        return [];
      }

      const data = await res.json();
      const rawEvents: GraphEventResponse[] = data.value || [];

      return rawEvents.map((ev) => ({
        id: ev.id,
        calendarId: calId,
        subject: ev.subject || "(No title)",
        bodyPreview: ev.bodyPreview,
        start: ev.start,
        end: ev.end,
        isAllDay: !!ev.isAllDay,
        location: ev.location?.displayName || undefined,
        isOnlineMeeting: !!ev.isOnlineMeeting || !!ev.onlineMeetingUrl,
        teamsUrl: extractTeamsMeetingUrl(ev),
        webLink: ev.webLink,
        responseStatus: ev.responseStatus?.response,
        importance: ev.importance,
        categories: ev.categories,
        showAs: ev.showAs,
      }));
    } catch (e) {
      console.warn(`[outlook] Error querying calendar ${calId}:`, e);
      return [];
    }
  });

  const results = await Promise.all(calPromises);
  const flattened = results.flat();

  // Deduplicate and sort chronologically by start dateTime
  const uniqueMap = new Map<string, OutlookEventItem>();
  for (const ev of flattened) {
    if (!uniqueMap.has(ev.id)) {
      uniqueMap.set(ev.id, ev);
    }
  }

  const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
    const timeA = new Date(a.start.dateTime).getTime();
    const timeB = new Date(b.start.dateTime).getTime();
    return timeA - timeB;
  });

  return sorted;
}
