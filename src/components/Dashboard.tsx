"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import {
   Search, Settings, Edit2, Lock, Trash2, ExternalLink, Moon, Sun, LayoutGrid, ChevronDown, ChevronRight, MoreVertical, GripVertical, LogOut, Maximize2, Plus, Move, X, Upload, Palette, LayoutTemplate, Copy, ChevronLeft, Grid, ArrowRight, PlusCircle, Layout, Download, Library, Check, Menu, Star, Users, Info
} from "lucide-react";
import { useTheme } from "next-themes";
import * as actions from "@/app/admin/actions";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, signIn } from "next-auth/react";
import { IconComponent, IconPicker } from "./IconPicker";
import ThemeModal from "@/components/ThemeModal";
import { TabModal } from "./TabModal";
import { SectionModal } from "./SectionModal";
import { BookmarkModal } from "./BookmarkModal";

export interface Bookmark {
   id: string;
   title: string;
   url: string;
   description?: string | null;
   longDescription?: string | null;
   icon?: string | null;
   openInNewTab: boolean;
   order: number;
}

export interface Section {
   id: string;
   title: string;
   icon?: string | null;
   height?: number | null;
   isAutoResize?: boolean;
   column: number;
   order?: number;
   defaultCollapsed?: boolean;
   bookmarks: Bookmark[];
   organization?: string | null;
   isLibraryItem?: boolean;
   description?: string | null;
   owners?: { id: string }[];
   editors?: { id: string }[];
   allowedUsers?: { id: string }[];
   departmentAccess?: any[];
}

export interface Theme {
   id: string;
   name: string;
   primaryColor: string;
   backgroundColor: string | null;
   dashboardTitle: string | null;
   darkMode: boolean;
   glassEffect: boolean;
   backgroundBlur?: number | null;
   backgroundTint?: number | null;
   sectionOpacity?: number | null;
   glassOpacity?: number | null;
   logoUrlLight?: string | null;
   logoUrlDark?: string | null;
}

export interface Tab {
   id: string;
   title: string;
   icon?: string | null;
   organization: string | null;
   columns: number;
   sections: Section[];
   theme?: Theme | null;
   themeId?: string | null;
   isLibraryItem?: boolean;
   description?: string | null;
   owners: { id: string }[];
   editors: { id: string }[];
   allowedUsers: { id: string }[];
}

export interface DashboardProps {
   tabs: Tab[];
   activeTheme: Theme;
   globalSettings: {
      logoUrlLight?: string | null;
      logoUrlDark?: string | null;
      logoUrlSquareLight?: string | null;
      logoUrlSquareDark?: string | null;
      systemThemeColor: string;
   };
   userDepartment?: string | null;
   isAdmin: boolean;
   currentUserId: string;
   canEditContent: boolean;
   iconSize?: number;
   libraryTabs: Tab[];
   librarySections: Section[];
   userName?: string | null;
   avatarColor?: string | null;
   allThemes?: { id: string; name: string }[];
   allDepartments?: string[];
   userDefaultTabId?: string | null;
   globalDefaultTabId?: string | null;
}

// Global hook to resolve hydrated state
function useMounted() {
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   return mounted;
}

