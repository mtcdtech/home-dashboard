"use client";

import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
import { Upload, X } from "lucide-react";
import { Icon } from "@iconify/react";
import { getIconRegistry, getCachedIconRegistry } from "@/lib/iconRegistry";

export const IconComponent = ({ name, size = 24, className = "", fallback }: { name?: string | null | undefined, size?: number, className?: string, fallback?: React.ReactNode }) => {
  if (!name) return fallback || null;
  if (name.startsWith("http") || name.startsWith("/") || name.startsWith("data:")) {
    // If it's a relative path, we proxy it to ensure it's served correctly in Docker
    const src = (name.startsWith("/") && !name.startsWith("/api")) ? name : name;
    return <img src={src} alt="" style={{ maxWidth: size, maxHeight: size, width: 'auto', height: 'auto', objectFit: 'contain' }} className={className} />;
  }
  
  // Handle Iconify strings (they contain a colon, e.g. "mdi:home")
  if (name.includes(":")) {
    return <Icon icon={name} width={size} height={size} className={className} />;
  }

  const LucideIcon = (LucideIcons as any)[name];
  return LucideIcon ? <LucideIcon size={size} className={className} /> : (fallback || null);
};

export const IconPicker = ({ 
  currentIcon, 
  setIcon, 
  query, 
  setQuery, 
  iconRegistry,
  onUpload
}: { 
  currentIcon: string | null | undefined; 
  setIcon: (icon: any) => void; 
  query: string; 
  setQuery: (q: string) => void;
  iconRegistry: string[];
  onUpload: (file: File) => Promise<void>;
}) => {
  const [activeSource, setActiveSource] = useState<"catalog" | "brands" | "extended" | "custom">("catalog");
  const [isDragging, setIsDragging] = useState(false);
  
  const uploadFile = async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      try {
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (data.url) setIcon(data.url);
      } catch (e) {
          console.error(e);
      }
  };

  const handleDropLocal = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) await uploadFile(file);
  };

  const [localRegistry, setLocalRegistry] = useState<string[]>(
    iconRegistry && iconRegistry.length ? iconRegistry : (getCachedIconRegistry() || [])
  );
  React.useEffect(() => {
     if (iconRegistry && iconRegistry.length) {
        setLocalRegistry(iconRegistry);
        return;
     }
     if (localRegistry.length === 0) {
        getIconRegistry().then(icons => setLocalRegistry(icons));
     }
  }, [iconRegistry]);


  const normalizedCatalogQuery = query.toLowerCase().trim().replace(/\s+/g, '-');

  return (
    <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.5, marginBottom: '-0.5rem' }}>
          <LucideIcons.Image size={14} />
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Icon Selection</h4>
      </div>

      <div className="glass" style={{ display: 'flex', padding: '0.25rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
         {(["catalog", "brands", "extended", "custom"] as const).map(src => (
            <button 
                key={src}
                type="button"
                onClick={() => setActiveSource(src)}
                className="btn"
                style={{ 
                    flex: 1, padding: '0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                    background: activeSource === src ? 'var(--primary)' : 'transparent',
                    color: activeSource === src ? 'var(--nav-text)' : 'var(--text)',
                    opacity: activeSource === src ? 1 : 0.6, transition: 'all 0.2s',
                    justifyContent: 'center', textAlign: 'center'
                }}
            >
                {src === "catalog" ? "Logos" : src === "brands" ? "Brands" : src === "extended" ? "Universal" : "Custom"}
            </button>
         ))}
      </div>

      {activeSource === "catalog" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <input 
                        type="text" 
                        placeholder="Search 3,200+ brand logos..." 
                        className="glass"
                        style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem', borderRadius: '8px', outline: 'none', border: '1px solid transparent' }}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <button type="button" className="btn btn-primary" style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                          Search
                      </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingRight: '4px' }}>
                      {localRegistry
                        .filter(item => {
                            const searchStr = item.toLowerCase();
                            return !query || searchStr.includes(normalizedCatalogQuery) || searchStr.includes(query.toLowerCase());
                        })
                        .slice(0, query ? 240 : 120)
                        .map(item => {
                          const isSelfHost = item.includes("selfhst-");
                          const url = isSelfHost ? item : `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${item}.png`;
                          const name = isSelfHost ? item.split('/').pop()?.replace('.png','') : item;
                          return (
                            <button 
                              key={item}
                              type="button"
                              onClick={() => setIcon(url)}
                              className="glass"
                              style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', border: currentIcon === url ? '2px solid var(--primary)' : '1px solid transparent', background: 'rgba(255,255,255,0.05)' }}
                            >
                              <img src={url} alt={name} style={{ width: '28px', height: '28px' }} title={name} />
                            </button>
                          );
                        })
                      }
                      {localRegistry.length === 0 && <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>Loading catalog...</p>}
                  </div>
              </div>
          </div>
      )}


      
      {activeSource === "brands" && (
         <BrandfetchPicker setIcon={setIcon} currentIcon={currentIcon} />
      )}
      {activeSource === "extended" && (
         <IconifyPicker setIcon={setIcon} currentIcon={currentIcon} />
      )}
      {activeSource === "custom" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDropLocal}
                style={{ 
                  border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--glass-border)'}`,
                  borderRadius: '12px', padding: '1.5rem', textAlign: 'center', transition: 'all 0.2s',
                  background: isDragging ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.03)'
                }}
              >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <input 
                        type="file" 
                        id="icon-upload-picker" 
                        hidden 
                        onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                      />
                      <label htmlFor="icon-upload-picker" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--primary)', color: 'var(--nav-text)', padding: '0.75rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                          <Upload size={16} /> Choose File
                      </label>
                      <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>- or -</span>
                      <input 
                        id="icon-input-manual" 
                        value={currentIcon || ""} 
                        onChange={(e) => setIcon(e.target.value)}
                        placeholder="Paste image URL here..." 
                        className="glass" 
                        style={{ padding: '0.75rem', borderRadius: '8px', width: '100%', fontSize: '0.9rem' }} 
                      />
                  </div>
                  <p style={{ margin: '1rem 0 0 0', fontSize: '0.75rem', opacity: 0.4 }}>Drag and drop SVG / PNG / JPG legacy assets here</p>
              </div>
          </div>
      )}

      {/* Current Preview */}
      {currentIcon && (
        <div className="glass" style={{ padding: '0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(var(--primary-rgb), 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
                <IconComponent name={currentIcon} size={32} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', opacity: 0.5, display: 'block' }}>Selected Icon Path</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{currentIcon}</span>
            </div>
            <button onClick={() => setIcon("")} className="btn" style={{ opacity: 0.5 }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
};

const IconifyPicker = ({ setIcon, currentIcon }: any) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<string[]>([]);
    const [searching, setSearching] = useState(false);

    const search = async () => {
        if (!query) return;
        setSearching(true);
        try {
            const res = await fetch(`https://api.iconify.design/search?query=${query}&limit=64`);
            const data = await res.json();
            setResults(data.icons || []);
        } catch (e) {}
        setSearching(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input 
                        className="glass" 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
                        placeholder="Search 150,000+ icons (Material, Brand logos, etc)..." 
                        style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem', borderRadius: '8px' }} 
                    />
                    <button type="button" onClick={(e) => { e.preventDefault(); search(); }} className="btn btn-primary" style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                        {searching ? "..." : "Search"}
                    </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', /* maxHeight removed to prevent nested scrollbars */ }}>
                    {results.map(name => (
                        <button 
                            key={name}
                            type="button"
                            onClick={() => setIcon(name)}
                            className="glass"
                            style={{ 
                                padding: '10px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', 
                                border: currentIcon === name ? '2px solid var(--primary)' : '1px solid transparent',
                                background: currentIcon === name ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(255,255,255,0.05)'
                            }}
                        >
                            <IconComponent name={name} size={20} />
                        </button>
                    ))}
                    {!results.length && !searching && <p style={{ fontSize: '0.75rem', opacity: 0.3, width: '100%', textAlign: 'center', padding: '1rem' }}>Enter a keyword (e.g. "church", "it", "home")</p>}
                </div>
            </div>
        </div>
    );
};


const BrandfetchPicker = ({ setIcon, currentIcon }: any) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const search = async () => {
        if (!query) return;
        setSearching(true);
        try {
            const res = await fetch(`https://api.brandfetch.io/v2/search/${encodeURIComponent(query)}`);
            const data = await res.json();
            if (Array.isArray(data)) {
               setResults(data);
            } else {
               setResults([]);
            }
        } catch (e) {
            console.error(e);
            setResults([]);
        }
        setSearching(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="glass" style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input 
                        className="glass" 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
                        placeholder="Search millions of brands (e.g. Google, Nike, Apple)..." 
                        style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem', borderRadius: '8px' }} 
                    />
                    <button type="button" onClick={(e) => { e.preventDefault(); search(); }} className="btn btn-primary" style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                        {searching ? "..." : "Search"}
                    </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', /* maxHeight removed to prevent nested scrollbars */ }}>
                    {results.map((brand, idx) => {
                        if (!brand.icon) return null;
                        const iconUrl = brand.icon;
                        return (
                          <button 
                              key={`${brand.domain}-${idx}`}
                              type="button"
                              onClick={() => setIcon(iconUrl)}
                              className="glass"
                              title={brand.name}
                              style={{ 
                                  padding: '8px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', 
                                  border: currentIcon === iconUrl ? '2px solid var(--primary)' : '1px solid transparent',
                                  background: currentIcon === iconUrl ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(255,255,255,0.05)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                                  width: '56px'
                              }}
                          >
                              <img src={iconUrl} style={{ width: '32px', height: '32px', objectFit: 'contain' }} alt={brand.name} />
                              <span style={{ fontSize: '0.5rem', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{brand.name}</span>
                          </button>
                        );
                    })}
                    {!results.length && !searching && <p style={{ fontSize: '0.75rem', opacity: 0.3, width: '100%', textAlign: 'center', padding: '1rem' }}>Enter a brand name to fetch its official logo.</p>}
                </div>
            </div>
        </div>
    );
};
