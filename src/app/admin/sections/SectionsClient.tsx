"use client";

import React, { useState } from "react";
import { IconComponent, IconPicker } from "@/components/IconPicker";
import { getIconRegistry } from "@/lib/iconRegistry";
import * as actions from "@/app/admin/actions";
import {
   LayoutGrid,
   TableProperties,
   Check,
   ChevronDown,
   ChevronRight,
   Zap,
   Users,
   Info,
   Bookmark,
   Building2,
   Library,
   Plus,
   Trash2,
   Search,
   Settings,
   X,
   ShieldCheck,
   ArrowDownLeft,
   Eye,
   Edit3,
   Globe,
   Send
} from "lucide-react";

interface Section {
   id: string;
   title: string;
   icon: string;
   organization: string;
   isGlobal: boolean;
   isLibraryItem: boolean;
   isReadOnlySync?: boolean;
   description?: string;
   tabSections: { tabId: string; sectionId: string }[];
   bookmarks: any[];
   allowedUsers?: any[];
   editors?: any[];
   owners?: any[];
   departmentAccess?: any[];
}

interface Tab {
   id: string;
   title: string;
   icon: string;
   pushRules?: any[];
   tabSections?: { sectionId: string }[];
}

export default function SectionsClient({
   initialSections,
   tabs,
   users,
   departments,
   themes
}: {
   initialSections: Section[],
   tabs: Tab[],
   users: any[],
   departments: string[],
   themes: any[]
}) {
   const activeTheme = themes.find((t: any) => t.isActive);
   const themeTintColor = activeTheme?.tintColor || '#be123c';

   const [sections, setSections] = useState<Section[]>(initialSections.filter(s => !s.isReadOnlySync));

   function getContrastText(hexcolor: string) {
      if (!hexcolor || hexcolor.length < 7) return '#fff';
      const r = parseInt(hexcolor.substring(1, 3), 16);
      const g = parseInt(hexcolor.substring(3, 5), 16);
      const b = parseInt(hexcolor.substring(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? 'var(--text)' : '#fff';
   }

   const ownerTextColor = getContrastText(activeTheme?.primaryColor || themeTintColor);

   // Check if a section is pushed to a given target via its parent workspace push rules
   function getSectionPushInfo(section: Section, targetType: string, targetId?: string): { pushed: boolean; viaTab?: string } {
      for (const tab of tabs) {
         const sectionInTab = tab.tabSections?.some(ts => ts.sectionId === section.id);
         if (!sectionInTab) continue;
         const matchingRule = tab.pushRules?.find(r => {
            if (r.targetType !== targetType) return false;
            if (targetType === 'global') return true;
            if (targetType === 'department') return (r.targetId || '').toLowerCase().trim() === (targetId || '').toLowerCase().trim();
            if (targetType === 'user') return r.targetId === targetId;
            return false;
         });
         if (matchingRule) return { pushed: true, viaTab: tab.title };
      }
      return { pushed: false };
   }

   const [viewMode, setViewMode] = useState<"grid" | "matrix">("grid");
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
   const [collapsedDepts, setCollapsedDepts] = useState<string[]>([]);
   const [modifiedDepts, setModifiedDepts] = useState<Record<string, string>>({}); // key: dept_sectionId, value: newRole
   const [editingSection, setEditingSection] = useState<Section | null>(null);
   const [searchQuery, setSearchQuery] = useState("");
   const [hidePrivate, setHidePrivate] = useState(false);
   const [iconRegistry, setIconRegistry] = useState<string[]>([]);
   const [iconPickerQuery, setIconPickerQuery] = useState("");

   // Form State
   const [title, setTitle] = useState("");
   const [icon, setIcon] = useState("");
   const [organization, setOrganization] = useState("");
   const [isGlobal, setIsGlobal] = useState(true);
   const [isLibraryItem, setIsLibraryItem] = useState(false);
   const [description, setDescription] = useState("");
   const [pushDept, setPushDept] = useState("");

   React.useEffect(() => {
      getIconRegistry().then(setIconRegistry);
   }, []);

   const toggleTab = async (sectionId: string, tabId: string, isAssigned: boolean) => {
      setSections((prev: Section[]) => prev.map((s: Section) => {
         if (s.id === sectionId) {
            const newTabSections = isAssigned
               ? [...(s.tabSections || []), { tabId, sectionId }]
               : (s.tabSections || []).filter((ts: any) => ts.tabId !== tabId);
            return { ...s, tabSections: newTabSections };
         }
         return s;
      }));
      await actions.toggleSectionInTab(tabId, sectionId, isAssigned);
   };

   const toggleCatalog = async (section: any) => {
      const newStatus = !section.isLibraryItem;
      setSections(prev => prev.map(s => s.id === section.id ? { ...s, isLibraryItem: newStatus } : s));
      await actions.updateSection(section.id, { isLibraryItem: newStatus });
   };

   const openAdd = () => {
      setEditingSection(null);
      setTitle("");
      setIcon("");
      setOrganization("");
      setIsGlobal(true);
      setIsLibraryItem(false);
      setDescription("");
      setPushDept("");
      setIsModalOpen(true);
   };

   const openEdit = (section: any) => {
      setEditingSection(section);
      setTitle(section.title);
      setIcon(section.icon || "");
      setOrganization(section.organization || "");
      setIsGlobal(section.isGlobal);
      setIsLibraryItem(section.isLibraryItem ?? false);
      setDescription(section.description || "");
      setPushDept("");
      setIsModalOpen(true);
   };

   const save = async () => {
      if (!title) return;
      const data = { title, icon, organization, isGlobal, isLibraryItem, description };
      if (editingSection) {
         await (actions as any).updateSection(editingSection.id, data);
      } else {
         await (actions as any).createSection(data);
      }
      window.location.reload();
   };

   const filtered = sections.filter((s: any) => s.title.toLowerCase().includes(searchQuery.toLowerCase()) && s.isLibraryItem);

   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
         <div className="admin-top-bar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="glass" style={{ display: 'flex', padding: '0.4rem', borderRadius: '16px', gap: '0.4rem' }}>
               <button
                  onClick={() => setViewMode("grid")}
                  className={viewMode === "grid" ? "btn btn-primary" : "btn"}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', gap: '0.5rem', background: viewMode === "grid" ? 'var(--primary)' : 'transparent', color: viewMode === "grid" ? '#fff' : 'inherit' }}
               >
                  <LayoutGrid size={18} />
                  Section Manager
               </button>
               <button
                  onClick={() => setViewMode("matrix")}
                  className={viewMode === "matrix" ? "btn btn-primary" : "btn"}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', gap: '0.5rem', background: viewMode === "matrix" ? 'var(--primary)' : 'transparent', color: viewMode === "matrix" ? '#fff' : 'inherit' }}
               >
                  <TableProperties size={18} />
                  Access Manager
               </button>
            </div>

            {viewMode === "grid" && (
               <div className="glass" style={{ flex: 1, position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                  <input
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search sections..."
                     className="glass"
                     style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: 'none' }}
                  />
               </div>
            )}
            {viewMode === "matrix" && <div style={{ flex: 1 }} />}

            <button onClick={openAdd} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, display: 'flex', gap: '0.5rem' }}>
               <Plus size={18} /> New Section
            </button>
         </div>

         {viewMode === "matrix" ? (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div className="glass" style={{ padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Legend:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', border: '1px solid var(--primary)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Owner:</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Full Control</span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.15)', border: '1px solid rgba(var(--primary-rgb), 0.3)' }} />
                           <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Editor:</span>
                           <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Can manage bookmarks</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }} />
                           <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Viewer:</span>
                           <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Can see section</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="glass" style={{ padding: '0', borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: Math.max(800, filtered.length * 160 + 300) + 'px' }}>
                     <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
                        <tr>
                           <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', width: '1%', whiteSpace: 'nowrap' }}>
                              Sections
                           </th>
                           {filtered.map((section: any) => (
                              <th key={section.id} style={{ padding: '0.75rem 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center', width: '150px' }}>
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    <IconComponent name={section.icon} size={14} />
                                    {section.title}
                                 </div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {/* Catalog Toggle Row */}
                        <tr style={{ background: 'rgba(var(--primary-rgb), 0.08)', borderBottom: '2px solid var(--primary)' }}>
                           <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                 <div style={{ width: 16 }} />
                                 <div style={{ padding: '0.4rem', borderRadius: '8px', background: '#10b981', display: 'flex', color: '#fff' }}><Library size={14} /></div>
                                 <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981' }}>In Catalog</span>
                              </div>
                           </td>
                           {filtered.map((section: any) => (
                              <td key={section.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                 <button onClick={async () => {
                                    const newVal = !section.isLibraryItem;
                                    if (!newVal && !window.confirm("Are you sure you want to remove this from the catalog? Only the creator will be able to see it or add it back.")) return;

                                    const newGlobal = newVal ? section.isGlobal : false;
                                    setSections((prev: any[]) => prev.map((s: any) => s.id === section.id ? { ...s, isLibraryItem: newVal, isGlobal: newGlobal } : s));
                                    await actions.updateSection(section.id, { ...section, isLibraryItem: newVal, isGlobal: newGlobal });
                                 }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: section.isLibraryItem ? '1px solid #10b981' : '1px solid rgba(var(--primary-rgb), 0.2)', background: section.isLibraryItem ? 'rgba(16,185,129,0.15)' : 'rgba(var(--primary-rgb), 0.05)', color: section.isLibraryItem ? '#10b981' : 'var(--text)', cursor: "pointer", fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                    {section.isLibraryItem ? '✓ CATALOG' : 'PRIVATE'}
                                 </button>
                              </td>
                           ))}
                        </tr>

                        {/* Entire Org Toggle Row */}
                        <tr style={{ background: 'rgba(var(--primary-rgb), 0.04)', borderBottom: '1px solid var(--glass-border)' }}>
                           <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                 <div style={{ width: 16 }} />
                                 <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', color: 'var(--primary)' }}><Globe size={14} /></div>
                                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>Entire Org</span>
                                 </div>
                              </div>
                           </td>
                           {filtered.map((section: any) => (
                              <td key={section.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                 {section.isLibraryItem ? (
                                    <button onClick={async () => {
                                       const newVal = !section.isGlobal;
                                       setSections((prev: any[]) => prev.map((s: any) => s.id === section.id ? { ...s, isGlobal: newVal } : s));
                                       await actions.updateSection(section.id, { ...section, isGlobal: newVal });
                                    }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: section.isGlobal ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)', background: section.isGlobal ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--primary-rgb), 0.05)', color: section.isGlobal ? 'var(--primary)' : 'var(--text)', cursor: "pointer", fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                       {section.isGlobal ? '✓ ALLOWED' : 'RESTRICTED'}
                                    </button>
                                 ) : (
                                    <div style={{ fontSize: '0.65rem', opacity: 0.3, textTransform: 'uppercase', fontWeight: 800 }}>N/A</div>
                                 )}
                              </td>
                           ))}
                        </tr>

                        {departments.map((dept: string) => {
                           const deptUsers = users.filter((u: any) => (u.dashboardGroup || "General") === dept);
                           if (deptUsers.length === 0) return null;

                           return (
                              <React.Fragment key={dept}>
                                 <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <button
                                             onClick={() => {
                                                setCollapsedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
                                             }}
                                             style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                                          >
                                             {collapsedDepts.includes(dept) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                          </button>
                                          <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.08)', display: 'flex', color: 'inherit' }}>
                                             <Users size={14} style={{ opacity: 0.5 }} />
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                             <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, color: 'inherit' }}>{dept}</span>
                                             <div className="tooltip-container" style={{ position: 'relative', display: 'flex' }}>
                                                <Info size={12} style={{ opacity: 0.3, cursor: 'help' }} />
                                                <div className="tooltip-bubble" style={{
                                                   position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-8px)',
                                                   background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px',
                                                   fontSize: '0.65rem', whiteSpace: 'nowrap', zIndex: 10, visibility: 'hidden', opacity: 0,
                                                   transition: '0.2s all', border: '1px solid var(--glass-border)'
                                                }}>
                                                   Changing this updates permissions for all members in this group.
                                                </div>
                                             </div>
                                          </div>
                                       </div>
                                    </td>
                                    {filtered.map((section: any) => {
                                       const stagingRole = modifiedDepts[`${dept}_${section.id}`];
                                       const savedRole = section.departmentAccess?.find((da: any) => da.department === dept)?.role || "none";
                                       const displayRole = stagingRole !== undefined ? stagingRole : savedRole;
                                       const isEntireOrg = section.isGlobal;
                                       const pushInfo = isEntireOrg
                                          ? getSectionPushInfo(section, 'global')
                                          : getSectionPushInfo(section, 'department', dept);
                                       const globalPush = !isEntireOrg ? getSectionPushInfo(section, 'global') : { pushed: false };
                                       const isPushedDept = pushInfo.pushed || globalPush.pushed;
                                       const pushViaTabDept = pushInfo.viaTab || globalPush.viaTab;
                                       const isITGroup = dept === "IT";
                                       const effectiveRole = isITGroup ? 'owner' : ((isPushedDept && displayRole === 'none') ? 'viewer' : displayRole);

                                       return (
                                          <td key={section.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                             <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.4rem', width: 'max-content', margin: '0 auto' }}>
                                                <div style={{
                                                   flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', padding: '0.4rem 0.5rem', minHeight: '34px', minWidth: '130px',
                                                   background: effectiveRole === 'owner' ? 'var(--primary)' : (effectiveRole === 'none' || effectiveRole === 'viewer' ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(var(--primary-rgb), 0.12)'),
                                                   border: effectiveRole === 'owner' ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)',
                                                   display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                   <div style={{
                                                      position: 'absolute', pointerEvents: 'none',
                                                      color: effectiveRole === 'owner' ? ownerTextColor : 'var(--text)',
                                                      fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap',
                                                      zIndex: 1
                                                   }}>
                                                      {effectiveRole === 'owner' ? 'OWNER (DEPT)' : effectiveRole === 'editor' ? 'EDITOR (DEPT)' : effectiveRole === 'viewer' ? 'VIEWER (DEPT)' : 'NOT SHARED'}
                                                   </div>
                                                   <select
                                                      value={effectiveRole}
                                                      onChange={async (e) => {
                                                         const newRole = e.target.value;
                                                         setModifiedDepts(prev => ({ ...prev, [`${dept}_${section.id}`]: newRole }));
                                                      }}
                                                      disabled={isITGroup}
                                                      style={{
                                                         width: '100%', opacity: 0, cursor: isITGroup ? 'not-allowed' : 'pointer', height: '100%',
                                                         position: 'absolute', inset: 0, zIndex: 2
                                                      }}
                                                   >
                                                      <option value="none" disabled={isPushedDept || isITGroup}>Not Shared</option>
                                                      <option value="owner">Owner (Dept)</option>
                                                      <option value="editor" disabled={isITGroup}>Editor (Dept)</option>
                                                      <option value="viewer" disabled={isITGroup}>Viewer (Dept)</option>
                                                   </select>
                                                </div>
                                                {modifiedDepts[`${dept}_${section.id}`] && (
                                                   <button
                                                      type="button"
                                                      onClick={async (e) => {
                                                         e.preventDefault();
                                                         e.stopPropagation();
                                                         const role = modifiedDepts[`${dept}_${section.id}`];

                                                         // Filter out admins for bulk operations to match server logic
                                                         const targetUsers = deptUsers.filter((u: any) => !u.isAdmin);
                                                         const targetUserIds = targetUsers.map((u: any) => u.id);

                                                         // 1. Immediate Deep Optimistic Update
                                                         setSections((prev: any[]) => prev.map((s: any) => {
                                                            if (s.id !== section.id) return s;
                                                            const otherAccess = (s.departmentAccess || []).filter((da: any) => da.department !== dept);
                                                            const filterOut = (arr: any[]) => (arr || []).filter((u: any) => !targetUserIds.includes(u.id));

                                                            return {
                                                               ...s,
                                                               departmentAccess: role === "none" ? otherAccess : [...otherAccess, { department: dept, role }],
                                                               owners: role === "owner" ? [...filterOut(s.owners), ...targetUsers] : filterOut(s.owners),
                                                               editors: role === "editor" ? [...filterOut(s.editors), ...targetUsers] : filterOut(s.editors),
                                                               allowedUsers: role === "viewer" ? [...filterOut(s.allowedUsers), ...targetUsers] : filterOut(s.allowedUsers)
                                                            };
                                                         }));

                                                         // 2. Clear staging
                                                         setModifiedDepts(prev => {
                                                            const next = { ...prev };
                                                            delete next[`${dept}_${section.id}`];
                                                            return next;
                                                         });

                                                         // 3. Fire server request
                                                         try {
                                                            await actions.bulkApplyDeptSectionRole(section.id, dept, role);
                                                         } catch (err) {
                                                            console.error("Zap sync failed:", err);
                                                         }
                                                      }}
                                                      className="btn btn-primary"
                                                      title="Apply Selection to All Members"
                                                      style={{
                                                         padding: '0.4rem',
                                                         borderRadius: '8px',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         justifyContent: 'center',
                                                         transition: 'all 0.2s',
                                                         position: 'relative',
                                                         zIndex: 100,
                                                         pointerEvents: 'auto',
                                                         cursor: 'pointer'
                                                      }}
                                                      onMouseEnter={(e) => e.currentTarget.style.background = themeTintColor}
                                                      onMouseLeave={(e) => e.currentTarget.style.background = ''}
                                                   >
                                                      <Zap size={14} />
                                                   </button>
                                                )}
                                                {isPushedDept && (
                                                   <div className="tooltip-container" style={{ position: 'relative', display: 'flex' }}>
                                                      <a
                                                         href="/admin/tabs"
                                                         style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '24px', height: '24px', flexShrink: 0,
                                                            color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)',
                                                            borderRadius: '6px',
                                                            border: '1px solid rgba(34, 197, 94, 0.25)',
                                                            cursor: 'pointer', textDecoration: 'none'
                                                         }}
                                                      >
                                                         <Send size={10} />
                                                      </a>
                                                      <div className="tooltip-bubble" style={{
                                                         position: 'absolute', bottom: '100%', right: 0, transform: 'translateY(-8px)',
                                                         background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px',
                                                         fontSize: '0.65rem', width: 'max-content', zIndex: 10, visibility: 'hidden', opacity: 0,
                                                         transition: '0.2s all', border: '1px solid var(--glass-border)', textAlign: 'left', whiteSpace: 'normal', maxWidth: '200px'
                                                      }}>
                                                         Pushed via "{pushViaTabDept}" workspace &mdash; click to manage in Push Manager
                                                      </div>
                                                   </div>
                                                )}
                                             </div>
                                          </td>
                                       );
                                    })}
                                 </tr>

                                 {!collapsedDepts.includes(dept) && deptUsers.map((user: any) => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} className="hover-row">
                                       <td style={{ width: '1%', whiteSpace: 'nowrap', padding: '1rem 1.25rem 1rem 2.5rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                             <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: user.avatarColor || 'var(--primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontSize: '0.75rem', fontWeight: 800,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                             }}>
                                                {(user.name || user.email || "U").trim().split(/\s+/).map((n: any) => n[0]).join('').toUpperCase().slice(0, 2)}
                                             </div>
                                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                   <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{user.name || "Anonymous User"}</span>
                                                   {user.isAdmin && (
                                                      <span style={{ fontSize: '0.6rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 800 }}>Admin</span>
                                                   )}
                                                </div>
                                                <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>{user.email}</span>
                                             </div>
                                          </div>
                                       </td>
                                       {filtered.map((section: any) => {
                                          const isOwner = section.owners?.some((o: any) => o.id === user.id);
                                          const isEditor = section.editors?.some((e: any) => e.id === user.id);
                                          const isViewer = section.allowedUsers?.some((a: any) => a.id === user.id);
                                          const isBlocked = section.blockedUsers?.some((b: any) => b.id === user.id);

                                          let inheritedRoleFromTabs = 'none';
                                          const userPushDirect = getSectionPushInfo(section, 'user', user.id);
                                          const userDept = user.dashboardGroup || "General";
                                          const userPushDept = getSectionPushInfo(section, 'department', userDept);
                                          const userPushGlobal = getSectionPushInfo(section, 'global');

                                          if (userPushDirect.pushed || userPushDept.pushed || userPushGlobal.pushed) {
                                             inheritedRoleFromTabs = 'viewer';
                                          } else {
                                             const hasTabAccess = section.tabSections?.some((ts: any) => {
                                                const parentTab = tabs.find(t => t.id === ts.tabId);
                                                if (!parentTab) return false;
                                                return parentTab.owners?.some((o: any) => o.id === user.id) ||
                                                       parentTab.editors?.some((e: any) => e.id === user.id) ||
                                                       parentTab.allowedUsers?.some((a: any) => a.id === user.id);
                                             });
                                             if (hasTabAccess) inheritedRoleFromTabs = 'viewer';
                                          }

                                          const role = isOwner ? "owner" : isEditor ? "editor" : isViewer ? "viewer" : (isBlocked ? "none" : (inheritedRoleFromTabs !== 'none' ? 'inherited' : 'none'));
                                          let effectiveRole = user.isAdmin ? "owner" : (role === "inherited" ? inheritedRoleFromTabs : role);

                                          return (
                                             <td key={section.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: '150px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.5rem', width: 'max-content', margin: '0 auto' }}>
                                                   <div
                                                      className="glass"
                                                      style={{
                                                         width: '100%', position: 'relative', borderRadius: '10px', overflow: 'hidden', minHeight: '34px', minWidth: '130px',
                                                         border: effectiveRole === "owner" ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)',
                                                         background: user.isAdmin
                                                            ? 'repeating-linear-gradient(45deg, rgba(var(--primary-rgb), 0.25), rgba(var(--primary-rgb), 0.25) 10px, rgba(var(--primary-rgb), 0.35) 10px, rgba(var(--primary-rgb), 0.35) 20px)'
                                                            : (effectiveRole === "owner" ? 'var(--primary)' : effectiveRole === "editor" ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.05)'),
                                                         display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                      }}
                                                   >
                                                      <div style={{
                                                         position: 'absolute', pointerEvents: 'none',
                                                         color: (effectiveRole === "owner" && !user.isAdmin) ? ownerTextColor : 'var(--text)',
                                                         fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap',
                                                         zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.35rem'
                                                      }}>
                                                         {user.isAdmin ? <><ShieldCheck size={11} strokeWidth={3} /> OWNER (ADMIN)</> : (
                                                            role === 'inherited'
                                                               ? <><ArrowDownLeft size={11} strokeWidth={3} /> INHERITED (VIEWER)</>
                                                               : (
                                                                  effectiveRole === 'none' ? <><X size={11} strokeWidth={3} /> NOT SHARED</> :
                                                                     effectiveRole === 'owner' ? <><ShieldCheck size={11} strokeWidth={3} /> OWNER</> :
                                                                        effectiveRole === 'editor' ? <><Edit3 size={11} strokeWidth={3} /> EDITOR</> :
                                                                           <><Eye size={11} strokeWidth={3} /> VIEWER</>
                                                               )
                                                         )}
                                                      </div>
                                                      <select
                                                         disabled={user.isAdmin}
                                                         value={role}
                                                         onChange={async (e) => {
                                                            const newRole = e.target.value;
                                                            // 1. Immediate Deep Optimistic Update
                                                            setSections((prev: any[]) => prev.map((s: any) => {
                                                               if (s.id !== section.id) return s;
                                                               return {
                                                                  ...s,
                                                                  owners: newRole === "owner" ? [...(s.owners || []).filter((o: any) => o.id !== user.id), user] : (s.owners || []).filter((o: any) => o.id !== user.id),
                                                                  editors: newRole === "editor" ? [...(s.editors || []).filter((e: any) => e.id !== user.id), user] : (s.editors || []).filter((e: any) => e.id !== user.id),
                                                                  allowedUsers: newRole === "viewer" ? [...(s.allowedUsers || []).filter((a: any) => a.id !== user.id), user] : (s.allowedUsers || []).filter((a: any) => a.id !== user.id),
                                                                  blockedUsers: newRole === "none" ? [...(s.blockedUsers || []).filter((b: any) => b.id !== user.id), user] : (s.blockedUsers || []).filter((b: any) => b.id !== user.id)
                                                               };
                                                            }));
                                                            // 2. Fire server request
                                                            try {
                                                               await actions.updateSectionUserRole(section.id, user.id, newRole);
                                                            } catch (err) {
                                                               console.error("Section user update failed:", err);
                                                            }
                                                         }}
                                                         style={{
                                                            width: '100%', opacity: 0, cursor: user.isAdmin ? 'default' : 'pointer', height: '100%',
                                                            position: 'absolute', inset: 0, zIndex: 2
                                                         }}
                                                      >
                                                         {user.isAdmin ? <option value="owner">Owner (Admin)</option> : (
                                                            <>
                                                               {inheritedRoleFromTabs !== 'none' && <option value="inherited">Inherited (Viewer)</option>}
                                                               <option value="viewer">Viewer</option>
                                                               <option value="editor">Editor</option>
                                                               <option value="owner">Owner</option>
                                                               <option value="none">Not Shared</option>
                                                            </>
                                                         )}
                                                      </select>
                                                   </div>
                                                   {user.isAdmin && (
                                                      <div className="tooltip-container" style={{ position: 'relative', display: 'flex' }}>
                                                         <Info size={14} style={{ opacity: 0.3, cursor: 'help' }} />
                                                         <div className="tooltip-bubble" style={{
                                                            position: 'absolute', bottom: '100%', right: 0, transform: 'translateY(-8px)',
                                                            background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px',
                                                            fontSize: '0.65rem', width: '180px', zIndex: 10, visibility: 'hidden', opacity: 0,
                                                            transition: '0.2s all', border: '1px solid var(--glass-border)', textAlign: 'left'
                                                         }}>
                                                            Global admins are automatically given ownership over all workspaces and sections.
                                                         </div>
                                                      </div>
                                                   )}
                                                   {isPushedUser && (
                                                      <div className="tooltip-container" style={{ position: 'relative', display: 'flex' }}>
                                                         <a
                                                            href="/admin/tabs"
                                                            style={{
                                                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                               width: '24px', height: '24px', flexShrink: 0,
                                                               color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)',
                                                               borderRadius: '6px',
                                                               border: '1px solid rgba(34, 197, 94, 0.25)',
                                                               cursor: 'pointer', textDecoration: 'none'
                                                            }}
                                                         >
                                                            <Send size={10} />
                                                         </a>
                                                         <div className="tooltip-bubble" style={{
                                                            position: 'absolute', bottom: '100%', right: 0, transform: 'translateY(-8px)',
                                                            background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px',
                                                            fontSize: '0.65rem', width: 'max-content', zIndex: 10, visibility: 'hidden', opacity: 0,
                                                            transition: '0.2s all', border: '1px solid var(--glass-border)', textAlign: 'left', whiteSpace: 'normal', maxWidth: '200px'
                                                         }}>
                                                            Pushed via "{pushViaTabUser}" workspace &mdash; click to manage in Push Manager
                                                         </div>
                                                      </div>
                                                   )}
                                                </div>
                                             </td>
                                          );
                                       })}
                                    </tr>
                                 ))}
                              </React.Fragment>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>
         ) : (
            <div className="glass" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'rgba(var(--primary-rgb), 0.05)' }}>
                     <tr>
                        <th style={{ padding: '1.25rem 2rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Section Name</th>
                        <th style={{ padding: '1.25rem 2rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, textAlign: 'center' }}>Catalog</th>
                        {tabs.map((tab: any) => (
                           <th key={tab.id} style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                 <IconComponent name={tab.icon} size={16} />
                                 <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{tab.title}</span>
                              </div>
                           </th>
                        ))}
                        <th style={{ padding: '1.25rem 2rem', textAlign: 'right' }}></th>
                     </tr>
                  </thead>
                  <tbody>
                     {filtered.map((section: any) => (
                        <tr key={section.id} style={{ borderTop: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                           <td style={{ padding: '1.25rem 2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                 <div className="glass" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--primary-rgb), 0.08)' }}>
                                    <IconComponent name={section.icon} size={20} />
                                 </div>
                                 <div>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                       {section.title}
                                       {section.isReadOnlySync && (
                                          <span style={{ fontSize: '0.6rem', color: '#10b981', background: 'rgba(16,185,129,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>Imported</span>
                                       )}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.4, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Bookmark size={10} /> {section.bookmarks.length} Bookmarks</span>
                                 </div>
                                 <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginTop: "0.4rem" }}>
                                    <span style={{ fontSize: "0.6rem", opacity: 0.5, fontWeight: 600 }}>Created by {section.owners?.[0]?.name || "System"} • {section.createdAt ? new Date(section.createdAt).toLocaleDateString() : "Unknown"}</span>
                                    <span style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: 500 }}>Last updated: {section.updatedAt ? new Date(section.updatedAt).toLocaleDateString() : "Unknown"}</span>
                                 </div>
                              </div>
                           </td>

                           <td style={{ padding: '1.25rem 2rem', textAlign: 'center' }}>
                              <button
                                 onClick={() => toggleCatalog(section)}
                                 className="btn"
                                 style={{
                                    padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
                                    background: section.isLibraryItem ? 'rgba(74, 222, 128, 0.1)' : 'rgba(var(--primary-rgb), 0.06)',
                                    color: section.isLibraryItem ? '#4ade80' : 'rgba(255,255,255,0.2)',
                                    border: section.isLibraryItem ? '1px solid #4ade80' : '1px solid transparent',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                                 }}
                              >
                                 <Library size={12} />
                                 {section.isLibraryItem ? "Public" : "Private"}
                              </button>
                           </td>
                           {tabs.map((tab: any) => {
                              const isAssigned = (section.tabSections || []).some((ts: any) => ts.tabId === tab.id);
                              return (
                                 <td key={tab.id} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                    <div
                                       onClick={() => toggleTab(section.id, tab.id, !isAssigned)}
                                       style={{
                                          width: '24px', height: '24px', borderRadius: '6px',
                                          margin: '0 auto',
                                          background: isAssigned ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.06)',
                                          border: '1px solid var(--glass-border)',
                                          cursor: 'pointer',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                                          color: 'white'
                                       }}
                                    >
                                       {isAssigned && <Check size={14} strokeWidth={3} />}
                                    </div>
                                 </td>
                              );
                           })}
                           <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                              {section.isReadOnlySync ? (
                                 <button disabled className="btn" style={{ padding: '0.5rem', borderRadius: '8px', opacity: 0.2, cursor: 'not-allowed' }} title="Imported (Locked)"><Settings size={18} /></button>
                              ) : (
                                 <button onClick={() => openEdit(section)} className="btn" style={{ padding: '0.5rem', borderRadius: '8px', opacity: 0.5 }}><Settings size={18} /></button>
                              )}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}

         {isModalOpen && (
            <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
               <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingSection ? `Configure ${editingSection.title}` : "Create New Section"}</h2>
                     <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                  </div>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                     <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Section Settings</label>
                        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Section Name (e.g. Media Management)" className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem 0.8rem', borderRadius: '12px', border: `1px solid ${isLibraryItem ? 'var(--primary)' : 'var(--glass-border)'}`, background: isLibraryItem ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent', transition: 'all 0.2s ease' }}>
                           <input type="checkbox" checked={isLibraryItem} onChange={(e) => setIsLibraryItem(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }} />
                           <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add to Section Catalog</div><div style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '2px' }}>Users can discover and add this section from the catalog</div></div>
                        </label>
                     </div>
                     <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Section Icon</label>
                        <IconPicker currentIcon={icon} setIcon={setIcon} query={iconPickerQuery} setQuery={setIconPickerQuery} iconRegistry={iconRegistry} onUpload={async () => { }} />
                     </div>
                  </div>
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(var(--primary-rgb), 0.03)' }}>
                     <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {editingSection && (
                           <button onClick={() => setIsDeleteModalOpen(true)} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, color: '#fff', background: 'rgba(231, 76, 60, 0.8)', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 1)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.8)'; }}>Archive Section</button>
                        )}
                     </div>
                     <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => setIsModalOpen(false)} className="btn" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancel</button>
                        <button onClick={save} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600 }}>{editingSection ? "Save Section" : "Create Section"}</button>
                     </div>
                  </div>
               </div>
            </div>
         )}


         <style jsx global>{`
          .fade-in { animation: fadeIn 0.3s ease-out; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
          .tooltip-container:hover .tooltip-bubble { visibility: visible; opacity: 1; }
       `}</style>
      </div>
   );
}