export function Dashboard({
   tabs: initialTabs, activeTheme: baseActiveTheme, globalSettings, userDepartment, isAdmin, currentUserId, canEditContent, iconSize = 36, libraryTabs, librarySections, allThemes = [], allDepartments = [], userName, avatarColor, userDefaultTabId, globalDefaultTabId
}: DashboardProps) {
   const router = useRouter();
   const [tabs, setTabs] = useState<Tab[]>(initialTabs);

   // States
   
   // Helper to determine text color based on background hex
   const getContrastYIQ = (hexcolor: string) => {
      if (!hexcolor) return 'var(--text)';
      hexcolor = hexcolor.replace("#", "");
      if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
      if (hexcolor.length !== 6) return 'var(--text)';
      const r = parseInt(hexcolor.substr(0, 2), 16);
      const g = parseInt(hexcolor.substr(2, 2), 16);
      const b = parseInt(hexcolor.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#000000' : '#ffffff';
   };
const [activeTabId, setActiveTabId] = useState<string>(tabs.length > 0 ? tabs[0].id : "");
   const [searchQuery, setSearchQuery] = useState("");
   const [showEditControls, setShowEditControls] = useState(false);
   const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

   // Modal States
   const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
   const [modalMode, setModalMode] = useState<"add" | "edit">("add");
   const [isTabModalOpen, setIsTabModalOpen] = useState(false);
   const [targetTabToEdit, setTargetTabToEdit] = useState<Tab | null>(null);

   // Bookmark Edit
   const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
   const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
   const [targetSectionIdForBookmark, setTargetSectionIdForBookmark] = useState<string>("");

   // Section Edit
   const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
   const [editingSection, setEditingSection] = useState<Section | null>(null);

   // Drag and Drop States
   const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
   const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

   const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
   const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

   const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(null);
   const [draggedBookmarkSectionId, setDraggedBookmarkSectionId] = useState<string | null>(null);
   const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(null);
   const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);

   const [isCatalogOpen, setIsCatalogOpen] = useState(false);
   // Lock body scroll when catalog is open
   useEffect(() => {
      if (isCatalogOpen) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = 'auto';
      }
      return () => { document.body.style.overflow = 'auto'; };
   }, [isCatalogOpen]);

   const [catalogTab, setCatalogTab] = useState<"workspaces" | "sections">("workspaces");

   const hasTabEditAccess = (tab: Tab) => {
      if (!currentUserId) return false;
      if (isAdmin) return true;
      if (tab.editors?.some(u => u.id === currentUserId)) return true;
      if (tab.owners?.some(u => u.id === currentUserId)) return true;
      return false;
   };

   const hasSectionEditAccess = (section: Section, tab: Tab) => {
      if (!currentUserId) return false;
      if (isAdmin) return true;
      if (section.editors?.some(u => u.id === currentUserId)) return true;
      if (section.owners?.some(u => u.id === currentUserId)) return true;
      if (hasTabEditAccess(tab)) return true;
      return false;
   };

   const handleTabDrop = async (e: React.DragEvent, targetTabId: string) => {
      e.preventDefault();
      if (!draggedTabId || draggedTabId === targetTabId) return;
      const newTabs = [...tabs];
      const src = newTabs.findIndex(t => t.id === draggedTabId);
      const dst = newTabs.findIndex(t => t.id === targetTabId);
      if (src === -1 || dst === -1) return;
      const [moved] = newTabs.splice(src, 1);
      newTabs.splice(dst, 0, moved);
      setTabs(newTabs);

      if (isAdmin) {
         await actions.reorderTabs(newTabs.map(t => t.id));
      } else {
         await actions.updatePersonalLayout({ tabOrder: newTabs.map(t => t.id) });
      }
      setDraggedTabId(null);
   };

   const handleSectionDrop = async (e: React.DragEvent, targetId: string | undefined, currentTabId: string, colIdx: number) => {
      e.preventDefault();
      e.stopPropagation();

      const dataTransferId = e.dataTransfer.getData("text/plain");
      const srcId = draggedSectionId || dataTransferId;

      setDraggedSectionId(null);
      setDragOverSectionId(null);
      setDragOverColIdx(null);
      if (!srcId || srcId === targetId) return;

      if (srcId.startsWith("catalogSection:")) {
         const catalogSectionId = srcId.replace("catalogSection:", "");
         await actions.addSectionToTab(catalogSectionId, currentTabId, colIdx);
         router.refresh();
         return;
      }

      // Compute the new layout directly (synchronously) before touching state
      const newTabs = [...tabs];
      const tabIndex = newTabs.findIndex(t => t.id === currentTabId);
      if (tabIndex === -1) return;
      const targetTab = { ...newTabs[tabIndex], sections: [...newTabs[tabIndex].sections] };

      const srcSectionIndex = targetTab.sections.findIndex(s => s.id === srcId);
      if (srcSectionIndex === -1) return;

      const [movedSection] = targetTab.sections.splice(srcSectionIndex, 1);
      movedSection.column = colIdx;

      if (targetId) {
         const dstSectionIndex = targetTab.sections.findIndex(s => s.id === targetId);
         if (dstSectionIndex !== -1) {
            targetTab.sections.splice(dstSectionIndex, 0, movedSection);
         } else {
            targetTab.sections.push(movedSection);
         }
      } else {
         targetTab.sections.push(movedSection);
      }
      // Assign order values to all sections in all columns after the move
      for (let col = 0; col < (targetTab.columns ?? 3); col++) {
         targetTab.sections.filter((s: any) => (s.column ?? 0) === col).forEach((s: any, idx: number) => { s.order = idx; });
      }
      newTabs[tabIndex] = targetTab;

      // Optimistic UI update with the already-computed layout
      setTabs(newTabs);

      // Send the entire updated layout to the server
      const allSectionUpdates = targetTab.sections.map((s: any) => ({
         sectionId: s.id,
         column: s.column ?? 0,
         order: s.order ?? 0,
      }));
      if (isAdmin) {
         await actions.updateGlobalLayoutBatch(currentTabId, allSectionUpdates);
      } else {
         await actions.updatePersonalLayoutBatch(allSectionUpdates.map((u: any) => ({ ...u, tabId: currentTabId })));
      }
      // Do NOT call router.refresh() — it re-renders from server and overwrites optimistic state
   };

   const handleBookmarkDrop = async (e: React.DragEvent, targetId: string, currentSectionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedBookmarkId) return;
      if (draggedBookmarkId === targetId) { setDragOverBookmarkId(null); return; }

      const bId = draggedBookmarkId;
      setDraggedBookmarkId(null);
      setDraggedBookmarkSectionId(null);
      setDragOverBookmarkId(null);

      let syncedTabs = [...tabs];
      // Optimistic Local Update
      setTabs(currentTabs => {
         const newTabs = [...currentTabs];
         newTabs.forEach((tab, tIdx) => {
            const newSections = [...tab.sections];
            let changed = false;
            const srcSecIdx = newSections.findIndex(s => s.bookmarks.some(b => b.id === bId));
            const dstSecIdx = newSections.findIndex(s => s.id === currentSectionId);

            if (srcSecIdx !== -1 && dstSecIdx !== -1) {
               changed = true;
               const srcSec = { ...newSections[srcSecIdx], bookmarks: [...newSections[srcSecIdx].bookmarks] };
               const dstSec = srcSecIdx === dstSecIdx ? srcSec : { ...newSections[dstSecIdx], bookmarks: [...newSections[dstSecIdx].bookmarks] };

               const bIdx = srcSec.bookmarks.findIndex(b => b.id === bId);
               if (bIdx !== -1) {
                  const [moved] = srcSec.bookmarks.splice(bIdx, 1);
                  const targetBIdx = dstSec.bookmarks.findIndex(b => b.id === targetId);
                  if (targetBIdx !== -1) dstSec.bookmarks.splice(targetBIdx, 0, moved);
                  else dstSec.bookmarks.push(moved);
                  dstSec.bookmarks.forEach((b, i) => b.order = i);
               }
               newSections[srcSecIdx] = srcSec;
               newSections[dstSecIdx] = dstSec;
            }
            if (changed) newTabs[tIdx] = { ...tab, sections: newSections };
         });
         syncedTabs = newTabs;
         return newTabs;
      });

      await actions.moveBookmark(bId, currentSectionId, targetId);
      router.refresh();
   };

   const mounted = useMounted();
   const { theme, setTheme } = useTheme();

   useEffect(() => {
      setTabs(initialTabs);
      if (!initialTabs.find(t => t.id === activeTabId) && initialTabs.length > 0) {
         setActiveTabId(initialTabs[0].id);
      }
   }, [initialTabs]);

   const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
   const activeTheme = activeTab?.theme || baseActiveTheme;

   // Filter logic
   const filteredTabs = useMemo(() => {
      if (!searchQuery.trim()) return [activeTab].filter(Boolean) as Tab[];
      const sq = searchQuery.toLowerCase();
      return tabs.map(tab => {
         const matchedSections = tab.sections.map(section => {
            const matchedBookmarks = section.bookmarks.filter(b => b.title.toLowerCase().includes(sq) || (b.description || "").toLowerCase().includes(sq));
            if (matchedBookmarks.length > 0 || section.title.toLowerCase().includes(sq)) {
               return { ...section, bookmarks: matchedBookmarks };
            }
            return null;
         }).filter(Boolean) as Section[];
         if (matchedSections.length > 0) return { ...tab, sections: matchedSections };
         return null;
      }).filter(Boolean) as Tab[];
   }, [tabs, activeTab, searchQuery]);

   const displayedTabs = searchQuery.trim() ? filteredTabs : ([activeTab].filter(Boolean) as Tab[]);

   const toggleSection = async (tabId: string, sectionId: string, defaultCollapsed: boolean = false) => {
      const key = `${tabId}_${sectionId}`;
      const newState = collapsedSections[key] === undefined ? !defaultCollapsed : !collapsedSections[key];
      setCollapsedSections(prev => ({ ...prev, [key]: newState }));

      // Optimistically save personal preference if logged in
      if (currentUserId) {
         await actions.updatePersonalLayout({ tabId, sectionId, collapsed: newState });
      }
   };

   if (!mounted) return null;

   const hexToRgb = (hex: string) => {
      if (!hex) return "99, 102, 241";
      if (hex.startsWith('rgb')) return hex;
      const cleanHex = hex.replace('#', '');
      if (cleanHex.length !== 6) return "99, 102, 241";
      const r = parseInt(cleanHex.slice(0, 2), 16);
      const g = parseInt(cleanHex.slice(2, 4), 16);
      const b = parseInt(cleanHex.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
   };

   const isLight = theme === 'light';
   const secOpac = activeTheme.sectionOpacity ?? 0.7;
   const glsOpac = activeTheme.glassOpacity ?? 0.12;

   // Use the active TAB's primary color if it has its own theme, else fall back to global theme
   const activeTabObj = tabs.find((t: any) => t.id === activeTabId);
   const effectivePrimaryColor = (activeTabObj?.theme?.primaryColor && activeTabObj.theme.primaryColor !== '') 
      ? activeTabObj.theme.primaryColor 
      : activeTheme.primaryColor;
   // Debug: console.log('Active tab:', activeTabObj?.title, 'theme:', activeTabObj?.theme?.primaryColor, 'effective:', effectivePrimaryColor);

   // PROPERLY tie glass wash to glassOpacity!
   const glassOverlayAlpha = isLight ? (glsOpac * 0.9) : (glsOpac * 0.4);

   // Tie background density to sectionOpacity
   const colorTintAlpha = isLight ? (secOpac * 0.8) : (secOpac * 0.45);

   const glassBg = activeTheme.glassEffect === false ? `rgba(${hexToRgb(effectivePrimaryColor)}, ${colorTintAlpha})` :
      `linear-gradient(rgba(255, 255, 255, ${glassOverlayAlpha}), rgba(255, 255, 255, ${glassOverlayAlpha})), rgba(${hexToRgb(effectivePrimaryColor)}, ${colorTintAlpha})`;

   const glassBorder = activeTheme.glassEffect === false ? `rgba(${hexToRgb(effectivePrimaryColor)}, 0.2)` :
      `rgba(${hexToRgb(effectivePrimaryColor)}, ${isLight ? 0.2 : 0.25})`;

   const dynamicCSS = `
    :root, [data-theme='dark'], [data-theme='light'] {
      --primary: ${effectivePrimaryColor};
      --primary-rgb: ${hexToRgb(effectivePrimaryColor)};
      --primary-glow: rgba(${hexToRgb(effectivePrimaryColor)}, 0.5);
      --glass-bg: ${glassBg};
      --glass-border: ${glassBorder};
    }
    .navbar {
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .desktop-nav-group { display: flex; }
    .mobile-menu-btn { display: none; }
    .mobile-menu-text { display: none; }
    @media (max-width: 768px) {
      .desktop-nav-group { display: none !important; }
      .desktop-nav-group.open {
        display: flex !important;
        flex-direction: column;
        align-items: stretch !important;
        position: absolute;
        top: 4rem;
        right: 1.5rem;
        background: var(--bg-color) !important;
        border: 1px solid var(--glass-border);
        padding: 1rem;
        border-radius: 16px;
        z-index: 9999;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        gap: 0.5rem !important;
      }
      .mobile-menu-btn { display: flex !important; }
      .mobile-menu-text { display: inline; font-size: 0.95rem; font-weight: 500; }
      .nav-menu-btn { width: 100%; display: flex; align-items: center; justify-content: flex-start; gap: 0.75rem; padding: 0.75rem !important; border-radius: 8px; }
      .navbar {
        padding-top: max(0.5rem, env(safe-area-inset-top)) !important;
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
        padding-bottom: 0.5rem !important;
      }
      .tabs-inner {
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
      }
      .dashboard-main-content {
        padding: 0.5rem !important;
      }
    }
  `;

   const catBtnBg = isCatalogOpen ? effectivePrimaryColor : effectivePrimaryColor + 'CC';
   const drawerBg = `color-mix(in srgb, ${effectivePrimaryColor} 15%, ${isLight ? 'rgba(255,255,255,0.9)' : 'rgba(18,18,18,0.9)'})`;

   return (
      <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', maxWidth: '100vw' }}>
         <style dangerouslySetInnerHTML={{ __html: dynamicCSS }} />
         <AmbientBackground theme={activeTheme} />

         {/* Global Nav Bar - Updated for Mobile / Multi-row */}
         <nav className="navbar glass" style={{ paddingTop: '0.5rem', background: 'var(--glass-bg)', display: 'flex', flexDirection: 'column', gap: '0.5rem', height: 'auto', minHeight: 'var(--nav-height)' }}>
            {/* Top Row: Workspace + Mobile Menu/Right Buttons */}
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
               {/* 1. Workspace Name */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flexShrink: 1 }}>
                  {globalSettings?.logoUrlLight && (
                     <img src={theme === "light" ? globalSettings.logoUrlLight : (globalSettings.logoUrlDark || globalSettings.logoUrlLight)} alt="Logo" className="nav-logo" style={{ height: '42px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                     {activeTab?.title ? `${activeTab.title} Dashboard` : (activeTheme.dashboardTitle || "Dashboard")}
                  </h1>
               </div>

               {/* Mobile Menu Toggle */}
               <button className="mobile-menu-btn glass" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                  <LucideIcons.Menu size={20} />
               </button>

               {/* Right Group */}
               <div className={`desktop-nav-group ${isMobileMenuOpen ? 'open' : ''}`} style={{ alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  {/* 3. Login Area */}
                  {currentUserId ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="nav-user-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                           {avatarColor ? (
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>
                                 {userName?.charAt(0)?.toUpperCase()}
                              </div>
                           ) : (
                              <LucideIcons.User size={18} />
                           )}
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                              <span className="nav-user-name" style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.2 }}>{userName}</span>
                              {userDepartment && <span style={{ fontSize: '10px', opacity: 0.5, lineHeight: 1, whiteSpace: 'nowrap' }}>{userDepartment}</span>}
                           </div>
                        </div>
                        <button onClick={() => signOut()} title="Sign Out" className="btn nav-menu-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                           <LogOut size={18} /> <span className="mobile-menu-text">Sign Out</span>
                        </button>
                     </div>
                  ) : (
                     <button onClick={() => signIn("microsoft-entra-id")} className="btn btn-primary nav-menu-btn" style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        Sign In
                     </button>
                  )}

                  {/* Theme Settings (always visible when user can edit, not just in edit mode) */}
                  {canEditContent && (
                     <button className="nav-menu-btn" title="Theme Settings (Current Workspace)" onClick={() => setIsThemeModalOpen(true)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)' }}>
                        <Palette size={18} /> <span className="mobile-menu-text">Workspace Theme</span>
                     </button>
                  )}

                  {/* Edit Toggle (Available to all logged-in users) */}
                  {currentUserId && (
                     <button className="nav-menu-btn" title="Toggle Edit Mode" onClick={() => setShowEditControls(!showEditControls)} style={{ background: showEditControls ? 'var(--primary)' : 'transparent', color: showEditControls ? 'white' : 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', marginLeft: '0.25rem' }}>
                        <Edit2 size={18} /> <span className="mobile-menu-text">Edit Dashboard</span>
                     </button>
                  )}

                  {/* 4. Admin Portal Icon (Gear) */}
                  {canEditContent && (
                     <Link className="nav-menu-btn" href="/admin" title="Admin Dashboard" style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                        <Settings size={18} /> <span className="mobile-menu-text">Admin Dashboard</span>
                     </Link>
                  )}

                  {/* 5. Light/Dark Mode */}
                  <button className="nav-menu-btn" title="Toggle Theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                     {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} <span className="mobile-menu-text">Toggle Dark Mode</span>
                  </button>
               </div>
            </div>

            {/* 2. Search Bar Row (Moved Below Header) */}
            <div style={{ width: '100%', position: 'relative', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
               <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                  <Search size={18} />
               </div>
               <input
                  type="text"
                  className="search-input"
                  placeholder="Search all apps & tools..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                     width: '100%', paddingTop: '0.7rem', paddingBottom: '0.7rem', paddingRight: '1rem', paddingLeft: '2.8rem',
                     background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '999px',
                     color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                     transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
                  }}
               />
            </div>
         </nav>

         {/* Tab Selection */}
         {(tabs.length > 1 || showEditControls) && !searchQuery.trim() && (
            <div className="tabs-container tab-scroll-container" style={{ width: '100%', boxSizing: 'border-box', overflowX: 'auto', overflowY: 'hidden', borderBottom: '1px solid var(--glass-border)', background: 'transparent', position: 'relative' }}>
               <div className="tabs-inner" style={{ display: 'flex', padding: '1.2rem 1.5rem 0 1.5rem', gap: '0.2rem', maxWidth: '1600px', margin: '0 auto', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                  {tabs.map(tab => {
                     const tabPrimary = tab.theme?.primaryColor || baseActiveTheme.primaryColor;
                     const isActiveTab = activeTabId === tab.id;
                     const isDragOver = dragOverTabId === tab.id;
                     return (
                        <button
                           key={tab.id}
                           className="workspace-tab-btn"
                           onClick={() => setActiveTabId(tab.id)}
                           draggable={showEditControls && hasTabEditAccess(tab)}
                           onDragStart={(e) => { if (showEditControls && hasTabEditAccess(tab)) { setDraggedTabId(tab.id); e.dataTransfer.effectAllowed = "move"; } }}
                           onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTabId(tab.id); }}
                           onDragLeave={() => setDragOverTabId(null)}
                           onDrop={(e) => { handleTabDrop(e, tab.id); setDragOverTabId(null); }}
                           style={{
                              padding: '0.75rem 1.25rem',
                              background: isDragOver ? tabPrimary + '80' : isActiveTab ? tabPrimary : tabPrimary + '99',
                              border: '1px solid ' + (isActiveTab || isDragOver ? tabPrimary : tabPrimary + 'B3'),
                              borderTop: isDragOver ? '3px solid ' + tabPrimary : '1px solid ' + (isActiveTab ? tabPrimary : tabPrimary + 'B3'),
                              borderBottom: 'none',
                              cursor: showEditControls ? 'grab' : 'pointer', borderRadius: '12px 12px 0 0',
                              color: getContrastYIQ(tabPrimary),
                              textShadow: !isActiveTab ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                              fontWeight: isActiveTab ? 700 : 500,
                              fontSize: '1rem', whiteSpace: 'nowrap', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)',
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              marginBottom: isActiveTab ? '-1px' : '0',
                              zIndex: isActiveTab ? 2 : 1,
                              opacity: draggedTabId === tab.id ? 0.5 : 1
                           }}
                        >
                           {tab.icon && <IconComponent name={tab.icon} size={18} />}
                           {tab.title}
                           {showEditControls && !hasTabEditAccess(tab) && (
                              <div style={{ marginLeft: '0.25rem', display: 'flex', opacity: 0.3 }} title="Locked: You do not have Editor or Owner permissions for this workspace.">
                                 <Lock size={12} />
                              </div>
                           )}
                           {showEditControls && (
                              <div style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                 {hasTabEditAccess(tab) && (
                                    <span onClick={(e) => { e.stopPropagation(); setTargetTabToEdit(tab); setIsTabModalOpen(true); }} style={{ opacity: 0.5, cursor: 'pointer', display: 'flex' }} title="Edit Workspace">
                                       <Settings size={14} />
                                    </span>
                                 )}
                                 {currentUserId && (
                                    <span onClick={async (e) => { e.stopPropagation(); await actions.setUserDefaultTab(currentUserId, tab.id); router.refresh(); }} style={{ opacity: userDefaultTabId === tab.id ? 1 : 0.5, color: userDefaultTabId === tab.id ? '#F7DC6F' : 'inherit', cursor: 'pointer', display: 'flex' }} title="Set as Default Desktop">
                                       {userDefaultTabId === tab.id ? <Star size={14} fill="#F7DC6F" stroke="#F7DC6F" /> : <Star size={14} />}
                                    </span>
                                 )}
                              </div>
                           )}
                        </button>
                     );
                  })}

                  {showEditControls && (
                     <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                           onClick={() => { setTargetTabToEdit(null); setIsTabModalOpen(true); }}
                           style={{
                              padding: '0.75rem 1.25rem', background: 'transparent', border: '1px dashed var(--glass-border)', borderBottom: 'none',
                              cursor: 'pointer', borderRadius: '12px 12px 0 0', color: 'var(--text)', opacity: 0.7, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'
                           }}
                        >
                           <Plus size={18} /> New Workspace
                        </button>
                     </div>
                  )}
               </div>
               {/* Catalog button / Cancel Drop Zone */}
               {showEditControls && (
                  draggedSectionId?.startsWith('catalogSection:') ? (
                     <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           // Add a slight delay before hiding the drop zone so the browser native drag ghost lands smoothly
                           setTimeout(() => setDraggedSectionId(null), 10);
                        }}
                        style={{
                           position: 'absolute', right: '1.5rem', bottom: '0.6rem',
                           padding: '0.55rem 1.5rem',
                           background: 'rgba(231, 76, 60, 0.95)',
                           border: '2px dashed #fff',
                           borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: 700,
                           fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                           boxShadow: '0 4px 16px rgba(231, 76, 60, 0.5)',
                           transition: 'all 0.2s ease', zIndex: 3,
                        }}
                     >
                        <LucideIcons.X size={18} /> Cancel Drop
                     </div>
                  ) : (
                     <button
                        onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                     style={{
                        position: 'absolute', right: '1.5rem', bottom: '0.6rem',
                        padding: '0.55rem 1rem',
                        background: catBtnBg,
                        border: '1px solid ' + effectivePrimaryColor,
                        borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: 700,
                        fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                        boxShadow: '0 2px 12px ' + effectivePrimaryColor + '55',
                        transition: 'all 0.2s ease', zIndex: 3,
                     }}
                  >
                     <LucideIcons.Library size={15} /> Catalog
                  </button>
                  )
               )}
                              </div>
                           )})
                     )}

                     {catalogTab === "sections" && (
                        librarySections.length === 0 ? <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '2rem' }}>No shared sections available.</div> :
                           librarySections.map(libSec => {
                              const activeTabObj = tabs.find(t => t.id === activeTabId);
                              const isAdded = activeTabObj?.tabSections?.some(ts => ts.section.id === libSec.id);
                              return (
                              <div
                                 key={libSec.id}
                                 className="glass-card"
                                 draggable={!isAdded}
                                 onDragStart={(e) => {
                                    if(isAdded) { e.preventDefault(); return; }
                                    e.dataTransfer.effectAllowed = "all";
                                    e.dataTransfer.setData("text/plain", `catalogSection:${libSec.id}`);
                                    setDraggedSectionId(`catalogSection:${libSec.id}`);
                                    setTimeout(() => setIsCatalogOpen(false), 50); // Defer closing so drag isn't interrupted
                                 }}
                                  onDragEnd={() => setDraggedSectionId(null)}
                                 style={{ padding: '1.25rem', borderRadius: '12px', border: '1px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: isAdded ? 'default' : 'grab', opacity: isAdded ? 0.5 : 1 }}
                              >
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem', color: 'var(--primary)' }}>
                                    {!isAdded && <GripVertical size={16} style={{ opacity: 0.5 }} />}
                                    {libSec.icon && <IconComponent name={libSec.icon} size={16} />}
                                    {libSec.title}
                                 </div>
                                 <div style={{ fontSize: '0.85rem', opacity: 0.7, paddingLeft: isAdded ? '0' : '1.5rem' }}>
                                    {isAdded ? "Already added to this workspace." : (libSec.description || "Drag this card onto any column in your dashboard to insert it.")}
                                 </div>
                              </div>
                           )})
                     )}
                  </div>
               </div>
            </div>
         )}

         {isThemeModalOpen && <ThemeModal
            editingTheme={activeTheme}
            isOpen={isThemeModalOpen}
            onClose={() => setIsThemeModalOpen(false)}
            onSave={async (data) => {
               if (activeTheme?.id && activeTheme.id !== "default") {
                  await actions.updateTheme(activeTheme.id, data);
               } else {
                  const newTheme = await actions.createTheme(data);
                  await actions.updateTab(activeTab.id, { themeId: newTheme.id });
               }
               setIsThemeModalOpen(false);
               router.refresh(); // Force a hard refresh to get the new theme JSON
            }}
         />}

         {/* Bookmark Modal */}
         {isBookmarkModalOpen && (
            <BookmarkModal
               bookmark={modalMode === "edit" ? editingBookmark : null}
               targetSectionId={targetSectionIdForBookmark}
               modalMode={modalMode}
               iconRegistry={undefined}
               onClose={() => setIsBookmarkModalOpen(false)}
               onSaved={() => { setIsBookmarkModalOpen(false); router.refresh(); }}
            />
         )}

         {/* Section Modal */}
         {isSectionModalOpen && (
            <SectionModal
               section={editingSection}
               targetTabId={activeTab?.id}
               onClose={() => setIsSectionModalOpen(false)}
               onSaved={() => { setIsSectionModalOpen(false); router.refresh(); }}
            />
         )}

         {/* Tab Modal */}
         {isTabModalOpen && (
            <TabModal
               tab={targetTabToEdit}
               allDepartments={allDepartments}
               allThemes={allThemes}
               onClose={() => setIsTabModalOpen(false)}
               onSaved={() => { setIsTabModalOpen(false); router.refresh(); }}
            />
         )}

         {/* Version Footer */}
         <div style={{ textAlign: 'center', padding: 'max(1rem, env(safe-area-inset-bottom))', opacity: 0.5, fontSize: '0.8rem', color: 'var(--text)', marginTop: 'auto' }}>
            v1.2.1
         </div>
      </main>
   );
}

