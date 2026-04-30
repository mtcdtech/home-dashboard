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
   impersonating?: { userId: string; userName: string } | null;
   adminUsers?: any[];
   allUsers?: any[];
}

// Global hook to resolve hydrated state
function useMounted() {
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   return mounted;
}

export function Dashboard({
   tabs: initialTabs, activeTheme: baseActiveTheme, globalSettings, userDepartment, isAdmin, currentUserId, canEditContent, iconSize = 36, libraryTabs, librarySections, allThemes = [], allDepartments = [], userName, avatarColor, userDefaultTabId, globalDefaultTabId, impersonating = null, adminUsers = [], allUsers = []
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
   const [activeTabId, setActiveTabId] = useState<string>("");

   useEffect(() => {
      if (typeof window !== "undefined") {
         const urlParams = new URLSearchParams(window.location.search);
         const tabParam = urlParams.get('tab');
         if (tabParam && tabs.some((t: any) => t.id === tabParam)) {
            setActiveTabId(tabParam);
         } else if (tabs.length > 0) {
            setActiveTabId(tabs[0].id);
         }
      }
   }, [tabs]);

   useEffect(() => {
      if (typeof window !== "undefined" && activeTabId) {
         const url = new URL(window.location.href);
         if (url.searchParams.get('tab') !== activeTabId) {
            url.searchParams.set('tab', activeTabId);
            window.history.replaceState({}, '', url.toString());
         }
      }
   }, [activeTabId]);

   const activeTabObj = tabs.find((t: any) => t.id === activeTabId);
   const [searchQuery, setSearchQuery] = useState("");
   const [showEditControls, setShowEditControls] = useState(false);
   const [lockInfoTarget, setLockInfoTarget] = useState<{ type: string; title: string; owners: any[]; editors: any[] } | null>(null);
   const adminBypass = isAdmin && !impersonating;
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
   const [catalogSearchQuery, setCatalogSearchQuery] = useState("");

   const hasTabAdminAccess = (tab?: Tab) => {
      if (!tab) return false;
      if (tab.isReadOnlySync) return false;
      if (isAdmin) return true;
      if ((tab as any).accessRole === "owner") return true;
      if (tab.owners?.some(u => u.id === currentUserId)) return true;
      return false;
   };

   const hasTabEditAccess = (tab?: Tab) => {
      if (!tab) return false;
      if (tab.isReadOnlySync) return false;
      if (adminBypass) return true;
      if ((tab as any).accessRole === "owner" || (tab as any).accessRole === "editor") return true;
      if (tab.editors?.some(u => u.id === currentUserId)) return true;
      if (tab.owners?.some(u => u.id === currentUserId)) return true;
      return false;
   };

   const hasSectionEditAccess = (section?: Section, tab?: Tab) => {
      if (!section || !tab) return false;
      if (section.isReadOnlySync || tab.isReadOnlySync) return false;
      if (adminBypass) return true;
      if ((section as any).accessRole === "owner" || (section as any).accessRole === "editor") return true;
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

      await actions.updatePersonalLayout({ tabOrder: newTabs.map(t => t.id) });
      setDraggedTabId(null);
   };

   const hasSyncedRef = useRef<Record<string, boolean>>({});

   useEffect(() => {
      if (activeTabObj?.isReadOnlySync && activeTabObj?.id && !hasSyncedRef.current[activeTabObj.id]) {
         hasSyncedRef.current[activeTabObj.id] = true;
         actions.refreshSyncedWorkspace(activeTabObj.id).then(() => {
            router.refresh();
         });
      }
   }, [activeTabObj?.id, activeTabObj?.isReadOnlySync]);



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
         try {
            await actions.addSectionToTab(catalogSectionId, currentTabId, colIdx);
            router.refresh();
         } catch (err: any) {
            alert(err.message);
         }
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
   const effectivePrimaryColor = (activeTabObj?.theme?.primaryColor && activeTabObj.theme.primaryColor !== '')
      ? activeTabObj.theme.primaryColor
      : activeTheme.primaryColor;
   // Debug: console.log('Active tab:', activeTabObj?.title, 'theme:', activeTabObj?.theme?.primaryColor, 'effective:', effectivePrimaryColor);

   // Card Color: interpolate from pure primary → 90% black/white (sectionOpacity 0→1)
   // Use regex so it works whether hexToRgb returns "r, g, b" or "rgb(r, g, b)"
   const primRgbStr = hexToRgb(effectivePrimaryColor);
   const rgbNums = (primRgbStr.match(/\d+/g) || ['99', '102', '241']).slice(0, 3).map(Number);
   const [pr, pg, pb] = rgbNums;
   const targetRGB = isLight ? [230, 230, 230] : [25, 25, 25];
   const mixR = Math.round(pr + (targetRGB[0] - pr) * secOpac);
   const mixG = Math.round(pg + (targetRGB[1] - pg) * secOpac);
   const mixB = Math.round(pb + (targetRGB[2] - pb) * secOpac);

   // Card Opacity: 40% to 90% based on glassOpacity slider
   const cardAlpha = 0.4 + glsOpac * 0.5;

   const glassBg = `rgba(${mixR}, ${mixG}, ${mixB}, ${cardAlpha})`;
   const glassBorder = `rgba(${mixR}, ${mixG}, ${mixB}, ${Math.min(1, cardAlpha + 0.15)})`;

   const dynamicCSS = `
    :root, [data-theme='dark'], [data-theme='light'] {
      --primary: ${effectivePrimaryColor};
      --primary-rgb: ${hexToRgb(effectivePrimaryColor)};
      --primary-glow: rgba(${hexToRgb(effectivePrimaryColor)}, 0.5);
      --glass-bg: ${glassBg};
      --glass-border: ${glassBorder};
      --glass-blur: 0px;
      --glass-saturate: 100%;
      --bg-color: color-mix(in srgb, ${effectivePrimaryColor} ${isLight ? '8%' : '15%'}, ${isLight ? '#ffffff' : '#000000'});
      --modal-bg: ${isLight
         ? `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), rgba(${hexToRgb(effectivePrimaryColor)}, 0.1)`
         : `linear-gradient(rgba(10, 10, 10, 0.75), rgba(10, 10, 10, 0.75)), rgba(${hexToRgb(effectivePrimaryColor)}, 0.2)`};
    }
    .navbar {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(24px) saturate(150%);
      -webkit-backdrop-filter: blur(24px) saturate(150%);
      background: var(--glass-bg);
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
         <AmbientBackground theme={activeTheme} isLight={isLight} />

         {/* Impersonation Banner */}
         {impersonating && (
            <div style={{ position: 'sticky', top: 0, zIndex: 9998, background: 'linear-gradient(90deg, #f59e0b, #ef4444)', color: '#fff', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem', fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
               <span>👁 Viewing dashboard as: <strong>{impersonating.userName}</strong> — edit controls enabled</span>
               <button
                  onClick={async () => { await fetch('/api/admin/impersonate', { method: 'DELETE' }); window.location.href = '/admin/users'; }}
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '8px', padding: '0.3rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
               >
                  ✕ Exit Preview
               </button>
            </div>
         )}

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
                  {activeTab?.isReadOnlySync && (
                     <div style={{ padding: '0.2rem 0.5rem', background: 'rgba(var(--primary-rgb), 0.8)', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                        Imported
                     </div>
                  )}
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
                        <button onClick={() => signOut()} title="Sign Out" className="btn nav-menu-btn" style={{ background: isLight ? 'rgba(185, 28, 28, 0.1)' : 'rgba(239, 68, 68, 0.15)', color: isLight ? '#b91c1c' : '#ef4444', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
                           <LogOut size={18} /> <span className="mobile-menu-text">Sign Out</span>
                        </button>
                     </div>
                  ) : (
                     <button onClick={() => signIn("microsoft-entra-id")} className="btn btn-primary nav-menu-btn" style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        Sign In
                     </button>
                  )}

                  {/* Theme Settings moved down to Catalog button area */}

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

            {/* 2. Search Bar Row with inline Theme/Catalog buttons */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
               <div style={{ flex: 1, position: 'relative' }}>
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
               {showEditControls && canEditContent && hasTabEditAccess(activeTabObj) && (
                  <button
                     onClick={() => setIsThemeModalOpen(true)}
                     style={{
                        padding: '0.6rem 0.85rem',
                        background: effectivePrimaryColor,
                        border: '1px solid ' + effectivePrimaryColor,
                        borderRadius: '12px', cursor: 'pointer', color: '#fff', fontWeight: 700,
                        fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
                        boxShadow: '0 2px 10px ' + effectivePrimaryColor + '44',
                        transition: 'all 0.2s ease', whiteSpace: 'nowrap', flexShrink: 0
                     }}
                  >
                     <Palette size={14} /> Theme
                  </button>
               )}
               {showEditControls && (
                  <button
                     onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                     style={{
                        padding: '0.6rem 0.85rem',
                        background: catBtnBg,
                        border: '1px solid ' + effectivePrimaryColor,
                        borderRadius: '12px', cursor: 'pointer', color: '#fff', fontWeight: 700,
                        fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
                        boxShadow: '0 2px 10px ' + effectivePrimaryColor + '44',
                        transition: 'all 0.2s ease', whiteSpace: 'nowrap', flexShrink: 0
                     }}
                  >
                     <Library size={14} /> Catalog
                  </button>
               )}
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
                           draggable={showEditControls}
                           onDragStart={(e) => { if (showEditControls) { setDraggedTabId(tab.id); e.dataTransfer.effectAllowed = "move"; } }}
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
                              <div style={{ marginLeft: '0.25rem', display: 'flex', opacity: 0.5, cursor: 'pointer' }} title="Click to see who can edit this workspace" onClick={(e) => { e.stopPropagation(); setLockInfoTarget({ type: 'Workspace', title: tab.title, owners: tab.owners || [], editors: tab.editors || [] }); }}>
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
                                 {currentUserId && !adminBypass && (
                                    <span
                                       onClick={async (e) => {
                                          e.stopPropagation();
                                          if ((tab as any).isLocked) {
                                             alert("This workspace is locked by an administrator and cannot be removed.");
                                             return;
                                          }
                                          if (hasTabAdminAccess(tab)) {
                                             alert("You are the owner of this workspace. To remove it from your dashboard, please open workspace settings (the gear icon) and designate a new owner, or delete it entirely.");
                                             return;
                                          }
                                          if (confirm(`Remove "${tab.title}" from your dashboard?`)) {
                                             try {
                                                await actions.removeTabFromUser(tab.id);
                                                router.refresh();
                                             } catch (err: any) {
                                                alert(err.message);
                                             }
                                          }
                                       }}
                                       style={{ opacity: (tab as any).isLocked || hasTabAdminAccess(tab) ? 0.3 : 0.8, cursor: (tab as any).isLocked || hasTabAdminAccess(tab) ? 'not-allowed' : 'pointer', display: 'flex', color: (tab as any).isLocked ? 'var(--text)' : '#ef4444' }}
                                       title={(tab as any).isLocked ? "Workspace Locked" : (hasTabAdminAccess(tab) ? "Owners must designate a new owner to remove" : "Remove Workspace from Dashboard")}
                                    >
                                       <X size={14} />
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
                              padding: '0.75rem 1.25rem', background: 'rgba(var(--primary-rgb), 0.15)', border: '1px dashed var(--glass-border)', borderBottom: 'none',
                              cursor: 'pointer', borderRadius: '12px 12px 0 0', color: '#ffffff', opacity: 0.7, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
                              backdropFilter: 'blur(10px)'
                           }}
                        >
                           <Plus size={18} /> New Workspace
                        </button>
                     </div>
                  )}
               </div>
               {/* Catalog button / Cancel Drop Zone */}
               {showEditControls && draggedSectionId?.startsWith('catalogSection:') && (
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
                     <X size={18} /> Cancel Drop
                  </div>
               )}
            </div>
         )}

         {/* Main Content Area */}
         <div className="dashboard-main-content" style={{ flex: 1, padding: '1.5rem', boxSizing: 'border-box', maxWidth: '1600px', margin: '0 auto', width: '100%', overflowX: 'hidden' }}>
            {displayedTabs.map(tab => {
               const isShared = tab.isLibraryItem || tab.organization || (tab.allowedUsers && tab.allowedUsers.length > 0) || (tab.departmentAccess && tab.departmentAccess.length > 0);
               return (
                  <div key={tab.id} style={{ marginBottom: '2rem' }}>
                     {searchQuery.trim() && <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>From {tab.title}</h2>}

                     {isShared && showEditControls && (
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                           <Info size={18} style={{ flexShrink: 0 }} />
                           <span>
                              {hasTabEditAccess(tab) ?
                                 "This workspace is shared. Personal layout changes (dragging items) only affect you, but editing content (buttons/links) affects all users." :
                                 "This workspace is shared and locked. You do not have permission to rearrange or edit its contents."
                              }
                           </span>
                        </div>
                     )}

                     {/* Multi-column layout: columns are side-by-side, sections stack vertically within each column */}
                     <div
                        className="dashboard-grid"
                        style={{ '--desktop-cols': tab.columns || 3 } as React.CSSProperties}
                     >
                        {Array.from({ length: tab.columns || 3 }, (_, colIdx) => (
                           <div
                              key={colIdx}
                              style={{
                                 display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0,
                                 minHeight: '150px',
                                 background: dragOverColIdx === colIdx && !dragOverSectionId ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent',
                                 borderRadius: '16px',
                                 transition: 'all 0.2s',
                                 border: dragOverColIdx === colIdx && !dragOverSectionId ? '2px dashed var(--primary)' : '2px solid transparent'
                              }}
                              onDragOver={(e) => {
                                 if (!showEditControls) return;
                                 e.preventDefault();
                                 e.dataTransfer.dropEffect = draggedSectionId?.startsWith("catalogSection:") ? "copy" : "move";
                                 setDragOverColIdx(colIdx);
                              }}
                              onDragLeave={(e) => {
                                 if (!showEditControls) return;
                                 if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                    setDragOverColIdx(null);
                                 }
                              }}
                              onDrop={(e) => {
                                 if (!showEditControls) return;
                                 handleSectionDrop(e, undefined, tab.id, colIdx);
                              }}
                           >
                              {tab.sections
                                 .filter(s => (s.column ?? 0) === colIdx)
                                 .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                 .map(section => (
                                    <div
                                       key={section.id}
                                       draggable={showEditControls && hasTabEditAccess(tab)}
                                       onDragStart={(e) => { if (showEditControls && hasTabEditAccess(tab)) { setDraggedSectionId(section.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", section.id); e.stopPropagation(); } }}
                                       onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = draggedSectionId?.startsWith("catalogSection:") ? "copy" : "move"; e.stopPropagation(); setDragOverSectionId(section.id); }}
                                       onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverSectionId(null); } }}
                                       onDragEnd={() => { setDraggedSectionId(null); setDragOverSectionId(null); setDragOverColIdx(null); }}
                                       onDrop={(e) => { if (showEditControls && hasTabEditAccess(tab)) handleSectionDrop(e, section.id, tab.id, colIdx); }}
                                       style={{
                                          background: 'var(--glass-bg)', borderRadius: '16px',
                                          border: dragOverSectionId === section.id ? '2px dashed var(--primary)' : '1px solid var(--glass-border)',
                                          overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                          height: 'fit-content', minWidth: 0, width: '100%', boxSizing: 'border-box',
                                          opacity: draggedSectionId === section.id ? 0.45 : 1,
                                          cursor: showEditControls ? 'grab' : 'default',
                                          transform: dragOverSectionId === section.id ? 'scale(1.02)' : 'none',
                                          transition: 'all 0.2s'
                                       }}
                                    >
                                       {/* Section Header */}
                                       <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <div onClick={() => toggleSection(tab.id, section.id, section.defaultCollapsed)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                                             <div style={{ flexShrink: 0, display: 'flex' }}>
                                                {(collapsedSections[`${tab.id}_${section.id}`] ?? section.defaultCollapsed) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                             </div>
                                             <div style={{ flexShrink: 0, display: 'flex' }}>
                                                <IconComponent name={section.icon || "LayoutGrid"} size={18} />
                                             </div>
                                             <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto', minWidth: 0 }}>{section.title}</h3>
                                             {showEditControls && !hasSectionEditAccess(section, tab) && (
                                                <div style={{ display: 'flex', opacity: 0.5, flexShrink: 0, marginLeft: '0.5rem', cursor: 'pointer' }} title="Click to see who can edit" onClick={(e) => { e.stopPropagation(); setLockInfoTarget({ type: 'Section', title: section.title, owners: section.owners || [], editors: section.editors || [] }); }}>
                                                   <Lock size={14} />
                                                </div>
                                             )}
                                          </div>
                                          {showEditControls && (hasSectionEditAccess(section, tab) || hasTabEditAccess(tab)) && (
                                             <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                {hasSectionEditAccess(section, tab) && (
                                                   <>
                                                      <button onClick={() => { setEditingBookmark({} as any); setTargetSectionIdForBookmark(section.id); setModalMode("add"); setIsBookmarkModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}><Plus size={20} /></button>
                                                      <button onClick={() => { setEditingSection(section); setIsSectionModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}><Settings size={20} /></button>
                                                   </>
                                                )}
                                                {!hasSectionEditAccess(section, tab) && hasTabEditAccess(tab) && (
                                                   <button onClick={async () => { if (confirm('Remove this section from your workspace?')) { await actions.removeSectionFromTab(section.id, tab.id); window.location.reload(); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Remove Section"><Trash2 size={20} /></button>
                                                )}
                                             </div>
                                          )}
                                       </div>

                                       {/* Bookmarks */}
                                       {!(collapsedSections[`${tab.id}_${section.id}`] ?? section.defaultCollapsed) && (
                                          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowX: 'hidden', pointerEvents: draggedSectionId ? 'none' : 'auto' }}>
                                             {section.bookmarks.sort((a, b) => a.order - b.order).map(bookmark => (
                                                <div
                                                   key={bookmark.id}
                                                   draggable={showEditControls && hasTabEditAccess(tab)}
                                                   onDragStart={(e) => { if (showEditControls && hasTabEditAccess(tab)) { setDraggedBookmarkId(bookmark.id); setDraggedBookmarkSectionId(section.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", bookmark.id); e.stopPropagation(); } }}
                                                   onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setDragOverBookmarkId(bookmark.id); }}
                                                   onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverBookmarkId(null); }}
                                                   onDragEnd={() => { setDraggedBookmarkId(null); setDraggedBookmarkSectionId(null); setDragOverBookmarkId(null); }}
                                                   onDrop={(e) => { if (showEditControls && hasTabEditAccess(tab)) handleBookmarkDrop(e, bookmark.id, section.id); }}
                                                   style={{ position: 'relative', width: '100%', boxSizing: 'border-box', minWidth: 0, opacity: draggedBookmarkId === bookmark.id ? 0.45 : 1, borderTop: dragOverBookmarkId === bookmark.id ? '2px solid var(--primary)' : '2px solid transparent' }}
                                                >
                                                   <a href={showEditControls ? "#" : bookmark.url} target={showEditControls ? "_self" : (bookmark.openInNewTab !== false ? "_blank" : "_self")} style={{
                                                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderRadius: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0,
                                                      textDecoration: 'none', color: 'var(--text)', transition: 'background 0.2s', ...(!showEditControls ? { cursor: 'pointer' } : { cursor: 'grab' })
                                                   }}
                                                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(150,150,150,0.1)'}
                                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                      onClick={() => { if (!showEditControls) fetch('/api/track/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarkId: bookmark.id, bookmarkTitle: bookmark.title, bookmarkUrl: bookmark.url }) }).catch(() => { }); }}
                                                   >
                                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', flexShrink: 0 }}>
                                                         <IconComponent name={bookmark.icon} size={28} />
                                                      </div>
                                                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: '1 1 auto', minWidth: 0 }}>
                                                         <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{bookmark.title}</span>
                                                         {bookmark.description ? <span style={{ fontSize: '0.8rem', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{bookmark.description}</span> : null}
                                                      </div>
                                                   </a>
                                                   {showEditControls && hasSectionEditAccess(section, tab) && (
                                                      <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '0.25rem', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                         <button onClick={(e) => { e.preventDefault(); setEditingBookmark(bookmark); setModalMode("edit"); setIsBookmarkModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}><Edit2 size={14} /></button>
                                                         <button onClick={(e) => { e.preventDefault(); if (confirm('Delete app?')) actions.deleteBookmark(bookmark.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4444' }}><Trash2 size={14} /></button>
                                                      </div>
                                                   )}
                                                </div>
                                             ))}

                                          </div>
                                       )}
                                    </div>
                                 ))}

                              {/* Drop placeholder (ghost area) inside column when dragging */}
                              {draggedSectionId && dragOverColIdx === colIdx && !dragOverSectionId && (
                                 <div style={{ width: '100%', height: '80px', borderRadius: '16px', border: '2px dashed var(--primary)', background: 'rgba(var(--primary-rgb), 0.1)', transition: 'all 0.2s' }} />
                              )}

                              {/* Add Section inside column */}
                              {showEditControls && hasTabEditAccess(tab) && (
                                 <div
                                    onClick={() => { setEditingSection(null); setIsSectionModalOpen(true); }}
                                    style={{
                                       background: isLight
                                          ? `rgba(${hexToRgb(effectivePrimaryColor)}, 0.08)`
                                          : `rgba(${hexToRgb(effectivePrimaryColor)}, 0.12)`,
                                       borderRadius: '16px',
                                       border: isLight
                                          ? `2px dashed rgba(${hexToRgb(effectivePrimaryColor)}, 0.55)`
                                          : '2px dashed rgba(255, 255, 255, 0.3)',
                                       display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center', justifyContent: 'center',
                                       padding: '1.5rem', cursor: 'pointer', opacity: 0.85, transition: 'opacity 0.2s, transform 0.2s, background 0.2s',
                                       color: isLight ? 'var(--text)' : '#ffffff', marginTop: '0.5rem', boxShadow: isLight ? `0 2px 8px rgba(${hexToRgb(effectivePrimaryColor)}, 0.15)` : '0 4px 12px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1)'; }}
                                 >
                                    <Plus size={20} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Add Section</span>
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>


         {/* --- Modals --- */}
         {isCatalogOpen && (
            <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: draggedSectionId?.startsWith('catalogSection:') ? 'transparent' : 'rgba(0,0,0,0.35)', backdropFilter: draggedSectionId?.startsWith('catalogSection:') ? 'none' : 'blur(2px)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end', pointerEvents: draggedSectionId?.startsWith('catalogSection:') ? 'none' : 'auto', transition: 'all 0.3s ease' }}>
               <div className="glass modal-content slide-in-right" style={{ width: '100%', maxWidth: '400px', height: '100%', display: 'flex', flexDirection: 'column', background: drawerBg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderLeft: '1px solid ' + effectivePrimaryColor, pointerEvents: 'auto' }}>
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                     <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Library size={20} /> Public Catalog</h2>
                     <button onClick={() => setIsCatalogOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                  </div>

                  <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
                     <button
                        onClick={() => setCatalogTab("workspaces")}
                        style={{ flex: 1, padding: '1rem', background: catalogTab === "workspaces" ? 'transparent' : 'rgba(0,0,0,0.05)', border: 'none', borderBottom: catalogTab === "workspaces" ? '2px solid var(--primary)' : '2px solid transparent', color: catalogTab === "workspaces" ? 'var(--primary)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                     >
                        Workspaces
                     </button>
                     <button
                        onClick={() => setCatalogTab("sections")}
                        style={{ flex: 1, padding: '1rem', background: catalogTab === "sections" ? 'transparent' : 'rgba(0,0,0,0.05)', border: 'none', borderBottom: catalogTab === "sections" ? '2px solid var(--primary)' : '2px solid transparent', color: catalogTab === "sections" ? 'var(--primary)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                     >
                        Sections
                     </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        <input value={catalogSearchQuery} onChange={e => setCatalogSearchQuery(e.target.value)} placeholder="Search catalog..." className="glass" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }} />
                     </div>

                     {catalogTab === "workspaces" && (
                        libraryTabs.length === 0 ? <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '2rem' }}>No shared workspaces available.</div> :
                           libraryTabs
                              .filter(t => t.title.toLowerCase().includes(catalogSearchQuery.toLowerCase()))
                              .sort((a, b) => a.title.localeCompare(b.title))
                              .map(libTab => {
                              const isAdded = tabs.some(t => t.id === libTab.id);
                              return (
                                 <div key={libTab.id} className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: isAdded ? 0.5 : 1, background: 'rgba(var(--primary-rgb), 0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.1rem' }}>
                                       {libTab.icon && <IconComponent name={libTab.icon} size={18} />}
                                       {libTab.title}
                                       {libTab.isReadOnlySync && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'rgba(var(--primary-rgb), 0.8)', color: '#ffffff', border: 'none', borderRadius: '4px', marginLeft: 'auto', textTransform: 'uppercase', fontWeight: 800 }}>Imported</span>}
                                    </div>
                                    {libTab.description && <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{libTab.description}</div>}
                                    {isAdded ? (
                                       <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.05)', color: 'var(--text)', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', opacity: 0.7 }}>
                                          Already added to dashboard
                                       </div>
                                    ) : (
                                       <button
                                          onClick={async () => { await actions.importTabFromLibrary(libTab.id); router.refresh(); }}
                                          style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                       >
                                          <Plus size={16} /> Add to Dashboard
                                       </button>
                                    )}
                                 </div>
                              )
                           })
                     )}

                     {catalogTab === "sections" && (
                        librarySections.length === 0 ? <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '2rem' }}>No shared sections available.</div> :
                           librarySections
                              .filter(s => s.title.toLowerCase().includes(catalogSearchQuery.toLowerCase()))
                              .sort((a, b) => a.title.localeCompare(b.title))
                              .map(libSec => {
                              const activeTabObj = tabs.find(t => t.id === activeTabId);
                              const isAdded = activeTabObj?.sections?.some(s => s.id === libSec.id);
                              const canDrag = !isAdded && hasTabEditAccess(activeTabObj);
                              return (
                                 <div
                                    key={libSec.id}
                                    className="glass-card"
                                    draggable={canDrag}
                                    onDragStart={(e) => {
                                       if (!canDrag) { e.preventDefault(); return; }
                                       e.dataTransfer.effectAllowed = "all";
                                       e.dataTransfer.setData("text/plain", `catalogSection:${libSec.id}`);
                                       setDraggedSectionId(`catalogSection:${libSec.id}`);
                                       setTimeout(() => setIsCatalogOpen(false), 50);
                                    }}
                                    onDragEnd={() => setDraggedSectionId(null)}
                                    style={{ padding: '1.25rem', borderRadius: '12px', border: '1px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: canDrag ? 'grab' : 'default', opacity: isAdded ? 0.5 : (canDrag ? 1 : 0.7), background: canDrag ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.04)' }}
                                 >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem', color: 'var(--primary)' }}>
                                       {canDrag && <GripVertical size={16} style={{ opacity: 0.5 }} />}
                                       {libSec.icon && <IconComponent name={libSec.icon} size={16} />}
                                       {libSec.title}
                                       {libSec.isReadOnlySync && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'rgba(var(--primary-rgb), 0.8)', color: '#ffffff', border: 'none', borderRadius: '4px', marginLeft: 'auto', textTransform: 'uppercase', fontWeight: 800 }}>Imported</span>}
                                    </div>
                                    {libSec.description && (
                                       <div style={{ fontSize: '0.85rem', opacity: 0.7, paddingLeft: canDrag ? '1.5rem' : '0' }}>
                                          {libSec.description}
                                       </div>
                                    )}
                                    <div style={{ fontSize: '0.85rem', opacity: 0.5, paddingLeft: canDrag ? '1.5rem' : '0' }}>
                                       {isAdded ? "Already added to this workspace." : (!hasTabEditAccess(activeTabObj) ? "You need edit access to add sections to this workspace." : "Drag this card onto any column in your dashboard to insert it.")}
                                    </div>
                                 </div>
                              )
                           })
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
               isAdmin={isAdmin}
               currentUserId={currentUserId}
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
               allUsers={allUsers}
               currentUserId={currentUserId}
               isAdmin={isAdmin}
               onClose={() => setIsTabModalOpen(false)}
               onSaved={() => { setIsTabModalOpen(false); router.refresh(); }}
            />
         )}

         {/* Lock Info Popup */}
         {lockInfoTarget && (
            <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setLockInfoTarget(null)}>
               <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '420px', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                     <Lock size={18} style={{ opacity: 0.5 }} />
                     <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{lockInfoTarget.title}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Who can edit this {lockInfoTarget.type.toLowerCase()}</div>
                     </div>
                  </div>
                  <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {(() => {
                        const ownerIds = new Set(lockInfoTarget.owners.map((u: any) => u.id));
                        const editorIds = new Set(lockInfoTarget.editors.map((u: any) => u.id));
                        const extraAdmins = adminUsers.filter((u: any) => !ownerIds.has(u.id) && !editorIds.has(u.id));
                        const renderUser = (u: any, badge?: string) => (
                           <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 800 }}>
                                 {(u.name || u.email || "U").trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.name || u.email}</span>
                              {badge && <span style={{ fontSize: '0.55rem', fontWeight: 800, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '0.1rem 0.35rem', borderRadius: '4px', textTransform: 'uppercase' }}>{badge}</span>}
                           </div>
                        );
                        return (
                           <>
                              {lockInfoTarget.owners.length > 0 && (
                                 <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Owners</div>
                                    {lockInfoTarget.owners.map((u: any) => renderUser(u))}
                                 </div>
                              )}
                              {lockInfoTarget.editors.length > 0 && (
                                 <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Editors</div>
                                    {lockInfoTarget.editors.map((u: any) => renderUser(u))}
                                 </div>
                              )}
                              {extraAdmins.length > 0 && (
                                 <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Global Admins</div>
                                    {extraAdmins.map((u: any) => renderUser(u, 'Admin'))}
                                 </div>
                              )}
                              {lockInfoTarget.owners.length === 0 && lockInfoTarget.editors.length === 0 && extraAdmins.length === 0 && (
                                 <div style={{ opacity: 0.5, fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No specific users assigned. Contact an admin.</div>
                              )}
                           </>
                        );
                     })()}
                  </div>
                  <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
                     <button onClick={() => setLockInfoTarget(null)} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', borderRadius: '10px', fontWeight: 600 }}>Close</button>
                  </div>
               </div>
            </div>
         )}
         {/* Version Footer */}
         <div style={{ textAlign: 'center', padding: 'max(1rem, env(safe-area-inset-bottom))', opacity: 0.5, fontSize: '0.8rem', color: 'var(--text)', marginTop: 'auto' }}>
            v{require('../../package.json').version}
         </div>
      </main>
   );
}

// --- AMBIENT BACKGROUND SYSTEM ---
function AmbientBackground({ theme, isLight }: { theme?: Theme | null; isLight?: boolean }) {
   if (!theme) return null;
   const bgImg = (theme.backgroundColor && (theme.backgroundColor.startsWith('http') || theme.backgroundColor.startsWith('/') || theme.backgroundColor.startsWith('api') || theme.backgroundColor.startsWith('data:'))) ? theme.backgroundColor : null;
   // Use the live browser mode (not the saved theme.darkMode) so the wash
   // responds immediately when the user toggles light/dark mode.
   const isDark = isLight === undefined ? theme.darkMode : !isLight;

   return (
      <div style={{ position: 'fixed', top: '-100px', bottom: '-100px', left: 0, right: 0, zIndex: -1, overflow: 'hidden', background: 'var(--bg-base)', pointerEvents: 'none' }}>
         <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '80%', height: '80%', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 60%)', filter: 'blur(100px)', opacity: 0.8, animation: 'float 20s infinite alternate linear' }} />
         <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '70%', height: '70%', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 60%)', filter: 'blur(120px)', opacity: 0.6, animation: 'float 25s infinite alternate-reverse linear' }} />
         {bgImg && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${theme.backgroundBlur ?? 0}px)`, transform: 'scale(1.05)', opacity: 0.9 }} />}
         <div style={{ position: 'absolute', inset: 0, background: 'var(--primary)', opacity: bgImg ? (theme.backgroundTint ?? 0.6) : 0.08, mixBlendMode: isDark ? 'soft-light' : 'overlay' }} />
         <div style={{ position: 'absolute', inset: 0, background: isDark ? '#000' : '#fff', opacity: isDark ? (0.2 + 0.6 * ((theme as any).backgroundWash ?? 0.0)) : (0.2 + 0.3 * ((theme as any).backgroundWash ?? 0.0)) }} />
         <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`, pointerEvents: 'none' }} />
      </div>
   );
};
