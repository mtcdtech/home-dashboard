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
    process.env.AZURE_TENANT_ID?.trim() ||
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

  // Attempt refresh token
  const refreshed = await refreshOutlookToken(widgetConfig.refreshToken, authConfig);
  if (!refreshed) {
    // If refresh failed (e.g. network hiccup) but token is still technically valid, fallback to current token
    if (widgetConfig.accessToken && widgetConfig.expiresAt && widgetConfig.expiresAt > now) {
      return { accessToken: widgetConfig.accessToken };
    }
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
  const calendarMap = new Map<string, OutlookCalendarItem>();

  // 1. Query /me/calendars (default calendar group)
  try {
    const url = "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,color,hexColor,isDefaultCalendar,canEdit,owner&$top=50";
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const rawList: GraphCalendarResponse[] = data.value || [];
      for (const c of rawList) {
        calendarMap.set(c.id, {
          id: c.id,
          name: c.name || "Calendar",
          color: c.color || "auto",
          hexColor: c.hexColor || undefined,
          isDefaultCalendar: !!c.isDefaultCalendar,
          canEdit: !!c.canEdit,
          owner: c.owner ? { name: c.owner.name, address: c.owner.address } : undefined,
        });
      }
    }
  } catch (e) {
    console.warn("[outlook] Error fetching /me/calendars:", e);
  }

  // 2. Query /me/calendarGroups to find Subscribed Calendars, Shared Calendars, and Other Calendars
  try {
    const groupsRes = await fetch("https://graph.microsoft.com/v1.0/me/calendarGroups?$top=25", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (groupsRes.ok) {
      const groupsData = await groupsRes.json();
      const groups = groupsData.value || [];
      for (const grp of groups) {
        try {
          const grpCalRes = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendarGroups/${encodeURIComponent(grp.id)}/calendars?$select=id,name,color,hexColor,isDefaultCalendar,canEdit,owner&$top=50`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Prefer: 'outlook.timezone="UTC"',
              },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (grpCalRes.ok) {
            const grpCalData = await grpCalRes.json();
            const grpCals: GraphCalendarResponse[] = grpCalData.value || [];
            for (const c of grpCals) {
              if (!calendarMap.has(c.id)) {
                calendarMap.set(c.id, {
                  id: c.id,
                  name: c.name || "Calendar",
                  color: c.color || "auto",
                  hexColor: c.hexColor || undefined,
                  isDefaultCalendar: !!c.isDefaultCalendar,
                  canEdit: !!c.canEdit,
                  owner: c.owner ? { name: c.owner.name, address: c.owner.address } : undefined,
                });
              }
            }
          }
        } catch (grpErr) {
          console.warn(`[outlook] Failed to fetch calendars for group ${grp.name || grp.id}:`, grpErr);
        }
      }
    }
  } catch (groupsErr) {
    console.warn("[outlook] Error fetching /me/calendarGroups:", groupsErr);
  }

  return Array.from(calendarMap.values());
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

  // Fetch all calendars first so we know their names, colors, and IDs (including subscribed calendars)
  const allCalendars = await fetchOutlookCalendars(accessToken);
  const calMap = new Map<string, OutlookCalendarItem>();
  for (const cal of allCalendars) {
    calMap.set(cal.id, cal);
  }

  // Determine which calendar IDs to query
  let targetCalIds: string[] = [];
  if (options.selectedCalendarIds && options.selectedCalendarIds.length > 0) {
    targetCalIds = options.selectedCalendarIds;
  } else if (allCalendars.length > 0) {
    targetCalIds = allCalendars.map((c) => c.id);
  }

  const allEvents: OutlookEventItem[] = [];

  // Query each calendar view in parallel
  if (targetCalIds.length > 0) {
    const promises = targetCalIds.map(async (calId) => {
      const calInfo = calMap.get(calId);
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
          console.warn(`[outlook] Failed to fetch events for calendar ${calInfo?.name || calId}:`, res.status);
          return [];
        }

        const data = await res.json();
        const rawEvents: GraphEventResponse[] = data.value || [];

        return rawEvents.map((ev) => ({
          id: ev.id,
          calendarId: calId,
          calendarName: calInfo?.name || "Calendar",
          calendarColor: calInfo?.hexColor || undefined,
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
      } catch (calErr) {
        console.warn(`[outlook] Error querying calendar ${calInfo?.name || calId}:`, calErr);
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      allEvents.push(...r);
    }
  } else {
    // Fallback if no calendars enumerated: query primary calendarView
    try {
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

      if (res.ok) {
        const data = await res.json();
        const rawEvents: GraphEventResponse[] = data.value || [];
        allEvents.push(
          ...rawEvents.map((ev) => ({
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
          }))
        );
      }
    } catch (e) {
      console.warn("[outlook] Fallback /me/calendarView failed:", e);
    }
  }

  // Deduplicate events by id and sort chronologically
  const uniqueMap = new Map<string, OutlookEventItem>();
  for (const ev of allEvents) {
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
