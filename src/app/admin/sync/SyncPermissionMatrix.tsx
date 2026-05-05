"use client";

import React, { useState } from "react";
import { Users, ChevronDown, ChevronRight, ShieldCheck, ArrowDownLeft, Zap } from "lucide-react";
import * as actions from "@/app/admin/actions";

export default function SyncPermissionMatrix({ syncedTabs, users, departments }: { syncedTabs: any[]; users: any[]; departments: string[] }) {
  const [tabs, setTabs] = useState(syncedTabs);
  const [collapsedDepts, setCollapsedDepts] = useState<string[]>([]);
  const [modifiedDepts, setModifiedDepts] = useState<Record<string, string>>({});

  const deptList = departments;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Users size={22} /> Imported Workspace Permissions
      </h2>
      <p style={{ opacity: 0.6, fontSize: '0.85rem', marginTop: '-0.5rem' }}>Control which departments and users can see imported workspaces.</p>

      {/* Legend */}
      <div className="glass" style={{ padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Legend:</div>
        {[
          { color: 'var(--primary)', label: 'Owner', desc: 'Full Control' },
          { color: 'rgba(var(--primary-rgb), 0.15)', label: 'Editor', desc: 'Can manage' },
          { color: 'rgba(var(--primary-rgb), 0.05)', label: 'Viewer', desc: 'Can see' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, border: '1px solid rgba(var(--primary-rgb), 0.3)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{l.label}:</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{l.desc}</span>
          </div>
        ))}
      </div>

      {/* Permission Table */}
      <div className="glass" style={{ padding: 0, borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
            <tr>
              <th style={{ padding: '1rem 0.5rem 1rem 1.5rem', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', width: '1%', whiteSpace: 'nowrap' }}>Groups / Users</th>
              {tabs.map(tab => (
                <th key={tab.id} style={{ padding: '0.75rem 0.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', width: '140px', letterSpacing: '0.04em' }}>
                  {tab.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deptList.map(dept => {
              const deptUsers = users.filter((u: any) => (u.dashboardGroup || "General") === dept);
              if (deptUsers.length === 0) return null;
              const isCollapsed = collapsedDepts.includes(dept);

              return (
                <React.Fragment key={dept}>
                  {/* Department Header Row */}
                  <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button onClick={() => setCollapsedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept])} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', opacity: 0.5 }}>
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.08)', display: 'flex' }}>
                          <Users size={14} style={{ opacity: 0.5 }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>{dept}</span>
                      </div>
                    </td>
                    {tabs.map(tab => {
                      const stagingRole = modifiedDepts[`${dept}_${tab.id}`];
                      const savedRole = tab.departmentAccess?.find((da: any) => da.department === dept)?.role || "none";
                      const displayRole = stagingRole !== undefined ? stagingRole : savedRole;
                      return (
                        <td key={tab.id} style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', padding: '0.4rem 0.5rem', minHeight: 34, background: displayRole === 'owner' ? 'var(--primary)' : displayRole === 'editor' ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.05)', border: displayRole === 'owner' ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ position: 'absolute', pointerEvents: 'none', color: displayRole === 'owner' ? '#fff' : 'var(--text)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', zIndex: 1 }}>
                                {displayRole === 'owner' ? 'OWNER (DEPT)' : displayRole === 'editor' ? 'EDITOR (DEPT)' : displayRole === 'viewer' ? 'VIEWER (DEPT)' : 'NOT SHARED'}
                              </div>
                              <select value={displayRole} onChange={(e) => setModifiedDepts(prev => ({ ...prev, [`${dept}_${tab.id}`]: e.target.value }))} style={{ width: '100%', opacity: 0, cursor: 'pointer', height: '100%', position: 'absolute', inset: 0, zIndex: 2 }}>
                                <option value="none">Not Shared</option>
                                <option value="owner">Owner (Dept)</option>
                                <option value="editor">Editor (Dept)</option>
                                <option value="viewer">Viewer (Dept)</option>
                              </select>
                            </div>
                            {modifiedDepts[`${dept}_${tab.id}`] && (
                              <button onClick={async () => {
                                const role = modifiedDepts[`${dept}_${tab.id}`];
                                setTabs(prev => prev.map(t => {
                                  if (t.id !== tab.id) return t;
                                  const otherAccess = (t.departmentAccess || []).filter((da: any) => da.department !== dept);
                                  return { ...t, departmentAccess: role === 'none' ? otherAccess : [...otherAccess, { department: dept, role }] };
                                }));
                                setModifiedDepts(prev => { const n = { ...prev }; delete n[`${dept}_${tab.id}`]; return n; });
                                try { await actions.bulkApplyDeptTabRole(tab.id, dept, role); } catch (e) { console.error(e); }
                              }} className="btn btn-primary" title="Apply" style={{ padding: '0.4rem', borderRadius: '8px', display: 'flex' }}>
                                <Zap size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Individual User Rows */}
                  {!isCollapsed && deptUsers.map((user: any) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }} className="hover-row">
                      <td style={{ width: '1%', whiteSpace: 'nowrap', padding: '0.75rem 1.25rem 0.75rem 2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 800 }}>
                            {(user.name || user.email || "U").trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{user.name || "Anonymous"}</span>
                            {user.isAdmin && <span style={{ fontSize: '0.55rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 800, width: 'fit-content' }}>Admin</span>}
                          </div>
                        </div>
                      </td>
                      {tabs.map(tab => {
                        const isOwner = tab.owners?.some((o: any) => o.id === user.id);
                        const isEditor = tab.editors?.some((e: any) => e.id === user.id);
                        const isViewer = tab.allowedUsers?.some((a: any) => a.id === user.id);
                        const deptRole = tab.departmentAccess?.find((da: any) => da.department === (user.department || "General"))?.role || "none";
                        const role = isOwner ? "owner" : isEditor ? "editor" : isViewer ? "viewer" : "inherited";
                        const isLocalAdmin = user.email === 'admin@local' || user.name === 'Local Admin';
                        const effectiveRole = isLocalAdmin ? "owner" : (role === "inherited" ? deptRole : role);
                        return (
                          <td key={tab.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: 150 }}>
                            <div className="glass" style={{ width: '100%', position: 'relative', borderRadius: '10px', overflow: 'hidden', minHeight: 34, border: effectiveRole === 'owner' ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)', background: isLocalAdmin ? 'repeating-linear-gradient(45deg, rgba(var(--primary-rgb), 0.25), rgba(var(--primary-rgb), 0.25) 10px, rgba(var(--primary-rgb), 0.35) 10px, rgba(var(--primary-rgb), 0.35) 20px)' : effectiveRole === 'owner' ? 'var(--primary)' : effectiveRole === 'editor' ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ position: 'absolute', pointerEvents: 'none', color: effectiveRole === 'owner' && !isLocalAdmin ? '#fff' : 'var(--text)', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                {isLocalAdmin ? <><ShieldCheck size={11} strokeWidth={3} /> OWNER (ADMIN)</> : role === 'inherited' ? <><ArrowDownLeft size={11} strokeWidth={3} /> {deptRole === 'none' ? 'NOT SHARED' : deptRole.toUpperCase()}</> : effectiveRole === 'none' ? 'NOT SHARED' : effectiveRole.toUpperCase()}
                              </div>
                              <select disabled={isLocalAdmin} value={isLocalAdmin ? "owner" : role} onChange={async (e) => {
                                const newRole = e.target.value;
                                setTabs(prev => prev.map(t => {
                                  if (t.id !== tab.id) return t;
                                  return {
                                    ...t,
                                    owners: newRole === 'owner' ? [...(t.owners || []).filter((o: any) => o.id !== user.id), user] : (t.owners || []).filter((o: any) => o.id !== user.id),
                                    editors: newRole === 'editor' ? [...(t.editors || []).filter((e: any) => e.id !== user.id), user] : (t.editors || []).filter((e: any) => e.id !== user.id),
                                    allowedUsers: newRole === 'viewer' ? [...(t.allowedUsers || []).filter((a: any) => a.id !== user.id), user] : (t.allowedUsers || []).filter((a: any) => a.id !== user.id),
                                  };
                                }));
                                try { await actions.updateTabUserRole(tab.id, user.id, newRole); } catch (e) { console.error(e); }
                              }} style={{ width: '100%', opacity: 0, cursor: isLocalAdmin ? 'default' : 'pointer', height: '100%', position: 'absolute', inset: 0, zIndex: 2 }}>
                                {isLocalAdmin ? <option value="owner">Owner (Admin)</option> : (
                                  <>
                                    <option value="inherited">Inherited</option>
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                    <option value="owner">Owner</option>
                                    <option value="none">Not Shared</option>
                                  </>
                                )}
                              </select>
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

      <style>{`
        .hover-row:hover { background: rgba(var(--primary-rgb), 0.04) !important; }
      `}</style>
    </div>
  );
}
