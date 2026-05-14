import { prisma } from "@/lib/prisma";
import { LayoutGrid, Bookmark, Library, Settings, MousePointerClick, Users, LogIn, Activity, Clock } from "lucide-react";
import { GlobalDefaultTab } from "./GlobalDefaultTab";
import { RecentActivityClient } from "./RecentActivityClient";
import { CustomTagsClient } from "./CustomTagsClient";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [tabsCount, sectionsCount, bookmarksCount, activeTheme, allTabs, globalSettings, totalClicks, uniqueClickUsers, recentLogins, activityFeed] = await Promise.all([
    prisma.tab.count(),
    prisma.section.count(),
    prisma.bookmark.count(),
    prisma.theme.findFirst({ where: { isActive: true } }),
    prisma.tab.findMany({ orderBy: { order: "asc" }, select: { id: true, title: true } }),
    (prisma as any).globalSettings.findUnique({ where: { id: "global" } }),
    // Total bookmark clicks (last 30 days)
    (prisma as any).clickEvent.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    // Unique users who clicked
    (prisma as any).clickEvent.groupBy({ by: ['userId'], where: { createdAt: { gte: thirtyDaysAgo }, userId: { not: null } } }).then((r: any[]) => r.length),
    // Unique logins (last 30 days) from activity log
    (prisma as any).activityLog.groupBy({ by: ['userId'], where: { type: 'login', createdAt: { gte: thirtyDaysAgo }, userId: { not: null } } }).then((r: any[]) => r.length),
    // Recent activity feed (last 100 entries)
    (prisma as any).activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, userName: true, type: true, detail: true, createdAt: true, userId: true } }),
  ]);

  const statCards = [
    { label: "Total Workspaces", value: tabsCount, icon: Library, color: "#6366f1" },
    { label: "Total Sections", value: sectionsCount, icon: LayoutGrid, color: "#ec4899" },
    { label: "Total Bookmarks", value: bookmarksCount, icon: Bookmark, color: "#8b5cf6" },
    { label: "Clicks (30d)", value: totalClicks, icon: MousePointerClick, color: "#10b981" },
    { label: "Active Users (30d)", value: uniqueClickUsers, icon: Users, color: "#3b82f6" },
    { label: "Unique Logins (30d)", value: recentLogins, icon: LogIn, color: "#f59e0b" },
  ];

  const typeLabel: Record<string, string> = {
    login: "Logged in",
    bookmark_click: "Clicked bookmark",
    section_edit: "Edited section",
    tab_edit: "Edited workspace",
  };
  const typeColor: Record<string, string> = {
    login: "#10b981",
    bookmark_click: "#3b82f6",
    section_edit: "#f59e0b",
    tab_edit: "#8b5cf6",
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {statCards.map((stat, i) => (
          <div key={i} className="glass glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ background: `${stat.color}18`, color: stat.color, padding: '0.85rem', borderRadius: '12px', flexShrink: 0 }}>
              <stat.icon size={22} />
            </div>
            <div>
              <p style={{ margin: 0, opacity: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>{stat.label}</p>
              <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem' }}>
        {/* Quick Settings */}
        <div className="glass glass-card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} /> Quick Settings
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Active Theme: <strong>{activeTheme?.name || "Default"}</strong></span>
              <a href="/admin/theme" className="btn" style={{ border: '1px solid var(--glass-border)' }}>Edit</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
              <div>
                <span style={{ display: 'block', fontWeight: 600 }}>Default Workspace</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Shown to users with no personal default set</span>
              </div>
              <GlobalDefaultTab allTabs={allTabs} currentDefaultTabId={globalSettings?.defaultTabId || null} />
            </div>
          </div>
        </div>

        {/* Custom Tags */}
        <CustomTagsClient initialTags={(globalSettings?.customTags as any[]) || []} />

        {/* Activity Feed */}
        <RecentActivityClient initialFeed={activityFeed} />
      </div>
    </div>
  );
}
