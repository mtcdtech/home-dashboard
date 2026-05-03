"use client";

import React, { useState, useEffect } from "react";
import { IconComponent } from "@/components/IconPicker";
import * as actions from "@/app/admin/actions";
import ThemeModal from "@/components/ThemeModal";
import {
   Palette,
   Search,
   Plus,
   X,
   ChevronRight,
   Trash2,
   Layers,
   Settings,
   Moon,
   Sun,
   TableProperties,
   LayoutGrid,
   ChevronDown,
   Info,
   Zap,
   ShieldCheck,
   ArrowDownLeft,
   Eye,
   Edit3,
   Monitor,
   CheckCircle,
   Globe,
   Users
   , Upload
} from "lucide-react";

export default function ThemeClient({
   initialThemes,
   globalSettings,
   users = [],
   departments = []
}: {
   initialThemes: any[],
   globalSettings: any,
   users?: any[],
   departments?: string[]
}) {
   const [themes, setThemes] = useState(initialThemes.filter((t: any) => !t.isReadOnlySync));
   const [globalBrand, setGlobalBrand] = useState(globalSettings);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [editingTheme, setEditingTheme] = useState<any>(null);
   const [searchQuery, setSearchQuery] = useState("");
   const [viewMode, setViewMode] = useState<"grid" | "matrix">("grid");
   const [collapsedDepts, setCollapsedDepts] = useState<string[]>([]);
   const [modifiedDepts, setModifiedDepts] = useState<Record<string, string>>({}); // key: dept_themeId

   const [stagedSystemColor, setStagedSystemColor] = useState(globalSettings.systemThemeColor);
   const [isApplyingColor, setIsApplyingColor] = useState(false);

   // Helper for high-contrast text over theme colors
   function getContrastText(hexcolor: string) {
      if (!hexcolor || hexcolor.length < 7) return '#fff';
      const r = parseInt(hexcolor.substring(1, 3), 16);
      const g = parseInt(hexcolor.substring(3, 5), 16);
      const b = parseInt(hexcolor.substring(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      if (yiq >= 128) return 'var(--text)';
      return '#fff';
   }

   const openAdd = () => {
      setEditingTheme(null);
      setIsModalOpen(true);
   };

   const openEdit = (theme: any) => {
      setEditingTheme(theme);
      setIsModalOpen(true);
   };

   const saveTheme = async (data: any) => {
      if (editingTheme) {
         await actions.updateTheme(editingTheme.id, data);
      } else {
         await actions.createTheme(data);
      }
      window.location.reload();
   };

   const deleteSelectedTheme = async () => {
      if (editingTheme) {
         await actions.deleteTheme(editingTheme.id);
         window.location.reload();
      }
   };

   const handleGlobalUpdate = async (field: string, value: any) => {
      if (field === "systemThemeColor") {
         setIsApplyingColor(true);
         // Inject CSS Variables Optimistically for Instant Portal Sync
         document.documentElement.style.setProperty('--primary', value);
         const rgb = hexToRgb(value);
         document.documentElement.style.setProperty('--primary-rgb', rgb);
      }
      const newSettings = { ...globalBrand, [field]: value };
      setGlobalBrand(newSettings);
      try {
         await actions.updateGlobalSettings(newSettings);
      } catch (err) {
         console.error("Global update failed:", err);
      } finally {
         if (field === "systemThemeColor") setIsApplyingColor(false);
      }
   };

   const handleLogoUpload = async (file: File, field: string) => {
      const fd = new FormData(); fd.append("file", file);
      const url = await actions.uploadImage(fd);
      if (url) handleGlobalUpdate(field, url);
      return url;
   };

   const filteredUsers = users.filter((u: any) =>
   (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
   );

   const filteredThemes = themes.filter((t: any) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

   const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '59, 130, 246';
   };

   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
         {/* Site Branding */}
         <div className="glass" style={{ padding: '2rem', borderRadius: '24px', background: 'rgba(var(--primary-rgb), 0.03)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <Settings size={20} style={{ opacity: 0.5 }} />
               <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Site Branding</h2>
            </div>

            <div className="admin-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
               <div className="field">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '1rem' }}>Light Mode Logo</span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                     <div style={{
                        width: '140px', height: '80px', borderRadius: '14px',
                        backgroundColor: '#eef2f7',
                        backgroundImage: `radial-gradient(circle at top left, rgba(${hexToRgb(globalBrand.systemThemeColor)}, 0.15) 0%, transparent 70%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem',
                        border: '1px solid rgba(0,0,0,0.05)',
                        position: 'relative', overflow: 'hidden'
                     }}>
                        <img src={globalBrand.logoUrlLight || ""} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', zIndex: 1 }} />
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input type="file" id="logo-light-brand" hidden onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], "logoUrlLight")} />
                        <label htmlFor="logo-light-brand" className="btn" style={{ fontSize: '0.7rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>Replace</label>
                     </div>
                  </div>
               </div>

               <div className="field">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '1rem' }}>Dark Mode Logo</span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                     <div style={{
                        width: '140px', height: '80px', borderRadius: '14px',
                        backgroundColor: '#050505',
                        backgroundImage: `radial-gradient(circle at top left, rgba(${hexToRgb(globalBrand.systemThemeColor)}, 0.25) 0%, transparent 70%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem',
                        border: '1px solid rgba(255,255,255,0.05)',
                        position: 'relative', overflow: 'hidden'
                     }}>
                        <img src={globalBrand.logoUrlDark || ""} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', zIndex: 1 }} />
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input type="file" id="logo-dark-brand" hidden onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], "logoUrlDark")} />
                        <label htmlFor="logo-dark-brand" className="btn" style={{ fontSize: '0.7rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>Replace</label>
                     </div>
                  </div>
               </div>

               <div className="field">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.75rem' }}>Square Logo (Light)</span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                     <div style={{
                        width: '60px', height: '60px', borderRadius: '12px',
                        backgroundColor: '#eef2f7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem',
                        border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden'
                     }}>
                        {globalBrand.logoUrlSquareLight ? (
                           <img src={globalBrand.logoUrlSquareLight} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                           <span style={{ fontSize: '0.55rem', opacity: 0.3, textAlign: 'center' }}>None</span>
                        )}
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <input type="file" id="logo-square-light" hidden onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], "logoUrlSquareLight")} />
                        <label htmlFor="logo-square-light" className="btn" style={{ fontSize: '0.65rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}>Upload</label>
                     </div>
                  </div>
               </div>

               <div className="field">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.75rem' }}>Square Logo (Dark)</span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                     <div style={{
                        width: '60px', height: '60px', borderRadius: '12px',
                        backgroundColor: '#050505',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem',
                        border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden'
                     }}>
                        {globalBrand.logoUrlSquareDark ? (
                           <img src={globalBrand.logoUrlSquareDark} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                           <span style={{ fontSize: '0.55rem', opacity: 0.3, textAlign: 'center', color: '#fff' }}>None</span>
                        )}
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <input type="file" id="logo-square-dark" hidden onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0], "logoUrlSquareDark")} />
                        <label htmlFor="logo-square-dark" className="btn" style={{ fontSize: '0.65rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}>Upload</label>
                     </div>
                  </div>
               </div>

               <div className="field">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '1rem' }}>System Theme Color</span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                     <div style={{ position: 'relative', width: '45px', height: '45px' }}>
                        <input type="color" value={stagedSystemColor} onChange={(e) => setStagedSystemColor(e.target.value)} style={{ width: '100%', height: '100%', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '10px', overflow: 'hidden' }} />
                     </div>
                     <input value={stagedSystemColor} onChange={(e) => setStagedSystemColor(e.target.value)} className="glass" style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem' }} />

                     {stagedSystemColor !== globalBrand.systemThemeColor && (
                        <button
                           disabled={isApplyingColor}
                           onClick={() => handleGlobalUpdate("systemThemeColor", stagedSystemColor)}
                           className="btn btn-primary animate-pulse"
                           style={{
                              padding: '0.75rem 1.5rem',
                              borderRadius: '10px',
                              border: 'none',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: `0 4px 15px rgba(${hexToRgb(stagedSystemColor)}, 0.4)`
                           }}
                        >
                           {isApplyingColor ? 'Syncing...' : 'APPLY'}
                        </button>
                     )}
                  </div>
               </div>

               <div className="field">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '1rem' }}>Login Page Theme</span>
                  <select
                     className="glass"
                     value={globalBrand.loginThemeId || ""}
                     onChange={(e) => handleGlobalUpdate("loginThemeId", e.target.value === "" ? null : e.target.value)}
                     style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--glass-border)', outline: 'none', background: 'rgba(0,0,0,0.1)', color: 'var(--text)' }}
                  >
                     <option value="" style={{ color: '#000' }}>System Default (Black)</option>
                     {themes.map(t => (
                        <option key={t.id} value={t.id} style={{ color: '#000' }}>{t.name}</option>
                     ))}
                  </select>
               </div>
            </div>
         </div>

         {/* View Mode & Actions */}
         <div className="admin-top-bar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'rgba(var(--primary-rgb), 0.08)', padding: '0.4rem', borderRadius: '14px', gap: '0.25rem', border: '1px solid var(--glass-border)' }}>
               <button onClick={() => setViewMode("grid")} className="btn" style={{ padding: '0.5rem 1rem', borderRadius: '10px', background: viewMode === "grid" ? 'var(--primary)' : 'transparent', color: viewMode === "grid" ? '#fff' : 'var(--text)', border: 'none', fontSize: '0.85rem', fontWeight: 700, display: 'flex', gap: '0.5rem' }}>
                  <LayoutGrid size={18} /> Theme Manager
               </button>
               <button onClick={() => setViewMode("matrix")} className="btn" style={{ padding: '0.5rem 1rem', borderRadius: '10px', background: viewMode === "matrix" ? 'var(--primary)' : 'transparent', color: viewMode === "matrix" ? '#fff' : 'var(--text)', border: 'none', fontSize: '0.85rem', fontWeight: 700, display: 'flex', gap: '0.5rem' }}>
                  <TableProperties size={18} /> Access Manager
               </button>
            </div>

            <div className="glass" style={{ flex: 1, position: 'relative' }}>
               <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
               <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search ${viewMode === 'grid' ? 'themes' : 'users'}...`} className="glass" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: 'none' }} />
            </div>

            <button onClick={openAdd} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, display: 'flex', gap: '0.5rem' }}>
               <Plus size={18} /> New Theme
            </button>
         </div>

         {viewMode === "grid" ? (
            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
               {filteredThemes.map((theme: any) => (
                  <div key={theme.id} className="glass theme-card" style={{ padding: '0', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--glass-border)', transition: 'all 0.3s ease', position: 'relative' }}>
                     <div className="theme-thumbnail" style={{ height: '160px', background: theme.primaryColor, position: 'relative', overflow: 'hidden' }}>
                        {theme.backgroundColor && <img src={theme.backgroundColor} alt={theme.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(2px) brightness(0.7)' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, rgba(0,0,0,0.4), transparent)`, zIndex: 1 }} />
                        <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.5rem', zIndex: 2 }}>
                           <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                              {theme.name}
                              {theme.isReadOnlySync && (
                                 <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', color: '#10b981', background: 'rgba(16,185,129,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase', verticalAlign: 'middle' }}>Imported</span>
                              )}
                           </h3>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}><span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}><Palette size={12} /> {theme.primaryColor}</span></div>
                        </div>
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 2 }}>
                           <div className="glass" style={{ padding: '0.4rem', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>{theme.darkMode ? <Moon size={16} /> : <Sun size={16} />}</div>
                        </div>
                     </div>
                     <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                           <div className="glass" style={{ padding: '0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{theme.owners?.length || 1} Owners</span>
                           </div>
                           <div className="glass" style={{ padding: '0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                              <Layers size={14} style={{ opacity: 0.4 }} />
                              <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{theme.tabs?.length || 0} Workspaces</span>
                           </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", padding: "0.6rem", background: "rgba(var(--primary-rgb), 0.05)", borderRadius: "10px", marginTop: "0.5rem" }}>
                           <span style={{ fontSize: "0.65rem", opacity: 0.6, fontWeight: 600 }}>Created by {theme.owners?.[0]?.name || "System"} • {theme.createdAt ? new Date(theme.createdAt).toLocaleDateString() : "Unknown"}</span>
                           <span style={{ fontSize: "0.65rem", opacity: 0.4, fontWeight: 500 }}>Last updated: {theme.updatedAt ? new Date(theme.updatedAt).toLocaleDateString() : "Unknown"}</span>
                        </div>
                        {theme.isReadOnlySync ? (
                           <button
                              disabled
                              className="btn"
                              style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', opacity: 0.5, cursor: 'not-allowed' }}
                           >
                              Imported (Locked)
                           </button>
                        ) : (
                           <button
                              onClick={() => openEdit(theme)}
                              className="btn btn-primary"
                              style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                           >
                              Manage Theme
                           </button>
                        )}
                     </div>
                  </div>
               ))}
            </div>
         ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <div className="glass" style={{ padding: '1.25rem 2rem', borderRadius: '16px', display: 'flex', gap: '2.5rem', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Access Legend:</div>
                  <div style={{ display: 'flex', gap: '3.5rem', alignItems: 'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 12px rgba(var(--primary-rgb), 0.4)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Owner:</span><span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Design authority</span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.15)', border: '1px solid rgba(var(--primary-rgb), 0.3)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Editor:</span><span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Can apply to hubs</span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Viewer:</span><span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Public asset</span>
                     </div>
                  </div>
               </div>

               <div className="glass" style={{ padding: '0', borderRadius: '24px', overflowX: 'auto', border: '1px solid var(--glass-border)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: Math.max(1000, themes.length * 160 + 300) + 'px' }}>
                     <thead style={{ background: 'rgba(var(--primary-rgb), 0.06)', borderBottom: '1px solid var(--glass-border)' }}>
                        <tr>
                           <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', width: '1%', whiteSpace: 'nowrap' }}>Themes</th>
                           {themes.map((t: any) => (
                              <th key={t.id} style={{ padding: '1rem 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center', width: '135px' }}>
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: t.primaryColor, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                                    <span style={{ fontWeight: 800 }}>{t.name}</span>
                                 </div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {departments.map((dept: string) => {
                           const deptUsers = filteredUsers.filter((u: any) => (u.dashboardGroup || "General") === dept);
                           if (deptUsers.length === 0) return null;

                           return (
                              <React.Fragment key={dept}>
                                 <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '0.75rem 1.25rem', width: '1%', whiteSpace: 'nowrap' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <button
                                             onClick={() => {
                                                setCollapsedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
                                             }}
                                             style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                                          >
                                             {collapsedDepts.includes(dept) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                          </button>
                                          <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.08)', display: 'flex', color: 'inherit' }}>
                                             <Users size={14} style={{ opacity: 0.5 }} />
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                             <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, color: 'inherit' }}>{dept}</span>
                                          </div>
                                       </div>
                                    </td>
                                    {themes.map((t: any) => {
                                       const savedRole = t.departmentAccess?.find((da: any) => da.department === dept)?.role || "none";
                                       const staging = modifiedDepts[`${dept}_${t.id}`];
                                       const display = staging !== undefined ? staging : savedRole;

                                       return (
                                          <td key={t.id} style={{ padding: '0.5rem 0.25rem' }}>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <div style={{
                                                   flex: 1,
                                                   borderRadius: '10px',
                                                   minHeight: '38px',
                                                   background: display === 'owner' ? 'var(--primary)' : (display === 'none' ? 'rgba(var(--primary-rgb), 0.03)' : 'rgba(var(--primary-rgb), 0.1)'),
                                                   border: '1px solid var(--glass-border)',
                                                   display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                                   position: 'relative'
                                                }}>
                                                   <span style={{
                                                      fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase',
                                                      color: display === 'owner' ? getContrastText(t.primaryColor) : 'var(--text)',
                                                      opacity: display === 'none' ? 0.2 : 1, zIndex: 1
                                                   }}>{display === 'none' ? 'NOT SHARED' : (display.toUpperCase() + ' (DEPT)')}</span>
                                                   <select
                                                      value={display}
                                                      onChange={async (e) => {
                                                         const val = e.target.value;
                                                         setModifiedDepts(prev => ({ ...prev, [`${dept}_${t.id}`]: val }));
                                                      }}
                                                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', zIndex: 2 }}
                                                   >
                                                      <option value="none">Not Shared</option><option value="viewer">Viewer (Dept)</option><option value="editor">Editor (Dept)</option><option value="owner">Owner (Dept)</option>
                                                   </select>
                                                </div>
                                                {modifiedDepts[`${dept}_${t.id}`] && (
                                                   <button
                                                      onClick={async () => {
                                                         const role = modifiedDepts[`${dept}_${t.id}`];
                                                         await actions.bulkApplyDeptThemeRole(t.id, dept, role);

                                                         // Deep Optimistic Update (Header + All Members in Dept)
                                                         setThemes((prevThemes: any[]) => prevThemes.map((theme: any) => {
                                                            if (theme.id !== t.id) return theme;
                                                            const otherAccess = (theme.departmentAccess || []).filter((da: any) => da.department !== dept);

                                                            const deptUserIds = deptUsers.map((u: any) => u.id);
                                                            const filterOut = (arr: any[]) => (arr || []).filter((u: any) => !deptUserIds.includes(u.id));

                                                            return {
                                                               ...theme,
                                                               departmentAccess: role === "none" ? otherAccess : [...otherAccess, { department: dept, role }],
                                                               owners: role === "owner" ? [...filterOut(theme.owners), ...deptUsers] : filterOut(theme.owners),
                                                               editors: role === "editor" ? [...filterOut(theme.editors), ...deptUsers] : filterOut(theme.editors),
                                                               allowedUsers: role === "viewer" ? [...filterOut(theme.allowedUsers), ...deptUsers] : filterOut(theme.allowedUsers)
                                                            };
                                                         }));

                                                         setModifiedDepts(prev => {
                                                            const next = { ...prev };
                                                            delete next[`${dept}_${t.id}`];
                                                            return next;
                                                         });
                                                      }}
                                                      title="Apply to group"
                                                      className="btn-sync"
                                                      style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', transition: 'all 0.2s ease', position: 'relative', zIndex: 10 }}
                                                   >
                                                      <Zap size={14} />
                                                   </button>
                                                )}
                                             </div>
                                          </td>
                                       );
                                    })}
                                 </tr>
                                 {/* User Items */}
                                 {!collapsedDepts.includes(dept) && deptUsers.map((u: any) => {
                                    return (
                                       <tr key={u.id} style={{ borderBottom: '1px solid rgba(var(--primary-rgb), 0.03)' }}>
                                          <td style={{ padding: '0.85rem 3rem' }}>
                                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                   <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{u.name || u.email}</span>
                                                   {u.isAdmin && <span style={{ fontSize: '0.6rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 800 }}>Admin</span>}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{u.email}</span>
                                             </div>
                                          </td>
                                          {themes.map((theme: any) => {
                                             const isOwner = theme.owners?.some((o: any) => o.id === u.id);
                                             const isEditor = theme.editors?.some((e: any) => e.id === u.id);
                                             const isViewer = theme.allowedUsers?.some((v: any) => v.id === u.id);
                                             const isBlocked = theme.blockedUsers?.some((b: any) => b.id === u.id);

                                             let inheritedRoleFromTabs = 'none';
                                             const userTabs = theme.tabs?.filter((tab: any) => {
                                                const tabOwner = tab.owners?.some((o: any) => o.id === u.id);
                                                const tabEditor = tab.editors?.some((e: any) => e.id === u.id);
                                                const tabViewer = tab.allowedUsers?.some((v: any) => v.id === u.id);
                                                const tabPushedUser = tab.pushRules?.some((r: any) => r.scopeType === 'user' && r.scopeId === u.id);
                                                const tabPushedDept = tab.pushRules?.some((r: any) => r.scopeType === 'department' && r.scopeId === dept);
                                                const tabPushedGlobal = tab.pushRules?.some((r: any) => r.scopeType === 'global');
                                                return tabOwner || tabEditor || tabViewer || tabPushedUser || tabPushedDept || tabPushedGlobal;
                                             });

                                             if (userTabs && userTabs.length > 0) {
                                                inheritedRoleFromTabs = 'viewer';
                                             }

                                             const role = isOwner ? 'owner' : (isEditor ? 'editor' : (isViewer ? 'viewer' : (isBlocked ? 'none' : (inheritedRoleFromTabs !== 'none' ? 'inherited' : 'none'))));
                                             const effectiveRole = u.isAdmin ? 'owner' : (role === 'inherited' ? inheritedRoleFromTabs : role);

                                             return (
                                                <td key={theme.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: '150px' }}>
                                                   <div style={{
                                                      width: '100%', position: 'relative', borderRadius: '10px', overflow: 'hidden', minHeight: '36px',
                                                      border: effectiveRole === "owner" ? '1px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.2)',
                                                      background: u.isAdmin
                                                         ? 'repeating-linear-gradient(45deg, rgba(var(--primary-rgb), 0.25), rgba(var(--primary-rgb), 0.25) 10px, rgba(var(--primary-rgb), 0.35) 10px, rgba(var(--primary-rgb), 0.35) 20px)'
                                                         : (effectiveRole === "owner" ? 'var(--primary)' : effectiveRole === "editor" ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.05)'),
                                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                   }}>
                                                      <div style={{
                                                         position: 'absolute', pointerEvents: 'none',
                                                         color: (effectiveRole === 'owner' && !u.isAdmin) ? getContrastText(theme.primaryColor) : 'var(--text)',
                                                         fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap',
                                                         zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.35rem'
                                                      }}>
                                                         {u.isAdmin ? <><ShieldCheck size={11} strokeWidth={3} /> OWNER (ADMIN)</> : (
                                                            role === 'inherited'
                                                               ? <><ArrowDownLeft size={11} strokeWidth={3} /> INHERITED ({inheritedRoleFromTabs.toUpperCase()})</>
                                                               : (
                                                                  effectiveRole === 'none' ? <><X size={11} strokeWidth={3} /> NOT SHARED</> :
                                                                     effectiveRole === 'owner' ? <><ShieldCheck size={11} strokeWidth={3} /> OWNER</> :
                                                                        effectiveRole === 'editor' ? <><Edit3 size={11} strokeWidth={3} /> EDITOR</> :
                                                                           <><Eye size={11} strokeWidth={3} /> VIEWER</>
                                                               )
                                                         )}
                                                      </div>
                                                      {!u.isAdmin && (
                                                         <select
                                                            value={role}
                                                            onChange={async (e) => {
                                                               const newRole = e.target.value;
                                                               await actions.updateThemeUserRole(theme.id, u.id, newRole);

                                                               // Optimistic Update for Individual User
                                                               setThemes((prevThemes: any[]) => prevThemes.map((t: any) => {
                                                                  if (t.id !== theme.id) return t;
                                                                  return {
                                                                     ...t,
                                                                     owners: newRole === "owner" ? [...(t.owners || []).filter((o: any) => o.id !== u.id), u] : (t.owners || []).filter((o: any) => o.id !== u.id),
                                                                     editors: newRole === "editor" ? [...(t.editors || []).filter((e: any) => e.id !== u.id), u] : (t.editors || []).filter((e: any) => e.id !== u.id),
                                                                     allowedUsers: newRole === "viewer" ? [...(t.allowedUsers || []).filter((a: any) => a.id !== u.id), u] : (t.allowedUsers || []).filter((a: any) => a.id !== u.id),
                                                                     blockedUsers: newRole === "none" ? [...(t.blockedUsers || []).filter((b: any) => b.id !== u.id), u] : (t.blockedUsers || []).filter((b: any) => b.id !== u.id)
                                                                  };
                                                               }));
                                                            }}
                                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                                                         >
                                                            {inheritedRoleFromTabs !== 'none' && <option value="inherited">Inherited (Viewer)</option>}
                                                            <option value="viewer">Viewer</option>
                                                            <option value="editor">Editor</option>
                                                            <option value="owner">Owner</option>
                                                            <option value="none">Not Shared</option>
                                                         </select>
                                                      )}
                                                   </div>
                                                </td>
                                             );
                                          })}
                                       </tr>
                                    );
                                 })}
                              </React.Fragment>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* EDIT MODAL */}
         <ThemeModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            editingTheme={editingTheme}
            onSave={saveTheme}
            onDelete={deleteSelectedTheme}
            showCatalogToggle={true}
         />

         <style jsx global>{`
          .spin-loader { width: 20px; height: 20px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
           @keyframes spin { to { transform: rotate(360deg); } }
           .btn-sync:hover { transform: scale(1.15); background: var(--primary) !important; color: #fff !important; }
          .theme-thumbnail:hover { transform: scale(1.02); }
          .fade-in { animation: fadeIn 0.4s ease-out; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
       `}</style>
      </div>
   );
}