// --- AMBIENT BACKGROUND SYSTEM ---
const AmbientBackground = ({ theme }: { theme?: Theme | null }) => {
   if (!theme) return null;
   const bgImg = (theme.backgroundColor && (theme.backgroundColor.startsWith('http') || theme.backgroundColor.startsWith('/') || theme.backgroundColor.startsWith('api') || theme.backgroundColor.startsWith('data:'))) ? theme.backgroundColor : null;


      return (
      <div style={{ position: 'fixed', top: '-100px', bottom: '-100px', left: 0, right: 0, zIndex: -1, overflow: 'hidden', background: 'var(--bg-base)', pointerEvents: 'none' }}>
         <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '80%', height: '80%', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 60%)', filter: 'blur(100px)', opacity: 0.8, animation: 'float 20s infinite alternate linear' }} />
         <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '70%', height: '70%', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 60%)', filter: 'blur(120px)', opacity: 0.6, animation: 'float 25s infinite alternate-reverse linear' }} />
         {bgImg && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${theme.backgroundBlur ?? 20}px) brightness(0.7)`, transform: 'scale(1.05)', opacity: 0.8 }} />}
         <div style={{ position: 'absolute', inset: 0, background: 'var(--primary)', opacity: bgImg ? (theme.backgroundTint ?? 0.6) : 0.08, mixBlendMode: theme.darkMode ? 'soft-light' : 'overlay' }} />
         <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`, pointerEvents: 'none' }} />
      </div>
   );
};
