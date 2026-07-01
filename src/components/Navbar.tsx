"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import * as LucideIcons from "lucide-react";
import { LogOut, LayoutGrid, Settings, Sun, Moon, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface NavbarProps {
  title?: string;
  logoIcon?: string | null;
  logoUrl?: string | null;
}

export function Navbar({ title = "Dashboard", logoIcon, logoUrl }: NavbarProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const IconComponent = ({ name, size = 20 }: { name: string; size?: number }) => {
    if (!name) return <LayoutGrid size={size} />;
    const Icon = (LucideIcons as any)[name];
    return Icon ? <Icon size={size} /> : <LayoutGrid size={size} />;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  if (!mounted) return null;

  return (
    <nav className="navbar glass">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        <div className="btn-primary nav-logo" style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px', flexShrink: 0 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <IconComponent name={logoIcon || ""} size={28} />
          )}
        </div>
        <h1 style={{ fontSize: '1.25rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <button onClick={toggleTheme} className="btn" style={{ background: 'transparent', border: 'none', color: 'inherit', padding: '0.5rem' }}>
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {session.user?.isAdmin && (
              <a href="/admin" className="btn" style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text)', padding: '0.5rem 0.75rem' }}>
                <Settings size={18} />
                <span className="nav-admin-text">Admin</span>
              </a>
            )}
            
            <div className="nav-user-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)', color: 'var(--text)' }}>
              {session.user?.image ? (
                <img src={session.user.image} alt="Avatar" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
              ) : (
                <User size={18} />
              )}
              <span className="nav-user-name" style={{ fontSize: '14px', fontWeight: 500 }}>{session.user?.name}</span>
            </div>

            <button onClick={() => signOut()} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '0.5rem 0.75rem' }}>
              <LogOut size={18} />
              <span className="nav-signout-text">Sign Out</span>
            </button>
          </div>
        ) : (
          <button onClick={() => signIn()} className="btn btn-primary">
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}
