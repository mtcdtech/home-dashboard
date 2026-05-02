"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseBookmarksHtml } from "@/lib/bookmark-parser";
import { auth } from "@/auth";
import { requireSession, requireAdmin, requireTabRole, requireSectionRole } from "@/lib/authz";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

async function logActionActivity(type: string, detail: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id || "system";
    const userName = session?.user?.name || session?.user?.email || "System";
    await (prisma as any).activityLog.create({
      data: { userId, userName, type, detail }
    });
  } catch(e) { }
}

// --- OPENVERSE IMAGE SEARCH ---
export async function searchOpenverseImages(query: string, page: number = 1) {
  await requireSession();
  try {
    const params = new URLSearchParams({
      q: `${query} wallpaper background`,
      page: String(page),
      page_size: "12",
      license_type: "all-cc",
      aspect_ratio: "wide",
      size: "large",
    });
    const resp = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
      headers: { "User-Agent": "HomeDashboard/1.0 (church internal tool)" },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || []).map((r: any) => ({
      url: r.url,
      thumb: r.thumbnail || r.url,
      title: r.title || "",
      creator: r.creator || "",
    }));
  } catch (err) {
    console.error("Openverse search error:", err);
    return [];
  }
}

// --- CORE ASSET GOVERNANCE ---
export async function uploadImage(formData: FormData) {
  await requireSession();
  try {
    const file = formData.get("file") as File;
    if (!file) return null;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }
    const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "").replace(/\.\.+/g, ".");
    const filename = `${Date.now()}-${cleanName}`;
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    return `/api/uploads/${filename}`;
  } catch (err) {
    console.error("Failed to upload image:", err);
    return null;
  }
}

export async function saveGeneratedImage(base64: string) {
  await requireSession();
  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `gen-${Date.now()}-${randomStr}.png`;
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    return `/api/uploads/${filename}`;
  } catch (err) {
    console.error("Failed to save base64 image:", err);
    return null; // Return null instead of throwing to prevent crashing import
  }
}

export async function downloadImageFromUrl(url: string) {
  await requireSession();
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return null;
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === '::1' || urlObj.hostname === '0.0.0.0') {
      console.error("Blocked SSRF attempt to loopback:", url);
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }

    const urlObj = new URL(url);
    const ext = urlObj.pathname.split('.').pop() || 'png';
    const filename = `remote-${Date.now()}.${ext}`;
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    return `/api/uploads/${filename}`;
  } catch (e) {
    console.error("Failed to download remote asset:", e);
    return null;
  }
}

export async function processMediaField(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return mediaUrl;
  try {
    if (mediaUrl.startsWith('data:image')) {
      const saved = await saveGeneratedImage(mediaUrl);
      return saved || mediaUrl; // Fallback to raw base64 if save failed (better than nothing)
    }
    if (mediaUrl.startsWith('http')) {
      const local = await downloadImageFromUrl(mediaUrl);
      if (local) return local;
    }
  } catch (e) {
    console.error("Failed to process media field:", e);
  }
  return mediaUrl;
}
export async function fetchFavicon(targetUrl: string) {
  await requireSession();
  try {
    const domain = new URL(targetUrl).hostname;
    // High-fidelity favicon signal from Google's high-res proxy
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    const response = await fetch(faviconUrl);
    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }

    const filename = `fav-${domain}-${Date.now()}.png`;
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    return `/api/uploads/${filename}`;
  } catch (e) {
    console.error("Favicon manifestation error:", e);
    return null;
  }
}

// --- TAB ORCHESTRATION ---

// Helper: returns the impersonated user ID if impersonating, otherwise the real user
async function getEffectiveUserId(): Promise<string | undefined> {
  const { cookies } = require("next/headers");
  const session = await auth();
  const realUserId = session?.user?.id;
  if (!realUserId) return undefined;
  try {
    const cookieStore = await cookies();
    const impId = cookieStore.get("impersonate_user_id")?.value;
    if (impId && impId !== realUserId) return impId;
  } catch (e) {}
  return realUserId;
}

