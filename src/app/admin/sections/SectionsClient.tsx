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
  Globe
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: string;
  organization: string;
  isGlobal: boolean;
  isLibraryItem: boolean;
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

  const [sections, setSections] = useState<Section[]>(initialSections);

  function getContrastText(hexcolor: string) {
    if (!hexcolor || hexcolor.length < 7) return '#fff';
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'var(--text)' : '#fff';
  }

  const ownerTextColor = getContrastText(activeTheme?.primaryColor || themeTintColor);
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
                ? [...s.tabSections, { tabId, sectionId }] 
                : s.tabSections.filter((ts: any) => ts.tabId !== tabId);
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
                  Section Grid
                </button>
                <button 
                  onClick={() => setViewMode("matrix")}
                  className={viewMode === "matrix" ? "btn btn-primary" : "btn"}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', gap: '0.5rem', background: viewMode === "matrix" ? 'var(--primary)' : 'transparent', color: viewMode === "matrix" ? '#fff' : 'inherit' }}
                >
                  <TableProperties size={18} />
                  Access Settings
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                       <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
                          <tr>
                             <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', width: '1%', whiteSpace: 'nowrap' }}>
                                Sections
                             </th>
                             {filtered.map((section: any) => (
                                <th key={section.id} style={{ padding: '0.75rem 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center', width: '110px' }}>
                                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                      <IconComponent name={section.icon} size={14} />
                                      {section.title}
                                   </div>
                                </th>
                             ))}
                          </tr>
                       </thead>
                       <tbody>
                       {["Entire Organization", ...departments].map((dept: string) => {
                          const isEntireOrg = dept === "Entire Organization";
                          const deptUsers = isEntireOrg ? users : users.filter((u: any) => (u.department || "General") === dept);
                          if (!isEntireOrg && deptUsers.length === 0) return null;

                          return (
                                <React.Fragment key={dept}>
                                    <tr style={{ background: isEntireOrg ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(var(--primary-rgb), 0.05)', borderBottom: isEntireOrg ? '2px solid var(--primary)' : '1px solid var(--glass-border)' }}>
                                       <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                             {!isEntireOrg ? (
                                                <button 
                                                   onClick={() => {
                                                      setCollapsedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
                                                   }}
                                                   style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                                                >
                                                   {collapsedDepts.includes(dept) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                             ) : (
                                                <div style={{ width: '16px' }} />
                                             )}
                                             <div style={{ padding: '0.4rem', borderRadius: '8px', background: isEntireOrg ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.08)', display: 'flex', color: isEntireOrg ? '#fff' : 'inherit' }}>
                                                {isEntireOrg ? <Globe size={14} /> : <Users size={14} style={{ opacity: 0.5 }} />}
                                             </div>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: isEntireOrg ? 1 : 0.6, color: isEntireOrg ? 'var(--primary)' : 'inherit' }}>{dept}</span>
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

                                         return (
                                             <td key={section.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                               <div style={{ 
                                                   flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', padding: '0.4rem 0.5rem', minHeight: '34px',
                                                   background: displayRole === 'owner' ? 'var(--primary)' : (displayRole === 'none' || displayRole === 'viewer' ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(var(--primary-rgb), 0.12)'),
                                                   border: displayRole === 'owner' ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)',
                                                   display: 'flex', alignItems: 'center', justifyContent: 'center'
                                               }}>
                                                  <div style={{ 
                                                      position: 'absolute', pointerEvents: 'none', 
                                                      color: displayRole === 'owner' ? ownerTextColor : 'var(--text)',
                                                      fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap',
                                                      zIndex: 1
                                                  }}>
                                                      {displayRole === 'owner' ? 'OWNER (DEPT)' : displayRole === 'editor' ? 'EDITOR (DEPT)' : displayRole === 'viewer' ? 'VIEWER (DEPT)' : 'NOT SHARED'}
                                                  </div>
                                                  <select 
                                                      value={displayRole}
                                                      onChange={async (e) => {
                                                         const newRole = e.target.value;
                                                         setModifiedDepts(prev => ({ ...prev, [`${dept}_${section.id}`]: newRole }));
                                                      }}
                                                      style={{ 
                                                         width: '100%', opacity: 0, cursor: 'pointer', height: '100%',
                                                         position: 'absolute', inset: 0, zIndex: 2
                                                      }}
                                                   >
                                                      <option value="none">Not Shared</option>
                                                      <option value="owner">Owner (Dept)</option>
                                                      <option value="editor">Editor (Dept)</option>
                                                      <option value="viewer">Viewer (Dept)</option>
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
                                                </div>
                                             </td>
                                         );
                                      })}
                                   </tr>

                                    {!isEntireOrg && !collapsedDepts.includes(dept) && deptUsers.map((user: any) => (
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
                                             
                                              const deptRole = section.departmentAccess?.find((da: any) => da.department === (user.department || "General"))?.role || "none";
                                              const role = isOwner ? "owner" : isEditor ? "editor" : isViewer ? "viewer" : (isBlocked ? "none" : "inherited");
                                              const effectiveRole = user.isAdmin ? "owner" : (role === "inherited" ? deptRole : role);

                                             return (
                                                <td key={section.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: '150px' }}>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                  <div 
                                                     className="glass"
                                                     style={{ 
                                                        width: '100%', position: 'relative', borderRadius: '10px', overflow: 'hidden', minHeight: '34px',
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
                                                              ? <><ArrowDownLeft size={11} strokeWidth={3} /> INHERITED ({deptRole === 'none' ? 'NOT SHARED' : deptRole.toUpperCase()})</>
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
                                                        value={user.isAdmin ? "owner" : role}
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
                                                              <option value="inherited">Inherited ({deptRole === 'none' ? 'Not Shared' : deptRole.charAt(0).toUpperCase() + deptRole.slice(1)})</option>
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
                       <th style={{ padding: '1.25rem 2rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, textAlign: 'center' }}>Identity</th>
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
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{section.title}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.4, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Bookmark size={10} /> {section.bookmarks.length} Bookmarks</span>
                             </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginTop: "0.4rem" }}>
                                   <span style={{ fontSize: "0.6rem", opacity: 0.5, fontWeight: 600 }}>Created by {section.owners?.[0]?.name || "System"} • {section.createdAt ? new Date(section.createdAt).toLocaleDateString() : "Unknown"}</span>
                                   <span style={{ fontSize: "0.6rem", opacity: 0.4, fontWeight: 500 }}>Last updated: {section.updatedAt ? new Date(section.updatedAt).toLocaleDateString() : "Unknown"}</span>
                                </div>
                          </div>
                       </td>
                       <td style={{ padding: '1.25rem 2rem', textAlign: 'center' }}>
                          <div className="glass" style={{ display: 'inline-flex', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', background: 'rgba(var(--primary-rgb), 0.06)', alignItems: 'center', gap: '0.4rem' }}>
                             <Building2 size={12} style={{ opacity: 0.3 }} />
                             {section.organization || "Global"}
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
                            const isAssigned = section.tabSections.some((ts: any) => ts.tabId === tab.id);
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
                          <button onClick={() => openEdit(section)} className="btn" style={{ padding: '0.5rem', borderRadius: '8px', opacity: 0.5 }}><Settings size={18} /></button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

       {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
             <div className="glass" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingSection ? `Configure Section: ${editingSection.title}` : "Create New Section"}</h2>
                   <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                </div>

                <div className="modal-grid" style={{ padding: '2rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                         <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Section Details</label>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input 
                               value={title}
                               onChange={(e) => setTitle(e.target.value)}
                               placeholder="Section Name (e.g. Media Management)" 
                               className="glass" 
                               style={{ width: '100%', padding: '0.8rem', borderRadius: '10px' }} 
                            />
                            
                            <div style={{ position: 'relative' }}>
                               <Building2 size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                               <select 
                                 value={organization}
                                 onChange={(e) => setOrganization(e.target.value)}
                                 className="glass"
                                 style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '10px' }}
                               >
                                  <option value="">Global Service</option>
                                  {departments.map((d: any) => <option key={d} value={d}>{d} Department Access</option>)}
                               </select>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem' }}>
                               <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
                               <span style={{ fontSize: '0.85rem' }}>Service Visibility (Global)</span>
                             </label>

                             <div className="glass" style={{ padding: '0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                                <input 
                                   type="checkbox" 
                                   checked={isLibraryItem} 
                                   onChange={(e) => setIsLibraryItem(e.target.checked)} 
                                   id="lib-item-sec"
                                />
                                <label htmlFor="lib-item-sec" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Available in Catalog</label>
                             </div>

                             <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Section Description (shows in Catalog)..."
                                className="glass"
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', minHeight: '80px', fontSize: '0.85rem' }}
                             />
                          </div>
                       </div>
                       
                       {editingSection && (
                          <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,165,0,0.05)', border: '1px solid rgba(255,165,0,0.1)' }}>
                             <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Push to Groups</label>
                             <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select 
                                    value={pushDept}
                                    onChange={(e) => setPushDept(e.target.value)}
                                    className="glass"
                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem' }}
                                >
                                   <option value="">Select Department...</option>
                                   {departments.map((d: any) => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <button 
                                   onClick={async () => {
                                      if (!pushDept) return;
                                      if (confirm(`Push this section to everyone in ${pushDept}?`)) {
                                         await actions.pushSectionToDepartment(editingSection.id, pushDept);
                                         alert("Section pushed successfully!");
                                      }
                                   }}
                                   className="btn"
                                   style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
                                >
                                   Push
                                </button>
                             </div>
                          </div>
                       )}
                    </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <IconPicker 
                        currentIcon={icon}
                        setIcon={setIcon}
                        query={iconPickerQuery}
                        setQuery={setIconPickerQuery}
                        iconRegistry={iconRegistry}
                        onUpload={async () => {}}
                      />
                   </div>
                </div>

                <div style={{ padding: '1.5rem 2rem', background: 'rgba(var(--primary-rgb), 0.05)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   {editingSection ? (
                      <button onClick={() => setIsDeleteModalOpen(true)} className="btn" style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)', padding: '0.75rem 1.25rem', borderRadius: '10px' }}>
                         <Trash2 size={16} style={{ marginRight: '0.5rem' }} /> Archive Section
                      </button>
                   ) : <div />}
                   
                   <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={() => setIsModalOpen(false)} className="btn" style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', opacity: 0.6 }}>Cancel</button>
                      <button onClick={save} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: 700 }}>{editingSection ? "Save Changes" : "Create Section"}</button>
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
