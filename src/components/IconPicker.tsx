"use client";

import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
import { Upload, X, Trash2, Search, RefreshCw } from "lucide-react";
import { Icon } from "@iconify/react";
import { getIconRegistry, getCachedIconRegistry } from "@/lib/iconRegistry";
import { downloadAndStoreIcon, getCustomUploadedIcons, checkIconUsage, deleteCustomUploadedIcon } from "@/app/admin/actions";

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
  const [isStoring, setIsStoring] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>(currentIcon || "");

  React.useEffect(() => {
    setManualInput(currentIcon || "");
  }, [currentIcon]);

  const handleSelectIcon = async (url: string) => {
    setPickerError(null);
    if (!url) {
      setIcon("");
      return;
    }

    if (/^https?:\/\//i.test(url) && !url.includes('/uploads/')) {
      setIsStoring(true);
      try {
        const res = await downloadAndStoreIcon(url);
        if (res?.localPath) {
          setIcon(res.localPath);
        } else {
          setPickerError(res?.error || "Failed to download and store icon on server");
        }
      } catch (err: any) {
        setPickerError(err.message || "Error downloading icon");
      } finally {
        setIsStoring(false);
      }
    } else {
      setIcon(url);
    }
  };
  
  const [uploadedIcons, setUploadedIcons] = useState<Array<{ name: string; url: string; mtime: number }>>([]);
  const [loadingUploaded, setLoadingUploaded] = useState(false);
  const [customSearchFilter, setCustomSearchFilter] = useState("");
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  const loadUploadedIcons = async () => {
    setLoadingUploaded(true);
    try {
      const res = await getCustomUploadedIcons();
      setUploadedIcons(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUploaded(false);
    }
  };

  React.useEffect(() => {
    if (activeSource === "custom") {
      loadUploadedIcons();
    }
  }, [activeSource]);

  const uploadFile = async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      try {
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (data.url) {
            setIcon(data.url);
            loadUploadedIcons();
          }
      } catch (e) {
          console.error(e);
      }
  };

  const handleDeleteUploadedIcon = async (url: string) => {
    setDeletingUrl(url);
    try {
      const usage = await checkIconUsage(url);
      let confirmMsg = `Are you sure you want to delete this uploaded icon (${url.split('/').pop()})?`;
      if (usage.inUse) {
        const itemNames = usage.details.slice(0, 5).map(d => `${d.type}: ${d.title}`).join(', ');
        const moreCount = usage.details.length > 5 ? ` and ${usage.details.length - 5} more` : '';
        confirmMsg = `WARNING: This icon is currently in use by ${usage.usageCount} item(s) on your dashboard (${itemNames}${moreCount}).\n\nDeleting it will remove the custom icon from those items. Are you sure you want to delete it permanently?`;
      }
      if (window.confirm(confirmMsg)) {
        const res = await deleteCustomUploadedIcon(url);
        if (res.success) {
          if (currentIcon === url) setIcon("");
          await loadUploadedIcons();
        } else {
          alert("Failed to delete icon: " + res.error);
        }
      }
    } catch (err: any) {
      alert("Error checking or deleting icon: " + err.message);
    } finally {
      setDeletingUrl(null);
    }
  };

  const handleDropLocal = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
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

      {isStoring && (
        <div style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontSize: '0.8rem', textAlign: 'center' }}>
          Downloading and storing icon to server...
        </div>
      )}

      {pickerError && (
        <div style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.8rem', textAlign: 'center' }}>
          {pickerError}
        </div>
      )}

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
                              onClick={() => handleSelectIcon(url)}
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
         <BrandfetchPicker onSelectIcon={handleSelectIcon} currentIcon={currentIcon} />
      )}
      {activeSource === "extended" && (
         <IconifyPicker setIcon={setIcon} currentIcon={currentIcon} />
      )}
      {activeSource === "custom" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div 
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragging(false);
                  }
                }}
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
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <input 
                          id="icon-input-manual" 
                          value={manualInput} 
                          onChange={(e) => setManualInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSelectIcon(manualInput))}
                          placeholder="Paste image URL or Lucide icon name..." 
                          className="glass" 
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }} 
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleSelectIcon(manualInput); }}
                          className="btn btn-primary"
                          style={{ padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}
                        >
                          Apply
                        </button>
                      </div>
                  </div>
                  <p style={{ margin: '1rem 0 0 0', fontSize: '0.75rem', opacity: 0.4 }}>Drag and drop SVG / PNG / JPG legacy assets here</p>
              </div>

              {/* Previously Uploaded Custom Icons Library */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.05em' }}>
                    Uploaded Custom Icons ({uploadedIcons.length})
                  </span>
                  <button 
                    type="button"
                    onClick={loadUploadedIcons}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <RefreshCw size={12} className={loadingUploaded ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>

                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input
                    type="text"
                    placeholder="Search custom uploaded icons..."
                    value={customSearchFilter}
                    onChange={(e) => setCustomSearchFilter(e.target.value)}
                    className="glass"
                    style={{ width: '100%', padding: '0.5rem 0.6rem 0.5rem 2rem', borderRadius: '8px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  />
                </div>

                {loadingUploaded ? (
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', margin: '0.5rem 0' }}>Loading custom icons...</p>
                ) : uploadedIcons.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', margin: '0.5rem 0' }}>No custom icons uploaded yet.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {uploadedIcons
                      .filter(item => !customSearchFilter || item.name.toLowerCase().includes(customSearchFilter.toLowerCase()))
                      .map(item => {
                        const isSelected = currentIcon === item.url;
                        return (
                          <div
                            key={item.url}
                            style={{
                              position: 'relative',
                              padding: '6px',
                              borderRadius: '10px',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                              background: isSelected ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(255,255,255,0.03)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => handleSelectIcon(item.url)}
                          >
                            <img src={item.url} alt={item.name} style={{ width: '32px', height: '32px', objectFit: 'contain' }} title={item.name} />
                            <span style={{ fontSize: '0.6rem', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                              {item.name}
                            </span>

                            <button
                              type="button"
                              title={`Delete ${item.name}`}
                              disabled={deletingUrl === item.url}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUploadedIcon(item.url);
                              }}
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                background: 'rgba(239, 68, 68, 0.85)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                width: '16px',
                                height: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
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

function IconifyPicker({ setIcon, currentIcon }: any) {
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


function BrandfetchPicker({ onSelectIcon, currentIcon }: { onSelectIcon: (url: string) => void; currentIcon: any }) {
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
                              onClick={() => onSelectIcon(iconUrl)}
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
