"use client";

import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { LogIn, ShieldCheck, LayoutGrid, Settings, Edit2, Check, LogOut, X } from "lucide-react";

const IconComponent = ({ name, size = 24, color = "currentColor" }: { name: string; size?: number, color?: string }) => {
  const icons: Record<string, any> = { LayoutGrid, ShieldCheck, Cpu: ShieldCheck, Settings, Edit2, Check, LogOut };
  const Icon = icons[name] || LayoutGrid;
  return <Icon size={size} color={color} />;
};

export function LoginForm({ logoUrl, themeColor, logoIcon, loginTheme, disableLocalAdmin, hasMicrosoft, hasSynology, hasAuthentik, hasAuthentikPco, hasAuthentikMs, hasAuthentikCc }: { logoUrl?: string | null, themeColor: string, logoIcon?: string | null, loginTheme?: any, disableLocalAdmin?: boolean, hasMicrosoft?: boolean, hasSynology?: boolean, hasAuthentik?: boolean, hasAuthentikPco?: boolean, hasAuthentikMs?: boolean, hasAuthentikCc?: boolean }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const [mounted, setMounted] = useState(false);
  const [showLocalLogin, setShowLocalLogin] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Convert hex to rgb for glow effects
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  };

  const themeRgb = themeColor.startsWith('#') ? hexToRgb(themeColor) : "99, 102, 241";
  
  const isDark = loginTheme ? loginTheme.darkMode : true;
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const glassBg = isDark ? `rgba(0,0,0,${loginTheme?.glassOpacity ?? 0.4})` : `rgba(255,255,255,${loginTheme?.glassOpacity ?? 0.5})`;

  return (
    <div className="login-atmospheric-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: loginTheme?.backgroundColor ? 'transparent' : '#050505',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* Theme Background */}
      {loginTheme?.backgroundColor && (
         <>
            {loginTheme.backgroundColor.startsWith('http') || loginTheme.backgroundColor.startsWith('/') ? (
               <img src={loginTheme.backgroundColor} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${loginTheme.backgroundBlur ?? 0}px)`, zIndex: 0 }} />
            ) : (
               <div style={{ position: 'absolute', inset: 0, background: loginTheme.backgroundColor, zIndex: 0 }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: loginTheme.darkMode ? '#000' : '#fff', opacity: Object.hasOwn(loginTheme, 'backgroundTint') ? loginTheme.backgroundTint : 0.5, zIndex: 0 }} />
         </>
      )}

      {/* Ambient backgrounds fallback if no theme image */}
      {!loginTheme?.backgroundColor && (
         <>
            <div style={{
              position: 'absolute',
              top: '-10%',
              right: '-10%',
              width: '60%',
              height: '60%',
              background: `radial-gradient(circle, rgba(${themeRgb}, 0.15) 0%, transparent 70%)`,
              filter: 'blur(100px)',
              zIndex: 0
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-10%',
              left: '-10%',
              width: '50%',
              height: '50%',
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
              filter: 'blur(100px)',
              zIndex: 0
            }} />
         </>
      )}

      <div className="glass fade-in" style={{ 
        width: '100%', 
        maxWidth: '450px', 
        padding: '3.5rem 3rem', 
        borderRadius: '32px', 
        zIndex: 1, 
        textAlign: 'center',
        border: `1px solid ${glassBorder}`,
        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(${themeRgb}, 0.2)`,
        backdropFilter: `blur(${loginTheme ? (loginTheme.glassEffect ? (loginTheme.backgroundBlur || 20) : 0) : 24}px)`,
        background: glassBg,
        margin: '1rem'
      }}>
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Logo" 
            style={{ height: '64px', width: 'auto', margin: '0 auto 2rem auto', display: 'block', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.1))' }} 
            onError={(e) => {
               e.currentTarget.style.display = 'none';
               // If there's a fallback sibling, display it
               if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
               }
            }}
          />
        ) : null}
        
        <div style={{ 
          width: '80px', 
          height: '80px', 
          background: themeColor, 
          borderRadius: '24px', 
          margin: '0 auto 2rem auto', 
          display: logoUrl ? 'none' : 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: `0 0 40px rgba(${themeRgb}, 0.4)`
        }}>
          <IconComponent name={logoIcon || "LayoutGrid"} size={40} color="#fff" />
        </div>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#fff', letterSpacing: '-0.025em' }}>Dashboard</h1>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2.5rem', lineHeight: 1.5 }}>
          Customize and consolidate links and apps in one location
        </p>

        {error && (
          <div className="glass" style={{ 
            padding: '1.25rem', 
            borderRadius: '16px', 
            background: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: '#f87171', 
            fontSize: '0.9rem', 
            marginBottom: '2.5rem',
            textAlign: 'left',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Authentication Error</div>
            {error === "AccessDenied" ? (
              <>
                <div style={{ opacity: 0.9 }}>You do not have permission to access this portal.</div>
                {errorDescription && <div style={{ marginTop: '0.5rem', opacity: 0.6, fontSize: '0.75rem' }}>{errorDescription}</div>}
              </>
            ) : "There was a problem signing you in. Please try again."}
          </div>
        )}

        {(hasAuthentik || hasAuthentikMs || hasAuthentikPco || hasAuthentikCc) && (
          <button 
            onClick={() => signIn(hasAuthentik ? "authentik" : hasAuthentikMs ? "authentik-ms" : hasAuthentikPco ? "authentik-pco" : "authentik-cc", { callbackUrl: "/" })}
            style={{ 
              width: '100%',
              padding: '1.1rem', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
              boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 70, 229, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(79, 70, 229, 0.3)';
            }}
          >
            <ShieldCheck size={24} />
            Sign In Securely
          </button>
        )}

        {hasMicrosoft && !hasAuthentikMs && (
          <button 
            onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/" })}
            style={{ 
              width: '100%',
              padding: '1.1rem', 
              borderRadius: '16px', 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.5 11.5H3V3H11.5V11.5Z" fill="#F25022"/>
              <path d="M21 11.5H12.5V3H21V11.5Z" fill="#7FBA00"/>
              <path d="M11.5 21H3V12.5H11.5V21Z" fill="#00A4EF"/>
              <path d="M21 21H12.5V12.5H21V21Z" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </button>
        )}

        {hasSynology && (
          <button 
            onClick={() => signIn("synology", { callbackUrl: "/" })}
            style={{ 
              width: '100%',
              padding: '1.1rem', 
              borderRadius: '16px', 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff',
              fontWeight: 600,
              fontSize: '1rem',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign In with Synology SSO
          </button>
        )}

        {!disableLocalAdmin && (
          <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
            <button 
               onClick={() => setShowLocalLogin(!showLocalLogin)}
               style={{ 
                 background: 'transparent', 
                 border: 'none', 
                 color: 'rgba(255,255,255,0.6)', 
                 fontSize: '0.8rem', 
                 cursor: 'pointer', 
                 padding: '0 1rem', 
                 textTransform: 'uppercase', 
                 letterSpacing: '0.1em' 
               }}>
               {showLocalLogin ? 'Hide Local Sign In' : 'Use Local Account'}
            </button>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
          </div>
        )}

        {showLocalLogin && (
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const username = formData.get("username") as string;
              const password = formData.get("password") as string;
              await signIn("credentials", { username, password, callbackUrl: "/" });
            }}
            className="fade-in"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}
          >
            <input 
              name="username"
              type="text" 
              placeholder="Username" 
              autoComplete="username"
              style={{ 
                width: '100%',
                padding: '1.1rem 1.25rem', 
                borderRadius: '16px', 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
            />
            <input 
              name="password"
              type="password" 
              placeholder="Password" 
              autoComplete="current-password"
              style={{ 
                width: '100%',
                padding: '1.1rem 1.25rem', 
                borderRadius: '16px', 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
            />
            <button 
              type="submit"
              style={{ 
                width: '100%',
                padding: '1.1rem', 
                borderRadius: '16px', 
                background: themeColor, 
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 15px rgba(${themeRgb}, 0.3)`,
                marginTop: '0.5rem'
              }}
            >
              Sign In Locally
            </button>
          </form>
        )}

        <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: 0.2 }}>
           <ShieldCheck size={14} />
           <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Secure Authentication</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem', opacity: 0.5, fontSize: '0.8rem', color: 'var(--text)' }}>
           v{require('../../../package.json').version}
        </div>
      </div>


      <style jsx global>{`
        .fade-in {
          animation: fadeIn 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input:focus {
          border-color: ${themeColor} !important;
          background: rgba(255,255,255,0.08) !important;
          box-shadow: 0 0 20px rgba(${themeRgb}, 0.15);
        }
        button:hover {
          filter: brightness(1.1);
          transform: translateY(-2px);
        }
        input::placeholder {
          color: rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  );
}
