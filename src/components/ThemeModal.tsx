"use client";

import React, { useState, useEffect } from "react";
import { Palette, Search, X, Trash2, Sun, Moon, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import * as actions from "@/app/admin/actions"; // Assuming we can use these actions here

export interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTheme: any | null;
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
  showCatalogToggle?: boolean;
}

export default function ThemeModal({ isOpen, onClose, editingTheme, onSave, onDelete, showCatalogToggle = false }: ThemeModalProps) {
  // --- Random Theme Name Generator ---
  const ADJECTIVES = ["Midnight", "Crystal", "Ember", "Arctic", "Velvet", "Solar", "Cosmic", "Ocean",
    "Crimson", "Frosted", "Golden", "Jade", "Obsidian", "Amber", "Sapphire", "Marble",
    "Bronze", "Sterling", "Twilight", "Autumn", "Coral", "Onyx", "Pearl", "Slate",
    "Copper", "Ivory", "Rustic", "Serene", "Vivid", "Muted", "Neon", "Dusty"];
  const NOUNS = ["Horizon", "Aurora", "Summit", "Cascade", "Nebula", "Prism", "Eclipse",
    "Mirage", "Tundra", "Canyon", "Lagoon", "Zenith", "Ember", "Glacier", "Oasis",
    "Dusk", "Haven", "Ridge", "Storm", "Bloom", "Shore", "Drift", "Crest", "Vale",
    "Meadow", "Reef", "Peak", "Grove", "Bluff", "Delta", "Fjord", "Mesa"];
  const randomName = () => ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + " " + NOUNS[Math.floor(Math.random() * NOUNS.length)];

  const randomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    const sat = 55 + Math.floor(Math.random() * 35);
    const light = 40 + Math.floor(Math.random() * 20);
    const c = (n: number) => {
      const k = (n + hue / 30) % 12;
      const a = sat / 100 * Math.min(light / 100, 1 - light / 100);
      const val = light / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * val).toString(16).padStart(2, '0');
    };
    return `#${c(0)}${c(8)}${c(4)}`;
  };

  // Form State
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [backgroundColor, setBackgroundColor] = useState("");
  const [dashboardTitle, setDashboardTitle] = useState("Home Dashboard");
  const [isDark, setIsDark] = useState(true);
  const [glassEffect, setGlassEffect] = useState(true);
  const [backgroundBlur, setBackgroundBlur] = useState(20);
  const [backgroundTint, setBackgroundTint] = useState(0.5);
  const [sectionOpacity, setSectionOpacity] = useState(0.7);
  const [glassOpacity, setGlassOpacity] = useState(0.12);
  const [backgroundWash, setBackgroundWash] = useState(0.0);
  const [isLibraryItem, setIsLibraryItem] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Background Search State
  const [bgSearchText, setBgSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [activeBgSource, setActiveBgSource] = useState<"search" | "generate" | "upload">("search");
  const [genKeyword, setGenKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPatternType, setGenPatternType] = useState<number>(-1); // -1 = random
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const PATTERN_NAMES = [
    { id: 0, label: "Mesh", desc: "Soft color blobs" },
    { id: 1, label: "Geometric", desc: "Angular shapes" },
    { id: 2, label: "Waves", desc: "Layered ridges" },
    { id: 3, label: "Bokeh", desc: "Floating circles" },
    { id: 4, label: "Stripes", desc: "Diagonal lines" },
    { id: 5, label: "Aurora", desc: "Northern lights" },
  ];

  useEffect(() => {
    if (isOpen) {
      if (editingTheme) {
        setName(editingTheme.name);
        setPrimaryColor(editingTheme.primaryColor);
        setBackgroundColor(editingTheme.backgroundColor || "");
        setDashboardTitle(editingTheme.dashboardTitle || "Home Dashboard");
        setIsDark(editingTheme.darkMode);
        setGlassEffect(editingTheme.glassEffect ?? true);
        setBackgroundBlur(editingTheme.backgroundBlur ?? 20);
        setBackgroundTint(editingTheme.backgroundTint ?? 0.5);
        setSectionOpacity(editingTheme.sectionOpacity ?? 0.7);
        setGlassOpacity(editingTheme.glassOpacity ?? 0.12);
        setBackgroundWash(editingTheme.backgroundWash ?? 0.0);
        setIsLibraryItem(editingTheme.isLibraryItem ?? false);
      } else {
        setName(randomName());
        setPrimaryColor(randomColor());
        setBackgroundColor("");
        setDashboardTitle("Workspace");
        setIsDark(resolvedTheme === "dark");
        setGlassEffect(true);
        setBackgroundBlur(20);
        setBackgroundTint(0.5);
        setSectionOpacity(0.7);
        setGlassOpacity(0.12);
        setBackgroundWash(0.0);
        setIsLibraryItem(false);
      }
      setIsDeleteModalOpen(false);
    }
  }, [isOpen, editingTheme, resolvedTheme]);

  // Keyword → color mapping
  const keywordToHue = (kw: string): number | null => {
    const map: Record<string, number> = {
      red: 0, scarlet: 0, crimson: 0, ruby: 350, cherry: 350, fire: 15,
      orange: 30, amber: 40, copper: 25, rust: 20, peach: 25,
      yellow: 55, gold: 45, lemon: 55, honey: 45, sunshine: 50,
      green: 120, emerald: 145, lime: 90, forest: 140, mint: 160, sage: 130,
      teal: 180, cyan: 190, turquoise: 175, aqua: 185,
      blue: 220, navy: 230, cobalt: 215, ocean: 210, sky: 200, azure: 210, sapphire: 225,
      purple: 270, violet: 280, indigo: 260, lavender: 265, plum: 290,
      pink: 330, magenta: 310, rose: 340, fuchsia: 315, blush: 345,
      brown: 30, chocolate: 25, mocha: 30, earth: 35, sand: 40,
      gray: -1, grey: -1, silver: -1, slate: 210, charcoal: -1,
      night: 240, midnight: 240, sunset: 20, sunrise: 35, dawn: 30, dusk: 270,
      space: 260, cosmic: 280, galaxy: 270, nebula: 290, star: 50,
    };
    const lower = kw.toLowerCase();
    for (const [word, hue] of Object.entries(map)) {
      if (lower.includes(word)) return hue;
    }
    return null;
  };

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const searchImages = async (isNew: boolean = true) => {
    if (!bgSearchText) return;
    setIsSearching(true);
    if (isNew) setSearchResults([]);
    const nextPage = isNew ? 1 : searchPage + 1;
    try {
      const resp = await fetch(`/api/openverse?q=${encodeURIComponent(bgSearchText)}&page=${nextPage}`);
      const results = await resp.json();
      const urls = results.map((r: any) => r.url);
      if (isNew) {
        setSearchResults(urls);
        setSearchPage(1);
      } else {
        setSearchResults(prev => [...prev, ...urls]);
        setSearchPage(nextPage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const doGenerate = async (keyword: string, color: string, dark: boolean, forcedPattern?: number): Promise<string | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const seed = (keyword + Date.now()).split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const rand = (s: number) => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
    const patternType = (forcedPattern !== undefined && forcedPattern >= 0) ? forcedPattern : Math.abs(seed) % 6;

    const kwHue = keywordToHue(keyword);
    let useKwColor = false;
    if (kwHue !== null && kwHue >= 0) useKwColor = true;

    ctx.fillStyle = dark ? '#080810' : '#f0f4f8';
    ctx.fillRect(0, 0, 1600, 900);

    const r0 = parseInt(color.slice(1, 3), 16), g0 = parseInt(color.slice(3, 5), 16), b0 = parseInt(color.slice(5, 7), 16);
    const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
    let hue = 0;
    if (useKwColor && kwHue !== null) {
      hue = kwHue;
    } else if (max !== min) {
      if (max === r0) hue = ((g0 - b0) / (max - min)) * 60;
      else if (max === g0) hue = (2 + (b0 - r0) / (max - min)) * 60;
      else hue = (4 + (r0 - g0) / (max - min)) * 60;
      if (hue < 0) hue += 360;
    }

    if (patternType === 0) {
      for (let i = 0; i < 10; i++) {
        const x = rand(seed + i * 7) * 1800 - 100;
        const y = rand(seed + i * 13) * 1100 - 100;
        const radius = 300 + rand(seed + i * 19) * 700;
        const h = (hue + rand(seed + i * 23) * 120 - 60 + 360) % 360;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `hsla(${h}, 80%, ${dark ? 40 : 60}%, ${0.3 + rand(seed + i * 29) * 0.4})`);
        grad.addColorStop(1, 'transparent');
        ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1600, 900);
      }
    } else if (patternType === 1) {
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 30; i++) {
        const cx = rand(seed + i * 11) * 1600;
        const cy = rand(seed + i * 17) * 900;
        const size = 80 + rand(seed + i * 31) * 300;
        const h = (hue + rand(seed + i * 41) * 90 - 45 + 360) % 360;
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const angle = (j / 3) * Math.PI * 2 + rand(seed + i) * Math.PI;
          const px = cx + Math.cos(angle) * size;
          const py = cy + Math.sin(angle) * size;
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = `hsla(${h}, 70%, ${dark ? 30 : 70}%, ${0.1 + rand(seed + i * 53) * 0.25})`;
        ctx.fill();
      }
    } else if (patternType === 2) {
      for (let layer = 0; layer < 6; layer++) {
        const h = (hue + layer * 30) % 360;
        const yBase = 150 + layer * 120 + rand(seed + layer * 7) * 80;
        ctx.beginPath();
        ctx.moveTo(0, 900);
        for (let x = 0; x <= 1600; x += 10) {
          const y = yBase + Math.sin(x * 0.005 + layer * 2 + rand(seed + layer) * 10) * (60 + rand(seed + layer * 3) * 80)
            + Math.sin(x * 0.012 + seed) * 30;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(1600, 900);
        ctx.closePath();
        ctx.fillStyle = `hsla(${h}, 65%, ${dark ? 20 + layer * 5 : 50 + layer * 8}%, ${0.15 + layer * 0.08})`;
        ctx.fill();
      }
    } else if (patternType === 3) {
      ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
      for (let i = 0; i < 40; i++) {
        const x = rand(seed + i * 3) * 1600;
        const y = rand(seed + i * 5) * 900;
        const radius = 20 + rand(seed + i * 7) * 180;
        const h = (hue + rand(seed + i * 11) * 80 - 40 + 360) % 360;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `hsla(${h}, 70%, ${dark ? 50 : 60}%, ${0.1 + rand(seed + i * 13) * 0.2})`);
        grad.addColorStop(0.7, `hsla(${h}, 70%, ${dark ? 40 : 65}%, ${0.05})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (patternType === 4) {
      const grad = ctx.createLinearGradient(0, 0, 1600, 900);
      const h2 = (hue + 180) % 360;
      grad.addColorStop(0, `hsla(${hue}, 70%, ${dark ? 15 : 80}%, 1)`);
      grad.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 60%, ${dark ? 25 : 65}%, 1)`);
      grad.addColorStop(1, `hsla(${h2}, 70%, ${dark ? 10 : 75}%, 1)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 900);
      ctx.globalCompositeOperation = dark ? 'overlay' : 'soft-light';
      for (let i = -20; i < 40; i++) {
        const offset = i * 80;
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset + 900, 900);
        ctx.lineWidth = 20 + rand(seed + i * 3) * 40;
        ctx.strokeStyle = `hsla(${hue}, 50%, 50%, ${0.05 + rand(seed + i * 7) * 0.1})`;
        ctx.stroke();
      }
    } else {
      const auroraGrad = ctx.createLinearGradient(0, 0, 0, 900);
      auroraGrad.addColorStop(0, dark ? '#050510' : '#c8d8f0');
      auroraGrad.addColorStop(1, dark ? '#0a0a20' : '#e8eef8');
      ctx.fillStyle = auroraGrad;
      ctx.fillRect(0, 0, 1600, 900);
      ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
      for (let band = 0; band < 5; band++) {
        const h = (hue + band * 40 + rand(seed + band) * 60) % 360;
        const yCenter = 200 + band * 100 + rand(seed + band * 3) * 150;
        ctx.beginPath();
        ctx.moveTo(0, yCenter);
        for (let x = 0; x <= 1600; x += 5) {
          const waveY = yCenter + Math.sin(x * 0.003 + band * 1.5 + seed * 0.01) * (50 + rand(seed + band * 11) * 100)
            + Math.sin(x * 0.008 + band + seed * 0.02) * 30;
          ctx.lineTo(x, waveY);
        }
        ctx.lineTo(1600, yCenter + 200);
        ctx.lineTo(0, yCenter + 200);
        ctx.closePath();
        const bandGrad = ctx.createLinearGradient(0, yCenter - 100, 0, yCenter + 200);
        bandGrad.addColorStop(0, 'transparent');
        bandGrad.addColorStop(0.4, `hsla(${h}, 80%, 55%, ${0.15 + rand(seed + band * 19) * 0.2})`);
        bandGrad.addColorStop(0.6, `hsla(${h}, 80%, 55%, ${0.1})`);
        bandGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = bandGrad;
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return await actions.saveGeneratedImage(dataUrl);
  };

  const generateAbstract = async () => {
    const kw = genKeyword || randomName();
    setIsGenerating(true);
    try {
      const url = await doGenerate(kw, primaryColor, isDark, genPatternType);
      if (url) setBackgroundColor(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBgUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const url = await actions.uploadImage(fd);
    if (url) setBackgroundColor(url);
  };

  const handleSaveClick = async () => {
    if (!name) return;
    setIsSaving(true);
    const data = {
      name,
      primaryColor,
      backgroundColor,
      dashboardTitle,
      darkMode: isDark,
      glassEffect,
      backgroundBlur: Number(backgroundBlur),
      backgroundTint: Number(backgroundTint),
      sectionOpacity: Number(sectionOpacity),
      glassOpacity: Number(glassOpacity),
      backgroundWash: Number(backgroundWash),
      isLibraryItem
    };
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  // LIVE PREVIEW — keep darkMode in sync with the current browser toggle.
  // (Hooks must be called before any early-return.)
  const currentIsDark = resolvedTheme === "dark";
  useEffect(() => {
    setIsDark(currentIsDark);
  }, [currentIsDark]);

  if (!isOpen) return null;

  // LIVE PREVIEW CALCULATIONS — tied to the actual dashboard light/dark mode
  const previewBg = currentIsDark ? '#080810' : '#f8fafc';
  const previewText = currentIsDark ? '#f8fafc' : '#080810';

  const targetRGB = !currentIsDark ? [230, 230, 230] : [25, 25, 25];
  const primaryRGB = hexToRgb(primaryColor);
  const blendedRGB = [
    Math.round(primaryRGB[0] * (1 - sectionOpacity) + targetRGB[0] * sectionOpacity),
    Math.round(primaryRGB[1] * (1 - sectionOpacity) + targetRGB[1] * sectionOpacity),
    Math.round(primaryRGB[2] * (1 - sectionOpacity) + targetRGB[2] * sectionOpacity)
  ];
  const previewSectionBg = `rgba(${blendedRGB.join(',')}, ${0.4 + glassOpacity * 0.5})`;
  const previewBookmarkBg = currentIsDark ? `rgba(255,255,255,0.05)` : `rgba(255,255,255,0.35)`;

  return (
    <>
      <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '1200px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
          <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Palette size={22} style={{ color: primaryColor }} />
              <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{editingTheme ? `Edit Theme: ${editingTheme.name}` : "Create New Theme"}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={24} /></button>
          </div>

          <div className="modal-grid" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', display: 'grid', gridTemplateColumns: 'minmax(450px, 1fr) 420px', gap: '4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              <section>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Branding</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div className="field">
                    <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.75rem' }}>Theme Name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cobalt Nebula" className="glass" style={{ width: '100%', padding: '0.9rem', borderRadius: '12px' }} />
                  </div>
                  <div className="field">
                    <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.75rem' }}>Dashboard Headline</span>
                    <input value={dashboardTitle} onChange={(e) => setDashboardTitle(e.target.value)} placeholder="Workspace" className="glass" style={{ width: '100%', padding: '0.9rem', borderRadius: '12px' }} />
                  </div>
                  <div className="field" style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.75rem' }}>Primary Color</span>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: '70px', height: '50px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                      <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="glass" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }} />
                    </div>
                  </div>
                  {showCatalogToggle && (
                    <div className="field" style={{ gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
                        <input
                          type="checkbox"
                          id="catalog-check"
                          checked={isLibraryItem}
                          onChange={(e) => setIsLibraryItem(e.target.checked)}
                        />
                        <label htmlFor="catalog-check" style={{ fontSize: '0.85rem', cursor: 'pointer', flex: 1 }}>
                          Share Theme in Catalog (Make available to others)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Theme Controls</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Background Blur</span><span className="glass" style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>{backgroundBlur}px</span></div>
                      <input type="range" min="0" max="50" step="1" value={backgroundBlur} onChange={(e) => setBackgroundBlur(parseInt(e.target.value))} style={{ width: '100%', accentColor: primaryColor }} />
                    </div>
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Background Color Overlay</span><span className="glass" style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>{Math.round(backgroundTint * 100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.05" value={backgroundTint} onChange={(e) => setBackgroundTint(parseFloat(e.target.value))} style={{ width: '100%', accentColor: primaryColor }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Background B/W Wash</span><span className="glass" style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>{Math.round(backgroundWash * 100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.05" value={backgroundWash} onChange={(e) => setBackgroundWash(parseFloat(e.target.value))} style={{ width: '100%', accentColor: primaryColor }} />
                    </div>
                    <div className="field">
                      {/* Empty field for layout balance */}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Card Color</span><span className="glass" style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>{Math.round(sectionOpacity * 100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.01" value={sectionOpacity} onChange={(e) => setSectionOpacity(parseFloat(e.target.value))} style={{ width: '100%', accentColor: primaryColor }} />
                      <p style={{ fontSize: '0.68rem', opacity: 0.4, marginTop: '0.35rem' }}>0% = theme color, 100% = near black/white</p>
                    </div>
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Card Opacity</span><span className="glass" style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>{Math.round(40 + glassOpacity * 50)}%</span></div>
                      <input type="range" min="0" max="1" step="0.01" value={glassOpacity} onChange={(e) => setGlassOpacity(parseFloat(e.target.value))} style={{ width: '100%', accentColor: primaryColor }} />
                      <p style={{ fontSize: '0.68rem', opacity: 0.4, marginTop: '0.35rem' }}>Range: 40% to 90% opacity</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Background Image</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>{(["search", "generate", "upload"] as const).map(src => (<button key={src} onClick={() => setActiveBgSource(src)} className="btn" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: activeBgSource === src ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.08)', color: activeBgSource === src ? '#fff' : 'var(--text)', border: 'none' }}>{src.toUpperCase()}</button>))}</div>
                </div>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(var(--primary-rgb), 0.03)' }}>
                  {activeBgSource === "search" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                          <input value={bgSearchText} onChange={(e) => setBgSearchText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchImages(true)} placeholder="Search for backgrounds..." className="glass" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '10px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                        </div>
                        <button onClick={() => searchImages(true)} disabled={isSearching} className="btn btn-primary" style={{ padding: '0 1.2rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {isSearching ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      <div style={{ position: 'relative', minHeight: searchResults.length > 0 || isSearching ? '180px' : '0' }}>
                        {isSearching && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: 0.6, zIndex: 2, background: 'rgba(0,0,0,0.3)', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                            <div className="spin-loader" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Searching Openverse...</span>
                          </div>
                        )}
                        {searchResults.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto', padding: '2px' }}>
                            {searchResults.map((url, i) => (
                              <div key={url} onClick={async () => {
                                const localUrl = await actions.downloadImageFromUrl(url);
                                if (localUrl) setBackgroundColor(localUrl);
                                else setBackgroundColor(url);
                              }} style={{
                                aspectRatio: '16/9', cursor: 'pointer', overflow: 'hidden', borderRadius: '8px',
                                border: backgroundColor === url ? `2px solid ${primaryColor}` : '1px solid rgba(var(--primary-rgb), 0.12)',
                                transition: 'all 0.2s', background: 'rgba(0,0,0,0.2)'
                              }}>
                                <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {!isSearching && searchResults.length > 0 && (
                        <button onClick={() => searchImages(false)} className="btn" style={{
                          padding: '0.55rem', borderRadius: '10px', fontSize: '0.78rem', width: '100%',
                          fontWeight: 700, background: 'rgba(var(--primary-rgb), 0.06)', border: '1px solid var(--glass-border)'
                        }}>
                          Load More
                        </button>
                      )}
                    </div>
                  )}
                  {activeBgSource === "generate" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={genKeyword} onChange={(e) => setGenKeyword(e.target.value)} placeholder="Color or mood (e.g. purple, sunset, ocean)" className="glass" style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem' }} onKeyDown={(e) => e.key === 'Enter' && generateAbstract()} />
                        <button onClick={generateAbstract} disabled={isGenerating} className="btn btn-primary" style={{ padding: '0 1.2rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Pattern Style</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                          <button onClick={() => setGenPatternType(-1)} style={{
                            padding: '0.45rem 0.3rem', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                            background: genPatternType === -1 ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.06)',
                            color: genPatternType === -1 ? '#fff' : 'var(--text)',
                            border: '1px solid ' + (genPatternType === -1 ? 'var(--primary)' : 'var(--glass-border)'),
                            cursor: 'pointer', textAlign: 'center'
                          }}>Random</button>
                          {PATTERN_NAMES.map(p => (
                            <button key={p.id} onClick={() => setGenPatternType(p.id)} title={p.desc} style={{
                              padding: '0.45rem 0.3rem', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                              background: genPatternType === p.id ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.06)',
                              color: genPatternType === p.id ? '#fff' : 'var(--text)',
                              border: '1px solid ' + (genPatternType === p.id ? 'var(--primary)' : 'var(--glass-border)'),
                              cursor: 'pointer', textAlign: 'center'
                            }}>{p.label}</button>
                          ))}
                        </div>
                      </div>
                      {isGenerating && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '0.75rem', opacity: 0.5 }}>
                          <div className="spin-loader" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Generating backdrop...</span>
                        </div>
                      )}
                    </div>
                  )}
                  {activeBgSource === "upload" && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingBg(true); }}
                      onDragLeave={() => setIsDraggingBg(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingBg(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) handleBgUpload(file);
                      }}
                      style={{
                        border: `2px dashed ${isDraggingBg ? 'var(--primary)' : 'var(--glass-border)'}`,
                        borderRadius: '16px', padding: '2.5rem 1.5rem',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: '1rem', cursor: 'pointer',
                        background: isDraggingBg ? 'rgba(var(--primary-rgb), 0.06)' : 'transparent',
                        transition: 'all 0.2s', textAlign: 'center',
                      }}
                      onClick={() => document.getElementById('bg-upload-input')?.click()}
                    >
                      <input id="bg-upload-input" type="file" accept="image/*" hidden
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleBgUpload(file); }} />
                      <Upload size={28} style={{ opacity: 0.4 }} />
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Drop an image here</p>
                        <p style={{ fontSize: '0.75rem', opacity: 0.4, margin: '0.25rem 0 0 0' }}>or click to browse your files</p>
                      </div>
                      {backgroundColor && (backgroundColor.startsWith('/') || backgroundColor.startsWith('http')) && (
                        <div style={{ width: '100%', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                          <img src={backgroundColor} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* LIVE PREVIEW AREA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass" style={{
                flex: 1, borderRadius: '32px', overflow: 'hidden', position: 'relative', border: `1px solid ${primaryColor}44`, background: previewBg, minHeight: '400px', boxShadow: `0 20px 80px -20px ${primaryColor}44`
              }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: backgroundColor ? `url(${backgroundColor})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${backgroundBlur}px) brightness(${currentIsDark ? 0.6 : 1.1})`, transform: 'scale(1.1)' }} />
                <div style={{ position: 'absolute', inset: 0, background: primaryColor, opacity: backgroundTint, mixBlendMode: currentIsDark ? 'soft-light' : 'overlay' }} />
                <div style={{ position: 'absolute', inset: 0, background: currentIsDark ? '#000' : '#fff', opacity: backgroundWash }} />
                <div style={{ position: 'relative', zIndex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><div style={{ width: '32px', height: '32px', borderRadius: '8px', background: primaryColor }} /><div style={{ fontSize: '1rem', fontWeight: 800, color: previewText }}>{dashboardTitle}</div></div>
                  <div className="glass" style={{ padding: '0.8rem 1rem', borderRadius: '12px', background: previewSectionBg, border: `1px solid ${primaryColor}15`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Search size={14} style={{ opacity: 0.3 }} /><div style={{ height: '7px', width: '40%', background: previewText, opacity: 0.2, borderRadius: '4px' }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>{[1, 2].map(i => (<div key={i} className="glass" style={{ padding: '1rem', borderRadius: '16px', background: previewSectionBg, border: `1px solid ${primaryColor}15`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '16px', height: '16px', borderRadius: '4px', background: primaryColor }} /><div style={{ height: '8px', width: '30%', background: previewText, opacity: 0.4, borderRadius: '4px' }} /></div><div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{[1, 2].map(j => (<div key={j} className="glass" style={{ padding: '0.5rem', borderRadius: '8px', background: previewBookmarkBg, border: `1px solid ${primaryColor}11`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '12px', height: '12px', borderRadius: '4px', background: primaryColor }} /><div style={{ height: '6px', width: '50%', background: previewText, opacity: 0.3, borderRadius: '4px' }} /></div>))}</div></div>))}</div>
                </div>
              </div>
              <div className="glass" style={{ display: 'flex', borderRadius: '14px', padding: '0.3rem', background: 'rgba(var(--primary-rgb), 0.05)', alignSelf: 'center' }}>
                <button onClick={() => setTheme('light')} style={{ padding: '0.5rem 1rem', borderRadius: '10px', background: !currentIsDark ? 'var(--primary)' : 'transparent', color: !currentIsDark ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer' }}><Sun size={18} /></button>
                <button onClick={() => setTheme('dark')} style={{ padding: '0.5rem 1rem', borderRadius: '10px', background: currentIsDark ? 'var(--primary)' : 'transparent', color: currentIsDark ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer' }}><Moon size={18} /></button>
              </div>
            </div>
          </div>

          <div style={{ padding: '1.5rem 2.5rem', background: 'rgba(var(--primary-rgb), 0.04)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {editingTheme && onDelete ? (
              <button onClick={() => setIsDeleteModalOpen(true)} className="btn" style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)', padding: '0.8rem 1.5rem', borderRadius: '14px', display: 'flex', gap: '0.5rem', fontWeight: 700 }}>
                <Trash2 size={18} /> Archive Theme
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <button onClick={onClose} className="btn" style={{ padding: '0.8rem 2rem', borderRadius: '14px', fontWeight: 600, opacity: 0.6 }}>Cancel</button>
              <button onClick={handleSaveClick} disabled={isSaving} className="btn btn-primary" style={{ padding: '0.8rem 3rem', borderRadius: '14px', fontWeight: 800, fontSize: '1rem' }}>
                {isSaving ? "Saving..." : (editingTheme ? "Save Changes" : "Create Theme")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && onDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', borderRadius: '32px', textAlign: 'center', border: '1px solid rgba(255,68,68,0.2)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,68,68,0.1)', color: '#ff4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}><Trash2 size={32} /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Archival Confirmation</h2>
            <p style={{ fontSize: '0.95rem', opacity: 0.6, marginBottom: '2.5rem' }}>This visual identity will be permanently decommissioned. Any workspaces relying on this theme will revert to system defaults.</p>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <button onClick={() => setIsDeleteModalOpen(false)} className="btn" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', fontWeight: 700 }}>Cancel</button>
              <button onClick={async () => { await onDelete(); setIsDeleteModalOpen(false); }} className="btn" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: '#ff4444', color: '#fff', fontWeight: 800 }}>Confirm Deletion</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
         .spin-loader { width: 20px; height: 20px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
         @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
