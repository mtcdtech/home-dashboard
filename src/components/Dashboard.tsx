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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
   isReadOnlySync?: boolean;
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
   singleSectionColumns?: number[];
   isReadOnlySync?: boolean;
   departmentAccess?: any[];
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
   const [activeTabId, setActiveTabId] = useState<string>(() => {
      if (initialTabs.length > 0) {
         return initialTabs[0].id;
      }
      return "";
   });

   useEffect(() => {
      if (typeof window !== "undefined") {
         const urlParams = new URLSearchParams(window.location.search);
         const tabParam = urlParams.get('tab');
         if (tabParam && initialTabs.some((t: any) => t.id === tabParam)) {
            setActiveTabId(tabParam);
         }
      }
   }, []);

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
   
   const [searchEngine, setSearchEngine] = useState<string>("google");
   const searchInputRef = useRef<HTMLInputElement>(null);

   const [isCtrlPressed, setIsCtrlPressed] = useState(false);
   const [gridFocus, setGridFocus] = useState<{ sectionId: string, bookmarkId: string | null } | null>(null);
   const [isGridFocused, setIsGridFocused] = useState(false);
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.ctrlKey || e.metaKey) setIsCtrlPressed(true);

         // Capture typing for search
         if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && e.key !== ' ') {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
               searchInputRef.current?.focus();
            }
         }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
         if (!e.ctrlKey && !e.metaKey) setIsCtrlPressed(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
         window.removeEventListener('keyup', handleKeyUp);
      };
   }, []);

   const SEARCH_ENGINES = (globalSettings?.searchEngines as any[]) || [
      { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
      { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
      { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?q=' },
      { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=' }
   ];

   const URL_PATTERN = /^(https?:\/\/)?(localhost|(\d{1,3}\.){3}\d{1,3}|([\da-z\.-]+)\.([a-z\.]{2,6}))(:\d+)?([\/\w \.-]*)*\/?$/i;

   useEffect(() => {
      const savedEngine = localStorage.getItem("preferredSearchEngine");
      if (savedEngine) {
         setSearchEngine(savedEngine);
      }
      if (searchInputRef.current) {
         searchInputRef.current.focus();
      }
   }, []);

   const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

   useEffect(() => {
      setSearchSelectedIndex(0);
   }, [searchQuery]);

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
   const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
   const [bulkSelectedTags, setBulkSelectedTags] = useState<string[]>([]);
   const [isBulkSaving, setIsBulkSaving] = useState(false);
   const [selectedBookmarks, setSelectedBookmarks] = useState<string[]>([]);
   const [viewingBookmarkInfo, setViewingBookmarkInfo] = useState<any | null>(null);
   const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
   const [targetSectionIdForBookmark, setTargetSectionIdForBookmark] = useState<string>("");

   // Section Edit
   const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
   const [editingSection, setEditingSection] = useState<Section | null>(null);
   const [targetColumnForSection, setTargetColumnForSection] = useState<number>(0);

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
   const { theme, resolvedTheme, setTheme } = useTheme();

   useEffect(() => {
      setTabs(initialTabs);
      setActiveTabId((current) => {
         if (current && initialTabs.some(t => t.id === current)) {
            return current;
         }
         return initialTabs.length > 0 ? initialTabs[0].id : "";
      });
   }, [initialTabs]);

   const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
   const activeTheme = activeTab?.theme || baseActiveTheme;

   // Filter logic
   const filteredTabs = useMemo(() => {
      if (!searchQuery.trim()) return [activeTab].filter(Boolean) as Tab[];
      const sq = searchQuery.toLowerCase();
      return tabs.map(tab => {
         const matchedSections = tab.sections.map(section => {
            const matchedBookmarks = section.bookmarks.filter(b => 
               b.title.toLowerCase().includes(sq) || 
               (b.description || "").toLowerCase().includes(sq) || 
               (b.url || "").toLowerCase().includes(sq) || 
               (b.keywords || "").toLowerCase().includes(sq)
            );
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

   const flatMatchedBookmarks = useMemo(() => {
      if (!searchQuery.trim()) return [];
      const list: any[] = [];
      displayedTabs.forEach(tab => {
         const cols = tab.columns || 3;
         for (let colIdx = 0; colIdx < cols; colIdx++) {
            tab.sections
               .filter(s => (s.column ?? 0) === colIdx)
               .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
               .forEach(section => {
                  section.bookmarks
                     .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                     .forEach(b => {
                        list.push(b);
                     });
               });
         }
      });
      return list;
   }, [displayedTabs, searchQuery]);

   const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!searchQuery.trim()) return;

      const maxIndex = flatMatchedBookmarks.length;

      if (e.key === 'ArrowDown') {
         e.preventDefault();
         setSearchSelectedIndex(prev => (prev + 1) > maxIndex ? 0 : prev + 1);
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setSearchSelectedIndex(prev => (prev - 1) < 0 ? maxIndex : prev - 1);
      } else if (e.key === 'Enter') {
         e.preventDefault();
         const openUrl = (url: string) => {
            if (e.ctrlKey || e.metaKey) window.open(url, '_blank');
            else window.location.href = url;
         };
         
         if (searchSelectedIndex < maxIndex) {
            const b = flatMatchedBookmarks[searchSelectedIndex];
            fetch('/api/track/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarkId: b.id, bookmarkTitle: b.title, bookmarkUrl: b.url }) }).catch(() => { });
            openUrl(b.url);
         } else {
            const query = searchQuery.trim();
            if (URL_PATTERN.test(query)) {
               let targetUrl = query;
               if (!query.startsWith('http://') && !query.startsWith('https://')) {
                  targetUrl = 'https://' + query;
               }
               openUrl(targetUrl);
            } else {
               const engineObj = SEARCH_ENGINES.find(se => se.id === searchEngine) || SEARCH_ENGINES[0];
               const targetUrl = engineObj.url + encodeURIComponent(query);
               openUrl(targetUrl);
            }
         }
      }
   };

   const toggleSection = async (tabId: string, sectionId: string, defaultCollapsed: boolean = false) => {
      const key = `${tabId}_${sectionId}`;
      const newState = collapsedSections[key] === undefined ? !defaultCollapsed : !collapsedSections[key];
      
      const updates = { [key]: newState };
      
      const tab = tabs.find(t => t.id === tabId);
      if (tab && !newState && tab.singleSectionColumns) {
         const section = tab.sections.find(s => s.id === sectionId);
         if (section && tab.singleSectionColumns.includes(section.column || 0)) {
            // Collapse all other sections in this column
            tab.sections.forEach(s => {
               if ((s.column || 0) === (section.column || 0) && s.id !== sectionId) {
                  updates[`${tabId}_${s.id}`] = true;
               }
            });
         }
      }
      
      setCollapsedSections(prev => ({ ...prev, ...updates }));

      // Optimistically save personal preference if logged in
      if (currentUserId) {
         await actions.updatePersonalLayout({ tabId, sectionId, collapsed: newState });
      }
   };

   /*
    * iOS Safari + PWA safe-area background sync.
    *
    * iOS paints the Dynamic Island / status bar gutter and the bottom URL
    * bar / home-indicator gutter using the html element's background, and
    * tints the top status bar with <meta name="theme-color">. The html
    * background uses --bg-color (matches the body), but theme-color uses a
    * separate navTintHex that approximates the navbar's visible color
    * (glassBg over bgHex). In iOS Safari tab mode the top OS strip sits
    * outside the web view, so it can only follow theme-color — driving it
    * from the body color leaves the strip looking off versus the navbar
    * directly under it. This is duplicated logic by design — it has to
    * happen before the early-return guard for hooks-rules compliance, and
    * before --bg-color is rendered into the dynamic <style> tag.
    */
   const _activePrimary = (activeTab?.theme?.primaryColor && activeTab.theme.primaryColor !== '')
      ? activeTab.theme.primaryColor
      : activeTheme.primaryColor;
   const _isLightForBg = resolvedTheme === 'light';
   const _secOpac = activeTheme.sectionOpacity ?? 0.7;
   const _glsOpac = activeTheme.glassOpacity ?? 0.12;
   useEffect(() => {
      if (typeof document === 'undefined') return;
      const parse = (h: string) => {
         const c = (h || '').replace('#', '');
         if (c.length !== 6) return null;
         return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
      };
      const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
      const targetHex = _isLightForBg ? '#ffffff' : '#000000';
      const mixPct = _isLightForBg ? 0.08 : 0.15;
      let bgHex = _isLightForBg ? '#eef2f7' : '#050505';
      const p = parse(_activePrimary);
      const t = parse(targetHex);
      let bgRgb: [number, number, number] | null = null;
      if (p && t) {
         const r = Math.round(p[0] * mixPct + t[0] * (1 - mixPct));
         const g = Math.round(p[1] * mixPct + t[1] * (1 - mixPct));
         const b = Math.round(p[2] * mixPct + t[2] * (1 - mixPct));
         bgRgb = [r, g, b];
         bgHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
      /*
       * navTintHex approximates the visible color at the very top of the
       * page — the navbar (rgba `glassBg`) composited over `bgHex`. iOS
       * Safari (non-PWA) tints the URL/Dynamic-Island gutter from
       * <meta name="theme-color">, so the gutter looks correct only if
       * theme-color matches the navbar, not the body. Mirrors the
       * mixR/mixG/mixB + cardAlpha math in the render path.
       */
      let navTintHex = bgHex;
      if (p && bgRgb) {
         const targetRGBNav = _isLightForBg ? [230, 230, 230] : [25, 25, 25];
         const navR = p[0] + (targetRGBNav[0] - p[0]) * _secOpac;
         const navG = p[1] + (targetRGBNav[1] - p[1]) * _secOpac;
         const navB = p[2] + (targetRGBNav[2] - p[2]) * _secOpac;
         const cardAlpha = 0.4 + _glsOpac * 0.5;
         const r = navR * cardAlpha + bgRgb[0] * (1 - cardAlpha);
         const g = navG * cardAlpha + bgRgb[1] * (1 - cardAlpha);
         const b = navB * cardAlpha + bgRgb[2] * (1 - cardAlpha);
         navTintHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
      const root = document.documentElement;
      root.style.setProperty('--bg-color', bgHex);
      root.style.setProperty('--bg-base', bgHex);
      root.style.setProperty('--theme-color', navTintHex);
      root.style.backgroundColor = bgHex;
      /*
       * Do NOT set document.body.style.backgroundColor. An opaque body
       * background paints over the AmbientBackground (z-index:-1) and
       * hides the theme image. The <html> background above is enough
       * to tint the iOS safe-area gutters and act as the pre-image
       * fallback color.
       */
      if (document.body) document.body.style.backgroundColor = '';
      /*
       * Update *every* <meta name="theme-color">, including any with a
       * media= attribute, then ensure exactly one canonical unqualified
       * tag exists with the live color. iOS Safari picks the
       * media-matching tag first, so leaving an old media-qualified tag
       * with a stale color would freeze the Dynamic Island / status
       * strip at that color regardless of what the unqualified tag
       * says. (Caveat: in regular Safari tab mode the OS status bar is
       * outside the web view; theme-color is best-effort and the theme
       * image cannot be drawn into the OS status strip there. Only a
       * standalone PWA with apple-mobile-web-app-status-bar-style
       * black-translucent paints under that gutter.)
       */
      const allThemeMetas = document.querySelectorAll('meta[name="theme-color"]');
      allThemeMetas.forEach((m) => { (m as HTMLMetaElement).content = navTintHex; });
      const unqualified = Array.from(allThemeMetas).find(
         (m) => !(m as HTMLMetaElement).hasAttribute('media')
      ) as HTMLMetaElement | undefined;
      if (!unqualified) {
         const meta = document.createElement('meta');
         meta.name = 'theme-color';
         meta.content = navTintHex;
         document.head.appendChild(meta);
      }
   }, [_activePrimary, _isLightForBg, _secOpac, _glsOpac]);

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

   const isLight = resolvedTheme === 'light';
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

   // Plain-color fallback for the iOS safe-area / native chrome tint. We
   // can't rely on color-mix here (some iOS versions still have spotty
   // support inside the html element's painted safe-area), so compute an
   // approximate hex value in JS and apply it directly to documentElement
   // in the effect below.
   const safeAreaBgHex = (() => {
      const targetHex = isLight ? '#ffffff' : '#000000';
      const mixPct = isLight ? 0.08 : 0.15;
      const parse = (h: string) => {
         const c = h.replace('#', '');
         return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
      };
      try {
         const [pr, pg, pb] = parse(effectivePrimaryColor);
         const [tr, tg, tb] = parse(targetHex);
         const r = Math.round(pr * mixPct + tr * (1 - mixPct));
         const g = Math.round(pg * mixPct + tg * (1 - mixPct));
         const b = Math.round(pb * mixPct + tb * (1 - mixPct));
         const toHex = (n: number) => n.toString(16).padStart(2, '0');
         return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      } catch {
         return isLight ? '#eef2f7' : '#050505';
      }
   })();

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
      --bg-base: ${safeAreaBgHex};
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
    .search-help-text { display: block; }
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

    /*
     * iOS Safari paints the Dynamic Island / status bar gutter and the
     * bottom URL-bar / home-indicator gutter using the html element's
     * background color. Mirror the active theme onto html so those native
     * chrome regions tint to match the dashboard rather than rendering
     * black.
     *
     * IMPORTANT: do NOT set background-color on <body>. Body must stay
     * transparent so the AmbientBackground layer (position:fixed,
     * z-index:-1) is visible — an opaque body background paints in
     * front of negative-z-index children and hides the theme image.
     * The html background already provides the safe-area tint and the
     * pre-image fallback color.
     */
    html {
      background-color: var(--bg-color);
    }
    body {
      background-color: transparent;
    }
  `;

   const catBtnBg = isCatalogOpen ? effectivePrimaryColor : effectivePrimaryColor + 'CC';
   const drawerBg = `color-mix(in srgb, ${effectivePrimaryColor} 15%, ${isLight ? 'rgba(255,255,255,0.9)' : 'rgba(18,18,18,0.9)'})`;

   const sortedSections = activeTabObj ? [...activeTabObj.sections].sort((a, b) => {
      if (a.column !== b.column) return (a.column || 0) - (b.column || 0);
      return (a.order || 0) - (b.order || 0);
   }) : [];

   const handleGridKeyDown = (e: React.KeyboardEvent) => {
      if (!activeTabObj || sortedSections.length === 0) return;
      if (e.key === 'Tab' && !e.shiftKey) {
         e.preventDefault();
         searchInputRef.current?.focus();
         return;
      }
      if (!gridFocus) return;

      const currentSectionIndex = sortedSections.findIndex(s => s.id === gridFocus.sectionId);
      const currentSection = sortedSections[currentSectionIndex];
      
      if (e.key === 'ArrowRight') {
         e.preventDefault();
         const nextIndex = Math.min(currentSectionIndex + 1, sortedSections.length - 1);
         setGridFocus({ sectionId: sortedSections[nextIndex].id, bookmarkId: null });
      } else if (e.key === 'ArrowLeft') {
         e.preventDefault();
         const prevIndex = Math.max(currentSectionIndex - 1, 0);
         setGridFocus({ sectionId: sortedSections[prevIndex].id, bookmarkId: null });
      } else if (e.key === 'ArrowDown') {
         e.preventDefault();
         if (!currentSection) return;
         const sortedBookmarks = [...currentSection.bookmarks].sort((a, b) => a.order - b.order);
         const isCollapsed = searchQuery.trim() === "" ? (collapsedSections[`${activeTabObj.id}_${currentSection.id}`] ?? currentSection.defaultCollapsed) : false;
         if (sortedBookmarks.length === 0 || isCollapsed) return;
         
         if (gridFocus.bookmarkId === null) {
            setGridFocus({ sectionId: currentSection.id, bookmarkId: sortedBookmarks[0].id });
         } else {
            const bIdx = sortedBookmarks.findIndex(b => b.id === gridFocus.bookmarkId);
            if (bIdx >= 0 && bIdx < sortedBookmarks.length - 1) {
               setGridFocus({ sectionId: currentSection.id, bookmarkId: sortedBookmarks[bIdx + 1].id });
            }
         }
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         if (!currentSection) return;
         const sortedBookmarks = [...currentSection.bookmarks].sort((a, b) => a.order - b.order);
         if (gridFocus.bookmarkId !== null) {
            const bIdx = sortedBookmarks.findIndex(b => b.id === gridFocus.bookmarkId);
            if (bIdx > 0) {
               setGridFocus({ sectionId: currentSection.id, bookmarkId: sortedBookmarks[bIdx - 1].id });
            } else {
               setGridFocus({ sectionId: currentSection.id, bookmarkId: null });
            }
         }
      } else if (e.key === 'Enter' || e.key === ' ') {
         e.preventDefault();
         if (gridFocus.bookmarkId) {
            const b = currentSection?.bookmarks.find(b => b.id === gridFocus.bookmarkId);
            if (b) {
               fetch('/api/track/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarkId: b.id, bookmarkTitle: b.title, bookmarkUrl: b.url }) }).catch(() => { });
               if (b.openInNewTab !== false) window.open(b.url, '_blank');
               else window.location.href = b.url;
            }
         } else {
            if (currentSection) {
               toggleSection(activeTabObj.id, currentSection.id, currentSection.defaultCollapsed);
            }
         }
      }
   };

   const handleTabsKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
         e.preventDefault();
         const currentIndex = tabs.findIndex(t => t.id === activeTabId);
         if (currentIndex === -1) return;
         let newIndex = currentIndex;
         if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % tabs.length;
         if (e.key === 'ArrowLeft') newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
         setActiveTabId(tabs[newIndex].id);
         setTimeout(() => {
            const btn = document.getElementById(`workspace-tab-${tabs[newIndex].id}`);
            btn?.focus();
         }, 0);
      }
   };

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
                     <img src={resolvedTheme === "light" ? globalSettings.logoUrlLight : (globalSettings.logoUrlDark || globalSettings.logoUrlLight)} alt="Logo" className="nav-logo" style={{ height: '42px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
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
                     <button className="nav-menu-btn" title="Toggle Edit Mode" onClick={() => { setShowEditControls(!showEditControls); setSelectedBookmarks([]); }} style={{ background: showEditControls ? 'var(--primary)' : 'transparent', color: showEditControls ? 'white' : 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', marginLeft: '0.25rem' }}>
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
                  <button className="nav-menu-btn" title="Toggle Theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                     {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} <span className="mobile-menu-text">Toggle Dark Mode</span>
                  </button>
               </div>
            </div>

            {/* 2. Search Bar Row with inline Theme/Catalog buttons */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
               <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                     <Search size={18} />
                  </div>
                  <input
                     ref={searchInputRef}
                     autoFocus
                     type="text"
                     className="search-input"
                     placeholder="Search apps, or web / paste URL..."
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     onKeyDown={handleSearchKeyDown}
                     style={{
                        width: '100%', paddingTop: '0.7rem', paddingBottom: '0.7rem', paddingRight: '14rem', paddingLeft: '2.8rem',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '999px',
                        color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                        transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
                     }}
                  />
                  {searchQuery.trim() !== "" && (
                     <button
                        tabIndex={-1}
                        title={searchSelectedIndex < flatMatchedBookmarks.length ? `Open ${flatMatchedBookmarks[searchSelectedIndex].title}` : undefined}
                        onClick={(e) => {
                           const isCtrl = e.ctrlKey || e.metaKey || isCtrlPressed;
                           const openUrl = (url: string) => {
                              if (isCtrl) window.open(url, '_blank');
                              else window.location.href = url;
                           };
                           if (searchSelectedIndex < flatMatchedBookmarks.length) {
                              const b = flatMatchedBookmarks[searchSelectedIndex];
                              fetch('/api/track/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarkId: b.id, bookmarkTitle: b.title, bookmarkUrl: b.url }) }).catch(() => { });
                              openUrl(b.url);
                           } else {
                              const query = searchQuery.trim();
                              if (URL_PATTERN.test(query)) {
                                 let targetUrl = query;
                                 if (!query.startsWith('http://') && !query.startsWith('https://')) {
                                    targetUrl = 'https://' + query;
                                 }
                                 openUrl(targetUrl);
                              } else {
                                 const engineObj = SEARCH_ENGINES.find(se => se.id === searchEngine) || SEARCH_ENGINES[0];
                                 const targetUrl = engineObj.url + encodeURIComponent(query);
                                 openUrl(targetUrl);
                              }
                           }
                        }}
                        style={{
                           position: 'absolute', right: '7.5rem', top: '50%', transform: 'translateY(-50%)',
                           fontSize: '0.75rem', whiteSpace: 'nowrap', fontWeight: 600,
                           padding: '0.35rem 0.6rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--primary)',
                           background: 'var(--primary)',
                           color: '#fff',
                           transition: 'all 0.2s ease',
                           maxWidth: '260px',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis'
                        }}
                     >
                        {searchSelectedIndex < flatMatchedBookmarks.length 
                           ? `Open: ${flatMatchedBookmarks[searchSelectedIndex].title} ${isCtrlPressed ? '(new window)' : '⏎'}`
                           : (URL_PATTERN.test(searchQuery.trim()) 
                              ? (isCtrlPressed ? 'Visit URL (in new window)' : 'Visit URL (press Ctrl for new window)') 
                              : (isCtrlPressed ? 'Web Search (in new window)' : 'Web Search in Current Window (hold Ctrl for new window)'))}
                     </button>
                  )}
                  <select
                     value={searchEngine}
                     onChange={(e) => {
                        setSearchEngine(e.target.value);
                        localStorage.setItem("preferredSearchEngine", e.target.value);
                     }}
                     onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary)'; e.currentTarget.style.borderRadius = '4px'; }}
                     onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                     style={{
                        position: 'absolute',
                        right: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        color: 'var(--text)',
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.85rem',
                        opacity: 0.7,
                        cursor: 'pointer'
                     }}
                  >
                     {SEARCH_ENGINES.map(engine => (
                        <option key={engine.id} value={engine.id} style={{ background: 'var(--bg-color)', color: 'var(--text)' }}>
                           {engine.name}
                        </option>
                     ))}
                  </select>
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
               <div className="tabs-inner" onKeyDown={handleTabsKeyDown} style={{ display: 'flex', padding: '1.2rem 1.5rem 0 1.5rem', gap: '0.2rem', maxWidth: activeTabObj ? `${Math.max(1600, activeTabObj.columns * 400)}px` : '1600px', margin: '0 auto', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                  {tabs.map(tab => {
                     const tabPrimary = tab.theme?.primaryColor || baseActiveTheme.primaryColor;
                     const isActiveTab = activeTabId === tab.id;
                     const isDragOver = dragOverTabId === tab.id;
                     return (
                        <button
                           id={`workspace-tab-${tab.id}`}
                           tabIndex={isActiveTab ? 0 : -1}
                           key={tab.id}
                           className="workspace-tab-btn"
                           onClick={() => setActiveTabId(tab.id)}
                           draggable={showEditControls}
                           onDragStart={(e) => { if (!showEditControls) { e.preventDefault(); return; } setDraggedTabId(tab.id); e.dataTransfer.effectAllowed = "move"; }}
                           onDragOver={(e) => { if (!showEditControls) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTabId(tab.id); }}
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
         <div 
            className="dashboard-main-content" 
            tabIndex={0}
            onFocus={() => {
               setIsGridFocused(true);
               if (!gridFocus && sortedSections.length > 0) {
                  setGridFocus({ sectionId: sortedSections[0].id, bookmarkId: null });
               }
            }}
            onBlur={(e) => {
               if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsGridFocused(false);
               }
            }}
            onKeyDown={handleGridKeyDown}
            style={{ flex: 1, padding: '1.5rem', boxSizing: 'border-box', maxWidth: activeTabObj ? `${Math.max(1600, activeTabObj.columns * 400)}px` : '1600px', margin: '0 auto', width: '100%', overflowX: 'hidden', outline: 'none' }}
         >
            {(() => {
               let bookmarkRenderIndex = 0;
               return displayedTabs.map(tab => {
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
                        {Array.from({ length: tab.columns || 3 }, (_, colIdx) => {
                           const sectionsInCol = tab.sections.filter(s => (s.column ?? 0) === colIdx);
                           if (searchQuery.trim() !== "" && sectionsInCol.length === 0) return null;
                           
                           return (
                           <div
                              key={colIdx}
                              style={{
                                 display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0,
                                 minHeight: showEditControls ? '150px' : 'auto',
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
                              {showEditControls && hasTabEditAccess(tab) && (
                                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.25rem', paddingRight: '0.5rem', color: 'var(--text)', opacity: 0.8, fontSize: '0.8rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                       <input 
                                          type="checkbox" 
                                          checked={tab.singleSectionColumns?.includes(colIdx) || false}
                                          onChange={async (e) => {
                                             const enabled = e.target.checked;
                                             await actions.toggleSingleSectionColumn(tab.id, colIdx, enabled);
                                             
                                             // Optimistically update UI
                                             const newCols = enabled 
                                                ? [...(tab.singleSectionColumns || []), colIdx] 
                                                : (tab.singleSectionColumns || []).filter(c => c !== colIdx);
                                                
                                             setTabs(prev => prev.map(t => {
                                                if (t.id === tab.id) {
                                                   const newTab = { ...t, singleSectionColumns: newCols };
                                                   // Auto collapse logic locally
                                                   if (enabled) {
                                                      const sectionsInCol = t.sections.filter(s => s.column === colIdx).sort((a, b) => (a.order || 0) - (b.order || 0));
                                                      if (sectionsInCol.length > 0) {
                                                         const firstId = sectionsInCol[0].id;
                                                         newTab.sections = t.sections.map(s => {
                                                            if (s.column === colIdx) {
                                                               return { ...s, defaultCollapsed: s.id !== firstId };
                                                            }
                                                            return s;
                                                         });
                                                      }
                                                   }
                                                   return newTab;
                                                }
                                                return t;
                                             }));
                                          }}
                                       />
                                       Single section open
                                    </label>
                                 </div>
                              )}
                              {sectionsInCol
                                 .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                 .map(section => {
                                    const isSectionFocused = isGridFocused && gridFocus?.sectionId === section.id;
                                    return (
                                    <div
                                       key={section.id}
                                       draggable={showEditControls && hasTabEditAccess(tab)}
                                       onDragStart={(e) => { if (!(showEditControls && hasTabEditAccess(tab))) { e.preventDefault(); return; } setDraggedSectionId(section.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", section.id); e.stopPropagation(); }}
                                       onDragOver={(e) => { if (!(showEditControls && hasTabEditAccess(tab))) return; e.preventDefault(); e.dataTransfer.dropEffect = draggedSectionId?.startsWith("catalogSection:") ? "copy" : "move"; e.stopPropagation(); setDragOverSectionId(section.id); }}
                                       onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverSectionId(null); } }}
                                       onDragEnd={() => { setDraggedSectionId(null); setDragOverSectionId(null); setDragOverColIdx(null); }}
                                       onDrop={(e) => { if (showEditControls && hasTabEditAccess(tab)) handleSectionDrop(e, section.id, tab.id, colIdx); }}
                                       style={{
                                          background: 'var(--glass-bg)', borderRadius: '16px',
                                          border: isSectionFocused ? '2px solid var(--primary)' : (dragOverSectionId === section.id ? '2px dashed var(--primary)' : '1px solid var(--glass-border)'),
                                          boxShadow: isSectionFocused ? '0 0 10px rgba(var(--primary-rgb), 0.3)' : 'none',
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
                                          <div 
                                             onClick={() => toggleSection(tab.id, section.id, section.defaultCollapsed)} 
                                             tabIndex={0}
                                             onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                   e.preventDefault();
                                                   toggleSection(tab.id, section.id, section.defaultCollapsed);
                                                }
                                             }}
                                             style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1, minWidth: 0, outline: 'none' }}
                                          >
                                             <div style={{ flexShrink: 0, display: 'flex' }}>
                                                {(searchQuery.trim() === "" ? (collapsedSections[`${tab.id}_${section.id}`] ?? section.defaultCollapsed) : false) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
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
                                       {!(searchQuery.trim() === "" ? (collapsedSections[`${tab.id}_${section.id}`] ?? section.defaultCollapsed) : false) && (
                                          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowX: 'hidden', pointerEvents: draggedSectionId ? 'none' : 'auto' }}>
                                             {section.bookmarks.sort((a, b) => a.order - b.order).map(bookmark => {
                                                const isBookmarkFocused = isGridFocused && gridFocus?.sectionId === section.id && gridFocus?.bookmarkId === bookmark.id;
                                                const isHighlighted = (searchQuery.trim() !== "" && bookmarkRenderIndex === searchSelectedIndex) || isBookmarkFocused;
                                                const currentBookmarkIndex = bookmarkRenderIndex++;
                                                return (
                                                <div
                                                   key={bookmark.id}
                                                   draggable={showEditControls && hasTabEditAccess(tab)}
                                                   onDragStart={(e) => { if (!(showEditControls && hasTabEditAccess(tab))) { e.preventDefault(); return; } setDraggedBookmarkId(bookmark.id); setDraggedBookmarkSectionId(section.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", bookmark.id); e.stopPropagation(); }}
                                                   onDragOver={(e) => { if (!(showEditControls && hasTabEditAccess(tab))) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setDragOverBookmarkId(bookmark.id); }}
                                                   onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverBookmarkId(null); }}
                                                   onDragEnd={() => { setDraggedBookmarkId(null); setDraggedBookmarkSectionId(null); setDragOverBookmarkId(null); }}
                                                   onDrop={(e) => { if (showEditControls && hasTabEditAccess(tab)) handleBookmarkDrop(e, bookmark.id, section.id); }}
                                                   style={{ position: 'relative', width: '100%', boxSizing: 'border-box', minWidth: 0, opacity: draggedBookmarkId === bookmark.id ? 0.45 : 1, borderTop: dragOverBookmarkId === bookmark.id ? '2px solid var(--primary)' : '2px solid transparent' }}
                                                >
                                                   <a href={showEditControls ? "#" : bookmark.url} target={showEditControls || searchQuery.trim() !== "" ? "_self" : (bookmark.openInNewTab !== false ? "_blank" : "_self")} style={{
                                                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderRadius: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0,
                                                      textDecoration: 'none', color: 'var(--text)', transition: 'background 0.2s', ...(!showEditControls ? { cursor: 'pointer' } : { cursor: 'grab' }),
                                                      background: isHighlighted ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                                                      border: isHighlighted ? '1px solid rgba(var(--primary-rgb), 0.5)' : '1px solid transparent'
                                                   }}
                                                      onMouseEnter={e => {
                                                         if (searchQuery.trim() === "") {
                                                            e.currentTarget.style.background = 'rgba(150,150,150,0.1)';
                                                         }
                                                         setSearchSelectedIndex(currentBookmarkIndex);
                                                      }}
                                                      onMouseLeave={e => {
                                                         if (!isHighlighted) e.currentTarget.style.background = 'transparent';
                                                      }}
                                                      onClick={(e) => {
                                                         if (showEditControls && hasSectionEditAccess(section, tab)) {
                                                            e.preventDefault();
                                                            setEditingBookmark(bookmark); setModalMode("edit"); setIsBookmarkModalOpen(true);
                                                         } else if (!showEditControls) {
                                                            fetch('/api/track/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarkId: bookmark.id, bookmarkTitle: bookmark.title, bookmarkUrl: bookmark.url }) }).catch(() => { });
                                                         }
                                                      }}
                                                   >
                                                      <div 
                                                         style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', flexShrink: 0, position: 'relative', cursor: showEditControls ? 'pointer' : 'default' }}
                                                         onClick={(e) => {
                                                            if (showEditControls && hasSectionEditAccess(section, tab)) {
                                                               e.preventDefault();
                                                               e.stopPropagation();
                                                               setSelectedBookmarks(prev => prev.includes(bookmark.id) ? prev.filter(id => id !== bookmark.id) : [...prev, bookmark.id]);
                                                            }
                                                         }}
                                                      >
                                                         {showEditControls && selectedBookmarks.includes(bookmark.id) ? (
                                                            <div style={{ position: 'absolute', inset: 0, background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                                               <Check size={20} />
                                                            </div>
                                                         ) : (
                                                            <IconComponent name={bookmark.icon} size={28} />
                                                         )}
                                                      </div>
                                                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: '1 1 auto', minWidth: 0 }}>
                                                         <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{bookmark.title}</span>
                                                         {bookmark.description ? <span style={{ fontSize: '0.8rem', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{bookmark.description}</span> : null}
                                                      </div>
                                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 'auto', flexShrink: 0, alignSelf: 'stretch', gap: '0.25rem', marginRight: (showEditControls && hasSectionEditAccess(section, tab)) ? '3.5rem' : '0' }}>
                                                         {!showEditControls && bookmark.longDescription ? (
                                                            <button 
                                                               onClick={(e) => {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  setViewingBookmarkInfo(bookmark);
                                                               }}
                                                               onMouseEnter={e => {
                                                                  e.currentTarget.style.opacity = '1';
                                                                  e.currentTarget.style.background = 'rgba(128,128,128,0.2)';
                                                               }}
                                                               onMouseLeave={e => {
                                                                  e.currentTarget.style.opacity = '0.5';
                                                                  e.currentTarget.style.background = 'none';
                                                               }}
                                                               style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5, padding: '0.2rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', marginTop: '-0.2rem', marginRight: '-0.2rem' }}
                                                            >
                                                               <Info size={16} />
                                                            </button>
                                                         ) : <div />}
                                                         {bookmark.tags && bookmark.tags.length > 0 && globalSettings?.customTags && (
                                                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginTop: 'auto' }}>
                                                               {bookmark.tags.map((tagId: string) => {
                                                                  const tagDef = (globalSettings.customTags as any[]).find(t => t.id === tagId);
                                                                  if (!tagDef) return null;
                                                                  return (
                                                                     <span key={tagId} title={tagDef.description || tagDef.text || ""} style={{ background: tagDef.opacity !== undefined ? `rgba(${hexToRgb(tagDef.color)}, ${tagDef.opacity})` : tagDef.color, color: getContrastYIQ(tagDef.color), fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {tagDef.icon ? <IconComponent name={tagDef.icon} size={12} /> : tagDef.text}
                                                                     </span>
                                                                  );
                                                               })}
                                                            </div>
                                                         )}
                                                      </div>
                                                   </a>
                                                   {showEditControls && hasSectionEditAccess(section, tab) && (
                                                      <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '0.25rem', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                                         <button onClick={(e) => { e.preventDefault(); if (confirm('Delete app?')) actions.deleteBookmark(bookmark.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4444' }}><Trash2 size={14} /></button>
                                                      </div>
                                                   )}
                                                </div>
                                             ); })}

                                          </div>
                                       )}
                                    </div>
                                 ); })}

                              {/* Drop placeholder (ghost area) inside column when dragging */}
                              {draggedSectionId && dragOverColIdx === colIdx && !dragOverSectionId && (
                                 <div style={{ width: '100%', height: '80px', borderRadius: '16px', border: '2px dashed var(--primary)', background: 'rgba(var(--primary-rgb), 0.1)', transition: 'all 0.2s' }} />
                              )}

                              {/* Add Section inside column */}
                              {showEditControls && hasTabEditAccess(tab) && (
                                 <div
                                    onClick={() => { setEditingSection(null); setTargetColumnForSection(colIdx); setIsSectionModalOpen(true); }}
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
                           );
                        })}
                     </div>
                  </div>
               );
            });
            })()}
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
               globalTags={(globalSettings?.customTags as any[]) || []}
            />
         )}

         {/* Section Modal */}
         {isSectionModalOpen && (
            <SectionModal
               section={editingSection}
               targetTabId={activeTab?.id}
               targetColumn={targetColumnForSection}
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
         
         {/* More Info Modal */}
         {viewingBookmarkInfo && (
            <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setViewingBookmarkInfo(null)}>
               <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '600px', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Info size={18} style={{ color: 'var(--primary)' }} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{viewingBookmarkInfo.title}</div>
                     </div>
                     <button onClick={() => setViewingBookmarkInfo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                  </div>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', lineHeight: '1.6', fontSize: '0.95rem' }} className="markdown-body">
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {viewingBookmarkInfo.longDescription}
                     </ReactMarkdown>
                  </div>
               </div>
            </div>
         )}
         
         {/* Bulk Tag Floating Bar */}
         {showEditControls && selectedBookmarks.length > 0 && (
            <div className="fade-in" style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', padding: '0.75rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(var(--primary-rgb), 0.3)', display: 'flex', gap: '1rem', alignItems: 'center', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
               <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedBookmarks.length} selected</span>
               <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)' }} />
               <button onClick={() => setIsBulkTagModalOpen(true)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem' }}>Apply Tags</button>
               <button onClick={() => setSelectedBookmarks([])} className="btn" style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'transparent', border: 'none', color: '#ff4444', fontSize: '0.85rem', fontWeight: 600 }}>Clear</button>
            </div>
         )}
         
         {/* Bulk Tag Modal */}
         {isBulkTagModalOpen && (
            <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
               <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '500px', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Apply Tags to {selectedBookmarks.length} apps</h2>
                     <button onClick={() => { setIsBulkTagModalOpen(false); setBulkSelectedTags([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                  </div>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {globalSettings?.customTags && (globalSettings.customTags as any[]).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                           {(globalSettings.customTags as any[]).map(tag => {
                              const isSelected = bulkSelectedTags.includes(tag.id);
                              return (
                                 <button
                                    key={tag.id}
                                    title={tag.description || tag.text || ""}
                                    type="button"
                                    onClick={() => {
                                       if (isSelected) {
                                          setBulkSelectedTags(bulkSelectedTags.filter(id => id !== tag.id));
                                       } else {
                                          setBulkSelectedTags([...bulkSelectedTags, tag.id]);
                                       }
                                    }}
                                    style={{
                                       background: tag.opacity !== undefined ? `rgba(${hexToRgb(tag.color)}, ${tag.opacity})` : tag.color,
                                       color: getContrastYIQ(tag.color),
                                       fontSize: '0.65rem',
                                       padding: '0.25rem 0.5rem',
                                       borderRadius: '4px',
                                       fontWeight: 600,
                                       textTransform: 'uppercase',
                                       whiteSpace: 'nowrap',
                                       display: 'flex',
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       border: isSelected ? `1px solid ${getContrastYIQ(tag.color)}` : '1px solid transparent',
                                       cursor: 'pointer',
                                       transition: 'all 0.2s ease',
                                       opacity: isSelected ? 1 : 0.4,
                                       transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                                    }}
                                 >
                                    {tag.icon ? <IconComponent name={tag.icon} size={14} /> : tag.text}
                                 </button>
                              );
                           })}
                        </div>
                     ) : (
                        <div style={{ opacity: 0.5, fontStyle: 'italic' }}>No custom tags defined in Admin portal.</div>
                     )}
                  </div>
                  <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(var(--primary-rgb), 0.03)' }}>
                     <button onClick={() => { setIsBulkTagModalOpen(false); setBulkSelectedTags([]); }} className="btn" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancel</button>
                     <button 
                        onClick={async () => {
                           setIsBulkSaving(true);
                           try {
                              for (const id of selectedBookmarks) {
                                 await actions.updateBookmark(id, { tags: bulkSelectedTags });
                              }
                              setSelectedBookmarks([]);
                              setIsBulkTagModalOpen(false);
                              setBulkSelectedTags([]);
                              router.refresh();
                           } catch (e) {
                              console.error(e);
                           }
                           setIsBulkSaving(false);
                        }} 
                        disabled={isBulkSaving} 
                        className="btn btn-primary" 
                        style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600, opacity: isBulkSaving ? 0.5 : 1 }}
                     >
                        {isBulkSaving ? "Saving..." : "Apply"}
                     </button>
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

   /*
    * iOS Safari + viewport-fit=cover safe-area:
    * - Use explicit top:0/left:0 with width:100vw and height:100lvh
    *   (largest viewport) so the layer reliably fills the visible area
    *   on every browser. Earlier iterations used implicit height via
    *   negative top/bottom offsets, which iOS Safari sometimes resolved
    *   to zero, collapsing the image element and leaving only the html
    *   background showing through. The html background already tints
    *   the iOS Dynamic Island / home-indicator gutters (set in
    *   globals.css and synced via documentElement.style on theme
    *   change), so the ambient layer does not need to overscan to cover
    *   safe areas — the gutters are handled at the html level.
    * - The container background is transparent so it does NOT flatten
    *   the image painted by the children.
    * - The image is rendered as the FIRST child when present, with the
    *   solid backstop only as a no-image fallback. Putting the backstop
    *   above the image (DOM order) used to cover it in some Safari
    *   compositing paths; restricting backstop to the no-image case
    *   avoids that ambiguity and guarantees the image paints on top of
    *   the radial glows.
    */
   return (
      <div className="ambient-background-layer" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100lvh', zIndex: -1, overflow: 'hidden', background: bgImg ? 'transparent' : 'var(--bg-base)', pointerEvents: 'none' }}>
         <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '80%', height: '80%', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 60%)', filter: 'blur(100px)', opacity: 0.8, animation: 'float 20s infinite alternate linear' }} />
         <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '70%', height: '70%', background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 60%)', filter: 'blur(120px)', opacity: 0.6, animation: 'float 25s infinite alternate-reverse linear' }} />
         {bgImg && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${theme.backgroundBlur ?? 0}px)`, transform: 'scale(1.05)', opacity: 0.9 }} />}
         <div style={{ position: 'absolute', inset: 0, background: 'var(--primary)', opacity: bgImg ? (theme.backgroundTint ?? 0.6) : 0.08, mixBlendMode: isDark ? 'soft-light' : 'overlay' }} />
         <div style={{ position: 'absolute', inset: 0, background: isDark ? '#000' : '#fff', opacity: isDark ? (0.2 + 0.6 * ((theme as any).backgroundWashBlack ?? (theme as any).backgroundWash ?? 0.0)) : (0.0 + 0.8 * ((theme as any).backgroundWashWhite ?? (theme as any).backgroundWash ?? 0.0)) }} />
         <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`, pointerEvents: 'none' }} />
      </div>
   );
};
