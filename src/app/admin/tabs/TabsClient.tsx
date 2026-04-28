"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { IconPicker, IconComponent } from "@/components/IconPicker";
import { getIconRegistry } from "@/lib/iconRegistry";
import * as actions from "@/app/admin/actions";
import { 
  Settings, 
  Trash2, 
  Search, 
  Plus, 
  X, 
  ChevronRight, 
  Users, 
  Building2,
  Palette,
  Columns,
  Eye,
  LayoutGrid,
  ChevronDown,
  Zap,
  TableProperties,
  Info,
  ShieldCheck,
  ArrowDownLeft,
  Edit3,
  Globe
} from "lucide-react";

export default function TabsClient({ initialTabs, users, departments, themes }: any) {
  const activeTheme = themes.find((t: any) => t.isActive);
  const themeTintColor = activeTheme?.tintColor || '#be123c';

  const [tabs, setTabs] = useState<any[]>(initialTabs);

  function getContrastText(hexcolor: string) {
    if (!hexcolor || hexcolor.length < 7) return '#fff';
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'var(--text)' : '#fff';
  }

  const ownerTextColor = getContrastText(activeTheme?.primaryColor || themeTintColor);
  const [collapsedDepts, setCollapsedDepts] = useState<string[]>([]);
  const [modifiedDepts, setModifiedDepts] = useState<Record<string, string>>({}); // key: dept_tabId, value: newRole
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [iconRegistry, setIconRegistry] = useState<string[]>([]);
  const [iconPickerQuery, setIconPickerQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "matrix">("grid");

  // Form State
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [organization, setOrganization] = useState("");
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [themeId, setThemeId] = useState("");
  const [columns, setColumns] = useState(3);
  const [isLibraryItem, setIsLibraryItem] = useState(false);
  const [description, setDescription] = useState("");
  const [pushDept, setPushDept] = useState("");

  React.useEffect(() => {
    getIconRegistry().then(setIconRegistry);
  }, []);

  const openAdd = () => {
    setEditingTab(null);
    setTitle("");
    setIcon("");
    setOrganization("");
    setAllowedUserIds([]);
    setThemeId("");
    setColumns(3);
    setIsLibraryItem(false);
    setDescription("");
    setPushDept("");
    setIsModalOpen(true);
  };

  const searchParams = useSearchParams();
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId) {
      const tab = tabs.find((t: any) => t.id === editId);
      if (tab) openEdit(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (tab: any) => {
    setEditingTab(tab);
    setTitle(tab.title);
    setIcon(tab.icon || "");
    setOrganization(tab.organization || "");
    setAllowedUserIds(tab.allowedUsers.map((u: any) => u.id));
    setThemeId(tab.themeId || "");
    setColumns(tab.columns ?? 3);
    setIsLibraryItem(tab.isLibraryItem ?? false);
    setDescription(tab.description || "");
    setPushDept("");
    setIsModalOpen(true);
  };

  const save = async () => {
    if (!title) return;
    const data = { title, icon, organization, allowedUserIds, themeId: themeId || null, columns: Number(columns), isLibraryItem, description };
    if (editingTab) {
      await actions.updateTab(editingTab.id, data);
    } else {
      await actions.createTab(data);
    }
    window.location.reload();
  };

  const confirmDelete = async () => {
      if (editingTab) {
          await (actions as any).deleteTab(editingTab.id);
          window.location.reload();
      }
  };

  const filtered = tabs.filter((t: any) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <div style={{ display: 'flex', background: 'rgba(var(--primary-rgb), 0.08)', padding: '0.4rem', borderRadius: '14px', gap: '0.25rem', border: '1px solid var(--glass-border)' }}>
                <button 
                  onClick={() => setViewMode("grid")} 
                  className="btn" 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: viewMode === "grid" ? 'var(--primary)' : 'transparent', 
                    color: viewMode === "grid" ? '#fff' : 'var(--text)',
                    border: 'none', fontSize: '0.85rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  <LayoutGrid size={18} />
                  Workspace Grid
                </button>
                <button 
                  onClick={() => setViewMode("matrix")} 
                  className="btn" 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: viewMode === "matrix" ? 'var(--primary)' : 'transparent', 
                    color: viewMode === "matrix" ? '#fff' : 'var(--text)',
                    border: 'none', fontSize: '0.85rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  <TableProperties size={18} />
                  Permissions Matrix
                </button>
             </div>
           {viewMode === "grid" && (
              <div className="glass" style={{ flex: 1, position: 'relative' }}>
                 <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                 <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tabs..." 
                    className="glass" 
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: 'none' }} 
                 />
              </div>
           )}
           {viewMode === "matrix" && <div style={{ flex: 1 }} />}
           <button onClick={openAdd} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, display: 'flex', gap: '0.5rem' }}>
              <Plus size={18} /> New Tab
           </button>
        </div>

        {viewMode === "matrix" ? (
           <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div className="glass" style={{ padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Legend:</div>
                  <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.4)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Owner:</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Full Control</span>
                     </div>
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

               <div className="glass" style={{ padding: '0', borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                      <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
                         <tr>
                            <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', width: '1%', whiteSpace: 'nowrap' }}>
                                Workspaces
                            </th>
                            {tabs.map((tab: any) => (
                               <th key={tab.id} style={{ padding: '0.75rem 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center', width: '110px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                     <IconComponent name={tab.icon} size={14} />
                                     {tab.title}
                                  </div>
                               </th>
                            ))}
                         </tr>
                      </thead>
                      <style>{`
                          .tooltip-container:hover .tooltip-bubble {
                             visibility: visible !important;
                             opacity: 1 !important;
                          }
                       `}</style>
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
                                            <div style={{ width: '16px' }} /> // spacer
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
                                   {tabs.map((tab: any) => {
                                      const stagingRole = modifiedDepts[`${dept}_${tab.id}`];
                                      const savedRole = tab.departmentAccess?.find((da: any) => da.department === dept)?.role || "none";
                                      const displayRole = stagingRole !== undefined ? stagingRole : savedRole;
                                      
                                      return (
                                         <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                 <div style={{ 
                                                    flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', padding: '0.4rem 0.3rem', minHeight: '34px',
                                                    background: displayRole === 'owner' ? 'var(--primary)' : (displayRole === 'none' || displayRole === 'viewer' ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(var(--primary-rgb), 0.12)'),
                                                    border: displayRole === 'owner' ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                 }}>
                                                    <div style={{ 
                                                       position: 'absolute', pointerEvents: 'none', 
                                                       color: displayRole === 'owner' ? ownerTextColor : 'var(--text)',
                                                       fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                                                       zIndex: 1
                                                    }}>
                                                       {displayRole === 'owner' ? 'OWNER (DEPT)' : displayRole === 'editor' ? 'EDITOR (DEPT)' : displayRole === 'viewer' ? 'VIEWER (DEPT)' : 'NOT SHARED'}
                                                    </div>
                                                    <select 
                                                       value={displayRole}
                                                       onChange={async (e) => {
                                                          const newRole = e.target.value;
                                                          setModifiedDepts(prev => ({ ...prev, [`${dept}_${tab.id}`]: newRole }));
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
                                             {modifiedDepts[`${dept}_${tab.id}`] && (
                                                <button 
                                                   type="button"
                                                   onClick={async (e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      const role = modifiedDepts[`${dept}_${tab.id}`];
                                                      
                                                      // Filter out admins for bulk operations to match server logic
                                                      const targetUsers = deptUsers.filter((u: any) => !u.isAdmin);
                                                      const targetUserIds = targetUsers.map((u: any) => u.id);

                                                      // 1. Immediate Deep Optimistic Update
                                                      setTabs((prevTabs: any[]) => prevTabs.map((t: any) => {
                                                         if (t.id !== tab.id) return t;
                                                         const otherAccess = (t.departmentAccess || []).filter((da: any) => da.department !== dept);
                                                         const filterOut = (arr: any[]) => (arr || []).filter((u: any) => !targetUserIds.includes(u.id));

                                                         return { 
                                                            ...t, 
                                                            departmentAccess: role === "none" ? otherAccess : [...otherAccess, { department: dept, role }],
                                                            owners: role === "owner" ? [...filterOut(t.owners), ...targetUsers] : filterOut(t.owners),
                                                            editors: role === "editor" ? [...filterOut(t.editors), ...targetUsers] : filterOut(t.editors),
                                                            allowedUsers: role === "viewer" ? [...filterOut(t.allowedUsers), ...targetUsers] : filterOut(t.allowedUsers)
                                                         };
                                                      }));

                                                      // 2. Clear staging
                                                      setModifiedDepts(prev => {
                                                         const next = { ...prev };
                                                         delete next[`${dept}_${tab.id}`];
                                                         return next;
                                                      });

                                                      // 3. Fire server request
                                                      try {
                                                         await actions.bulkApplyDeptTabRole(tab.id, dept, role);
                                                      } catch (err) {
                                                         console.error("Zap sync failed:", err);
                                                         // Revert would happen here if we had an undo log, 
                                                         // but revalidatePath on server will eventually catch up
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

                                {/* User Rows */}
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
                                      {tabs.map((tab: any) => {
                                          const isOwner = tab.owners?.some((o: any) => o.id === user.id);
                                          const isEditor = tab.editors?.some((e: any) => e.id === user.id);
                                          const isViewer = tab.allowedUsers?.some((a: any) => a.id === user.id);
                                          const isBlocked = tab.blockedUsers?.some((b: any) => b.id === user.id);
                                          
                                          const deptRole = tab.departmentAccess?.find((da: any) => da.department === (user.department || "General"))?.role || "none";
                                          const role = isOwner ? "owner" : isEditor ? "editor" : isViewer ? "viewer" : (isBlocked ? "none" : "inherited");
                                          const effectiveRole = user.isAdmin ? "owner" : (role === "inherited" ? deptRole : role);

                                         return (
                                            <td key={tab.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: '150px' }}>
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
                                                           setTabs((prevTabs: any[]) => prevTabs.map((t: any) => {
                                                              if (t.id !== tab.id) return t;
                                                              return {
                                                                  ...t,
                                                                  owners: newRole === "owner" ? [...(t.owners || []).filter((o: any) => o.id !== user.id), user] : (t.owners || []).filter((o: any) => o.id !== user.id),
                                                                  editors: newRole === "editor" ? [...(t.editors || []).filter((e: any) => e.id !== user.id), user] : (t.editors || []).filter((e: any) => e.id !== user.id),
                                                                  allowedUsers: newRole === "viewer" ? [...(t.allowedUsers || []).filter((a: any) => a.id !== user.id), user] : (t.allowedUsers || []).filter((a: any) => a.id !== user.id),
                                                                  blockedUsers: newRole === "none" ? [...(t.blockedUsers || []).filter((b: any) => b.id !== user.id), user] : (t.blockedUsers || []).filter((b: any) => b.id !== user.id)
                                                               };
                                                           }));
                                                           // 2. Fire server request
                                                           try {
                                                              await actions.updateTabUserRole(tab.id, user.id, newRole);
                                                           } catch (err) {
                                                              console.error("Tab user update failed:", err);
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
           <div className="admin-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
              {filtered.map((tab: any) => (
              <div key={tab.id} className="glass" style={{ padding: '0', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--glass-border)', transition: 'all 0.3s ease' }}>
                 <div style={{ 
                    height: '140px', background: tab.theme?.primaryColor || 'rgba(var(--primary-rgb), 0.1)', position: 'relative', overflow: 'hidden',
                    borderBottom: '1px solid var(--glass-border)'
                 }}>
                    {tab.theme?.backgroundColor && (
                       <img src={tab.theme.backgroundColor} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(5px) brightness(0.6)' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
                    <div style={{ 
                       position: 'absolute', top: '1rem', right: '1rem', 
                       background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)', 
                       padding: '0.5rem', borderRadius: '50%', 
                       color: tab.theme?.primaryColor || 'var(--primary)', 
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                       <IconComponent name={tab.icon} size={24} />
                    </div>
                     <div style={{ position: 'absolute', bottom: '1rem', left: '1.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{tab.title}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{tab.organization || "Public Workspace"}</span>
                        </div>
                     </div>
                 </div>

                 <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                       <div className="glass" style={{ padding: '0.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                          <div style={{ 
                             width: '24px', height: '24px', borderRadius: '6px', 
                             background: tab.theme?.primaryColor || 'var(--primary)', 
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             color: '#fff' 
                          }}>
                             <Palette size={14} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                             <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme:</span>
                             <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{tab.theme?.name || "System Default"}</span>
                          </div>
                       </div>

                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                          <div className="glass" style={{ padding: '0.6rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                             <Columns size={12} style={{ opacity: 0.3 }} />
                             <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{tab.columns} Cols</span>
                          </div>
                          <div className="glass" style={{ padding: '0.6rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                             <Users size={12} style={{ opacity: 0.3 }} />
                             <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{tab.allowedUsers.length} Users</span>
                          </div>
                          <div className="glass" style={{ padding: '0.6rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: tab.isLibraryItem ? 'rgba(16,185,129,0.05)' : 'rgba(var(--primary-rgb), 0.05)' }}>
                             <Eye size={12} style={{ opacity: 0.3, color: tab.isLibraryItem ? '#10b981' : 'inherit' }} />
                             <span style={{ fontSize: '0.7rem', fontWeight: 800, color: tab.isLibraryItem ? '#10b981' : 'inherit' }}>{tab.isLibraryItem ? 'Catalog' : 'Private'}</span>
                          </div>
                       </div>
                    </div>

                    <div style={{ minHeight: '40px' }}>
                       <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {tab.description || "No description provided for this workspace hub."}
                       </p>
                    
                     </div>

                     <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", padding: "0.6rem", background: "rgba(var(--primary-rgb), 0.05)", borderRadius: "10px", marginTop: "0.5rem", marginBottom: "1rem" }}>
                        <span style={{ fontSize: "0.65rem", opacity: 0.6, fontWeight: 600 }}>Created by {tab.owners?.[0]?.name || "System"} • {tab.createdAt ? new Date(tab.createdAt).toLocaleDateString() : "Unknown"}</span>
                        <span style={{ fontSize: "0.65rem", opacity: 0.4, fontWeight: 500 }}>Last updated: {tab.updatedAt ? new Date(tab.updatedAt).toLocaleDateString() : "Unknown"}</span>
                     </div>

                     <button 
                       onClick={() => openEdit(tab)} 
                       className="btn btn-primary" 
                       style={{ padding: '0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                       Manage Tabs
                    </button>
                 </div>
              </div>
               ))}
           </div>
        )}

       {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
             <div className="glass" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingTab ? `Configure ${editingTab.title}` : "Create New Tab"}</h2>
                   <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                </div>

                <div className="modal-grid" style={{ padding: '2rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                         <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem' }}>General Settings</label>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input 
                               value={title}
                               onChange={(e) => setTitle(e.target.value)}
                               placeholder="Workspace Name (e.g. Finance Dashboard)" 
                               className="glass" 
                               style={{ width: '100%', padding: '0.8rem', borderRadius: '10px' }} 
                            />
                            
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, opacity: 0.4, textTransform: 'uppercase' }}>Organizational Access</label>
                                <div style={{ position: 'relative' }}>
                                   <Building2 size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                   <select 
                                     value={organization}
                                     onChange={(e) => setOrganization(e.target.value)}
                                     className="glass"
                                     style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '10px' }}
                                   >
                                      <option value="">Public / Organization Wide</option>
                                      {departments.map((d: any) => <option key={d} value={d}>{d} Team</option>)}
                                   </select>
                                </div>
                             </div>

                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, opacity: 0.4, textTransform: 'uppercase' }}>Workspace Appearance</label>
                                <div style={{ position: 'relative' }}>
                                   <Palette size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                   <select 
                                     value={themeId}
                                     onChange={(e) => setThemeId(e.target.value)}
                                     className="glass"
                                     style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '10px' }}
                                   >
                                      <option value="">System Default Appearance</option>
                                 {themes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                   </select>
                                </div>
                             </div>

                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <label style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.4, textTransform: 'uppercase' }}>Workspace Width (Columns)</label>
                                     <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{columns} Columns</span>
                                  </div>
                                  <input 
                                     type="range" min="1" max="6" step="1"
                                     value={columns}
                                     onChange={(e) => setColumns(parseInt(e.target.value))}
                                     style={{ width: '100%', cursor: 'pointer' }}
                                  />
                               </div>

                               <div className="glass" style={{ padding: '0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                                  <input 
                                     type="checkbox" 
                                     checked={isLibraryItem} 
                                     onChange={(e) => setIsLibraryItem(e.target.checked)} 
                                     id="lib-item"
                                  />
                                  <label htmlFor="lib-item" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Visible in Organization Catalog</label>
                                </div>

                                <textarea 
                                   value={description}
                                   onChange={(e) => setDescription(e.target.value)}
                                   placeholder="Workspace Description (shows in Catalog)..."
                                   className="glass"
                                   style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', minHeight: '80px', fontSize: '0.85rem' }}
                                />
                         </div>
                      </div>

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
                   {editingTab ? (
                      <button onClick={() => setIsDeleteModalOpen(true)} className="btn" style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)', padding: '0.75rem 1.25rem', borderRadius: '10px' }}>
                         <Trash2 size={16} style={{ marginRight: '0.5rem' }} /> Delete Workspace
                      </button>
                   ) : <div />}
                   
                   <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={() => setIsModalOpen(false)} className="btn" style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', opacity: 0.6 }}>Cancel</button>
                      <button onClick={save} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: 700 }}>{editingTab ? "Save Changes" : "Create Tab"}</button>
                   </div>
                </div>
             </div>
          </div>
       )}

       {isDeleteModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
             <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,68,68,0.2)' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,68,68,0.1)', color: '#ff4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                   <Trash2 size={30} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Delete Tab?</h2>
                <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '2rem' }}>All sections and bookmarks in this tab will be permanently deleted. This cannot be undone.</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <button onClick={() => setIsDeleteModalOpen(false)} className="btn" style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
                   <button onClick={confirmDelete} className="btn" style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', background: '#ff4444', color: 'white', fontWeight: 700 }}>Confirm Delete</button>
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
