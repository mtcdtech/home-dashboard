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
  Globe,
  Library,
  UserPlus,
  Send,
  Lock
} from "lucide-react";

export default function TabsClient({ initialTabs, users, departments, themes }: any) {
  const activeTheme = themes.find((t: any) => t.isActive);
  const themeTintColor = activeTheme?.tintColor || '#be123c';

  const [tabs, setTabs] = useState<any[]>(initialTabs.filter((t: any) => !t.isReadOnlySync));

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
  const [viewMode, setViewMode] = useState<"grid" | "matrix" | "push">("grid");

  // Form State
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [organization, setOrganization] = useState("");
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [themeId, setThemeId] = useState("");
  const [columns, setColumns] = useState(3);
  const [isLibraryItem, setIsLibraryItem] = useState(false);
  const [isGlobal, setIsGlobal] = useState(false);
  const [pushToNewUsers, setPushToNewUsers] = useState(false);
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
    setIsGlobal(false);
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
    setIsGlobal(tab.isGlobal ?? false);
    setPushToNewUsers(tab.pushToNewUsers ?? false);
    setDescription(tab.description || "");
    setPushDept("");
    setIsModalOpen(true);
  };

  const save = async () => {
    if (!title) return;
    const data = { title, icon, organization, allowedUserIds, themeId: themeId || null, columns: Number(columns), isLibraryItem, isGlobal, pushToNewUsers, description };
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
                <button 
                   onClick={() => setViewMode("push")} 
                   className="btn" 
                   style={{ 
                     padding: '0.5rem 1rem', 
                     background: viewMode === "push" ? 'var(--primary)' : 'transparent', 
                     color: viewMode === "push" ? '#fff' : 'var(--text)',
                     border: 'none', fontSize: '0.85rem', fontWeight: 700,
                     display: 'flex', alignItems: 'center', gap: '0.5rem'
                   }}
                >
                   <Send size={18} />
                   Push Matrix
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
           {(viewMode === "matrix" || viewMode === "push") && <div style={{ flex: 1 }} />}
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
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: Math.max(800, tabs.length * 160 + 300) + 'px' }}>
                      <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
                         <tr>
                            <th style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', width: '1%', whiteSpace: 'nowrap' }}>
                                Workspaces
                            </th>
                            {tabs.map((tab: any) => (
                               <th key={tab.id} style={{ padding: '0.75rem 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center', width: '150px' }}>
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
                       {/* Catalog & Auto Assign Toggle Rows */}
                       <tr style={{ background: 'rgba(var(--primary-rgb), 0.08)', borderBottom: '2px solid var(--primary)' }}>
                          <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 16 }} />
                                <div style={{ padding: '0.4rem', borderRadius: '8px', background: '#10b981', display: 'flex', color: '#fff' }}><Library size={14} /></div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981' }}>In Catalog</span>
                             </div>
                          </td>
                          {tabs.map((tab: any) => (
                             <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                <button onClick={async () => {
                                   const newVal = !tab.isLibraryItem;
                                   if (!newVal && !window.confirm("Are you sure you want to remove this from the catalog? Only the creator will be able to see it or add it back.")) return;
                                   
                                   // If removing from catalog, also turn off isGlobal
                                   const newGlobal = newVal ? tab.isGlobal : false;

                                   setTabs((prev: any[]) => prev.map((t: any) => t.id === tab.id ? { ...t, isLibraryItem: newVal, isGlobal: newGlobal } : t));
                                   await actions.updateTab(tab.id, { ...tab, isLibraryItem: newVal, pushToNewUsers: tab.pushToNewUsers, isGlobal: newGlobal });
                                }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: tab.isLibraryItem ? '1px solid #10b981' : '1px solid rgba(var(--primary-rgb), 0.2)', background: tab.isLibraryItem ? 'rgba(16,185,129,0.15)' : 'rgba(var(--primary-rgb), 0.05)', color: tab.isLibraryItem ? '#10b981' : 'var(--text)', cursor: "pointer", fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                   {tab.isLibraryItem ? '✓ CATALOG' : 'PRIVATE'}
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
                          {tabs.map((tab: any) => (
                             <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                {tab.isLibraryItem ? (
                                   <button onClick={async () => {
                                      const newVal = !tab.isGlobal;
                                      setTabs((prev: any[]) => prev.map((t: any) => t.id === tab.id ? { ...t, isGlobal: newVal } : t));
                                      await actions.updateTab(tab.id, { ...tab, isLibraryItem: tab.isLibraryItem, pushToNewUsers: tab.pushToNewUsers, isGlobal: newVal });
                                   }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: tab.isGlobal ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)', background: tab.isGlobal ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--primary-rgb), 0.05)', color: tab.isGlobal ? 'var(--primary)' : 'var(--text)', cursor: "pointer", fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                      {tab.isGlobal ? '✓ ALLOWED' : 'RESTRICTED'}
                                   </button>
                                ) : (
                                   <div style={{ fontSize: '0.65rem', opacity: 0.3, textTransform: 'uppercase', fontWeight: 800 }}>N/A</div>
                                )}
                             </td>
                          ))}
                       </tr>

                       {/* Department Rows */}
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
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: "pointer", display: 'flex', alignItems: 'center', opacity: 0.5 }}
                                         >
                                            {collapsedDepts.includes(dept) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                         </button>
                                         <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.08)', display: 'flex' }}>
                                            <Users size={14} style={{ opacity: 0.5 }} />
                                         </div>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>{dept}</span>
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
                                      const isITGroup = dept === "IT"; 
                                      const globalPush = tab.pushRules?.find((r: any) => r.targetType === "global");
                                      const deptPush = tab.pushRules?.find((r: any) => r.targetType === "department" && r.targetId === dept);
                                      const isPushedDept = globalPush || deptPush;
                                      const effectiveRole = isITGroup ? "owner" : ((isPushedDept && displayRole === "none") ? "viewer" : displayRole);
                                      
                                      return (
                                         <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.2rem', width: 'max-content', margin: '0 auto' }}>
                                                 <div style={{ 
                                                    flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', padding: '0.4rem 0.3rem', minHeight: '34px', minWidth: '130px',
                                                    background: effectiveRole === "owner" ? "var(--primary)" : (effectiveRole === "none" || effectiveRole === "viewer" ? "rgba(var(--primary-rgb), 0.05)" : "rgba(var(--primary-rgb), 0.12)"),
                                                    border: effectiveRole === "owner" ? "1px solid var(--primary)" : "1px solid rgba(var(--primary-rgb), 0.2)",
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                 }}>
                                                    <div style={{ 
                                                       position: 'absolute', pointerEvents: 'none', 
                                                       color: effectiveRole === "owner" ? ownerTextColor : "var(--text)",
                                                       fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                                                       zIndex: 1
                                                    }}>
                                                       {effectiveRole === "owner" ? "OWNER (DEPT)" : effectiveRole === "editor" ? "EDITOR (DEPT)" : effectiveRole === "viewer" ? "VIEWER (DEPT)" : "NOT SHARED"}
                                                    </div>
                                                    <select 
                                                       value={effectiveRole} disabled={isITGroup}
                                                       onChange={async (e) => {
                                                          const newRole = e.target.value;
                                                          setModifiedDepts(prev => ({ ...prev, [`${dept}_${tab.id}`]: newRole }));
                                                       }}
                                                       style={{ 
                                                          width: '100%', opacity: 0, cursor: isITGroup ? "not-allowed" : "pointer", height: '100%',
                                                          position: 'absolute', inset: 0, zIndex: 2
                                                       }}
                                                    >
                                                       <option value="none" disabled={isITGroup}>Not Shared</option>
                                                       <option value="owner">Owner (Dept)</option>
                                                       <option value="editor" disabled={isITGroup}>Editor (Dept)</option>
                                                       <option value="viewer" disabled={isITGroup}>Viewer (Dept)</option>
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
                                                      cursor: "pointer"
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
                                      {tabs.map((tab: any) => {
                                          const isOwner = tab.owners?.some((o: any) => o.id === user.id);
                                          const isEditor = tab.editors?.some((e: any) => e.id === user.id);
                                          const isViewer = tab.allowedUsers?.some((a: any) => a.id === user.id);
                                          const isBlocked = tab.blockedUsers?.some((b: any) => b.id === user.id);
                                          
                                          const userDept = user.dashboardGroup || "General";
                                          const savedDeptRole = tab.departmentAccess?.find((da: any) => da.department === userDept)?.role || "none";
                                          const isITGroup = userDept === "IT";
                                          
                                          const globalPush = tab.pushRules?.find((r: any) => r.targetType === "global");
                                          const deptPush = tab.pushRules?.find((r: any) => r.targetType === "department" && r.targetId === userDept);
                                          const userPush = tab.pushRules?.find((r: any) => r.targetType === "user" && r.targetId === user.id);
                                          
                                          const isPushedDept = globalPush || deptPush;
                                          const isPushedUser = isPushedDept || userPush;
                                          
                                          const effectiveDeptRole = isITGroup ? "owner" : ((isPushedDept && savedDeptRole === "none") ? "viewer" : savedDeptRole);
                                          const role = isOwner ? "owner" : isEditor ? "editor" : isViewer ? "viewer" : (isBlocked ? "none" : "inherited");
                                          let effectiveRole = user.isAdmin ? "owner" : (role === "inherited" ? effectiveDeptRole : role);
                                          
                                          if (isPushedUser && effectiveRole === "none") effectiveRole = "viewer";

                                         return (
                                            <td key={tab.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: '150px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.5rem', width: 'max-content', margin: '0 auto' }}>
                                                  <div 
                                                     className="glass"
                                                     style={{ 
                                                        width: '100%', minWidth: '130px', position: 'relative', borderRadius: '10px', overflow: 'hidden', minHeight: '34px',
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
                                                              ? <><ArrowDownLeft size={11} strokeWidth={3} /> INHERITED ({effectiveDeptRole === 'none' ? 'NOT SHARED' : effectiveDeptRole.toUpperCase()})</>
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
                                                              <option value="inherited">Inherited ({effectiveDeptRole === 'none' ? 'Not Shared' : effectiveDeptRole.charAt(0).toUpperCase() + effectiveDeptRole.slice(1)})</option>
                                                              <option value="viewer">Viewer</option>
                                                              <option value="editor">Editor</option>
                                                              <option value="owner">Owner</option>
                                                              <option value="none" disabled={isPushedUser}>Not Shared</option>
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
                                                           href="#" 
                                                           onClick={(e) => { e.preventDefault(); setViewMode("push"); }}
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
                                                           Pushed to this user/department &mdash; click to manage in Push Matrix
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
        ) : viewMode === "push" ? (
           <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="glass" style={{ padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                 <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Legend:</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '1px solid #10b981' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Pushed:</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Appears on dashboard</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lock size={12} style={{ opacity: 0.7 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Locked:</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>User cannot remove</span>
                 </div>
              </div>

              <div className="glass" style={{ padding: 0, borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
                       <tr>
                          <th style={{ padding: '1rem 0.5rem 1rem 1.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', width: '1%', whiteSpace: 'nowrap' }}>
                             Push Targets
                          </th>
                          {tabs.map((tab: any) => (
                             <th key={tab.id} style={{ padding: '0.75rem 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center', width: '140px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                   <IconComponent name={tab.icon} size={14} />
                                   {tab.title}
                                </div>
                             </th>
                          ))}
                       </tr>
                    </thead>
                    <tbody>
                       {/* Global Push Row */}
                       <tr style={{ background: 'rgba(var(--primary-rgb), 0.08)', borderBottom: '2px solid var(--primary)' }}>
                          <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 16 }} />
                                <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'var(--primary)', display: 'flex', color: '#fff' }}><Globe size={14} /></div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>All Users</span>
                             </div>
                          </td>
                          {tabs.map((tab: any) => {
                             const rule = tab.pushRules?.find((r: any) => r.targetType === "global");
                             return (
                                <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <button onClick={async () => {
                                         const newEnabled = !rule;
                                         setTabs((prev: any[]) => prev.map((t: any) => {
                                            if (t.id !== tab.id) return t;
                                            const otherRules = (t.pushRules || []).filter((r: any) => !(r.targetType === "global"));
                                            return { ...t, pushRules: newEnabled ? [...otherRules, { targetType: "global", targetId: "", locked: false }] : otherRules };
                                         }));
                                         await actions.togglePushRule(tab.id, "global", null, newEnabled);
                                      }} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: rule ? '1px solid #10b981' : '1px solid rgba(var(--primary-rgb), 0.2)', background: rule ? 'rgba(16,185,129,0.15)' : 'rgba(var(--primary-rgb), 0.05)', color: rule ? '#10b981' : 'var(--text)', cursor: "pointer", fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                         {rule ? '✓ PUSHED' : 'OFF'}
                                      </button>
                                      {rule && (
                                         <button onClick={async () => {
                                            const newLocked = !rule.locked;
                                            setTabs((prev: any[]) => prev.map((t: any) => {
                                               if (t.id !== tab.id) return t;
                                               return { ...t, pushRules: (t.pushRules || []).map((r: any) => r.targetType === "global" ? { ...r, locked: newLocked } : r) };
                                            }));
                                            await actions.togglePushRuleLock(tab.id, "global", null, newLocked);
                                         }} style={{ padding: '0.4rem', borderRadius: '6px', border: rule.locked ? '1px solid #ef4444' : '1px solid rgba(var(--primary-rgb), 0.15)', background: rule.locked ? 'rgba(239,68,68,0.1)' : 'transparent', color: rule.locked ? '#ef4444' : 'var(--text)', cursor: "pointer", fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', transition: 'all 0.2s', opacity: rule.locked ? 1 : 0.4 }}>
                                            <Lock size={9} />
                                         </button>
                                      )}
                                   </div>
                                </td>
                             );
                          })}
                       </tr>

                       {/* Department + User Rows */}
                       {departments.map((dept: string) => {
                          const deptUsers = users.filter((u: any) => (u.dashboardGroup || "General") === dept);
                          if (deptUsers.length === 0) return null;
                          const isCollapsed = collapsedDepts.includes(dept);
                          return (
                             <React.Fragment key={dept}>
                                <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                   <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                         <button onClick={() => setCollapsedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept])} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: "pointer", display: 'flex', opacity: 0.5 }}>
                                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                         </button>
                                         <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.08)', display: 'flex' }}><Users size={14} style={{ opacity: 0.5 }} /></div>
                                         <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>{dept}</span>
                                      </div>
                                   </td>
                                   {tabs.map((tab: any) => {
                                      const rule = tab.pushRules?.find((r: any) => r.targetType === "department" && r.targetId === dept);
                                      const globalRule = tab.pushRules?.find((r: any) => r.targetType === "global");
                                      const isInherited = !rule && globalRule;
                                      return (
                                         <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                            {isInherited ? (
                                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                  <div style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: 'rgba(16,185,129,0.6)' }}>
                                                     <ArrowDownLeft size={9} /> VIA ALL
                                                  </div>
                                                  {globalRule.locked && <div style={{ padding: '0.4rem', display: 'flex' }}><Lock size={9} style={{ color: '#ef4444' }} /></div>}
                                               </div>
                                            ) : (
                                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                  <button onClick={async () => {
                                                     const newEnabled = !rule;
                                                     setTabs((prev: any[]) => prev.map((t: any) => {
                                                        if (t.id !== tab.id) return t;
                                                        const otherRules = (t.pushRules || []).filter((r: any) => !(r.targetType === "department" && r.targetId === dept));
                                                        return { ...t, pushRules: newEnabled ? [...otherRules, { targetType: "department", targetId: dept, locked: false }] : otherRules };
                                                     }));
                                                     await actions.togglePushRule(tab.id, "department", dept, newEnabled);
                                                  }} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: rule ? '1px solid #10b981' : '1px solid rgba(var(--primary-rgb), 0.2)', background: rule ? 'rgba(16,185,129,0.15)' : 'rgba(var(--primary-rgb), 0.05)', color: rule ? '#10b981' : 'var(--text)', cursor: "pointer", fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                                     {rule ? '✓ DEPT' : 'OFF'}
                                                  </button>
                                                  {rule && (
                                                     <button onClick={async () => {
                                                        const newLocked = !rule.locked;
                                                        setTabs((prev: any[]) => prev.map((t: any) => {
                                                           if (t.id !== tab.id) return t;
                                                           return { ...t, pushRules: (t.pushRules || []).map((r: any) => (r.targetType === "department" && r.targetId === dept) ? { ...r, locked: newLocked } : r) };
                                                        }));
                                                        await actions.togglePushRuleLock(tab.id, "department", dept, newLocked);
                                                     }} style={{ padding: '0.4rem', borderRadius: '6px', border: rule.locked ? '1px solid #ef4444' : '1px solid rgba(var(--primary-rgb), 0.15)', background: rule.locked ? 'rgba(239,68,68,0.1)' : 'transparent', color: rule.locked ? '#ef4444' : 'var(--text)', cursor: "pointer", fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', transition: 'all 0.2s', opacity: rule.locked ? 1 : 0.4 }}>
                                                        <Lock size={9} />
                                                     </button>
                                                  )}

                                               </div>
                                            )}
                                         </td>
                                      );
                                   })}
                                </tr>

                                {/* Individual user rows */}
                                {!isCollapsed && deptUsers.map((user: any) => (
                                   <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }} className="hover-row">
                                      <td style={{ width: '1%', whiteSpace: 'nowrap', padding: '0.75rem 1.25rem 0.75rem 2.5rem' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 800 }}>
                                               {(user.name || user.email || "U").trim().split(/\s+/).map((n: any) => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                               <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{user.name || "Anonymous"}</span>
                                               {user.isAdmin && <span style={{ fontSize: '0.55rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 800, width: 'fit-content' }}>Admin</span>}
                                            </div>
                                         </div>
                                      </td>
                                      {tabs.map((tab: any) => {
                                         const userRule = tab.pushRules?.find((r: any) => r.targetType === "user" && r.targetId === user.id);
                                         const deptRule = tab.pushRules?.find((r: any) => r.targetType === "department" && r.targetId === (user.department || "General"));
                                         const globalRule = tab.pushRules?.find((r: any) => r.targetType === "global");
                                         const inherited = !userRule && (deptRule || globalRule);
                                         const inheritedFrom = deptRule ? "DEPT" : globalRule ? "ALL" : "";
                                         const isLocked = userRule?.locked || deptRule?.locked || globalRule?.locked;
                                         return (
                                            <td key={tab.id} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', minWidth: 120 }}>
                                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                  {userRule ? (
                                                     <>
                                                        <button onClick={async () => {
                                                           setTabs((prev: any[]) => prev.map((t: any) => {
                                                              if (t.id !== tab.id) return t;
                                                              return { ...t, pushRules: (t.pushRules || []).filter((r: any) => !(r.targetType === "user" && r.targetId === user.id)) };
                                                           }));
                                                           await actions.togglePushRule(tab.id, "user", user.id, false);
                                                        }} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid #10b981', background: 'rgba(16,185,129,0.15)', color: '#10b981', cursor: "pointer", fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                                           ✓ USER
                                                        </button>
                                                        <button onClick={async () => {
                                                           const newLocked = !userRule.locked;
                                                           setTabs((prev: any[]) => prev.map((t: any) => {
                                                              if (t.id !== tab.id) return t;
                                                              return { ...t, pushRules: (t.pushRules || []).map((r: any) => (r.targetType === "user" && r.targetId === user.id) ? { ...r, locked: newLocked } : r) };
                                                           }));
                                                           await actions.togglePushRuleLock(tab.id, "user", user.id, newLocked);
                                                        }} style={{ padding: '0.4rem', borderRadius: '6px', border: userRule.locked ? '1px solid #ef4444' : '1px solid rgba(var(--primary-rgb), 0.15)', background: userRule.locked ? 'rgba(239,68,68,0.1)' : 'transparent', color: userRule.locked ? '#ef4444' : 'var(--text)', cursor: "pointer", fontSize: '0.55rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: userRule.locked ? 1 : 0.4 }}>
                                                           <Lock size={9} />
                                                        </button>
                                                     </>
                                                  ) : inherited ? (
                                                     <>
                                                        <div style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: 'rgba(16,185,129,0.6)' }}>
                                                           <ArrowDownLeft size={9} /> {inheritedFrom}
                                                        </div>
                                                        {isLocked && <div style={{ padding: '0.4rem', display: 'flex' }}><Lock size={9} style={{ color: '#ef4444' }} /></div>}
                                                     </>
                                                  ) : (
                                                     <button onClick={async () => {
                                                        setTabs((prev: any[]) => prev.map((t: any) => {
                                                           if (t.id !== tab.id) return t;
                                                           return { ...t, pushRules: [...(t.pushRules || []), { targetType: "user", targetId: user.id, locked: false }] };
                                                        }));
                                                        await actions.togglePushRule(tab.id, "user", user.id, true);
                                                     }} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(var(--primary-rgb), 0.2)', background: 'rgba(var(--primary-rgb), 0.05)', color: 'var(--text)', cursor: "pointer", fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5 }}>
                                                        OFF
                                                     </button>
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
                           {tab.isReadOnlySync && (
                              <span style={{ fontSize: '0.6rem', color: '#10b981', background: 'rgba(16,185,129,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>Imported</span>
                           )}
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

                     {tab.isReadOnlySync ? (
                        <button 
                           disabled
                           className="btn" 
                           style={{ padding: '0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', opacity: 0.5, cursor: 'not-allowed' }}
                        >
                           Imported (Locked)
                        </button>
                     ) : (
                        <button 
                           onClick={() => openEdit(tab)} 
                           className="btn btn-primary" 
                           style={{ padding: '0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                           Manage Tabs
                        </button>
                     )}
                 </div>
              </div>
               ))}
           </div>
        )}

       {isModalOpen && (
          <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
             <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingTab ? `Configure ${editingTab.title}` : "Create New Workspace"}</h2>
                   <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: "pointer", color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
                </div>

                <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Workspace Settings</label>
                      <input
                         autoFocus
                         value={title}
                         onChange={(e) => setTitle(e.target.value)}
                         placeholder="Workspace Name (e.g. Finance Dashboard)"
                         className="glass"
                         style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                         <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Column Layout</label>
                            <select value={columns} onChange={(e) => setColumns(parseInt(e.target.value))} className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', outline: 'none' }}>
                               <option value={2}>2 Columns</option>
                               <option value={3}>3 Columns</option>
                               <option value={4}>4 Columns</option>
                               <option value={5}>5 Columns (Wide)</option>
                               <option value={6}>6 Columns (Ultra Wide)</option>
                            </select>
                         </div>
                         <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Workspace Theme</label>
                            <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', outline: 'none' }}>
                               <option value="">-- Inherit System Theme --</option>
                               {themes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                         </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: "pointer", padding: '0.6rem 0.8rem', borderRadius: '12px', border: `1px solid ${isLibraryItem ? 'var(--primary)' : 'var(--glass-border)'}`, background: isLibraryItem ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent', transition: 'all 0.2s ease' }}>
                         <input type="checkbox" checked={isLibraryItem} onChange={(e) => setIsLibraryItem(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: "pointer", flexShrink: 0 }} />
                         <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add to Workspace Catalog</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '2px' }}>Other users can discover and add this workspace to their dashboard</div>
                         </div>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: "pointer", padding: '0.6rem 0.8rem', borderRadius: '12px', border: `1px solid ${isGlobal ? 'var(--primary)' : 'var(--glass-border)'}`, background: isGlobal ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent', transition: 'all 0.2s ease', marginTop: '0.5rem' }}>
                         <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: "pointer", flexShrink: 0 }} />
                         <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Entire Organization Override</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '2px' }}>Automatically makes this workspace visible to everyone, overriding any restrictions.</div>
                         </div>
                      </label>
                   </div>

                   <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Workspace UI Icon</label>
                      <IconPicker currentIcon={icon} setIcon={setIcon} query={iconPickerQuery} setQuery={setIconPickerQuery} iconRegistry={iconRegistry} onUpload={async () => {}} />
                   </div>
                </div>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(var(--primary-rgb), 0.03)' }}>
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {editingTab && (
                         <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, color: '#fff', background: 'rgba(231, 76, 60, 0.8)', border: 'none', cursor: "pointer", transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.8)'; }}
                         >
                            Delete Workspace
                         </button>
                      )}
                   </div>
                   <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={() => setIsModalOpen(false)} className="btn" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancel</button>
                      <button onClick={save} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600 }}>{editingTab ? "Save Workspace" : "Create Workspace"}</button>
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
