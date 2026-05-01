"use client";

import React, { useState } from "react";
import { X, LayoutGrid, BookMarked, KeyRound, Copy } from "lucide-react";
import { IconPicker } from "./IconPicker";
import * as actions from "@/app/admin/actions";

export interface TabModalProps {
  tab: any | null; // if null, creating new
  allDepartments: string[];
  onClose: () => void;
  onSaved: () => void;
  iconRegistry?: { selfhost: any[], walkx: any[] };
  onUploadIcon?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<string | null>;
  allThemes?: any[];
  currentUserId?: string;
  isAdmin?: boolean;
  allUsers?: any[];
}

export function TabModal({ tab, allDepartments, onClose, onSaved, iconRegistry, onUploadIcon, allThemes = [], currentUserId, isAdmin, allUsers = [] }: TabModalProps) {
  const [title, setTitle] = useState(tab?.title || "");
  const [icon, setIcon] = useState(tab?.icon || "");
  const [description, setDescription] = useState(tab?.description || "");
  const [isLibraryItem, setIsLibraryItem] = useState(tab?.isLibraryItem ?? false);
  const [isPublic, setIsPublic] = useState(tab?.isPublic ?? false);
  const [themeId, setThemeId] = useState(tab?.themeId || tab?.theme?.id || "");
  const [columns, setColumns] = useState(tab?.columns || 3);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const isOwner = isAdmin || tab?.owners?.some((u: any) => u.id === currentUserId);
  const isShared = tab?.isLibraryItem || tab?.organization || (tab?.allowedUsers && tab.allowedUsers.length > 0) || (tab?.departmentAccess && tab.departmentAccess.length > 0);
  const showDelete = isOwner;
  const showRemove = !isOwner;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (tab) {
        await actions.updateTab(tab.id, { title, icon, description, columns, themeId: themeId || null, isLibraryItem, isPublic } as any);
      } else {
        await actions.createTab({ title, icon, description, columns, themeId: themeId || null, isLibraryItem, isPublic } as any);
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!newOwnerId || !tab || !currentUserId) return;
    if (!confirm("Are you sure you want to transfer ownership? You will lose owner access.")) return;
    setTransferring(true);
    try {
      await actions.transferTabOwnership(tab.id, currentUserId, newOwnerId);
      onSaved();
    } catch(err) {
      console.error(err);
      alert("Failed to transfer ownership.");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
       <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{tab ? `Configure ${tab.title}` : "Create New Workspace"}</h2>
             <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
          </div>

          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Workspace Settings</label>
                   <input 
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Workspace Name (e.g. Finance)" 
                      className="glass" 
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', boxSizing: 'border-box' }} 
                   />

                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                         <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Column Layout</label>
                         <select 
                            value={columns} 
                            onChange={(e) => setColumns(Number(e.target.value))}
                            className="glass"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', outline: 'none' }}
                         >
                            <option value={2}>2 Columns</option>
                            <option value={3}>3 Columns</option>
                            <option value={4}>4 Columns</option>
                            <option value={5}>5 Columns (Wide)</option>
                            <option value={6}>6 Columns (Ultra Wide)</option>
                         </select>
                      </div>
                   
                      <div style={{ flex: 1, minWidth: '150px' }}>
                         <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Workspace Theme</label>
                         <select 
                            value={themeId} 
                            onChange={(e) => setThemeId(e.target.value)}
                            className="glass"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', outline: 'none' }}
                         >
                            <option value="">-- Inherit System Theme --</option>
                            {allThemes.map(t => (
                               <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem 0.8rem', borderRadius: '12px', border: `1px solid ${isLibraryItem ? 'var(--primary)' : 'var(--glass-border)'}`, background: isLibraryItem ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent', transition: 'all 0.2s ease' }}>
                      <input
                         type="checkbox"
                         checked={isLibraryItem}
                         onChange={(e) => setIsLibraryItem(e.target.checked)}
                         style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <BookMarked size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
                      <div>
                         <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add to Workspace Catalog</div>
                         <div style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '2px' }}>Other users can discover and add this workspace to their dashboard</div>
                      </div>
                   </label>

                   {isAdmin && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem 0.8rem', borderRadius: '12px', border: `1px solid ${isPublic ? 'var(--primary)' : 'var(--glass-border)'}`, background: isPublic ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent', transition: 'all 0.2s ease' }}>
                         <input
                            type="checkbox"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                         />
                         <LayoutGrid size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
                         <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Public Access (No Login Required)</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '2px' }}>Allow anyone with the link to view this workspace. Admins only.</div>
                         </div>
                      </label>
                   )}

                   {isLibraryItem && (
                      <div style={{ marginTop: '0.25rem' }}>
                         <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Description for Catalog</label>
                         <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Briefly describe what this workspace is used for..." 
                            className="glass" 
                            rows={2}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} 
                         />
                      </div>
                   )}

                </div>
             </div>

             <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Workspace UI Icon</label>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <IconPicker currentIcon={icon} setIcon={setIcon} query={query} setQuery={setQuery} iconRegistry={iconRegistry} onUpload={onUploadIcon} />
                </div>
             </div>

             {tab && isOwner && allUsers.length > 0 && (
                <div className="glass-card" style={{ padding: '1rem', borderRadius: '10px', border: '1px solid rgba(231, 140, 60, 0.3)', background: 'rgba(231, 140, 60, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(231, 140, 60, 1)', textTransform: 'uppercase' }}>Transfer Ownership</label>
                   <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Select a user to transfer ownership of this workspace to them. You will be downgraded to an editor.</div>
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                         value={newOwnerId}
                         onChange={(e) => setNewOwnerId(e.target.value)}
                         className="glass"
                         style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', outline: 'none' }}
                      >
                         <option value="">-- Select New Owner --</option>
                         {allUsers.filter(u => u.id !== currentUserId).map(u => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                         ))}
                      </select>
                      <button 
                         onClick={handleTransferOwnership}
                         disabled={transferring || !newOwnerId}
                         style={{ padding: '0 1.5rem', borderRadius: '10px', fontWeight: 600, background: 'rgba(231, 140, 60, 0.8)', color: '#fff', border: 'none', cursor: (!newOwnerId || transferring) ? 'not-allowed' : 'pointer', opacity: (!newOwnerId || transferring) ? 0.5 : 1 }}
                      >
                         {transferring ? "Transferring..." : "Transfer"}
                      </button>
                   </div>
                </div>
             )}
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(var(--primary-rgb), 0.03)' }}>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
                {tab && showRemove && (
                   <button 
                      onClick={async () => {
                         if(confirm(`Are you sure you want to remove the workspace "${tab.title}" from your dashboard?`)) {
                            setSaving(true);
                            try {
                               await actions.removeTabFromUser(tab.id);
                               onSaved();
                            } catch(e) {
                               console.error(e);
                               setSaving(false);
                            }
                         }
                      }}
                      disabled={saving}
                      style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, color: '#fff', background: 'rgba(231, 140, 60, 0.8)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: saving ? 0.5 : 1 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(231, 140, 60, 1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(231, 140, 60, 0.8)'; }}
                   >
                      Remove Workspace
                   </button>
                )}
                {tab && showDelete && (
                   <button 
                      onClick={async () => {
                         if(confirm(`Are you sure you want to permanently delete the workspace "${tab.title}" for all users?`)) {
                            setSaving(true);
                            try {
                               await actions.deleteTab(tab.id);
                               onSaved();
                            } catch(e) {
                               console.error(e);
                               setSaving(false);
                            }
                         }
                      }}
                      disabled={saving}
                      style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, color: '#fff', background: 'rgba(231, 76, 60, 0.8)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: saving ? 0.5 : 1 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.8)'; }}
                   >
                      Delete Workspace
                   </button>
                )}
             </div>
             <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={onClose} className="btn" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600, opacity: (saving || !title.trim()) ? 0.5 : 1 }}>
                   {saving ? "Saving..." : "Save Workspace"}
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}
