// FreeScout REST API Client & Helper Library

export interface FreeScoutMailbox {
  id: number;
  name: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FreeScoutCustomer {
  id?: number;
  email?: string;
  fname?: string;
  lname?: string;
  photoUrl?: string;
}

export interface FreeScoutAssignee {
  id?: number;
  email?: string;
  fname?: string;
  lname?: string;
  photoUrl?: string;
}

export interface FreeScoutConversation {
  id: number;
  number: number;
  threadsCount?: number;
  type?: string;
  folderId?: number;
  status: "active" | "pending" | "closed" | "spam" | string;
  state?: string;
  subject: string;
  preview?: string;
  mailboxId: number;
  mailboxName?: string;
  customer?: FreeScoutCustomer;
  assignee?: FreeScoutAssignee;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  ticketUrl: string;
}

export interface FreeScoutWidgetConfig {
  serverUrl?: string;
  apiKey?: string;
  selectedMailboxIds?: number[];
  selectedStatuses?: string[]; // e.g. ["active", "pending"]
  sortBy?: "updatedAt" | "createdAt" | "number";
  sortOrder?: "desc" | "asc";
  maxItems?: number; // e.g. 10, 25, 50
  autoRefreshMinutes?: number; // e.g. 0 (disabled), 1, 5, 15
}

export function normalizeFreeScoutUrls(rawUrl: string): { apiBase: string; webBase: string } {
  let cleaned = (rawUrl || "").trim().replace(/\/+$/, "");
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }

  // Remove /api from webBase if present
  let webBase = cleaned;
  if (webBase.endsWith("/api")) {
    webBase = webBase.slice(0, -4);
  }

  const apiBase = `${webBase}/api`;
  return { apiBase, webBase };
}

export function getFreeScoutTicketUrl(webBase: string, conversationId: number | string): string {
  const cleanWeb = webBase.replace(/\/+$/, "");
  return `${cleanWeb}/conversation/${conversationId}`;
}

