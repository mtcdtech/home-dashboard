"use server";

import { prisma } from "@/lib/prisma";
import { resolveTabAccess, buildUserContext } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { parseBookmarksHtml } from "@/lib/bookmark-parser";
import { auth } from "@/auth";
import { requireSession, requireAdmin, requireTabRole, requireSectionRole } from "@/lib/authz";
import { safeFetch, isSafeUrl } from "@/lib/ssrf";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { downloadIconToDisk, saveBase64IconToDisk, isExternalUrl } from "@/lib/icon-storage";
import { ALLOWED_IMAGE_EXTENSIONS, MAX_UPLOAD_BYTES, isMagicImage, sanitizeImageFilename } from "@/lib/image-validation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";


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

    const { filename, ext } = sanitizeImageFilename(file.name);
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      throw new Error("Invalid file extension");
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("File too large (max 5MB)");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > MAX_UPLOAD_BYTES || !isMagicImage(buffer)) {
      throw new Error("Invalid image format or content");
    }

    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }
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
    const arrayBuffer = await safeFetch(url, { expectedTypePrefix: 'image/' });
    const buffer = Buffer.from(arrayBuffer);

    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) { }

    const urlObj = new URL(url);
    const ext = urlObj.pathname.split('.').pop() || 'png';
    const filename = `remote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    return `/api/uploads/${filename}`;
  } catch (e) {
    console.error("Failed to download remote asset:", e);
    return null;
  }
}

export async function downloadAndStoreIcon(url: string): Promise<{ localPath?: string; error?: string }> {
  await requireSession();
  if (!url || typeof url !== 'string') {
    return { error: 'Invalid URL provided' };
  }
  if (!isExternalUrl(url)) {
    return { localPath: url };
  }
  return await downloadIconToDisk(url);
}

export async function processMediaField(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return mediaUrl;
  try {
    if (mediaUrl.startsWith('data:image')) {
      const saved = await saveBase64IconToDisk(mediaUrl);
      return saved || mediaUrl;
    }
    if (isExternalUrl(mediaUrl)) {
      const result = await downloadIconToDisk(mediaUrl);
      if (result.localPath) return result.localPath;
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
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    const arrayBuffer = await safeFetch(faviconUrl, { expectedTypePrefix: 'image/' });
    const buffer = Buffer.from(arrayBuffer);

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
  if ((session?.user as any)?.isAdmin === true) {
    try {
      const cookieStore = await cookies();
      const impId = cookieStore.get("impersonate_user_id")?.value;
      if (impId && impId !== realUserId) return impId;
    } catch (e) {}
  }
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
  await requireTabRole(id, "edit");
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
  await requireAdmin();
  await Promise.all(orderedIds.map((id, idx) => (prisma as any).tab.update({ where: { id }, data: { order: idx } })));
  revalidatePath("/");
}

export async function deleteTab(id: string) {
  await requireTabRole(id, "owner");
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
  await requireTabRole(tabId, "edit");
  await requireSectionRole(sectionId, "edit");
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
  await requireTabRole(tabId, "edit");
  await requireSectionRole(sectionId, "edit");
  await (prisma as any).tabSection.deleteMany({ where: { sectionId, tabId } });
  revalidatePath("/");
}

export async function toggleSectionInTab(tabId: string, sectionId: string, isAssigned: boolean) {
  await requireTabRole(tabId, "edit");
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
  await requireSectionRole(id, "edit");
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
  await requireSectionRole(id, "owner");
  await prisma.section.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

export async function updateSectionLayout(sectionId: string, tabId: string, data: { height?: number | null; isAutoResize?: boolean }) {
  await requireTabRole(tabId, "edit");
  await requireSectionRole(sectionId, "edit");
  await (prisma as any).tabSection.update({
    where: { tabId_sectionId: { tabId, sectionId } },
    data: data,
  });
  revalidatePath("/");
}

export async function updateTabSectionCollapsed(sectionId: string, tabId: string, defaultCollapsed: boolean) {
  await requireSession();
  
  // If we are setting this section to be expanded (defaultCollapsed = false)
  if (!defaultCollapsed) {
    const ts = await (prisma as any).tabSection.findUnique({
      where: { tabId_sectionId: { tabId, sectionId } },
      include: { tab: true }
    });
    
    if (ts && ts.tab?.singleSectionColumns?.includes(ts.column)) {
      // It's in a single section column, so collapse all other sections in this column
      await (prisma as any).tabSection.updateMany({
        where: { tabId, column: ts.column, sectionId: { not: sectionId } },
        data: { defaultCollapsed: true }
      });
    }
  }

  await (prisma as any).tabSection.update({
    where: { tabId_sectionId: { tabId, sectionId } },
    data: { defaultCollapsed }
  });
  
  revalidatePath("/");
}

export async function toggleSingleSectionColumn(tabId: string, colIndex: number, enabled: boolean) {
  await requireSession();
  const tab = await prisma.tab.findUnique({ where: { id: tabId } });
  if (!tab) throw new Error("Tab not found");

  const currentCols = (tab as any).singleSectionColumns || [];
  let newCols = [...currentCols];

  if (enabled && !newCols.includes(colIndex)) {
    newCols.push(colIndex);
    
    // Auto-collapse all sections except the first one in this column
    const sectionsInCol = await (prisma as any).tabSection.findMany({
      where: { tabId, column: colIndex },
      orderBy: { order: 'asc' }
    });
    
    if (sectionsInCol.length > 0) {
      const firstId = sectionsInCol[0].id;
      // Ensure the first one is expanded
      await (prisma as any).tabSection.update({
        where: { id: firstId },
        data: { defaultCollapsed: false }
      });
      // Collapse the rest
      if (sectionsInCol.length > 1) {
        await (prisma as any).tabSection.updateMany({
          where: { tabId, column: colIndex, id: { not: firstId } },
          data: { defaultCollapsed: true }
        });
      }
    }
  } else if (!enabled && newCols.includes(colIndex)) {
    newCols = newCols.filter(c => c !== colIndex);
  }

  await prisma.tab.update({
    where: { id: tabId },
    data: { singleSectionColumns: newCols } as any
  });

  revalidatePath("/");
}

export async function updateUserDefaultTab(userId: string, defaultTabId: string | null) {
  const session = await requireSession();
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) throw new Error("User not found");
  
  if (session.id !== userId && !(session as any).isAdmin) {
    throw new Error("Unauthorized to change another user's default tab");
  }

  if (defaultTabId) {
    const tab = await prisma.tab.findUnique({
      where: { id: defaultTabId },
      include: {
        owners: true,
        editors: true,
        allowedUsers: true,
        blockedUsers: true,
        departmentAccess: true,
        pushRules: true
      }
    });
    if (!tab) throw new Error("Tab not found");
    const ctx = buildUserContext({
      userId: targetUser.id,
      dashboardGroup: targetUser.dashboardGroup || targetUser.department,
      isAdminView: targetUser.isAdmin,
      isLocalAdmin: targetUser.email === 'admin@local' || targetUser.name === 'Local Admin'
    });
    const access = resolveTabAccess(tab, ctx);
    if (access.role === "none" && !(session as any).isAdmin) {
      throw new Error("Target tab is not accessible by this user");
    }
  }

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
  await requireTabRole(tabId, "edit");
  await requireSectionRole(sectionId, "edit");
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
  if (!data?.sectionId) throw new Error("sectionId is required");
  await requireSectionRole(data.sectionId, "edit");
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
  const bookmark = await prisma.bookmark.findUnique({ where: { id }, select: { sectionId: true } });
  if (!bookmark) throw new Error("Bookmark not found");
  await requireSectionRole(bookmark.sectionId, "edit");
  if (data.sectionId && data.sectionId !== bookmark.sectionId) {
    await requireSectionRole(data.sectionId, "edit");
  }
  if (data.url) data.url = normalizeUrl(data.url);
  await prisma.bookmark.update({ where: { id }, data });
  await logActionActivity("bookmark_edit", `Updated bookmark: ${data.title || data.url || id}`);
  revalidatePath("/");
}

export async function deleteBookmark(id: string) {
  const bookmark = await prisma.bookmark.findUnique({ where: { id }, select: { sectionId: true } });
  if (!bookmark) throw new Error("Bookmark not found");
  await requireSectionRole(bookmark.sectionId, "edit");
  await prisma.bookmark.delete({ where: { id } });
  revalidatePath("/");
}

export async function duplicateBookmark(id: string) {
  const original = await prisma.bookmark.findUnique({ where: { id } });
  if (!original) throw new Error("Bookmark not found");
  await requireSectionRole(original.sectionId, "edit");

  // Increment order of all bookmarks in the section that have order > original.order
  await prisma.bookmark.updateMany({
    where: {
      sectionId: original.sectionId,
      order: { gt: original.order }
    },
    data: {
      order: { increment: 1 }
    }
  });

  // Create a duplicate bookmark with order = original.order + 1
  const duplicateData = {
    title: original.title,
    url: original.url,
    description: original.description,
    longDescription: original.longDescription,
    icon: original.icon,
    keywords: original.keywords,
    openInNewTab: original.openInNewTab,
    tags: original.tags,
    order: original.order + 1,
    sectionId: original.sectionId
  };

  const b = await prisma.bookmark.create({ data: duplicateData });
  await logActionActivity("bookmark_edit", `Duplicated bookmark: ${original.title || original.url} to ${b.title}`);
  revalidatePath("/");
  return b;
}

export async function moveBookmark(bookmarkId: string, targetSectionId: string, beforeBookmarkId?: string) {
  const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId }, select: { sectionId: true } });
  if (!bookmark) throw new Error("Bookmark not found");
  await requireSectionRole(bookmark.sectionId, "edit");
  if (targetSectionId !== bookmark.sectionId) {
    await requireSectionRole(targetSectionId, "edit");
  }
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
  await requireTabRole(tabId, "edit");
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
  await requireAdmin();
  return await (prisma as any).globalSettings.findUnique({ where: { id: "global" } });
}

// --- USER & IDENTITY GOVERNANCE ---
export async function toggleUserAdmin(id: string, isAdmin: boolean) {
  await requireAdmin();
  throw new Error("Admin role changes must be performed in the MTCD Admin Portal.");
}

export async function updateUserDashboardGroup(id: string, dashboardGroup: string) {
  await requireAdmin();
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) throw new Error("Unauthorized");
  await prisma.user.update({ where: { id }, data: { dashboardGroup } });
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) throw new Error("Unauthorized");
  
  // Local admins cannot be deleted
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true } });
  if (user?.email === "admin@local" || user?.name === "Local Admin") {
    throw new Error("Local admin cannot be deleted");
  }

  await prisma.user.delete({ where: { id } });
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
  await requireTabRole(tabId, "edit");
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
  await requireTabRole(tabId, "owner");
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
  await requireTabRole(tabId, "edit");
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
  await requireTabRole(tabId, "edit");
  await _updateTabDepartmentRole(tabId, department, role);
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function setSectionEditors(sectionId: string, userIds: string[]) {
  await requireSectionRole(sectionId, "edit");
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
  await requireSectionRole(sectionId, "edit");
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
  await requireSectionRole(sectionId, "edit");
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
  await requireAdmin();
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
  if (!(await isSafeUrl(syncUrl))) {
    throw new Error("Invalid or unsafe sync URL");
  }
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
  if (!(await isSafeUrl(tab.syncSourceUrl))) {
    console.warn("refreshSyncedWorkspace: Refusing unsafe syncSourceUrl:", tab.syncSourceUrl);
    return;
  }

  const startTime = Date.now();
  try {
     const resp = await fetch(tab.syncSourceUrl, { 
       cache: 'no-store',
       signal: AbortSignal.timeout(5000)
     });
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
  } catch(e: any) {
     const elapsed = Date.now() - startTime;
     if (e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.message?.includes('timeout') || e?.message?.includes('aborted')) {
        console.warn(`WARN: Synced workspace refresh timed out for ${tab.syncSourceUrl} after ${elapsed}ms`);
     } else {
        console.error("Failed to sync workspace", e);
     }
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
      if (!bookmark.url) continue;
      const normalizedUrl = normalizeUrl(bookmark.url);
      if (existingUrls.has(normalizedUrl)) continue;
      await prisma.bookmark.create({ data: { title: bookmark.title, url: normalizedUrl, icon: bookmark.icon, sectionId, order: currentOrder++ } });
      revalidatePath("/");
    }
    revalidatePath("/");
  }
  return { success: true };
}

export async function bulkApplyDeptTabRole(tabId: string, department: string, role: string) {
  await requireTabRole(tabId, "edit");
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
  await requireSectionRole(sectionId, "edit");
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
  await requireAdmin();
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
  await requireAdmin();
  await _updateThemeDepartmentRole(themeId, department, role);
  revalidatePath("/");
  revalidatePath("/admin/theme");
}

export async function bulkApplyDeptThemeRole(themeId: string, department: string, role: string) {
  await requireAdmin();
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
  const session = await requireSession();
  if (session.id !== userId && !(session as any).isAdmin) {
    throw new Error("Unauthorized to change another user's default tab");
  }
  await prisma.user.update({ where: { id: userId }, data: { defaultTabId: tabId } });
}


export async function updateGlobalLayoutBatch(tabId: string, updates: { sectionId: string; column: number; order?: number }[]) {
  await requireTabRole(tabId, "edit");
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

  if (!oldName || !newName || oldName === "General") return;
  await prisma.user.updateMany({
    where: { dashboardGroup: oldName },
    data: { dashboardGroup: newName.trim() }
  });
}

export async function deleteGroup(groupName: string) {
  await requireAdmin();

  if (!groupName || groupName === "General") return;
  await prisma.user.updateMany({
    where: { dashboardGroup: groupName },
    data: { dashboardGroup: "General" }
  });
}

// Clean "Entire Organization" entries from specific tabs
export async function removeEntireOrgAccess(tabId: string) {
  await requireAdmin();

  await (prisma as any).tabDepartmentAccess.deleteMany({
    where: { tabId, department: "Entire Organization" }
  });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

// List all department access entries (for debugging)
export async function listDeptAccess() {
  await requireAdmin();

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

// --- LOCAL ADMIN GOVERNANCE ---
export async function updateLocalAdminSettings(data: { disableLocalAdmin?: boolean; password?: string }) {
  await requireAdmin();
  
  if (data.disableLocalAdmin !== undefined) {
    await (prisma as any).globalSettings.upsert({
      where: { id: "global" },
      update: { disableLocalAdmin: data.disableLocalAdmin },
      create: { id: "global", disableLocalAdmin: data.disableLocalAdmin }
    });
  }

  if (data.password && data.password.trim()) {
    const passwordHash = await bcrypt.hash(data.password.trim(), 12);
    const adminUser = await prisma.user.findUnique({ where: { email: "admin@local.host" } });
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          passwordHash,
          password: null,
        }
      });
    } else {
      await prisma.user.create({
        data: {
          name: "Local Admin",
          email: "admin@local.host",
          passwordHash,
          password: null,
          isAdmin: true,
          department: "IT",
        }
      });
    }
  }
  revalidatePath("/");
  revalidatePath("/admin/users");
  revalidatePath("/login");
  return { success: true };
}

export async function updateSectionWidgetConfig(sectionId: string, widgetConfig: any) {
  await requireSectionRole(sectionId, "edit");
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
  });
  const existingConfig =
    typeof section?.widgetConfig === "string"
      ? JSON.parse(section.widgetConfig) || {}
      : (section?.widgetConfig as Record<string, unknown>) || {};

  const merged = {
    ...existingConfig,
    ...(typeof widgetConfig === "object" && widgetConfig !== null ? widgetConfig : {}),
  };

  await prisma.section.update({
    where: { id: sectionId },
    data: { widgetConfig: JSON.parse(JSON.stringify(merged)) }
  });
  revalidatePath("/");
}

function extractPublicUrlFromLabels(labels: Record<string, string> = {}): string | null {
  if (!labels || typeof labels !== "object") return null;

  // 1. Explicit public url labels (homepage.url, homarr.url, dashboard.url, public_url, public.url, etc.)
  for (const key of Object.keys(labels)) {
    const lkey = key.toLowerCase();
    if (["homepage.url", "homarr.url", "dashboard.url", "public_url", "public.url", "url"].includes(lkey)) {
      const val = labels[key]?.trim();
      if (val) return val.startsWith("http") ? val : `https://${val}`;
    }
  }

  // 2. Traefik Host(...) rule parsing (e.g. traefik.http.routers.<app>.rule = Host(`app.abraham16.com`))
  for (const [key, val] of Object.entries(labels)) {
    if (key.toLowerCase().includes("traefik.http.routers") && key.toLowerCase().endsWith(".rule")) {
      const hostMatch = String(val).match(/Host\([`'"\s]*([^`'"\),]+)[`'"\s]*\)/i);
      if (hostMatch && hostMatch[1]) {
        const domain = hostMatch[1].trim();
        if (domain) return `https://${domain}`;
      }
    }
  }

  // 3. Nginx / VIRTUAL_HOST labels
  for (const key of Object.keys(labels)) {
    if (key.toLowerCase() === "virtual_host") {
      const vhost = labels[key]?.split(",")[0]?.trim();
      if (vhost) return `https://${vhost}`;
    }
  }

  return null;
}

export async function fetchPortainerContainers(config: { url?: string; apiKey?: string; endpointId?: string }) {
  await requireAdmin();
  const startTime = Date.now();
  let currentFetchUrl = "";
  try {
    let rawUrl = (config.url || process.env.PORTAINER_URL || "https://docker.abraham16.com").trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    const baseUrl = rawUrl.replace(/\/$/, "");
    const parsedTargetUrl = new URL(baseUrl);
    const targetHost = parsedTargetUrl.hostname.toLowerCase();

    // Strict URL allowlist check (C3)
    let isAllowed = false;
    if (process.env.ALLOWED_PORTAINER_HOSTS) {
      const allowedHosts = process.env.ALLOWED_PORTAINER_HOSTS.split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
      isAllowed = allowedHosts.some(allowed => {
        if (allowed === targetHost) return true;
        try {
          const parsed = new URL(allowed.includes("://") ? allowed : `https://${allowed}`);
          return parsed.hostname.toLowerCase() === targetHost;
        } catch {
          return false;
        }
      });
    } else if (process.env.PORTAINER_URL) {
      try {
        const envUrl = new URL(process.env.PORTAINER_URL.includes("://") ? process.env.PORTAINER_URL : `https://${process.env.PORTAINER_URL}`);
        isAllowed = envUrl.hostname.toLowerCase() === targetHost || baseUrl === process.env.PORTAINER_URL.replace(/\/$/, "");
      } catch {
        isAllowed = false;
      }
    } else {
      isAllowed = targetHost === "docker.abraham16.com" || targetHost === "docker.server.mtcd.org";
    }

    if (!isAllowed) {
      throw new Error(`Portainer URL is not in the allowed host list: ${targetHost}`);
    }

    const apiKey = (config.apiKey || process.env.PORTAINER_API_KEY || "").trim();
    let targetEndpointId = config.endpointId?.trim();

    // Auto-detect endpoint ID if not explicitly specified
    if (!targetEndpointId) {
      try {
        currentFetchUrl = `${baseUrl}/api/endpoints`;
        const endpointsResp = await fetch(currentFetchUrl, {
          headers: { "X-API-Key": apiKey, "Accept": "application/json" },
          signal: AbortSignal.timeout(5000)
        });
        if (endpointsResp.ok) {
          const endpoints = await endpointsResp.json();
          if (Array.isArray(endpoints) && endpoints.length > 0) {
            targetEndpointId = String(endpoints[0].Id);
          }
        }
      } catch (e: any) {
        const elapsed = Date.now() - startTime;
        if (e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.message?.includes('timeout') || e?.message?.includes('aborted')) {
          console.warn(`WARN: Auto-detect Portainer endpoint ID timed out for ${currentFetchUrl} after ${elapsed}ms`);
        } else {
          console.warn("Could not auto-detect Portainer endpoint ID:", e);
        }
      }
    }

    if (!targetEndpointId) targetEndpointId = "2";

    let fetchUrl = `${baseUrl}/api/endpoints/${targetEndpointId}/docker/containers/json?all=1`;
    currentFetchUrl = fetchUrl;
    let httpResp = await fetch(fetchUrl, {
      headers: {
        "X-API-Key": apiKey,
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(5000)
    });

    // Fallback: If specified endpointId 404s, attempt auto-discovering from /api/endpoints
    if (!httpResp.ok && httpResp.status === 404) {
      try {
        currentFetchUrl = `${baseUrl}/api/endpoints`;
        const endpointsResp = await fetch(currentFetchUrl, {
          headers: { "X-API-Key": apiKey, "Accept": "application/json" },
          signal: AbortSignal.timeout(5000)
        });
        if (endpointsResp.ok) {
          const endpoints = await endpointsResp.json();
          if (Array.isArray(endpoints) && endpoints.length > 0) {
            const fallbackId = String(endpoints[0].Id);
            if (fallbackId !== targetEndpointId) {
              targetEndpointId = fallbackId;
              fetchUrl = `${baseUrl}/api/endpoints/${targetEndpointId}/docker/containers/json?all=1`;
              currentFetchUrl = fetchUrl;
              httpResp = await fetch(fetchUrl, {
                headers: { "X-API-Key": apiKey, "Accept": "application/json" },
                signal: AbortSignal.timeout(5000)
              });
            }
          }
        }
      } catch (e: any) {
        const elapsed = Date.now() - startTime;
        if (e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.message?.includes('timeout') || e?.message?.includes('aborted')) {
          console.warn(`WARN: Portainer fallback endpoint discovery timed out for ${currentFetchUrl} after ${elapsed}ms`);
        }
      }
    }

    if (!httpResp.ok) {
      throw new Error(`Portainer API returned status ${httpResp.status}`);
    }

    const containers = await httpResp.json();

    return {
      success: true,
      containers: (containers || []).map((c: any) => ({
        id: c.Id,
        name: (c.Names?.[0] || "").replace(/^\//, ""),
        image: c.Image,
        state: c.State, // "running", "exited", etc.
        status: c.Status,
        created: c.Created,
        inferredUrl: extractPublicUrlFromLabels(c.Labels || {}),
        labels: c.Labels || {},
        ports: (c.Ports || []).map((p: any) => ({
          privatePort: p.PrivatePort,
          publicPort: p.PublicPort,
          type: p.Type
        }))
      }))
    };
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError' || err?.message?.includes('timeout') || err?.message?.includes('aborted')) {
      console.warn(`WARN: Portainer fetch timed out for ${currentFetchUrl || 'Portainer API'} after ${elapsed}ms`);
      return {
        success: false,
        error: "Portainer API request timed out (5s limit exceeded)"
      };
    }
    console.error("fetchPortainerContainers error:", err);
    return {
      success: false,
      error: err.message || "Failed to connect to Portainer API"
    };
  }
}

// --- IAM INTEGRATION SERVER ACTIONS ---
export async function iamBackfillDryRun() {
  await requireAdmin();
  const { runIamBackfill } = await import("@/lib/iam-backfill");
  return await runIamBackfill({ apply: false });
}

export async function iamBackfillApply() {
  await requireAdmin();
  const { runIamBackfill } = await import("@/lib/iam-backfill");
  const result = await runIamBackfill({ apply: true });
  revalidatePath("/admin/users");
  return result;
}

export async function iamManualLink(userId: string, pid: string) {
  await requireAdmin();
  const cleanPid = pid.trim();
  if (!cleanPid) throw new Error("Invalid mtcd_person_id");

  const conflict = await prisma.user.findUnique({ where: { mtcdPersonId: cleanPid } });
  if (conflict && conflict.id !== userId) {
    throw new Error(`mtcd_person_id ${cleanPid} is already linked to user ${conflict.name || conflict.email}`);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      mtcdPersonId: cleanPid,
      mtcdIdentitySource: "manual_admin",
      mtcdLastSyncedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  return { success: true, user: updated };
}

export async function iamUnlink(userId: string) {
  await requireAdmin();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      mtcdPersonId: null,
      mtcdIdentitySource: null,
      mtcdLastSyncedAt: new Date(),
    },
  });

  revalidatePath("/admin/users");
  return { success: true, user: updated };
}

export async function getIamApiDetails() {
  await requireAdmin();
  const { getIamApiKey } = await import("@/lib/iam");
  const apiKey = await getIamApiKey();
  return {
    apiKey,
    rolesUrl: "/api/iam/roles",
    usersUrl: "/api/iam/users",
  };
}

export async function regenerateIamApiKey() {
  await requireAdmin();
  const newKey = `iam_live_${randomBytes(32).toString("hex")}`;

  await (prisma as any).globalSettings.upsert({
    where: { id: "global" },
    update: { iamApiKey: newKey },
    create: { id: "global", iamApiKey: newKey },
  });

  revalidatePath("/admin/users");
  return { success: true, apiKey: newKey };
}

// --- CUSTOM UPLOADED ICONS LIBRARY & USAGE CHECK ---
export async function getCustomUploadedIcons() {
  await requireSession();
  const icons: Array<{ name: string; url: string; mtime: number }> = [];
  try {
    const fs = await import("fs");
    const path = await import("path");
    
    const scanDir = (dirPath: string, urlPrefix: string) => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && file.match(/\.(png|jpe?g|svg|webp|gif|ico)$/i)) {
            icons.push({
              name: file,
              url: `${urlPrefix}/${file}`,
              mtime: stat.mtimeMs,
            });
          }
        }
      }
    };

    scanDir(path.join(process.cwd(), "public", "uploads"), "/api/uploads");
    scanDir(path.join(process.cwd(), "public", "uploads", "icons"), "/api/uploads/icons");

    // Sort newest first
    icons.sort((a, b) => b.mtime - a.mtime);
  } catch (err) {
    console.error("Failed to list custom uploaded icons:", err);
  }
  return icons;
}

