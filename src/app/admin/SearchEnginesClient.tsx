"use client";

import { useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { updateGlobalSettings } from "./actions";

export function SearchEnginesClient({ initialEngines }: { initialEngines: any[] }) {
   const defaultEngines = [
      { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
      { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
      { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?q=' },
      { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=' }
   ];

   const [engines, setEngines] = useState(initialEngines && initialEngines.length > 0 ? initialEngines : defaultEngines);
   const [isSaving, setIsSaving] = useState(false);

   const addEngine = () => {
      setEngines([...engines, { id: Date.now().toString(), name: "New Engine", url: "https://" }]);
   };

   const updateEngine = (id: string, field: string, value: string) => {
      setEngines(engines.map(e => e.id === id ? { ...e, [field]: value } : e));
   };

   const removeEngine = (id: string) => {
      setEngines(engines.filter(e => e.id !== id));
   };

   const handleSave = async () => {
      setIsSaving(true);
      await updateGlobalSettings({ searchEngines: engines });
      setIsSaving(false);
   };

   return (
      <div className="glass glass-card">
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Search size={20} /> Search Engines
            </h3>
            <button onClick={addEngine} className="btn" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
               <Plus size={16} /> Add Engine
            </button>
         </div>
         <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem' }}>
            Define custom search engines. The URL should end where the search query will be appended.
         </p>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {engines.map(engine => (
               <div key={engine.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                     <input type="text" value={engine.name} onChange={e => updateEngine(engine.id, 'name', e.target.value)} className="glass form-input" style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', minWidth: '100px' }} placeholder="Name (e.g. Google)" />
                     <button onClick={() => removeEngine(engine.id)} className="btn" style={{ padding: '0.5rem', color: '#ef4444', background: 'transparent', border: 'none', flexShrink: 0 }}>
                        <X size={18} />
                     </button>
                  </div>
                  <input type="text" value={engine.url} onChange={e => updateEngine(engine.id, 'url', e.target.value)} className="glass form-input" style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }} placeholder="URL (e.g. https://www.google.com/search?q=)" />
               </div>
            ))}
            {engines.length === 0 && <div style={{ fontSize: '0.85rem', opacity: 0.5, textAlign: 'center', padding: '1rem' }}>No search engines defined.</div>}
         </div>
         <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Engines"}
         </button>
      </div>
   );
}