export async function createTab(data: { title: string; icon?: string; order?: number; themeId?: string | null; organization?: string | null; allowedUserIds?: string[]; columns?: number }) {
  await requireSession();
  const effectiveUserId = await getEffectiveUserId();
  await (prisma as any).tab.create({
    data: {
      title: data.title,
      icon: data.icon || null,
      order: data.order ?? 0,
      themeId: data.themeId,
      organization: data.organization || null,
      columns: data.columns ?? 3,
      isLibraryItem: (data as any).isLibraryItem ?? false,
      isPublic: (data as any).isPublic ?? false,
      description: (data as any).description || null,
      allowedUsers: data.allowedUserIds ? { connect: data.allowedUserIds.map(id => ({ id })) } : undefined,
      owners: effectiveUserId ? { connect: { id: effectiveUserId } } : undefined
    }
  });
  await logActionActivity("tab_edit", `Created workspace: ${data.title}`);
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function updateTab(id: string, data: { title: string; icon?: string | null; order?: number; themeId?: string | null; organization?: string | null; allowedUserIds?: string[]; columns?: number }) {
  await requireTabRole(arguments[0], "edit");
  // Imported (read-only sync) workspaces are never catalog items per access-matrix spec.
  const existing = await (prisma as any).tab.findUnique({ where: { id }, select: { isReadOnlySync: true } });
  const requestedLibrary = (data as any).isLibraryItem ?? false;
  const isLibraryItem = existing?.isReadOnlySync ? false : requestedLibrary;

  await (prisma as any).tab.update({
    where: { id },
    data: {
      title: data.title,
      icon: data.icon,
      order: data.order ?? 0,
      themeId: data.themeId,
      organization: data.organization || null,
      columns: data.columns ?? 3,
      isLibraryItem,
      isPublic: (data as any).isPublic ?? false,
      pushToNewUsers: (data as any).pushToNewUsers ?? false,
      description: (data as any).description || null,
      allowedUsers: data.allowedUserIds ? { set: data.allowedUserIds.map(uid => ({ id: uid })) } : undefined,
      editors: (data as any).editorUserIds ? { set: (data as any).editorUserIds.map((uid: string) => ({ id: uid })) } : undefined,
      owners: (data as any).ownerUserIds ? { set: (data as any).ownerUserIds.map((uid: string) => ({ id: uid })) } : undefined
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function reorderTabs(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, idx) => (prisma as any).tab.update({ where: { id }, data: { order: idx } })));
  revalidatePath("/");
}

export async function deleteTab(id: string) {
  await requireTabRole(arguments[0], "owner");
  const tab = await prisma.tab.findUnique({ 
    where: { id },
    include: { tabSections: true }
  });
  
  if (!tab) return;
  
  const sectionIds = tab.tabSections.map((ts: any) => ts.sectionId);
  const themeId = tab.themeId;

  // Delete the tab first (cascades to TabSection)
  await prisma.tab.delete({ where: { id } });

  // Clean up orphaned read-only imported sections
  if (tab.isReadOnlySync && sectionIds.length > 0) {
    for (const sId of sectionIds) {
      const remainingLinks = await prisma.tabSection.count({ where: { sectionId: sId } });
      if (remainingLinks === 0) {
        await prisma.section.deleteMany({ where: { id: sId, isReadOnlySync: true } });
      }
    }
  }

  // Clean up orphaned read-only theme
  if (tab.isReadOnlySync && themeId) {
    const remainingTabs = await prisma.tab.count({ where: { themeId } });
    if (remainingTabs === 0) {
      await prisma.theme.deleteMany({ where: { id: themeId, isReadOnlySync: true } });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function addTabToUser(tabId: string) {
  await requireSession();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await (prisma as any).tab.update({
    where: { id: tabId },
    data: { allowedUsers: { connect: { id: userId } } }
  });
  revalidatePath("/");
}

// --- SECTION ORCHESTRATION ---
export async function createSection(data: any) {
  await requireSession();
  const session = await auth();
  const userId = session?.user?.id;
  const section = await prisma.section.create({
    data: {
      ...data,
      isLibraryItem: data.isLibraryItem ?? false,
      description: data.description || null,
      ...(userId ? { owners: { connect: { id: userId } } } : {})
    }
  } as any);
  revalidatePath("/");
  revalidatePath("/admin/sections");
  return section;
}

export async function addSectionToTab(sectionId: string, tabId: string, column: number = 0) {
  await requireTabRole(arguments[0], "edit");
  // Permission check: only tab owners, editors, or admins can add sections
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    const isAdmin = (session?.user as any)?.isAdmin;
    if (!isAdmin) {
      const tab = await prisma.tab.findUnique({
        where: { id: tabId },
        include: { editors: { select: { id: true } }, owners: { select: { id: true } } }
      });
      const hasEditAccess = tab?.editors?.some(e => e.id === userId) || tab?.owners?.some(o => o.id === userId);
      if (!hasEditAccess) {
        throw new Error("You don't have edit access to this workspace");
      }
    }
  }

  const lastEntry = await (prisma as any).tabSection.findFirst({
    where: { tabId, column },
    orderBy: { order: "desc" },
  });
  await (prisma as any).tabSection.create({
    data: { sectionId, tabId, column, order: (lastEntry?.order ?? -1) + 1 },
  });
  revalidatePath("/");
}

export async function removeSectionFromTab(sectionId: string, tabId: string) {
  await requireTabRole(arguments[0], "edit");
  await (prisma as any).tabSection.deleteMany({ where: { sectionId, tabId } });
  revalidatePath("/");
}

export async function toggleSectionInTab(tabId: string, sectionId: string, isAssigned: boolean) {
  await requireTabRole(arguments[0], "edit");
  if (isAssigned) {
    const existing = await (prisma as any).tabSection.findUnique({ where: { tabId_sectionId: { tabId, sectionId } } });
    if (!existing) await (prisma as any).tabSection.create({ data: { tabId, sectionId, order: 999, column: 0 } });
  } else {
    await (prisma as any).tabSection.delete({ where: { tabId_sectionId: { tabId, sectionId } } });
  }
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

export async function updateSection(id: string, data: any) {
  await requireSectionRole(arguments[0], "edit");
  // Imported (read-only sync) sections are never catalog items per access-matrix spec.
  const existing = await prisma.section.findUnique({ where: { id }, select: { isReadOnlySync: true } });
  const requestedLibrary = data.isLibraryItem ?? false;
  const isLibraryItem = existing?.isReadOnlySync ? false : requestedLibrary;

  await prisma.section.update({
    where: { id },
    data: {
      ...data,
      isLibraryItem,
      description: data.description || null
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

export async function deleteSection(id: string) {
  await requireSectionRole(arguments[0], "owner");
  await prisma.section.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

export async function updateSectionLayout(sectionId: string, tabId: string, data: { height?: number | null; isAutoResize?: boolean }) {
  await requireTabRole(arguments[0], "edit");
  await (prisma as any).tabSection.update({
    where: { tabId_sectionId: { tabId, sectionId } },
    data: data,
  });
  revalidatePath("/");
}

export async function updateTabSectionCollapsed(sectionId: string, tabId: string, defaultCollapsed: boolean) {
  await requireSession();
  await prisma.$transaction(
    [{ sectionId, tabId, defaultCollapsed }].map(update =>
      (prisma as any).tabSection.updateMany({
        where: { tabId: update.tabId, sectionId: update.sectionId },
        data: { defaultCollapsed: update.defaultCollapsed }
      })
    )
  );
  revalidatePath("/");
}

export async function updateUserDefaultTab(userId: string, defaultTabId: string | null) {
  await requireSession();
  await prisma.user.update({ where: { id: userId }, data: { defaultTabId } });
  revalidatePath("/");
}

export async function updateGlobalDefaultTab(defaultTabId: string | null) {
  await requireAdmin();
  await (prisma as any).globalSettings.upsert({
    where: { id: "global" },
    update: { defaultTabId },
    create: { id: "global", defaultTabId },
  });
  revalidatePath("/");
}

export async function moveSection(sectionId: string, tabId: string, targetColumn: number, beforeSectionId?: string) {
  await requireTabRole(arguments[0], "edit");
  await (prisma as any).tabSection.update({ where: { tabId_sectionId: { tabId, sectionId } }, data: { column: targetColumn } });
  const allInTarget = await (prisma as any).tabSection.findMany({ where: { tabId, column: targetColumn }, orderBy: { order: "asc" } }) as any[];
  const withoutMoved = allInTarget.filter((ts: any) => ts.sectionId !== sectionId);
  const movedEntry = allInTarget.find((ts: any) => ts.sectionId === sectionId)!;
  if (!movedEntry) { revalidatePath("/"); return; }
  let finalOrder: any[];
  if (beforeSectionId) {
    const beforeIdx = withoutMoved.findIndex((ts: any) => ts.sectionId === beforeSectionId);
    if (beforeIdx === -1) {
      finalOrder = [...withoutMoved, movedEntry]; // fallback: append at end
    } else {
      finalOrder = [...withoutMoved.slice(0, beforeIdx), movedEntry, ...withoutMoved.slice(beforeIdx)];
    }
  } else {
    finalOrder = [...withoutMoved, movedEntry];
  }
  await Promise.all(finalOrder.map((ts: any, idx: number) => (prisma as any).tabSection.update({ where: { id: ts.id }, data: { order: idx } })));
  revalidatePath("/");
}

export async function updatePersonalLayout(data: {
  tabOrder?: string[];
  tabId?: string;
  sectionId?: string;
  column?: number;
  order?: number;
  collapsed?: boolean;
}) {
  await requireSession();
  const session = await auth();
  const user = session?.user;
  if (!user?.email) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true, layout: true } });
  if (!dbUser) throw new Error("User not found");

  let layout: any = dbUser.layout;
  if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
  else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
  else { layout = {}; }

  if (data.tabOrder) {
    layout.tabOrder = data.tabOrder;
  }

  if (data.tabId && data.sectionId) {
    if (!layout.tabSections) layout.tabSections = {};
    if (!layout.tabSections[data.tabId]) layout.tabSections[data.tabId] = {};
    if (!layout.tabSections[data.tabId][data.sectionId]) layout.tabSections[data.tabId][data.sectionId] = {};

    const secLayout = layout.tabSections[data.tabId][data.sectionId];
    if (data.column !== undefined) secLayout.column = data.column;
    if (data.order !== undefined) secLayout.order = data.order;
    if (data.collapsed !== undefined) secLayout.collapsed = data.collapsed;
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { layout }
  });

  revalidatePath("/");
}

export async function updatePersonalLayoutBatch(updates: {
  tabId: string;
  sectionId: string;
  column?: number;
  order?: number;
  collapsed?: boolean;
}[]) {
  await requireSession();
  const session = await auth();
  const user = session?.user;
  if (!user?.email) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true, layout: true } });
  if (!dbUser) throw new Error("User not found");

  let layout: any = dbUser.layout;
  if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
  else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
  else { layout = {}; }

  for (const data of updates) {
    if (!layout.tabSections) layout.tabSections = {};
    if (!layout.tabSections[data.tabId]) layout.tabSections[data.tabId] = {};
    if (!layout.tabSections[data.tabId][data.sectionId]) layout.tabSections[data.tabId][data.sectionId] = {};

    const secLayout = layout.tabSections[data.tabId][data.sectionId];
    if (data.column !== undefined) secLayout.column = data.column;
    if (data.order !== undefined) secLayout.order = data.order;
    if (data.collapsed !== undefined) secLayout.collapsed = data.collapsed;
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { layout }
  });

  revalidatePath("/");
}

export async function activateTheme(id: string) {
  await prisma.theme.updateMany({ data: { isActive: false } });
  await prisma.theme.update({ where: { id }, data: { isActive: true } });
  revalidatePath("/");
  revalidatePath("/admin/theme");
}

// --- BOOKMARK ORCHESTRATION ---
function normalizeUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  return 'https://' + trimmed;
}

export async function createBookmark(data: any) {
  if (data.url) data.url = normalizeUrl(data.url);
  
  if (data.sectionId) {
    const maxOrderBookmark = await prisma.bookmark.findFirst({
      where: { sectionId: data.sectionId },
      orderBy: { order: "desc" },
      select: { order: true }
    });
    data.order = maxOrderBookmark ? (maxOrderBookmark.order + 1) : 0;
  }
  
  const b = await prisma.bookmark.create({ data });
  await logActionActivity("bookmark_edit", `Created bookmark: ${data.title || data.url}`);
  revalidatePath("/");
  return b;
}

export async function updateBookmark(id: string, data: any) {
  if (data.url) data.url = normalizeUrl(data.url);
  await prisma.bookmark.update({ where: { id }, data });
  await logActionActivity("bookmark_edit", `Updated bookmark: ${data.title || data.url || id}`);
  revalidatePath("/");
}

export async function deleteBookmark(id: string) {
  await prisma.bookmark.delete({ where: { id } });
  revalidatePath("/");
}

export async function moveBookmark(bookmarkId: string, targetSectionId: string, beforeBookmarkId?: string) {
  await prisma.bookmark.update({ where: { id: bookmarkId }, data: { sectionId: targetSectionId } });
  const allInTarget = await prisma.bookmark.findMany({ where: { sectionId: targetSectionId }, orderBy: { order: "asc" } });
  const withoutMoved = allInTarget.filter((b) => b.id !== bookmarkId);
  const movedBookmark = allInTarget.find((b) => b.id === bookmarkId)!;
  let finalOrder = beforeBookmarkId
    ? [...withoutMoved.slice(0, withoutMoved.findIndex((b) => b.id === beforeBookmarkId)), movedBookmark, ...withoutMoved.slice(withoutMoved.findIndex((b) => b.id === beforeBookmarkId))].filter(Boolean)
    : [...withoutMoved, movedBookmark];
  await Promise.all(finalOrder.map((b, idx) => prisma.bookmark.update({ where: { id: b.id }, data: { order: idx } })));
  revalidatePath("/");
}

// --- THEME & AESTHETIC FORGE ---
export async function createTheme(data: any) {
  await requireAdmin();
  const result = await prisma.theme.create({
    data: {
      ...data,
      owners: { connect: { id: (await auth())?.user?.id } }
    }
  });
  revalidatePath("/admin/theme");
  return result;
}

export async function updateTheme(id: string, data: any) {
  await requireAdmin();
  const result = await prisma.theme.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath("/admin/theme");
  return result;
}

export async function deleteTheme(id: string) {
  await requireAdmin();
  return await prisma.theme.delete({ where: { id } });
}

export async function updateTabTheme(tabId: string, themeData: any) {
  await requireTabRole(arguments[0], "edit");
  const session = await auth();
  const user = (session as any)?.user;
  if (!user) throw new Error("Unauthorized");

  const tab = await prisma.tab.findUnique({ where: { id: tabId }, include: { theme: true } });
  if (!tab) throw new Error("Tab not found");

  let shouldCreateNew = true;
  if (tab.theme) {
    const isOwner = await prisma.theme.findFirst({
      where: { id: tab.theme.id, owners: { some: { id: user.id } } }
    });
    if (isOwner && !tab.theme.isLibraryItem && !tab.theme.isActive) {
      shouldCreateNew = false;
    }
  }

  if (shouldCreateNew) {
    const newTheme = await prisma.theme.create({
      data: {
        ...themeData,
        owners: { connect: { id: user.id } }
      }
    });
    await prisma.tab.update({ where: { id: tabId }, data: { themeId: newTheme.id } });
    revalidatePath("/");
    return newTheme;
  } else {
    const updated = await prisma.theme.update({
      where: { id: tab.theme!.id },
      data: themeData
    });
    revalidatePath("/");
    revalidatePath("/admin/theme");
    return updated;
  }
}

// --- GLOBAL AESTHETIC GOVERNANCE ---
export async function updateGlobalSettings(data: any) {
  await requireAdmin();
  const settings = await (prisma as any).globalSettings.upsert({
    where: { id: "global" },
    update: data,
    create: { id: "global", ...data }
  });
  revalidatePath("/");
  revalidatePath("/admin/theme");
  return settings;
}

export async function getGlobalSettings() {
  return await (prisma as any).globalSettings.findUnique({ where: { id: "global" } });
}

// --- USER & IDENTITY GOVERNANCE ---
export async function toggleUserAdmin(id: string, isAdmin: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { isAdmin } });
  revalidatePath("/admin/users");
}