export async function checkIconUsage(iconUrl: string) {
  await requireSession();
  const path = await import("path");
  const filename = path.basename(iconUrl || "").trim();
  if (!filename) return { inUse: false, usageCount: 0, details: [] };

  const details: Array<{ type: string; title: string }> = [];

  try {
    // 1. Check Bookmarks
    const bookmarks = await prisma.bookmark.findMany({
      where: { icon: { contains: filename } },
      select: { id: true, title: true }
    });
    for (const b of bookmarks) {
      details.push({ type: "Bookmark", title: b.title });
    }

    // 2. Check Sections
    const sections = await prisma.section.findMany({
      where: {
        OR: [
          { icon: { contains: filename } },
          { widgetConfig: { contains: filename } }
        ]
      },
      select: { id: true, title: true }
    });
    for (const s of sections) {
      details.push({ type: "Section", title: s.title });
    }

    // 3. Check Tabs
    const tabs = await prisma.tab.findMany({
      where: { icon: { contains: filename } },
      select: { id: true, title: true }
    });
    for (const t of tabs) {
      details.push({ type: "Tab", title: t.title });
    }

    // 4. Check Themes
    const themes = await (prisma as any).theme.findMany({
      where: {
        OR: [
          { icon: { contains: filename } },
          { background: { contains: filename } }
        ]
      },
      select: { id: true, name: true }
    });
    for (const th of themes) {
      details.push({ type: "Theme", title: th.name });
    }
  } catch (err) {
    console.error("Error checking icon usage:", err);
  }

  return {
    inUse: details.length > 0,
    usageCount: details.length,
    details
  };
}

