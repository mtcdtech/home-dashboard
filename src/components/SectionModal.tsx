"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { IconPicker } from "./IconPicker";
import * as actions from "@/app/admin/actions";

export interface SectionModalProps {
  section: any | null; // if null, creating new
  targetTabId?: string; // used for creating new
  onClose: () => void;
  onSaved: () => void;
  iconRegistry?: { selfhost: any[], walkx: any[] };
  onUploadIcon?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<string | null>;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function SectionModal({ section, targetTabId, onClose, onSaved, iconRegistry, onUploadIcon, currentUserId, isAdmin }: SectionModalProps) {
  const [title, setTitle] = useState(section?.title || "");
  const [icon, setIcon] = useState(section?.icon || "");
  const [description, setDescription] = useState(section?.description || "");
  const [isLibraryItem, setIsLibraryItem] = useState(section ? section.isLibraryItem : false);
  const [defaultCollapsed, setDefaultCollapsed] = useState(section ? section.defaultCollapsed : false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const isOwner = isAdmin || section?.owners?.some((u: any) => u.id === currentUserId);
  const isShared = section?.isLibraryItem || section?.organization || (section?.allowedUsers && section.allowedUsers.length > 0) || (section?.departmentAccess && section.departmentAccess.length > 0);
  const showDelete = isOwner;
  const showRemove = isShared || !isOwner;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (section) {
        await actions.updateSection(section.id, { title, icon, isLibraryItem, description } as any);
        if (targetTabId) await actions.updateTabSectionCollapsed(section.id, targetTabId, defaultCollapsed);
      } else if (targetTabId) {
        const newSection = await actions.createSection({ title, icon, isLibraryItem, description, isGlobal: false } as any);
        await actions.addSectionToTab(newSection.id, targetTabId);
        await actions.updateTabSectionCollapsed(newSection.id, targetTabId, defaultCollapsed);
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
       <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '700px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{section ? `Configure ${section.title}` : "New Section"}</h2>
             <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
          </div>

          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Section Name</label>
                <input 
                   autoFocus
                   value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   placeholder="e.g. Finance Dashboard" 
                   className="glass" 
                   style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', boxSizing: 'border-box' }} 
                />

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                   <input 
                      type="checkbox" 
                      checked={defaultCollapsed} 
                      onChange={(e) => setDefaultCollapsed(e.target.checked)} 
                      style={{ width: '18px', height: '18px' }}
                   />
                   <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Default Collapsed (Start minimized on dashboard load)</span>
                </label>

                <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.5rem 0' }}></div>
                 
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                   <input 
                      type="checkbox" 
                      checked={isLibraryItem} 
                      onChange={(e) => setIsLibraryItem(e.target.checked)} 
                      style={{ width: '18px', height: '18px' }}
                   />
                   <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Share in Public Catalog (Allow others to add this section)</span>
                </label>
                 
                {isLibraryItem && (
                   <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Description for Catalog</label>
                      <textarea 
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         placeholder="Briefly describe what this section contains..." 
                         className="glass" 
                         rows={2}
                         style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} 
                      />
                   </div>
                )}
             </div>

             <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Section Icon</label>
                <div style={{ /* expanded dynamically */ }}>
                  <IconPicker currentIcon={icon} setIcon={setIcon} query={query} setQuery={setQuery} iconRegistry={iconRegistry} onUpload={onUploadIcon} />
                </div>
             </div>
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(var(--primary-rgb), 0.03)' }}>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
                {section && targetTabId && showRemove && (
                   <button 
                      onClick={async () => {
                         if(confirm(`Are you sure you want to remove the section "${section.title}" from this workspace?`)) {
                            setSaving(true);
                            try {
                               await actions.removeSectionFromTab(section.id, targetTabId);
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
                      Remove Section
                   </button>
                )}
                {section && targetTabId && showDelete && (
                   <button 
                      onClick={async () => {
                         if(confirm(`Are you sure you want to permanently delete the section "${section.title}" for all users?`)) {
                            setSaving(true);
                            try {
                               await actions.deleteSection(section.id);
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
                      Delete Section
                   </button>
                )}
             </div>
             <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={onClose} className="btn" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600, opacity: (saving || !title.trim()) ? 0.5 : 1 }}>
                   {saving ? "Saving..." : "Save Config"}
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}
