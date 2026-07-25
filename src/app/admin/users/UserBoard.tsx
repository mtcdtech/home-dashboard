"use client";

import React, { useState, useMemo, useRef } from "react";
import { Shield, ShieldAlert, Search, Users, ChevronDown, ChevronRight, GripVertical, Plus, FolderOpen, Home, Eye, Edit3, Trash2, Check, X, Key, Lock, EyeOff, Link as LinkIcon, Unlink, RefreshCw } from "lucide-react";
import { toggleUserAdmin, updateUserDashboardGroup, updateUserDefaultTab, renameGroup, deleteGroup, deleteUser, updateLocalAdminSettings, iamBackfillDryRun, iamBackfillApply, iamManualLink, iamUnlink } from "../actions";

export default function UserTable({ initialUsers, allTabs = [], initialDisableLocalAdmin = false }: { initialUsers: any[]; allTabs?: { id: string; title: string }[]; initialDisableLocalAdmin?: boolean }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filterUnlinked, setFilterUnlinked] = useState(false);
  const [isSyncingIam, setIsSyncingIam] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [dragUserId, setDragUserId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const [disableLocalAdmin, setDisableLocalAdmin] = useState(initialDisableLocalAdmin);
  const [showLocalAdminModal, setShowLocalAdminModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingLocalAdmin, setIsSavingLocalAdmin] = useState(false);

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

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to completely delete user "${userName}"? This cannot be undone.`)) {
      setUsers(u => u.filter(x => x.id !== userId));
      await deleteUser(userId).catch((err) => {
        alert(err.message || "Failed to delete user");
        // Could technically revert UI here but page refresh will fix
      });
    }
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

  const unlinkedCount = useMemo(() => users.filter(u => !u.mtcdPersonId).length, [users]);

  const handleManualLink = async (userId: string, currentName: string) => {
    const pid = window.prompt(`Enter mtcd_person_id to link to user "${currentName}":`);
    if (!pid || !pid.trim()) return;
    try {
      const res = await iamManualLink(userId, pid.trim());
      setUsers(u => u.map(x => x.id === userId ? { ...x, ...res.user } : x));
      alert(`User "${currentName}" linked to ${pid.trim()}`);
    } catch (e: any) {
      alert("Failed to link IAM person ID: " + (e.message || e));
    }
  };

  const handleUnlink = async (userId: string, currentName: string) => {
    if (confirm(`Unlink IAM person ID from user "${currentName}"?`)) {
      try {
        const res = await iamUnlink(userId);
        setUsers(u => u.map(x => x.id === userId ? { ...x, ...res.user } : x));
      } catch (e: any) {
        alert("Failed to unlink: " + (e.message || e));
      }
    }
  };

  const handleBackfillDryRun = async () => {
    setIsSyncingIam(true);
    try {
      const res = await iamBackfillDryRun();
      alert(`[IAM Dry-Run Summary]\nMatched: ${res.stats.matched}\nAmbiguous: ${res.stats.ambiguous}\nUnmatched: ${res.stats.unmatched}\nAlready Taken: ${res.stats.alreadyTaken}\nReport saved to: ${res.outFile}`);
    } catch (e: any) {
      alert("IAM Dry-Run failed: " + (e.message || e));
    } finally {
      setIsSyncingIam(false);
    }
  };

  const handleBackfillApply = async () => {
    if (!confirm("Run IAM Backfill (APPLY)? This will write mtcdPersonId to matching local users.")) return;
    setIsSyncingIam(true);
    try {
      const res = await iamBackfillApply();
      alert(`[IAM Backfill Applied]\nApplied: ${res.stats.applied}\nMatched: ${res.stats.matched}\nAmbiguous: ${res.stats.ambiguous}\nUnmatched: ${res.stats.unmatched}`);
      window.location.reload();
    } catch (e: any) {
      alert("IAM Backfill failed: " + (e.message || e));
    } finally {
      setIsSyncingIam(false);
    }
  };

  // Group users
  const groups = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = users.filter(u => {
      const matchesSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q) || u.mtcdPersonId?.toLowerCase().includes(q);
      const matchesUnlinked = !filterUnlinked || !u.mtcdPersonId;
      return matchesSearch && matchesUnlinked;
    });

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
  }, [users, search, filterUnlinked, customGroups]);

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

      {/* Search + Controls */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }} />
          <input
            id="user-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users, email, department, pid..."
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
          onClick={() => setFilterUnlinked(!filterUnlinked)}
          className="btn glass"
          style={{
            padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap',
            background: filterUnlinked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(var(--primary-rgb), 0.04)',
            border: filterUnlinked ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--glass-border)',
            color: filterUnlinked ? '#ef4444' : 'var(--text)'
          }}
        >
          <Unlink size={15} /> Unlinked from IAM ({unlinkedCount})
        </button>

        <button
          disabled={isSyncingIam}
          onClick={handleBackfillDryRun}
          className="btn glass"
          style={{
            padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap'
          }}
        >
          <RefreshCw size={15} className={isSyncingIam ? "animate-spin" : ""} /> IAM Dry-Run
        </button>

        <button
          disabled={isSyncingIam}
          onClick={handleBackfillApply}
          className="btn glass"
          style={{
            padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap',
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981'
          }}
        >
          <LinkIcon size={15} /> Backfill IAM
        </button>

        <button
          onClick={handleCreateGroup}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                   display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
        >
          <Plus size={15} /> New Group
        </button>

        <button
          onClick={() => setShowLocalAdminModal(true)}
          className="btn glass"
          style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                   display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap',
                   background: disableLocalAdmin ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--primary-rgb), 0.1)',
                   border: disableLocalAdmin ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--glass-border)',
                   color: disableLocalAdmin ? '#ef4444' : 'var(--text)' }}
        >
          <Key size={15} /> Local Admin Settings {disableLocalAdmin ? "(Disabled)" : "(Active)"}
        </button>
      </div>

      {showLocalAdminModal && (
        <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '500px', borderRadius: '24px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Key size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Local Admin Settings</h3>
              </div>
              <button onClick={() => setShowLocalAdminModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderRadius: '12px', background: 'rgba(var(--primary-rgb), 0.05)', cursor: 'pointer', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Disable Local Admin Sign In</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Hides the "Use Local Account" option on the login screen and blocks local admin credentials.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={disableLocalAdmin}
                  onChange={(e) => setDisableLocalAdmin(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>Change Local Admin Password</span>
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setShowLocalAdminModal(false)}
                className="btn glass"
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={isSavingLocalAdmin}
                onClick={async () => {
                  if (newPassword && newPassword !== confirmPassword) {
                    return alert("Passwords do not match!");
                  }
                  setIsSavingLocalAdmin(true);
                  try {
                    await updateLocalAdminSettings({
                      disableLocalAdmin,
                      password: newPassword ? newPassword.trim() : undefined
                    });
                    alert("Local admin settings updated successfully!");
                    setNewPassword("");
                    setConfirmPassword("");
                    setShowLocalAdminModal(false);
                  } catch (e: any) {
                    alert("Failed to update local admin settings: " + (e.message || e));
                  } finally {
                    setIsSavingLocalAdmin(false);
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {isSavingLocalAdmin ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped Table */}
      <div className="admin-table-wrap glass" style={{ borderRadius: '16px', overflow: 'auto', border: '1px solid var(--glass-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '2px solid var(--glass-border)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, width: '36px' }}></th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Email</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>Department (Entra)</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, textAlign: 'left' }}>IAM Link</th>
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
                    <td colSpan={8} style={{ padding: '0.7rem 1rem' }}>
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

                      {/* IAM Link */}
                      <td style={tdStyle}>
                        {user.mtcdPersonId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <a
                              href={`https://admin.server.mtcd.org/iam/users?pid=${user.mtcdPersonId}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`Source: ${user.mtcdIdentitySource || "Authentik SSO"}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                padding: '0.18rem 0.5rem', borderRadius: '6px',
                                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                                fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace',
                                textDecoration: 'none'
                              }}
                            >
                              <LinkIcon size={12} /> {user.mtcdPersonId.slice(0, 16)}...
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnlink(user.id, user.name || user.email); }}
                              title="Unlink IAM Person ID"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6, padding: '0.1rem', display: 'flex' }}
                            >
                              <Unlink size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ opacity: 0.35, fontSize: '0.75rem', fontStyle: 'italic' }}>Unlinked</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleManualLink(user.id, user.name || user.email); }}
                              title="Manually link mtcd_person_id"
                              style={{
                                background: 'rgba(var(--primary-rgb), 0.08)', color: 'var(--primary)',
                                border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '6px',
                                padding: '0.15rem 0.45rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                              }}
                            >
                              <LinkIcon size={11} /> Link
                            </button>
                          </div>
                        )}
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

                      {/* Actions */}
                      <td style={{ ...tdStyle, textAlign: 'center', minWidth: '150px' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
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
                          
                          <button
                            onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                            title="Delete User"
                            style={{
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '8px', padding: '0.35rem 0.5rem',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
                      <td colSpan={8} style={{
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