export async function deleteCustomUploadedIcon(iconUrl: string) {
  await requireSession();
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filename = path.basename(iconUrl || "").trim();
    if (!filename || filename.includes("..")) {
      throw new Error("Invalid filename");
    }

    const path1 = path.join(process.cwd(), "public", "uploads", filename);
    const path2 = path.join(process.cwd(), "public", "uploads", "icons", filename);

    let deleted = false;
    if (fs.existsSync(path1)) {
      fs.unlinkSync(path1);
      deleted = true;
    }
    if (fs.existsSync(path2)) {
      fs.unlinkSync(path2);
      deleted = true;
    }

    if (!deleted) {
      throw new Error("Icon file not found on server disk");
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete icon" };
  }
}

export async function purgeUnusedCustomUploadedIcons() {
  await requireSession();
  try {
    const fs = await import("fs");
    const path = await import("path");

    // 1. Collect all uploaded files on disk
    const allFiles: Array<{ filename: string; fullPath: string }> = [];
    const scanDir = (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && file.match(/\.(png|jpe?g|svg|webp|gif|ico)$/i)) {
            allFiles.push({ filename: file, fullPath });
          }
        }
      }
    };

    scanDir(path.join(process.cwd(), "public", "uploads"));
    scanDir(path.join(process.cwd(), "public", "uploads", "icons"));

    if (allFiles.length === 0) {
      return { success: true, purgedCount: 0, purgedFiles: [], message: "No uploaded icons found on server." };
    }

    // 2. Fetch all referenced icon strings from DB in bulk
    const [bookmarks, sections, tabs, themes] = await Promise.all([
      prisma.bookmark.findMany({ select: { icon: true } }),
      prisma.section.findMany({ select: { icon: true, widgetConfig: true } }),
      prisma.tab.findMany({ select: { icon: true } }),
      (prisma as any).theme.findMany({ select: { icon: true, background: true } }),
    ]);

    // Build array of all icon strings
    const dbIconStrings: string[] = [];
    for (const b of bookmarks) if (b.icon) dbIconStrings.push(b.icon);
    for (const s of sections) {
      if (s.icon) dbIconStrings.push(s.icon);
      if (s.widgetConfig) {
        dbIconStrings.push(typeof s.widgetConfig === "string" ? s.widgetConfig : JSON.stringify(s.widgetConfig));
      }
    }
    for (const t of tabs) if (t.icon) dbIconStrings.push(t.icon);
    for (const th of themes) {
      if (th.icon) dbIconStrings.push(th.icon);
      if (th.background) dbIconStrings.push(th.background);
    }

    const allDbText = dbIconStrings.join(" ");

    // 3. Identify unused files and delete them
    const purgedFiles: string[] = [];
    for (const item of allFiles) {
      if (!allDbText.includes(item.filename)) {
        try {
          if (fs.existsSync(item.fullPath)) {
            fs.unlinkSync(item.fullPath);
            purgedFiles.push(item.filename);
          }
        } catch (unlinkErr) {
          console.warn(`[purge] Failed to delete unused icon ${item.filename}:`, unlinkErr);
        }
      }
    }

    revalidatePath("/");
    return {
      success: true,
      purgedCount: purgedFiles.length,
      purgedFiles,
      remainingCount: allFiles.length - purgedFiles.length,
    };
  } catch (err: any) {
    console.error("[actions] purgeUnusedCustomUploadedIcons error:", err);
    return { success: false, error: err.message || "Failed to purge unused icons" };
  }
}

