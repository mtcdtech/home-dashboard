"use client";

import React, { useState, useMemo, useRef } from "react";
import { Shield, ShieldAlert, Search, Users, ChevronDown, ChevronRight, GripVertical, Plus, FolderOpen, Home, Eye, Edit3, Trash2, Check, X } from "lucide-react";
import { toggleUserAdmin, updateUserDashboardGroup, updateUserDefaultTab, renameGroup, deleteGroup } from "../actions";

export default function UserTable({ initialUsers, allTabs = [] }: { initialUsers: any[]; allTabs?: { id: string; title: string }[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [dragUserId, setDragUserId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const handleToggleAdmin = async (id: string, current: boolean) => {
    setUsers(u => u.map(x => x.id === id ? { ...x, isAdmin: !current } : x));
    await toggleUserAdmin(id, !current);
  };

  const handleMoveUser = async (userId: string, newGroup: string) => {
    setUsers(u => u.map(x => x.id === userId ? { ...x, dashboardGroup: newGroup } : x));
    await updateUserDashboardGroup(userId, newGroup);
  };

  const handleChangeDefaultTab = async (userId: string, tabId: string) => {
    const val = tabId || null;
    setUsers(u => u.map(x => x.id === userId ? { ...x, defaultTabId: val } : x));
    await updateUserDefaultTab(userId, val);
  };

  const handleImpersonate = async (userId: string) => {
    await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    window.open('/', '_blank');
  };

  const handleCreateGroup = () => {
    const name = window.prompt("Enter a name for the new group:");
    if (name && name.trim()) {
      // Create a placeholder user concept — but actually we just need an empty group
      // We'll add the group name to a local list
      setCustomGroups(prev => [...prev, name.trim()]);
    }
  };

  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const toggleCollapse = (group: string) => {
    setCollapsedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  // Group users
  const groups = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = users.filter(u =>
      !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q)
    );

    const groupMap: Record<string, any[]> = {};
    filtered.forEach(u => {
      const g = u.dashboardGroup || "General";
      if (!groupMap[g]) groupMap[g] = [];
      groupMap[g].push(u);
    });

    // Also add empty custom groups
    customGroups.forEach(g => {
      if (!groupMap[g]) groupMap[g] = [];
    });

    // Sort groups: General first, then alphabetical
    const sortedKeys = Object.keys(groupMap).sort((a, b) => {
      if (a === "General") return -1;
      if (b === "General") return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({ name: key, users: groupMap[key] }));
  }, [users, search, customGroups]);

  const admins = users.filter(u => u.isAdmin).length;
  const depts = new Set(users.map(u => u.department || "—")).size;
  const groupCount = new Set(users.map(u => u.dashboardGroup || "General")).size;

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    borderBottom: '1px solid var(--glass-border)',
    verticalAlign: 'middle',
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, userId: string) => {
    setDragUserId(userId);
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, groupName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverGroup(groupName);
  };

  const handleDragLeave = () => {
    setDragOverGroup(null);
  };

  const handleDrop = (e: React.DragEvent, groupName: string) => {
    e.preventDefault();
    setDragOverGroup(null);
    if (dragUserId) {
      const user = users.find(u => u.id === dragUserId);
      if (user && (user.dashboardGroup || "General") !== groupName) {
        handleMoveUser(dragUserId, groupName);
      }
    }
    setDragUserId(null);
  };

  const handleDragEnd = () => {
    setDragUserId(null);
    setDragOverGroup(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Stats Row */}
      <div className="stats-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Users', value: users.length, icon: <Users size={18} /> },
          { label: 'Admins', value: admins, icon: <Shield size={18} /> },
          { label: 'Departments (Entra)', value: depts, icon: <FolderOpen size={18} /> },
          { label: 'Groups', value: groupCount, icon: <FolderOpen size={18} /> },
        ].map(stat => (
          <div key={stat.label} className="glass" style={{
            padding: '1rem 1.5rem', borderRadius: '14px', display: 'flex',
            flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '140px',
            background: 'rgba(var(--primary-rgb), 0.04)', border: '1px solid var(--glass-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.5 }}>
              {stat.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{stat.label}</span>
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Search + Create Group */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }} />
          <input
            id="user-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users, email, department..."
            style={{
              width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem',
              borderRadius: '10px', border: '1px solid var(--glass-border)',
              background: 'rgba(var(--primary-rgb), 0.04)',
              color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <button
          onClick={handleCreateGroup}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                   display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
        >
          <Plus size={15} /> New Group
        </button>
      </div>

      {/* Grouped Table */}
      <div className="admin-table-wrap glass" style={{ borderRadius: '16px', overflow: 'auto', border: '1px solid var(--glass-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '2px solid var(--glass-border)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, width: '36px' }}></th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Email</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Department (Entra)</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'center' }}>Role</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Default Tab</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => {
              const isCollapsed = collapsedGroups.includes(group.name);
              const isDragTarget = dragOverGroup === group.name;

              return (
                <React.Fragment key={group.name}>
                  {/* Group Header Row */}
                  <tr
                    style={{
                      background: isDragTarget
                        ? 'rgba(var(--primary-rgb), 0.15)'
                        : 'rgba(var(--primary-rgb), 0.06)',
                      borderTop: '2px solid rgba(var(--primary-rgb), 0.1)',
                      borderBottom: '1px solid rgba(var(--primary-rgb), 0.08)',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => toggleCollapse(group.name)}
                    onDragOver={(e) => handleDragOver(e, group.name)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, group.name)}
                  >
                    <td colSpan={7} style={{ padding: '0.7rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {isCollapsed
                          ? <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.7, cursor: 'pointer' }} onClick={() => toggleCollapse(group.name)} />
                          : <ChevronDown size={16} style={{ color: 'var(--primary)', opacity: 0.7, cursor: 'pointer' }} onClick={() => toggleCollapse(group.name)} />
                        }
                        <FolderOpen size={16} style={{ color: 'var(--primary)' }} />
                        {editingGroup === group.name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              autoFocus
                              value={editGroupName}
                              onChange={(e) => setEditGroupName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { if (editGroupName.trim() && editGroupName.trim() !== group.name) { renameGroup(group.name, editGroupName.trim()); setUsers(u => u.map(x => x.dashboardGroup === group.name ? { ...x, dashboardGroup: editGroupName.trim() } : x)); } setEditingGroup(null); } if (e.key === 'Escape') setEditingGroup(null); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 800, width: '160px' }}
                            />
                            <button onClick={(e) => { e.stopPropagation(); if (editGroupName.trim() && editGroupName.trim() !== group.name) { renameGroup(group.name, editGroupName.trim()); setUsers(u => u.map(x => x.dashboardGroup === group.name ? { ...x, dashboardGroup: editGroupName.trim() } : x)); } setEditingGroup(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', display: 'flex' }}><Check size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingGroup(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><X size={14} /></button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => toggleCollapse(group.name)}>
                            {group.name}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, opacity: 0.5,
                          background: 'rgba(var(--primary-rgb), 0.1)',
                          padding: '0.1rem 0.45rem', borderRadius: '6px'
                        }}>
                          {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
                        </span>
                        {group.name !== 'General' && editingGroup !== group.name && (
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingGroup(group.name); setEditGroupName(group.name); }} title="Rename Group" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', opacity: 0.5, display: 'flex', padding: '0.2rem' }}><Edit3 size={13} /></button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete group "${group.name}"? All ${group.users.length} user(s) will be moved to the General group.`)) { deleteGroup(group.name); setUsers(u => u.map(x => x.dashboardGroup === group.name ? { ...x, dashboardGroup: 'General' } : x)); setCustomGroups(prev => prev.filter(g => g !== group.name)); } }} title="Delete Group" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5, display: 'flex', padding: '0.2rem' }}><Trash2 size={13} /></button>
                          </div>
                        )}
                        {isDragTarget && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', marginLeft: isDragTarget && group.name !== 'General' ? '0' : 'auto' }}>
                            Drop here to move user
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* User Rows */}
                  {!isCollapsed && group.users.map((user, i) => (
                    <tr
                      key={user.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, user.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: dragUserId === user.id
                          ? 'rgba(var(--primary-rgb), 0.08)'
                          : i % 2 === 0 ? 'transparent' : 'rgba(var(--primary-rgb), 0.015)',
                        transition: 'background 0.15s',
                        opacity: dragUserId === user.id ? 0.5 : 1,
                        cursor: 'grab',
                      }}
                      className="user-row"
                    >
                      {/* Drag Handle */}
                      <td style={{ ...tdStyle, width: '36px', textAlign: 'center', cursor: 'grab' }}>
                        <GripVertical size={14} style={{ opacity: 0.25 }} />
                      </td>

                      {/* Name + Avatar */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: user.avatarColor || 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 800, color: '#fff'
                          }}>
                            {(user.name || user.email || "?")[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name || <span style={{ opacity: 0.4 }}>Unnamed</span>}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ ...tdStyle, opacity: 0.6, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {user.email}
                      </td>

                      {/* Entra Department */}
                      <td style={tdStyle}>
                        {user.department
                          ? <span style={{
                              padding: '0.18rem 0.5rem',
                              background: 'rgba(var(--primary-rgb), 0.1)',
                              color: 'var(--primary)',
                              borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700
                            }}>
                              {user.department}
                            </span>
                          : <span style={{ opacity: 0.25, fontSize: '0.8rem' }}>—</span>
                        }
                      </td>

                      {/* Admin Toggle */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          id={`admin-toggle-${user.id}`}
                          onClick={(e) => { e.stopPropagation(); handleToggleAdmin(user.id, user.isAdmin); }}
                          title={user.isAdmin ? "Click to remove admin" : "Click to make admin"}
                          style={{
                            background: user.isAdmin ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.08)',
                            color: user.isAdmin ? '#fff' : 'var(--text)',
                            border: 'none', borderRadius: '8px', padding: '0.35rem 0.75rem',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                            gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s'
                          }}
                        >
                          {user.isAdmin ? <><Shield size={13} /> Admin</> : <><ShieldAlert size={13} style={{ opacity: 0.4 }} /> Standard</>}
                        </button>
                      </td>

                      {/* Default Workspace */}
                      <td style={{ ...tdStyle, minWidth: '120px' }}>
                        <select 
                          value={user.defaultTabId || ""}
                          onChange={(e) => handleChangeDefaultTab(user.id, e.target.value)}
                          className="glass"
                          style={{ padding: '0.25rem 0.4rem', borderRadius: '6px', fontSize: '0.72rem', width: '100%', cursor: 'pointer' }}
                        >
                          <option value="">Auto</option>
                          {allTabs.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </td>

                      {/* Impersonate */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleImpersonate(user.id)}
                          title={`View dashboard as ${user.name || user.email}`}
                          style={{
                            background: 'rgba(var(--primary-rgb), 0.08)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(var(--primary-rgb), 0.2)',
                            borderRadius: '8px', padding: '0.35rem 0.6rem',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                            gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.08)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        >
                          <Eye size={13} /> Preview
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Empty group drop zone */}
                  {!isCollapsed && group.users.length === 0 && (
                    <tr
                      onDragOver={(e) => handleDragOver(e, group.name)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, group.name)}
                    >
                      <td colSpan={6} style={{
                        ...tdStyle, textAlign: 'center', opacity: 0.3, padding: '1.5rem',
                        background: isDragTarget ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
                        fontStyle: 'italic', fontSize: '0.8rem'
                      }}>
                        Drag users here to add them to this group
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '0.75rem', opacity: 0.4, textAlign: 'right' }}>
        {users.length} users across {groups.length} groups
      </div>

      <style>{`
        .user-row:hover { background: rgba(var(--primary-rgb), 0.04) !important; }
        .user-row:hover td:first-child svg { opacity: 0.6 !important; }
      `}</style>
    </div>
  );
}
