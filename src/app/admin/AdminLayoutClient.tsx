"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { 
  Sun, 
  Moon, 
  LayoutGrid, 
  Home, 
  Layers, 
  Palette, 
  Users, 
  ArrowLeft,
  LogOut,
  RefreshCw
} from "lucide-react";
import { IconComponent } from "@/components/IconPicker";
import * as actions from "@/app/admin/actions";

export default function AdminLayout({
   children,
   session,
   avatarColor
}: {
   children: React.ReactNode;
   session: any;
   avatarColor?: string | null;
}) {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const fetchSettings = async () => {
      const settings = await actions.getGlobalSettings();
      setGlobalSettings(settings);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (globalSettings?.systemThemeColor) {
      document.documentElement.style.setProperty('--primary', globalSettings.systemThemeColor);
      const hex = globalSettings.systemThemeColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    }
  }, [globalSettings]);

  const userDepartment = session?.user?.department;
  const isAdmin = (session?.user as any)?.isAdmin;

  const initials = session?.user?.name
    ? session.user.name.trim().split(/\s+/).map((n: any) => n[0]).join('').toUpperCase().slice(0, 2)
    : (isAdmin ? "AD" : "U");

  const navItems = [
    { label: "Overview", href: "/admin", icon: Home },
    { label: "Tabs", href: "/admin/tabs", icon: Layers },
    { label: "Sections", href: "/admin/sections", icon: LayoutGrid },
    { label: "Themes", href: "/admin/theme", icon: Palette },
    { label: "Users", href: "/admin/users", icon: Users },
  ];

  if (isAdmin) {
    navItems.push({ label: "Workspace Sync", href: "/admin/sync", icon: RefreshCw });
  }

  return (
    <div className="fade-in admin-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="admin-header glass" style={{ background: 'var(--glass-bg)', padding: 'calc(0.5rem + env(safe-area-inset-top)) 1.5rem 0.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, width: '100%', boxSizing: 'border-box', borderBottom: '1px solid var(--glass-border)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {(globalSettings?.logoUrlLight || globalSettings?.logoUrlDark) && (
              <>
                <img 
                  src={mounted && resolvedTheme === 'dark' 
                    ? (globalSettings.logoUrlDark || globalSettings.logoUrlLight || "")
                    : (globalSettings.logoUrlLight || globalSettings.logoUrlDark || "")
                  }
                  alt="System Logo"
                  className="admin-logo-wide"
                  style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
                />
                <img 
                  src={mounted && resolvedTheme === 'dark' 
                    ? (globalSettings.logoUrlSquareDark || globalSettings.logoUrlDark || globalSettings.logoUrlLight || "")
                    : (globalSettings.logoUrlSquareLight || globalSettings.logoUrlLight || globalSettings.logoUrlDark || "")
                  }
                  alt="System Logo"
                  className="admin-logo-square"
                  style={{ height: '28px', width: '28px', objectFit: 'contain', borderRadius: '6px', display: 'none' }}
                />
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>
                    Admin Portal
                </h1>
            </div>
        </div>

        <div className="admin-header-right admin-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="glass admin-user-info" style={{ padding: '0.35rem 0.75rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>
                {initials}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}>
                  {session?.user?.name || "User"}
                </span>
                <span style={{ fontSize: '0.65rem', opacity: 0.5, lineHeight: 1 }}>
                  {userDepartment || "General"}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} 
            className="btn" 
            style={{ padding: '0.5rem', color: 'var(--text)', opacity: 0.6 }}
            title="Toggle Theme"
          >
            {mounted && resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button 
            onClick={() => {
              import("next-auth/react").then(mod => mod.signOut({ callbackUrl: "/" }));
            }} 
            className="btn" 
            style={{ padding: '0.5rem', color: '#f87171', opacity: 0.8 }}
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>

          <a href="/" className="btn admin-dashboard-link" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--glass-border)', display: 'flex', gap: '0.4rem', color: 'var(--text)', alignItems: 'center' }}>
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </a>
        </div>
      </header>

      <div style={{ flex: 1, padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
        <div className="admin-grid" style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2rem' }}>
        <aside className="admin-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '1rem', marginBottom: '0.4rem' }}>Navigation</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <a 
                key={item.href}
                href={item.href} 
                className={`glass admin-nav-item ${isActive ? 'active' : ''}`}
                style={{ 
                  padding: '0.85rem 1rem', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  color: 'var(--text)',
                  background: isActive ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--primary-rgb), 0.05)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                  opacity: isActive ? 1 : 0.7,
                  transition: 'all 0.3s ease',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem'
                }}
              >
                <Icon size={18} style={{ color: isActive ? 'var(--primary)' : 'inherit', flexShrink: 0 }} />
                <span className="admin-nav-label">{item.label}</span>
              </a>
            );
          })}
        </aside>

        <main style={{ minWidth: 0 }}>
          {children}
        </main>
        </div>
      </div>
      
      {/* Version Footer */}
      <div style={{ textAlign: 'center', padding: 'max(1rem, env(safe-area-inset-bottom))', opacity: 0.5, fontSize: '0.8rem', color: 'var(--text)', marginTop: 'auto' }}>
         v1.3.24
      </div>

      <style jsx global>{`
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
