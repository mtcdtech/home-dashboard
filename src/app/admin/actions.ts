"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseBookmarksHtml } from "@/lib/bookmark-parser";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// --- OPENVERSE IMAGE SEARCH ---
export async function searchOpenverseImages(query: string, page: number = 1) {
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
  const file = formData.get("file") as File;
  if (!file) return null;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = join(process.cwd(), "public", "uploads");
  try { await mkdir(uploadDir, { recursive: true }); } catch (e) {}
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  const path = join(uploadDir, filename);
  await writeFile(path, buffer);
  return `/api/uploads/${filename}`;
}

export async function saveGeneratedImage(base64: string) {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, 'base64');
  const uploadDir = join(process.cwd(), "public", "uploads");
  try { await mkdir(uploadDir, { recursive: true }); } catch (e) {}
  const filename = `gen-${Date.now()}.jpg`;
  const path = join(uploadDir, filename);
  await writeFile(path, buffer);
  return `/api/uploads/${filename}`;
}

export async function downloadImageFromUrl(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) {}
    
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
export async function fetchFavicon(targetUrl: string) {
  try {
    const domain = new URL(targetUrl).hostname;
    // High-fidelity favicon signal from Google's high-res proxy
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    
    const response = await fetch(faviconUrl);
    if (!response.ok) return null;
    
    const bytes = await response.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadDir = join(process.cwd(), "public", "uploads");
    try { await mkdir(uploadDir, { recursive: true }); } catch (e) {}
    
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
export async function createTab(data: { title: string; icon?: string; order?: number; themeId?: string | null; organization?: string | null; allowedUserIds?: string[]; columns?: number }) {
  await (prisma as any).tab.create({
    data: {
      title: data.title,
      icon: data.icon || null,
      order: data.order ?? 0,
      themeId: data.themeId,
      organization: data.organization || null,
      columns: data.columns ?? 3,
      isLibraryItem: (data as any).isLibraryItem ?? false,
      description: (data as any).description || null,
      allowedUsers: data.allowedUserIds ? { connect: data.allowedUserIds.map(id => ({ id })) } : undefined,
      owners: { connect: { id: (await auth())?.user?.id } } // creator is initial owner
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

export async function updateTab(id: string, data: { title: string; icon?: string | null; order?: number; themeId?: string | null; organization?: string | null; allowedUserIds?: string[]; columns?: number }) {
  await (prisma as any).tab.update({
    where: { id },
    data: {
      title: data.title,
      icon: data.icon,
      order: data.order ?? 0,
      themeId: data.themeId,
      organization: data.organization || null,
      columns: data.columns ?? 3,
      isLibraryItem: (data as any).isLibraryItem ?? false,
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
  await prisma.tab.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/tabs");
}

// --- SECTION ORCHESTRATION ---
export async function createSection(data: any) {
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
  await (prisma as any).tabSection.deleteMany({ where: { sectionId, tabId } });
  revalidatePath("/");
}

export async function toggleSectionInTab(tabId: string, sectionId: string, isAssigned: boolean) {
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
  await prisma.section.update({ 
    where: { id }, 
    data: {
      ...data,
      isLibraryItem: data.isLibraryItem ?? false,
      description: data.description || null
    }
  });
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

export async function deleteSection(id: string) {
  await prisma.section.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/sections");
}

export async function updateSectionLayout(sectionId: string, tabId: string, data: { height?: number | null; isAutoResize?: boolean }) {
  await (prisma as any).tabSection.update({
    where: { tabId_sectionId: { tabId, sectionId } },
    data: data,
  });
  revalidatePath("/");
}

export async function updateTabSectionCollapsed(sectionId: string, tabId: string, defaultCollapsed: boolean) {
  await (prisma as any).tabSection.update({
    where: { tabId_sectionId: { tabId, sectionId } },
    data: { defaultCollapsed },
  });
  revalidatePath("/");
}

export async function updateUserDefaultTab(userId: string, defaultTabId: string | null) {
  await prisma.user.update({ where: { id: userId }, data: { defaultTabId } });
  revalidatePath("/");
}

export async function updateGlobalDefaultTab(defaultTabId: string | null) {
  await (prisma as any).globalSettings.upsert({
    where: { id: "global" },
    update: { defaultTabId },
    create: { id: "global", defaultTabId },
  });
  revalidatePath("/");
}

export async function moveSection(sectionId: string, tabId: string, targetColumn: number, beforeSectionId?: string) {
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
  const session = await auth();
  const user = session?.user;
  if (!user?.email) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true, layout: true } });
  if (!dbUser) throw new Error("User not found");

  let layout: any = dbUser.layout || {};

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
  await prisma.bookmark.create({ data });
  revalidatePath("/");
}

export async function updateBookmark(id: string, data: any) {
  if (data.url) data.url = normalizeUrl(data.url);
  await prisma.bookmark.update({ where: { id }, data });
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
  const result = await prisma.theme.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath("/admin/theme");
  return result;
}

export async function deleteTheme(id: string) {
  return await prisma.theme.delete({ where: { id } });
}

export async function updateTabTheme(tabId: string, themeData: any) {
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
  await prisma.user.update({ where: { id }, data: { isAdmin } });
  revalidatePath("/admin/users");
}

export async function updateUserDashboardGroup(id: string, dashboardGroup: string) {
  const session = await auth();
  if (!(session?.user as any)?.isAdmin) throw new Error("Unauthorized");
  await prisma.user.update({ where: { id }, data: { dashboardGroup } });
  revalidatePath("/admin/users");
}

export async function toggleUserEditContent(id: string, canEditContent: boolean) {
  await prisma.user.update({ where: { id }, data: { canEditContent } });
  revalidatePath("/admin/users");
}

export async function setUserAllowedSections(userId: string, sectionIds: string[]) {
  await prisma.user.update({ where: { id: userId }, data: { allowedSections: { set: sectionIds.map((id) => ({ id })) } } });
  revalidatePath("/admin/users");
  revalidatePath("/");
}

export async function setTabEditors(tabId: string, userIds: string[]) {
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

export async function updateTabUserRole(tabId: string, userId: string, role: string) {
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
    await _updateTabDepartmentRole(tabId, department, role);
    revalidatePath("/");
    revalidatePath("/admin/tabs");
}

export async function setSectionEditors(sectionId: string, userIds: string[]) {
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
    await _updateSectionDepartmentRole(sectionId, department, role);
    revalidatePath("/");
    revalidatePath("/admin/sections");
}

// --- CATALOG & PUSH ORCHESTRATION ---
export async function pushTabToDepartment(tabId: string, department: string) {
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
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
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
  
  revalidatePath("/");
}

export async function removeTabFromUser(tabId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await (prisma as any).tab.update({
    where: { id: tabId },
    data: {
      allowedUsers: { disconnect: { id: user.id } }
    }
  });
  revalidatePath("/");
}

// --- UTILITY & IMPORT ---
export async function scanBookmarksFile(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");
  const html = await file.text();
  return await parseBookmarksHtml(html);
}

export async function executeBookmarkImport(mappings: any[]) {
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
    // 1. Update the department-level setting
    await _updateTabDepartmentRole(tabId, department, role);
    
    // 2. Update all members (excluding Global Admins)
    const users = await prisma.user.findMany({ 
        where: department === "Entire Organization" 
            ? { isAdmin: false }
            : { 
                department: department === "General" ? null : department, 
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
    // 1. Update the department-level setting
    await _updateSectionDepartmentRole(sectionId, department, role);
    
    // 2. Update all members (excluding Global Admins)
    const users = await prisma.user.findMany({ 
        where: department === "Entire Organization" 
            ? { isAdmin: false }
            : { 
                department: department === "General" ? null : department, 
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
                department: department === "General" ? null : department, 
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
  await prisma.user.update({ where: { id: userId }, data: { defaultTabId: tabId } });
}