export async function testFreeScoutConnection(serverUrl: string, apiKey: string): Promise<{ success: boolean; mailboxCount?: number; error?: string }> {
  if (!serverUrl || !apiKey) {
    return { success: false, error: "Server URL and API Key are required." };
  }

  try {
    const { apiBase } = normalizeFreeScoutUrls(serverUrl);
    const res = await fetch(`${apiBase}/mailboxes`, {
      headers: {
        "X-FreeScout-API-Key": apiKey.trim(),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: "Authentication failed. Please check your API Key." };
      }
      if (res.status === 404) {
        return { success: false, error: "FreeScout API endpoint not found. Please verify the Server URL." };
      }
      return { success: false, error: `FreeScout server responded with HTTP ${res.status} ${res.statusText}` };
    }

    const data = await res.json();
    let count = 0;
    if (data?._embedded?.mailboxes && Array.isArray(data._embedded.mailboxes)) {
      count = data._embedded.mailboxes.length;
    } else if (Array.isArray(data?.data)) {
      count = data.data.length;
    } else if (Array.isArray(data)) {
      count = data.length;
    }

    return { success: true, mailboxCount: count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Connection failed: ${msg}` };
  }
}

export async function fetchFreeScoutMailboxes(serverUrl: string, apiKey: string): Promise<FreeScoutMailbox[]> {
  const { apiBase } = normalizeFreeScoutUrls(serverUrl);
  const res = await fetch(`${apiBase}/mailboxes`, {
    headers: {
      "X-FreeScout-API-Key": apiKey.trim(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch mailboxes (HTTP ${res.status})`);
  }

  const data = await res.json();
  let rawList: any[] = [];
  if (data?._embedded?.mailboxes && Array.isArray(data._embedded.mailboxes)) {
    rawList = data._embedded.mailboxes;
  } else if (Array.isArray(data?.data)) {
    rawList = data.data;
  } else if (Array.isArray(data)) {
    rawList = data;
  }

  return rawList.map((m: any) => ({
    id: Number(m.id),
    name: String(m.name || `Mailbox #${m.id}`),
    email: m.email ? String(m.email) : undefined,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));
}

export async function fetchFreeScoutConversations(
  serverUrl: string,
  apiKey: string,
  options: {
    mailboxIds?: number[];
    statuses?: string[];
    sortBy?: "updatedAt" | "createdAt" | "number";
    sortOrder?: "desc" | "asc";
    maxItems?: number;
  }
): Promise<{ conversations: FreeScoutConversation[]; mailboxes: FreeScoutMailbox[] }> {
  const { apiBase, webBase } = normalizeFreeScoutUrls(serverUrl);
  const mailboxes = await fetchFreeScoutMailboxes(serverUrl, apiKey);
  const mailboxMap = new Map<number, string>();
  for (const m of mailboxes) {
    mailboxMap.set(m.id, m.name);
  }

  // Selected statuses default to active (unresolved) and pending
  const targetStatuses = options.statuses && options.statuses.length > 0 ? options.statuses : ["active", "pending"];
  const targetMailboxIds = options.mailboxIds && options.mailboxIds.length > 0 ? options.mailboxIds : mailboxes.map((m) => m.id);

  const sortBy = options.sortBy || "updatedAt";
  const sortOrder = options.sortOrder || "desc";
  const maxItems = Math.min(Math.max(options.maxItems ?? 25, 1), 100);

  // In FreeScout API, query per status/mailbox
  const queryPromises: Promise<any>[] = [];

  for (const status of targetStatuses) {
    if (targetMailboxIds.length > 0) {
      for (const mbId of targetMailboxIds) {
        const queryParams = new URLSearchParams({
          mailboxId: String(mbId),
          status: status,
          sort: sortBy,
          order: sortOrder,
        });

        const p = fetch(`${apiBase}/conversations?${queryParams.toString()}`, {
          headers: {
            "X-FreeScout-API-Key": apiKey.trim(),
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return [];
            let items: any[] = [];
            if (data?._embedded?.conversations && Array.isArray(data._embedded.conversations)) {
              items = data._embedded.conversations;
            } else if (Array.isArray(data?.data)) {
              items = data.data;
            } else if (Array.isArray(data)) {
              items = data;
            }
            return items;
          })
          .catch((err) => {
            console.warn(`[freescout] Error querying conversations for mailbox ${mbId}, status ${status}:`, err);
            return [];
          });

        queryPromises.push(p);
      }
    } else {
      const queryParams = new URLSearchParams({
        status: status,
        sort: sortBy,
        order: sortOrder,
      });

      const p = fetch(`${apiBase}/conversations?${queryParams.toString()}`, {
        headers: {
          "X-FreeScout-API-Key": apiKey.trim(),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return [];
          let items: any[] = [];
          if (data?._embedded?.conversations && Array.isArray(data._embedded.conversations)) {
            items = data._embedded.conversations;
          } else if (Array.isArray(data?.data)) {
            items = data.data;
          } else if (Array.isArray(data)) {
            items = data;
          }
          return items;
        })
        .catch((err) => {
          console.warn(`[freescout] Error querying conversations status ${status}:`, err);
          return [];
        });

      queryPromises.push(p);
    }
  }

  const results = await Promise.all(queryPromises);
  const collectedConversations: FreeScoutConversation[] = [];
  const seenIds = new Set<number>();

  for (const rawList of results) {
    for (const item of rawList) {
      const id = Number(item.id);
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const mbId = Number(item.mailboxId || item.mailbox_id || (item.mailbox ? item.mailbox.id : 0));
      const mbName = mbId ? mailboxMap.get(mbId) || `Mailbox #${mbId}` : "Mailbox";

      collectedConversations.push({
        id,
        number: Number(item.number || id),
        threadsCount: item.threadsCount ?? item.threads_count ?? 1,
        type: item.type || "email",
        folderId: item.folderId ?? item.folder_id,
        status: String(item.status || "active").toLowerCase(),
        state: item.state || "published",
        subject: item.subject || "(No Subject)",
        preview: item.preview ? String(item.preview).slice(0, 200) : undefined,
        mailboxId: mbId,
        mailboxName: mbName,
        customer: item.customer
          ? {
              id: item.customer.id,
              email: item.customer.email,
              fname: item.customer.fname || item.customer.firstName,
              lname: item.customer.lname || item.customer.lastName,
              photoUrl: item.customer.photoUrl || item.customer.photo_url,
            }
          : undefined,
        assignee: item.assignee
          ? {
              id: item.assignee.id,
              email: item.assignee.email,
              fname: item.assignee.fname || item.assignee.firstName,
              lname: item.assignee.lname || item.assignee.lastName,
              photoUrl: item.assignee.photoUrl || item.assignee.photo_url,
            }
          : undefined,
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
        updatedAt: item.updatedAt || item.updated_at || item.createdAt || new Date().toISOString(),
        closedAt: item.closedAt || item.closed_at || null,
        ticketUrl: getFreeScoutTicketUrl(webBase, id),
      });
    }
  }

  // Sort collected conversations
  collectedConversations.sort((a, b) => {
    if (sortBy === "number") {
      return sortOrder === "asc" ? a.number - b.number : b.number - a.number;
    }
    if (sortBy === "createdAt") {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    }
    // Default updatedAt
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
  });

  return {
    conversations: collectedConversations.slice(0, maxItems),
    mailboxes,
  };
}
