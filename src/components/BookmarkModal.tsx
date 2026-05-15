"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { IconPicker } from "./IconPicker";
import * as actions from "@/app/admin/actions";

export interface BookmarkModalProps {
  bookmark: any | null;
  targetSectionId: string;
  modalMode: "add" | "edit";
  onClose: () => void;
  onSaved: () => void;
  iconRegistry?: { selfhost: any[], walkx: any[] };
  onUploadIcon?: (file: File) => Promise<void>;
  globalTags?: any[];
}

export function BookmarkModal({ bookmark, targetSectionId, modalMode, onClose, onSaved, iconRegistry, onUploadIcon, globalTags = [] }: BookmarkModalProps) {
  const [title, setTitle] = useState(bookmark?.title || "");
  const [url, setUrl] = useState(bookmark?.url || "");
  const [description, setDescription] = useState(bookmark?.description || "");
  const [longDescription, setLongDescription] = useState(bookmark?.longDescription || "");
  const [showMoreInfo, setShowMoreInfo] = useState(!!bookmark?.longDescription);
  const [icon, setIcon] = useState(bookmark?.icon || "");
  const [keywords, setKeywords] = useState(bookmark?.keywords || "");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(bookmark?.tags || []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      if (modalMode === "edit" && bookmark?.id) {
        await actions.updateBookmark(bookmark.id, { title, url, description, longDescription, icon, keywords, tags: selectedTags } as any);
      } else {
        await actions.createBookmark({ title, url, description, longDescription, icon, keywords, tags: selectedTags, sectionId: targetSectionId, order: 999, openInNewTab: true } as any);
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
          {/* Header */}
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{modalMode === 'add' ? 'Add Bookmark' : `Edit: ${bookmark?.title || 'Bookmark'}`}</h2>
             <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
          </div>

          {/* Body */}
          <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {/* Basic Info */}
             <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>App Title</label>
                   <input
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Snipe-IT"
                      required
                      className="glass"
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1rem', boxSizing: 'border-box' }}
                   />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>URL</label>
                   <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      required
                      className="glass"
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1rem', boxSizing: 'border-box' }}
                   />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Description (optional)</label>
                   <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief info about this app"
                      className="glass"
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1rem', boxSizing: 'border-box' }}
                   />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hidden Search Keywords (optional)</label>
                   <input
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g. settings, admin, database"
                      className="glass"
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1rem', boxSizing: 'border-box' }}
                   />
                </div>
                
                <div>
                   <div 
                      onClick={() => setShowMoreInfo(!showMoreInfo)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: showMoreInfo ? '0.5rem' : '0' }}
                   >
                      {showMoreInfo ? '▼' : '▶'} More Info (Markdown supported)
                   </div>
                   {showMoreInfo && (
                      <textarea
                         value={longDescription}
                         onChange={(e) => setLongDescription(e.target.value)}
                         placeholder="Detailed instructions, credentials, or context..."
                         className="glass"
                         style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '0.95rem', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                   )}
                </div>
             </div>

             {/* Icon Picker */}
             <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>App Icon</label>
                <div style={{ /* expanded dynamically */ }}>
                   <IconPicker currentIcon={icon} setIcon={setIcon} query={query} setQuery={setQuery} iconRegistry={iconRegistry} onUpload={onUploadIcon} />
                </div>
             </div>

             {/* Tags */}
             {globalTags && globalTags.length > 0 && (
                <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                   <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Tags</label>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {globalTags.map(tag => {
                         const isSelected = selectedTags.includes(tag.id);
                         return (
                            <button
                               key={tag.id}
                               type="button"
                               onClick={() => {
                                  if (isSelected) {
                                     setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                  } else {
                                     setSelectedTags([...selectedTags, tag.id]);
                                  }
                               }}
                               style={{
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '999px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  border: `1px solid ${tag.color}`,
                                  background: isSelected ? tag.color : 'transparent',
                                  color: isSelected ? '#fff' : tag.color,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                               }}
                            >
                               {tag.text}
                            </button>
                         )
                      })}
                   </div>
                </div>
             )}
          </div>

          {/* Footer */}
          <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(var(--primary-rgb), 0.03)' }}>
             <button onClick={onClose} className="btn" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--glass-border)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancel</button>
             <button onClick={handleSave} disabled={saving || !title.trim() || !url.trim()} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600, opacity: (saving || !title.trim() || !url.trim()) ? 0.5 : 1 }}>
                {saving ? "Saving..." : "Save Bookmark"}
             </button>
          </div>
       </div>
    </div>
  );
}
