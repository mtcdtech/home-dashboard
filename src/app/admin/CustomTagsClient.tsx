"use client";

import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { updateGlobalSettings } from "./actions";

export function CustomTagsClient({ initialTags }: { initialTags: any[] }) {
   const [tags, setTags] = useState(initialTags || []);
   const [isSaving, setIsSaving] = useState(false);

   const addTag = () => {
      setTags([...tags, { id: Date.now().toString(), text: "New Tag", color: "#3b82f6", description: "", opacity: 1 }]);
   };

   const updateTag = (id: string, field: string, value: string) => {
      setTags(tags.map(t => t.id === id ? { ...t, [field]: value } : t));
   };

   const removeTag = (id: string) => {
      setTags(tags.filter(t => t.id !== id));
   };

   const handleSave = async () => {
      setIsSaving(true);
      await updateGlobalSettings({ customTags: tags });
      setIsSaving(false);
   };

   return (
      <div className="glass glass-card">
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Tag size={20} /> Custom Tags
            </h3>
            <button onClick={addTag} className="btn" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
               <Plus size={16} /> Add Tag
            </button>
         </div>
         <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem' }}>
            Define custom tags that users can apply to bookmarks to categorize them.
         </p>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {tags.map(tag => (
               <div key={tag.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                     <input type="color" value={tag.color} onChange={e => updateTag(tag.id, 'color', e.target.value)} style={{ width: '36px', height: '36px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }} />
                     <input type="text" value={tag.text} onChange={e => updateTag(tag.id, 'text', e.target.value)} className="glass form-input" style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', minWidth: '120px' }} placeholder="Tag text" />
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', opacity: 0.8, whiteSpace: 'nowrap', padding: '0 0.5rem' }}>
                        <span>Opacity:</span>
                        <input type="range" min="0.1" max="1" step="0.05" value={tag.opacity ?? 1} onChange={e => updateTag(tag.id, 'opacity', e.target.value)} style={{ width: '80px', accentColor: tag.color }} />
                        <span style={{ width: '30px', textAlign: 'right' }}>{Math.round((tag.opacity ?? 1) * 100)}%</span>
                     </div>
                     <button onClick={() => removeTag(tag.id)} className="btn" style={{ padding: '0.5rem', color: '#ef4444', background: 'transparent', border: 'none', flexShrink: 0 }}>
                        <X size={18} />
                     </button>
                  </div>
                  <input type="text" value={tag.description || ""} onChange={e => updateTag(tag.id, 'description', e.target.value)} className="glass form-input" style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }} placeholder="Optional description (shows on hover)" />
               </div>
            ))}
            {tags.length === 0 && <div style={{ fontSize: '0.85rem', opacity: 0.5, textAlign: 'center', padding: '1rem' }}>No tags defined yet.</div>}
         </div>
         <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Tags"}
         </button>
      </div>
   );
}