// --- OUTLOOK CALENDAR WIDGET ACTIONS ---

export async function fetchOutlookCalendarsAction(sectionId: string) {
  await requireSession();
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return { success: false, error: "Section not found" };
    }

    const rawConfig =
      typeof section.widgetConfig === "string"
        ? JSON.parse(section.widgetConfig) || {}
        : section.widgetConfig || {};

    const { getValidAccessToken, fetchOutlookCalendars } = await import("@/lib/outlook");
    const tokenResult = await getValidAccessToken(sectionId, rawConfig);
    if (!tokenResult) {
      return { success: false, error: "Outlook account not connected or authentication expired", needsAuth: true };
    }

    const calendars = await fetchOutlookCalendars(tokenResult.accessToken);
    return { success: true, calendars };
  } catch (err: any) {
    console.error("[actions] fetchOutlookCalendarsAction error:", err);
    return { success: false, error: err.message || "Failed to fetch calendars" };
  }
}

export async function fetchOutlookEventsAction(
  sectionId: string,
  options?: { daysAhead?: number; selectedCalendarIds?: string[]; timeZone?: string }
) {
  await requireSession();
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return { success: false, error: "Section not found" };
    }

    const rawConfig =
      typeof section.widgetConfig === "string"
        ? JSON.parse(section.widgetConfig) || {}
        : section.widgetConfig || {};

    if (!rawConfig.connected && !rawConfig.refreshToken) {
      return { success: false, error: "Outlook account not connected", needsAuth: true };
    }

    const { getValidAccessToken, fetchOutlookEvents } = await import("@/lib/outlook");
    const tokenResult = await getValidAccessToken(sectionId, rawConfig);
    if (!tokenResult) {
      return { success: false, error: "Outlook session expired. Please reconnect in widget settings.", needsAuth: true };
    }

    const daysAhead = options?.daysAhead ?? rawConfig.daysAhead ?? 7;
    const selectedCalendarIds = options?.selectedCalendarIds ?? rawConfig.selectedCalendarIds ?? [];

    const events = await fetchOutlookEvents(tokenResult.accessToken, {
      daysAhead,
      selectedCalendarIds,
      timeZone: options?.timeZone,
    });

    return {
      success: true,
      events,
      accountName: rawConfig.accountName,
      accountEmail: rawConfig.accountEmail,
      daysAhead,
      selectedCalendarIds,
    };
  } catch (err: any) {
    console.error("[actions] fetchOutlookEventsAction error:", err);
    return { success: false, error: err.message || "Failed to fetch calendar events" };
  }
}

