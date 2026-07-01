import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const globalSettings = await (prisma as any).globalSettings.findUnique({ where: { id: "global" } });
  const activeTheme = await prisma.theme.findFirst({ where: { isActive: true } });
  
  let loginTheme = null;
  if (globalSettings?.loginThemeId) {
    loginTheme = await prisma.theme.findUnique({ where: { id: globalSettings.loginThemeId } });
  }

  const logoUrlLight = globalSettings?.logoUrlLight || null;
  const logoUrlDark = globalSettings?.logoUrlDark || globalSettings?.logoUrlLight || null;
  const logoUrl = loginTheme?.darkMode ? logoUrlDark : (logoUrlLight || logoUrlDark);
  const themeColor = loginTheme?.primaryColor || globalSettings?.systemThemeColor || activeTheme?.primaryColor || "#3b82f6";
  const logoIcon = loginTheme?.logoIcon || activeTheme?.logoIcon || "LayoutGrid";

  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: loginTheme?.backgroundColor ? 'transparent' : '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-pulse" style={{ width: '40px', height: '40px', background: themeColor, borderRadius: '12px' }} />
      </div>
    }>
      <LoginForm 
        logoUrl={logoUrl} 
        themeColor={themeColor}
        logoIcon={logoIcon}
        loginTheme={loginTheme}
        hasMicrosoft={!!process.env.AUTH_MICROSOFT_ENTRA_ID_ID && !process.env.NEXTAUTH_URL?.includes("abraham16")}
        hasSynology={!!process.env.SYNOLOGY_CLIENT_ID}
        hasAuthentikPco={!!process.env.AUTHENTIK_PCO_CLIENT_ID}
        hasAuthentikMs={!!process.env.AUTHENTIK_MS_CLIENT_ID}
        hasAuthentikCc={!!process.env.AUTHENTIK_CC_CLIENT_ID}
      />
    </Suspense>
  );
}
