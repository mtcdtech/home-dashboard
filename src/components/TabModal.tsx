"use client";

import React, { useState } from "react";
import { X, LayoutGrid, BookMarked } from "lucide-react";
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
}

export function TabModal({ tab, allDepartments, onClose, onSaved, iconRegistry, onUploadIcon, allThemes = [], currentUserId, isAdmin }: TabModalProps) {
  const [title, setTitle] = useState(tab?.title || "");
  const [icon, setIcon] = useState(tab?.icon || "");
  const [isLibraryItem, setIsLibraryItem] = useState(tab?.isLibraryItem ?? false);
  const [themeId, setThemeId] = useState(tab?.themeId || tab?.theme?.id || "");
  const [columns, setColumns] = useState(tab?.columns || 3);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const isOwner = isAdmin || tab?.owners?.some((u: any) => u.id === currentUserId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (tab) {
        await actions.updateTab(tab.id, { title, icon, columns, themeId: themeId || null, isLibraryItem } as any);
      } else {
        await actions.createTab({ title, icon, columns, themeId: themeId || null, isLibraryItem } as any);
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
       <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{tab ? `Configure ${tab.title}` : "Create New Workspace"}</h2>
             <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
          </div>

          <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Workspace Settings</label>
                   <input 
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Workspace Name (e.g. Finance)" 
                      className="glass" 
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1rem', boxSizing: 'border-box' }} 
                   />

                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
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

                   {/* Add to Catalog toggle */}
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '12px', border: `1px solid ${isLibraryItem ? 'var(--primary)' : 'var(--glass-border)'}`, background: isLibraryItem ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent', transition: 'all 0.2s ease' }}>
                      <input
                         type="checkbox"
                         checked={isLibraryItem}
                         onChange={(e) => setIsLibraryItem(e.target.checked)}
                         style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <BookMarked size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
                      <div>
                         <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add to Workspace Catalog</div>
                         <div style={{ fontSize: '0.75rem', opacity: 0.55, marginTop: '2px' }}>Other users can discover and add this workspace to their dashboard</div>
                      </div>
                   </label>
                </div>
             </div>

             <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Workspace UI Icon</label>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <IconPicker currentIcon={icon} setIcon={setIcon} query={query} setQuery={setQuery} iconRegistry={iconRegistry} onUpload={onUploadIcon} />
                </div>
             </div>
          </div>

          <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(var(--primary-rgb), 0.03)' }}>
             <div>
                {tab && (
                   <button 
                      onClick={async () => {
                         if(isOwner) {
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
                         } else {
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
                         }
                      }}
                      disabled={saving}
                      style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, color: '#fff', background: 'rgba(231, 76, 60, 0.8)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: saving ? 0.5 : 1 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.8)'; }}
                   >
                      {isOwner ? "Delete Workspace" : "Remove Workspace"}
                   </button>
                )}
             </div>
             <div style={{ display: 'flex', gap: '1rem' }}>
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