export async function disconnectOutlookAccountAction(sectionId: string) {
  await requireSectionRole(sectionId, "edit");
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return { success: false, error: "Section not found" };
    }

    const rawConfig =
      typeof section.widgetConfig === "string"
        ? JSON.parse(section.widgetConfig) || {}
        : section.widgetConfig || {};

    const updatedConfig = {
      ...rawConfig,
      connected: false,
      accountEmail: null,
      accountName: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    };

    await prisma.section.update({
      where: { id: sectionId },
      data: { widgetConfig: updatedConfig },
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to disconnect account" };
  }
}

export async function saveOutlookWidgetSettingsAction(
  sectionId: string,
  settings: {
    daysAhead?: number;
    selectedCalendarIds?: string[];
    clientId?: string;
    tenantId?: string;
    clientSecret?: string;
  }
) {
  await requireSession();
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return { success: false, error: "Section not found" };
    }

    const existingConfig =
      typeof section.widgetConfig === "string"
        ? JSON.parse(section.widgetConfig) || {}
        : (section.widgetConfig as Record<string, unknown>) || {};

    const mergedConfig = {
      ...existingConfig,
      daysAhead: typeof settings.daysAhead === "number" ? settings.daysAhead : (existingConfig.daysAhead ?? 7),
      selectedCalendarIds: Array.isArray(settings.selectedCalendarIds)
        ? settings.selectedCalendarIds
        : (existingConfig.selectedCalendarIds ?? []),
      ...(settings.clientId !== undefined ? { clientId: settings.clientId.trim() || undefined } : {}),
      ...(settings.tenantId !== undefined ? { tenantId: settings.tenantId.trim() || undefined } : {}),
      ...(settings.clientSecret !== undefined ? { clientSecret: settings.clientSecret.trim() || undefined } : {}),
    };

    await prisma.section.update({
      where: { id: sectionId },
      data: { widgetConfig: JSON.parse(JSON.stringify(mergedConfig)) },
    });

    revalidatePath("/");
    return { success: true, updatedConfig: mergedConfig };
  } catch (err: any) {
    console.error("[actions] saveOutlookWidgetSettingsAction error:", err);
    return { success: false, error: err.message || "Failed to save settings" };
  }
}