export async function updateUserDashboardGroup(id: string, dashboardGroup: string) {
  await requireAdmin();
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) throw new Error("Unauthorized");
  await prisma.user.update({ where: { id }, data: { dashboardGroup } });
  revalidatePath("/admin/users");
}

export async function toggleUserEditContent(id: string, canEditContent: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { canEditContent } });
  revalidatePath("/admin/users");
}

export async function setUserAllowedSections(userId: string, sectionIds: string[]) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { allowedSections: { set: sectionIds.map((id) => ({ id })) } } });
  revalidatePath("/admin/users");
  revalidatePath("/");
}

export async function setTabEditors(tabId: string, userIds: string[]) {
  await requireTabRole(arguments[0], "edit");
  await (prisma as any).tab.update({
    where: { id: tabId },
    data: {
      editors: { set: userIds.map(id => ({ id })) }
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

async function _updateTabUserRole(tabId: string, userId: string, role: string) {
  await prisma.tab.update({
    where: { id: tabId },
    data: {
      owners: { disconnect: { id: userId } },
      editors: { disconnect: { id: userId } },
      allowedUsers: { disconnect: { id: userId } },
      blockedUsers: { disconnect: { id: userId } }
    }
  });

  if (role === "owner") {
    await prisma.tab.update({ where: { id: tabId }, data: { owners: { connect: { id: userId } } } });
  } else if (role === "editor") {
    await prisma.tab.update({ where: { id: tabId }, data: { editors: { connect: { id: userId } } } });
  } else if (role === "viewer") {
    await prisma.tab.update({ where: { id: tabId }, data: { allowedUsers: { connect: { id: userId } } } });
  } else if (role === "none") {
    await prisma.tab.update({ where: { id: tabId }, data: { blockedUsers: { connect: { id: userId } } } });
  }
}

export async function transferTabOwnership(tabId: string, currentOwnerId: string, newOwnerId: string) {
  await requireTabRole(arguments[0], "edit");
  // Disconnect current owner, add them as an editor instead
  await prisma.tab.update({
    where: { id: tabId },
    data: {
      owners: { disconnect: { id: currentOwnerId } },
      editors: { connect: { id: currentOwnerId } }
    }
  });

  // Make the new owner an owner (disconnect from everything else first)
  await prisma.tab.update({
    where: { id: tabId },
    data: {
      editors: { disconnect: { id: newOwnerId } },
      allowedUsers: { disconnect: { id: newOwnerId } },
      blockedUsers: { disconnect: { id: newOwnerId } }
    }
  });
  await prisma.tab.update({
    where: { id: tabId },
    data: { owners: { connect: { id: newOwnerId } } }
  });

  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function updateTabUserRole(tabId: string, userId: string, role: string) {
  await requireTabRole(arguments[0], "edit");
  await _updateTabUserRole(tabId, userId, role);
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

async function _updateTabDepartmentRole(tabId: string, department: string, role: string) {
  if (role === "none") {
    await (prisma as any).tabDepartmentAccess.deleteMany({
      where: { tabId, department }
    });
  } else {
    await (prisma as any).tabDepartmentAccess.upsert({
      where: { tabId_department: { tabId, department } },
      update: { role },
      create: { tabId, department, role }
    });
  }
}

export async function updateTabDepartmentRole(tabId: string, department: string, role: string) {
  await requireTabRole(arguments[0], "edit");
  await _updateTabDepartmentRole(tabId, department, role);
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function setSectionEditors(sectionId: string, userIds: string[]) {
  await requireSectionRole(arguments[0], "edit");
  await prisma.section.update({
    where: { id: sectionId },
    data: {
      editors: { set: userIds.map(id => ({ id })) }
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

async function _updateSectionUserRole(sectionId: string, userId: string, role: string) {
  await prisma.section.update({
    where: { id: sectionId },
    data: {
      owners: { disconnect: { id: userId } },
      editors: { disconnect: { id: userId } },
      allowedUsers: { disconnect: { id: userId } },
      blockedUsers: { disconnect: { id: userId } }
    }
  });

  if (role === "owner") {
    await prisma.section.update({ where: { id: sectionId }, data: { owners: { connect: { id: userId } } } });
  } else if (role === "editor") {
    await prisma.section.update({ where: { id: sectionId }, data: { editors: { connect: { id: userId } } } });
  } else if (role === "viewer") {
    await prisma.section.update({ where: { id: sectionId }, data: { allowedUsers: { connect: { id: userId } } } });
  } else if (role === "none") {
    await prisma.section.update({ where: { id: sectionId }, data: { blockedUsers: { connect: { id: userId } } } });
  }
}

export async function updateSectionUserRole(sectionId: string, userId: string, role: string) {
  await requireSectionRole(arguments[0], "edit");
  await _updateSectionUserRole(sectionId, userId, role);
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

async function _updateSectionDepartmentRole(sectionId: string, department: string, role: string) {
  if (role === "none") {
    await (prisma as any).sectionDepartmentAccess.deleteMany({
      where: { sectionId, department }
    });
  } else {
    await (prisma as any).sectionDepartmentAccess.upsert({
      where: { sectionId_department: { sectionId, department } },
      update: { role },
      create: { sectionId, department, role }
    });
  }
}

export async function updateSectionDepartmentRole(sectionId: string, department: string, role: string) {
  await requireSectionRole(arguments[0], "edit");
  await _updateSectionDepartmentRole(sectionId, department, role);
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

// --- CATALOG & PUSH ORCHESTRATION ---
export async function pushTabToDepartment(tabId: string, department: string) {
  await requireAdmin();
  const users = await prisma.user.findMany({ where: { department }, select: { id: true } });
  await (prisma as any).tab.update({
    where: { id: tabId },
    data: {
      allowedUsers: { connect: users.map(u => ({ id: u.id })) }
    }
  });
  revalidatePath("/");
}

export async function pushSectionToDepartment(sectionId: string, department: string) {
  await requireTabRole(arguments[0], "edit");
  const users = await prisma.user.findMany({ where: { department }, select: { id: true } });
  await prisma.section.update({
    where: { id: sectionId },
    data: {
      allowedUsers: { connect: users.map(u => ({ id: u.id })) }
    }
  });
  revalidatePath("/");
}

export async function importTabFromLibrary(tabId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, layout: true } });
  if (!user) throw new Error("User not found");

  // Get all sections in this tab so we can grant sub-access
  const tabWithSections = await (prisma as any).tab.findUnique({
    where: { id: tabId },
    include: { tabSections: { select: { sectionId: true } } }
  });

  const sectionIds = tabWithSections?.tabSections.map((ts: any) => ts.sectionId) || [];

  await prisma.$transaction([
    (prisma as any).tab.update({
      where: { id: tabId },
      data: { allowedUsers: { connect: { id: user.id } } }
    }),
    ...sectionIds.map((sid: string) => prisma.section.update({
      where: { id: sid },
      data: { allowedUsers: { connect: { id: user.id } } }
    }))
  ]);

  // Remove from hiddenTabs and add to tabOrder
  let layout: any = user.layout;
  if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
  else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
  else { layout = {}; }
  if (layout.hiddenTabs) {
    layout.hiddenTabs = layout.hiddenTabs.filter((id: string) => id !== tabId);
  }
  if (!layout.tabOrder) layout.tabOrder = [];
  if (!layout.tabOrder.includes(tabId)) {
    layout.tabOrder.push(tabId);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { layout }
  });

  revalidatePath("/");
}

export async function removeTabFromUser(tabId: string) {
  await requireSession();
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, dashboardGroup: true }
  });
  if (!user) throw new Error("User not found");

  // Refuse if a LOCKED push rule covers this user (global, their dept, or them directly).
  const dept = (user.dashboardGroup || "General").toLowerCase().trim();
  const lockedRule = await (prisma as any).tabPushRule.findFirst({
    where: {
      tabId,
      locked: true,
      OR: [
        { targetType: "global" },
        { targetType: "user", targetId: user.id },
        { targetType: "department" }, // department match is case-insensitive; filter below
      ],
    }
  });
  if (lockedRule) {
    if (
      lockedRule.targetType === "global" ||
      (lockedRule.targetType === "user" && lockedRule.targetId === user.id) ||
      (lockedRule.targetType === "department" && (lockedRule.targetId || "").toLowerCase().trim() === dept)
    ) {
      throw new Error("This workspace is locked by an administrator and cannot be removed.");
    }
  }

  const tab = await prisma.tab.findUnique({
    where: { id: tabId },
    include: { owners: { select: { id: true } } }
  });
  if (tab?.owners?.some((o: any) => o.id === user.id)) {
    throw new Error("You are the owner of this workspace. To remove it from your dashboard, please open the Admin Dashboard and designate a new owner, or delete it entirely.");
  }

  await (prisma as any).tab.update({
    where: { id: tabId },
    data: {
      allowedUsers: { disconnect: { id: user.id } }
    }
  });

  // Also add to hiddenTabs so pushed or global tabs don't keep reappearing
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { layout: true } });
  if (dbUser) {
    let layout: any = dbUser.layout;
    if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
    else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
    else { layout = {}; }
    if (!layout.hiddenTabs) layout.hiddenTabs = [];
    if (!layout.hiddenTabs.includes(tabId)) {
      layout.hiddenTabs.push(tabId);
    }
    // Also remove from tabOrder if present
    if (layout.tabOrder) {
      layout.tabOrder = layout.tabOrder.filter((id: string) => id !== tabId);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { layout }
    });
  }

  revalidatePath("/");
}

// --- CROSS-SERVER SYNC ORCHESTRATION ---
export async function generateTabSyncToken(tabId: string) {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) throw new Error("Unauthorized");
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  await (prisma as any).tab.update({ where: { id: tabId }, data: { syncToken: token } });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
  return token;
}

export async function importWorkspaceFromSyncUrl(syncUrl: string) {
  await requireAdmin();
  try {
     console.log("importWorkspaceFromSyncUrl: Starting import for", syncUrl);
     const session = await auth();
     const userId = session?.user?.id;
     if (!userId) throw new Error("Unauthorized");
  
     console.log("importWorkspaceFromSyncUrl: Fetching payload...");
     const resp = await fetch(syncUrl, { cache: 'no-store' });
     if (!resp.ok) {
         console.error("importWorkspaceFromSyncUrl: fetch failed with status", resp.status);
         throw new Error("Failed to fetch sync payload");
     }
     const payload = await resp.json();
     console.log("importWorkspaceFromSyncUrl: Fetched payload successfully");
  
     if (!payload.tab) throw new Error("Invalid sync payload: missing tab");
  
     let themeId = null;
     if (payload.tab.theme) {
        console.log("importWorkspaceFromSyncUrl: Processing theme...");
        let bgUrl = payload.tab.theme.backgroundColor;
        if (bgUrl && bgUrl.startsWith('/')) {
            try {
                const urlObj = new URL(syncUrl);
                bgUrl = `${urlObj.origin}${bgUrl}`;
            } catch (e) {}
        }
        bgUrl = await processMediaField(bgUrl);
  
        let logoIcon = payload.tab.theme.logoIcon;
        if (logoIcon && logoIcon.startsWith('/')) {
            try {
                const urlObj = new URL(syncUrl);
                logoIcon = `${urlObj.origin}${logoIcon}`;
            } catch (e) {}
        }
        logoIcon = await processMediaField(logoIcon);
  
        const t = await prisma.theme.create({
           data: {
              ...payload.tab.theme,
              backgroundColor: bgUrl,
              logoIcon: logoIcon,
              name: `Synced Theme - ${payload.tab.theme.name} - ${Date.now()}`,
              isLibraryItem: true,
              isReadOnlySync: true,
              owners: { connect: { id: userId } }
           }
        });
        themeId = t.id;
        console.log("importWorkspaceFromSyncUrl: Created theme", t.id);
     }
  
     console.log("importWorkspaceFromSyncUrl: Processing tab icon...");
     let tabIcon = payload.tab.icon;
     if (tabIcon && tabIcon.startsWith('/')) {
         try {
             const urlObj = new URL(syncUrl);
             tabIcon = `${urlObj.origin}${tabIcon}`;
         } catch (e) {}
     }
     tabIcon = await processMediaField(tabIcon);
  
     console.log("importWorkspaceFromSyncUrl: Creating tab in DB...");
     const newTab = await (prisma as any).tab.create({
        data: {
           title: payload.tab.title,
           icon: tabIcon,
           columns: payload.tab.columns,
           description: payload.tab.description,
           themeId,
           // Imported workspaces are never added to the catalog (access-matrix spec).
           isLibraryItem: false,
           syncSourceUrl: syncUrl,
           isReadOnlySync: true,
           owners: { connect: { id: userId } },
           allowedUsers: { connect: { id: userId } }
        }
     });
     console.log("importWorkspaceFromSyncUrl: Created tab", newTab.id);

     console.log(`importWorkspaceFromSyncUrl: Processing ${payload.tab.sections?.length || 0} sections...`);
     for (const s of payload.tab.sections) {
        console.log("importWorkspaceFromSyncUrl: Creating section:", s.title);
        let secIcon = s.icon;
        if (secIcon && secIcon.startsWith('/')) {
            try {
                const urlObj = new URL(syncUrl);
                secIcon = `${urlObj.origin}${secIcon}`;
            } catch (e) {}
        }
        secIcon = await processMediaField(secIcon);
  
        const newSec = await prisma.section.create({
           data: {
              title: s.title,
              icon: secIcon,
              description: s.description,
              isGlobal: false,
              // Imported sections are never added to the catalog (access-matrix spec).
              isLibraryItem: false,
              isReadOnlySync: true,
              owners: { connect: { id: userId } }
           }
        });
        await (prisma as any).tabSection.create({
           data: {
              tabId: newTab.id,
              sectionId: newSec.id,
              order: s.order,
              column: s.column,
              height: s.height,
              defaultCollapsed: s.defaultCollapsed
           }
        });
        
        console.log(`importWorkspaceFromSyncUrl: Processing ${s.bookmarks?.length || 0} bookmarks for section ${s.title}...`);
        for (const b of s.bookmarks) {
           let bIcon = b.icon;
           if (bIcon && bIcon.startsWith('/')) {
               try {
                   const urlObj = new URL(syncUrl);
                   bIcon = `${urlObj.origin}${bIcon}`;
               } catch (e) {}
           }
           bIcon = await processMediaField(bIcon);
  
           await prisma.bookmark.create({
              data: {
                 title: b.title,
                 url: b.url,
                 description: b.description,
                 icon: bIcon,
                 longDescription: b.longDescription,
                 openInNewTab: b.openInNewTab,
                 order: b.order,
                 sectionId: newSec.id
              }
           });
        }
     }
  
     console.log("importWorkspaceFromSyncUrl: Import completed successfully.");
     revalidatePath("/");
     return newTab.id;
  } catch (err: any) {
     console.error("importWorkspaceFromSyncUrl CRITICAL ERROR:", err);
     throw err;
  }
}

export async function refreshSyncedWorkspace(tabId: string) {
  await requireAdmin();
  const tab = await (prisma as any).tab.findUnique({ 
    where: { id: tabId }, 
    include: { tabSections: true, owners: { select: { id: true } } } 
  });
  if (!tab || !tab.syncSourceUrl || !tab.isReadOnlySync) return;

  try {
     const resp = await fetch(tab.syncSourceUrl, { cache: 'no-store' });
     if (!resp.ok) return;
     const payload = await resp.json();
     if (!payload.tab) return;

     let tabIcon = payload.tab.icon;
     if (tabIcon && tabIcon.startsWith('/')) {
         try {
             const urlObj = new URL(tab.syncSourceUrl);
             tabIcon = `${urlObj.origin}${tabIcon}`;
         } catch (e) {}
     }
     tabIcon = await processMediaField(tabIcon);

     await (prisma as any).tab.update({
        where: { id: tab.id },
        data: {
           title: payload.tab.title,
           icon: tabIcon,
           columns: payload.tab.columns,
           description: payload.tab.description,
        }
     });

     if (payload.tab.theme && tab.themeId) {
         let bgUrl = payload.tab.theme.backgroundColor;
         if (bgUrl && bgUrl.startsWith('/')) {
             try {
                 const urlObj = new URL(tab.syncSourceUrl);
                 bgUrl = `${urlObj.origin}${bgUrl}`;
             } catch (e) {}
         }
         bgUrl = await processMediaField(bgUrl);

         let logoIcon = payload.tab.theme.logoIcon;
         if (logoIcon && logoIcon.startsWith('/')) {
             try {
                 const urlObj = new URL(tab.syncSourceUrl);
                 logoIcon = `${urlObj.origin}${logoIcon}`;
             } catch (e) {}
         }
         logoIcon = await processMediaField(logoIcon);

        await prisma.theme.update({
           where: { id: tab.themeId },
           data: {
               ...payload.tab.theme,
               backgroundColor: bgUrl,
               logoIcon: logoIcon
           }
        });
     }

     for (const ts of tab.tabSections) {
        await prisma.section.delete({ where: { id: ts.sectionId } });
     }
     
     const ownerId = tab.owners?.[0]?.id;
     
     for (const s of payload.tab.sections) {
        let secIcon = s.icon;
        if (secIcon && secIcon.startsWith('/')) {
            try {
                const urlObj = new URL(tab.syncSourceUrl);
                secIcon = `${urlObj.origin}${secIcon}`;
            } catch (e) {}
        }
        secIcon = await processMediaField(secIcon);

        const newSec = await prisma.section.create({
           data: {
              title: s.title,
              icon: secIcon,
              description: s.description,
              isGlobal: false,
              // Imported sections are never added to the catalog (access-matrix spec).
              isLibraryItem: false,
              isReadOnlySync: true,
              ...(ownerId ? { owners: { connect: { id: ownerId } } } : {})
           }
        });
        await (prisma as any).tabSection.create({
           data: {
              tabId: tab.id,
              sectionId: newSec.id,
              order: s.order,
              column: s.column,
              height: s.height,
              defaultCollapsed: s.defaultCollapsed
           }
        });
        for (const b of s.bookmarks) {
           let bIcon = b.icon;
           if (bIcon && bIcon.startsWith('/')) {
               try {
                   const urlObj = new URL(tab.syncSourceUrl);
                   bIcon = `${urlObj.origin}${bIcon}`;
               } catch (e) {}
           }
           bIcon = await processMediaField(bIcon);

           await prisma.bookmark.create({
              data: {
                 title: b.title,
                 url: b.url,
                 description: b.description,
                 icon: bIcon,
                 longDescription: b.longDescription,
                 openInNewTab: b.openInNewTab,
                 order: b.order,
                 sectionId: newSec.id
              }
           });
        }
     }
     revalidatePath("/");
  } catch(e) {
     console.error("Failed to sync workspace", e);
  }
}

// --- UTILITY & IMPORT ---
export async function scanBookmarksFile(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");
  const html = await file.text();
  return await parseBookmarksHtml(html);
}

export async function executeBookmarkImport(mappings: any[]) {
  await requireAdmin();
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) throw new Error("Unauthorized");
  for (const mapping of mappings) {
    let sectionId = mapping.targetSectionId;
    if (mapping.targetType === 'new' && mapping.newSectionTitle && mapping.newTabId) {
      const newSection = await prisma.section.create({ data: { title: mapping.newSectionTitle, isGlobal: true } as any });
      const lastEntry = await (prisma as any).tabSection.findFirst({ where: { tabId: mapping.newTabId }, orderBy: { order: 'desc' } });
      await (prisma as any).tabSection.create({ data: { sectionId: newSection.id, tabId: mapping.newTabId, order: (lastEntry?.order ?? -1) + 1 } });
      sectionId = newSection.id;
    }
    if (!sectionId) continue;
    const existingBookmarks = await prisma.bookmark.findMany({ where: { sectionId }, select: { url: true } });
    const existingUrls = new Set(existingBookmarks.map(b => b.url));
    const lastBookmark = await prisma.bookmark.findFirst({ where: { sectionId }, orderBy: { order: "desc" } });
    let currentOrder = (lastBookmark?.order ?? -1) + 1;
    for (const bookmark of mapping.bookmarks) {
      if (existingUrls.has(bookmark.url)) continue;
      await prisma.bookmark.create({ data: { title: bookmark.title, url: bookmark.url, icon: bookmark.icon, sectionId, order: currentOrder++ } });
      revalidatePath("/");
    }
    revalidatePath("/");
  }
  return { success: true };
}

export async function bulkApplyDeptTabRole(tabId: string, department: string, role: string) {
  await requireTabRole(arguments[0], "edit");
  // 1. Update the department-level setting
  await _updateTabDepartmentRole(tabId, department, role);

  // 2. Update all members (excluding Global Admins)
  const users = await prisma.user.findMany({
    where: department === "Entire Organization"
      ? { isAdmin: false }
      : {
        dashboardGroup: department === "General" ? "General" : department,
        isAdmin: false
      },
    select: { id: true }
  });

  if (users.length > 0) {
    const userIds = users.map(u => ({ id: u.id }));
    await (prisma as any).tab.update({
      where: { id: tabId },
      data: {
        owners: { disconnect: userIds },
        editors: { disconnect: userIds },
        allowedUsers: { disconnect: userIds }
      }
    });

    if (role !== "none") {
      const connectKey = role === "owner" ? "owners" : (role === "editor" ? "editors" : "allowedUsers");
      await (prisma as any).tab.update({
        where: { id: tabId },
        data: { [connectKey]: { connect: userIds } }
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/tabs");
  return { success: true };
}

export async function bulkApplyDeptSectionRole(sectionId: string, department: string, role: string) {
  await requireSectionRole(arguments[0], "edit");
  // 1. Update the department-level setting
  await _updateSectionDepartmentRole(sectionId, department, role);

  // 2. Update all members (excluding Global Admins)
  const users = await prisma.user.findMany({
    where: department === "Entire Organization"
      ? { isAdmin: false }
      : {
        dashboardGroup: department === "General" ? "General" : department,
        isAdmin: false
      },
    select: { id: true }
  });

  if (users.length > 0) {
    const userIds = users.map(u => ({ id: u.id }));
    await prisma.section.update({
      where: { id: sectionId },
      data: {
        owners: { disconnect: userIds },
        editors: { disconnect: userIds },
        allowedUsers: { disconnect: userIds }
      }
    });

    if (role !== "none") {
      const connectKey = role === "owner" ? "owners" : (role === "editor" ? "editors" : "allowedUsers");
      await prisma.section.update({
        where: { id: sectionId },
        data: { [connectKey]: { connect: userIds } }
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/sections");
  return { success: true };
}

// --- THEME GOVERNANCE ORCHESTRATION ---
async function _updateThemeUserRole(themeId: string, userId: string, role: string) {
  await prisma.theme.update({
    where: { id: themeId },
    data: {
      owners: { disconnect: { id: userId } },
      editors: { disconnect: { id: userId } },
      allowedUsers: { disconnect: { id: userId } },
      blockedUsers: { disconnect: { id: userId } }
    }
  });

  if (role === "owner") {
    await prisma.theme.update({ where: { id: themeId }, data: { owners: { connect: { id: userId } } } });
  } else if (role === "editor") {
    await prisma.theme.update({ where: { id: themeId }, data: { editors: { connect: { id: userId } } } });
  } else if (role === "viewer") {
    await prisma.theme.update({ where: { id: themeId }, data: { allowedUsers: { connect: { id: userId } } } });
  } else if (role === "none") {
    await prisma.theme.update({ where: { id: themeId }, data: { blockedUsers: { connect: { id: userId } } } });
  }
}

export async function updateThemeUserRole(themeId: string, userId: string, role: string) {
  await _updateThemeUserRole(themeId, userId, role);
  revalidatePath("/");
  revalidatePath("/admin/theme");
}

async function _updateThemeDepartmentRole(themeId: string, department: string, role: string) {
  if (role === "none") {
    await (prisma as any).themeDepartmentAccess.deleteMany({
      where: { themeId, department }
    });
  } else {
    await (prisma as any).themeDepartmentAccess.upsert({
      where: { themeId_department: { themeId, department } },
      update: { role },
      create: { themeId, department, role }
    });
  }
}

export async function updateThemeDepartmentRole(themeId: string, department: string, role: string) {
  await _updateThemeDepartmentRole(themeId, department, role);
  revalidatePath("/");
  revalidatePath("/admin/theme");
}

export async function bulkApplyDeptThemeRole(themeId: string, department: string, role: string) {
  // 1. Update the department-level setting
  await _updateThemeDepartmentRole(themeId, department, role);

  // 2. Update all members (excluding Global Admins)
  const users = await prisma.user.findMany({
    where: department === "Entire Organization"
      ? { isAdmin: false }
      : {
        dashboardGroup: department === "General" ? "General" : department,
        isAdmin: false
      },
    select: { id: true }
  });

  if (users.length > 0) {
    const userIds = users.map(u => ({ id: u.id }));
    await prisma.theme.update({
      where: { id: themeId },
      data: {
        owners: { disconnect: userIds },
        editors: { disconnect: userIds },
        allowedUsers: { disconnect: userIds }
      }
    });

    if (role !== "none") {
      const connectKey = role === "owner" ? "owners" : (role === "editor" ? "editors" : "allowedUsers");
      await prisma.theme.update({
        where: { id: themeId },
        data: { [connectKey]: { connect: userIds } }
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/theme");
  return { success: true };
}

export async function setUserDefaultTab(userId: string, tabId: string) {
  await requireSession();
  await prisma.user.update({ where: { id: userId }, data: { defaultTabId: tabId } });
}


export async function updateGlobalLayoutBatch(tabId: string, updates: { sectionId: string; column: number; order?: number }[]) {
  await requireTabRole(arguments[0], "edit");
  const session = await auth();
  const user = session?.user;
  if (!user?.email) throw new Error("Unauthorized");
  
  await prisma.$transaction(
    updates.map(update =>
      (prisma as any).tabSection.updateMany({
        where: { tabId: tabId, sectionId: update.sectionId },
        data: {
          column: update.column,
          ...(update.order !== undefined ? { order: update.order } : {})
        }
      })
    )
  );
  revalidatePath("/");
}

// Group management
export async function renameGroup(oldName: string, newName: string) {
  await requireAdmin();
  "use server";
  if (!oldName || !newName || oldName === "General") return;
  await prisma.user.updateMany({
    where: { dashboardGroup: oldName },
    data: { dashboardGroup: newName.trim() }
  });
}

export async function deleteGroup(groupName: string) {
  await requireAdmin();
  "use server";
  if (!groupName || groupName === "General") return;
  await prisma.user.updateMany({
    where: { dashboardGroup: groupName },
    data: { dashboardGroup: "General" }
  });
}

// Clean "Entire Organization" entries from specific tabs
export async function removeEntireOrgAccess(tabId: string) {
  await requireAdmin();
  "use server";
  await (prisma as any).tabDepartmentAccess.deleteMany({
    where: { tabId, department: "Entire Organization" }
  });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

// List all department access entries (for debugging)
export async function listDeptAccess() {
  await requireAdmin();
  "use server";
  return (prisma as any).tabDepartmentAccess.findMany({
    include: { tab: { select: { id: true, title: true } } }
  });
}

// --- TAB PUSH RULES ---
export async function togglePushRule(tabId: string, targetType: string, targetId: string | null, enabled: boolean) {
  await requireAdmin();
  if (enabled) {
    await (prisma as any).tabPushRule.upsert({
      where: { tabId_targetType_targetId: { tabId, targetType, targetId: targetId || "" } },
      update: {},
      create: { tabId, targetType, targetId: targetId || "" }
    });

    // Auto-enable sections for catalog when workspace is pushed.
    // Imported (read-only sync) sections are never added to the catalog per access-matrix spec.
    const tabSections = await prisma.tabSection.findMany({
      where: { tabId },
      select: { sectionId: true }
    });
    if (tabSections.length > 0) {
      const sectionIds = tabSections.map(ts => ts.sectionId);
      await prisma.section.updateMany({
        where: { id: { in: sectionIds }, isReadOnlySync: false },
        data: { isLibraryItem: true }
      });
    }

    // Auto-reconcile permissions: pushed targets must have at least viewer access
    if (targetType === "global") {
      // For global push, ensure every department has at least viewer access
      const allDepts = await prisma.user.findMany({ select: { id: true, dashboardGroup: true, layout: true } });
      const uniqueDepts = Array.from(new Set(allDepts.map(u => u.dashboardGroup || "General")));
      for (const dept of uniqueDepts) {
        const existing = await (prisma as any).tabDepartmentAccess.findUnique({
          where: { tabId_department: { tabId, department: dept } }
        });
        if (!existing) {
          await (prisma as any).tabDepartmentAccess.create({
            data: { tabId, department: dept, role: "viewer" }
          });
        }
      }

      // Ensure it is removed from everyone's hiddenTabs
      for (const user of allDepts) {
        let layout: any = user.layout;
        if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
        else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
        else { layout = {}; }
        if (layout.hiddenTabs && layout.hiddenTabs.includes(tabId)) {
          layout.hiddenTabs = layout.hiddenTabs.filter((id: string) => id !== tabId);
          await prisma.user.update({ where: { id: user.id }, data: { layout } });
        }
      }
    } else if (targetType === "department" && targetId) {
      // For department push, ensure department has at least viewer access
      const existing = await (prisma as any).tabDepartmentAccess.findUnique({
        where: { tabId_department: { tabId, department: targetId } }
      });
      if (!existing) {
        await (prisma as any).tabDepartmentAccess.create({
          data: { tabId, department: targetId, role: "viewer" }
        });
      }

      // Ensure it is removed from everyone's hiddenTabs in that department
      const deptUsers = await prisma.user.findMany({
        where: { OR: [ { dashboardGroup: targetId }, { dashboardGroup: targetId.toLowerCase() } ] },
        select: { id: true, layout: true }
      });
      for (const user of deptUsers) {
        let layout: any = user.layout;
        if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
        else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
        else { layout = {}; }
        if (layout.hiddenTabs && layout.hiddenTabs.includes(tabId)) {
          layout.hiddenTabs = layout.hiddenTabs.filter((id: string) => id !== tabId);
          await prisma.user.update({ where: { id: user.id }, data: { layout } });
        }
      }
    } else if (targetType === "user" && targetId) {
      // For user push, ensure user has at least viewer access
      const tab = await prisma.tab.findUnique({
        where: { id: tabId },
        include: { allowedUsers: { select: { id: true } }, editors: { select: { id: true } }, owners: { select: { id: true } } }
      });
      const alreadyHasAccess = tab?.owners?.some((o: any) => o.id === targetId) ||
                                tab?.editors?.some((e: any) => e.id === targetId) ||
                                tab?.allowedUsers?.some((a: any) => a.id === targetId);
      if (!alreadyHasAccess) {
        await prisma.tab.update({
          where: { id: tabId },
          data: { allowedUsers: { connect: { id: targetId } } }
        });
      }

      // Also ensure it is removed from their hiddenTabs so it actually appears!
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: { layout: true } });
      if (user) {
        let layout: any = user.layout;
        if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) { layout = {}; } }
        else if (layout && typeof layout === 'object') { layout = JSON.parse(JSON.stringify(layout)); }
        else { layout = {}; }
        if (layout.hiddenTabs && layout.hiddenTabs.includes(tabId)) {
          layout.hiddenTabs = layout.hiddenTabs.filter((id: string) => id !== tabId);
          await prisma.user.update({
            where: { id: targetId },
            data: { layout }
          });
        }
      }
    }
  } else {
    await (prisma as any).tabPushRule.deleteMany({
      where: { tabId, targetType, targetId: targetId || "" }
    });
  }
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function togglePushRuleLock(tabId: string, targetType: string, targetId: string | null, locked: boolean) {
  await requireAdmin();
  await (prisma as any).tabPushRule.updateMany({
    where: { tabId, targetType, targetId: targetId || "" },
    data: { locked }
  });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}
