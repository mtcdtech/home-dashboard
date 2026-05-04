import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";

const providers: any[] = [];

// Authentik OIDC -> Planning Center (auto-redirect via dedicated single-source flow)
if (process.env.AUTHENTIK_PCO_CLIENT_ID) {
  providers.push({
    id: "authentik-pco",
    name: "Planning Center",
    type: "oidc",
    issuer: process.env.AUTHENTIK_PCO_ISSUER,            // https://auth.server.mtcd.org/application/o/home-dashboard-pco/
    clientId: process.env.AUTHENTIK_PCO_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_PCO_CLIENT_SECRET,
    authorization: { params: { scope: "openid email profile groups" } },
    checks: ["pkce", "state"],
    allowDangerousEmailAccountLinking: true,
    profile(profile: any) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.picture || null,
        department: "",      // populated in signIn callback from groups
        isAdmin: false,
      };
    },
  });
}

// Authentik OIDC -> Microsoft Entra (auto-redirect via dedicated single-source flow)
if (process.env.AUTHENTIK_MS_CLIENT_ID) {
  providers.push({
    id: "authentik-ms",
    name: "Microsoft",
    type: "oidc",
    issuer: process.env.AUTHENTIK_MS_ISSUER,             // https://auth.server.mtcd.org/application/o/home-dashboard-ms/
    clientId: process.env.AUTHENTIK_MS_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_MS_CLIENT_SECRET,
    authorization: { params: { scope: "openid email profile groups" } },
    checks: ["pkce", "state"],
    allowDangerousEmailAccountLinking: true,
    profile(profile: any) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.picture || null,
        department: "",
        isAdmin: false,
      };
    },
  });
}

// Legacy Microsoft Entra ID provider — fallback when Authentik is not configured.
// Activates only when all three legacy vars are set, so the login button is usable.
if (
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
  process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
) {
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const issuer =
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ||
    `https://login.microsoftonline.com/${tenantId}/v2.0`;
  providers.push(MicrosoftEntraID({
      id: "microsoft-entra-id",
      name: "Microsoft",
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer,
      authorization: { params: { scope: "openid profile email User.Read" } },
      allowDangerousEmailAccountLinking: true,
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.displayName || profile.name || "",
          email: profile.email || profile.preferred_username,
          image: null,
          department: profile.department || "",
          isAdmin: false,
        };
      },
  }));
}

if (process.env.SYNOLOGY_CLIENT_ID) {
  providers.push({
      id: "synology",
      name: "Synology SSO",
      type: "oidc",
      clientId: process.env.SYNOLOGY_CLIENT_ID,
      clientSecret: process.env.SYNOLOGY_CLIENT_SECRET,
      issuer: process.env.SYNOLOGY_ISSUER,
      authorization: { params: { scope: "openid email groups" } },
      allowDangerousEmailAccountLinking: true,
      profile(profile: any) {
        console.log("Synology OIDC Profile claims:", profile);
        return {
          id: profile.sub,
          name: profile.description || profile.name || profile.username || profile.sub,
          email: profile.email || `${profile.username}@abraham16.com`,
          image: null,
          department: profile.groups && profile.groups.includes("administrators") ? "Admin" : "Synology",
          isAdmin: false, // Handled in auth.ts based on group mapping
        };
      },
  });
}

export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = (auth?.user as any)?.isAdmin;
      const isLoginPage = nextUrl.pathname.startsWith("/login");
      const isPublicApi = nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname.startsWith("/api/sync");
      const isPublicAsset =
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/favicon.ico") ||
        nextUrl.pathname.startsWith("/uploads");

      // 🛡️ Master Exclusion Governance
      if (isLoginPage || isPublicApi || isPublicAsset) {
        if (isLoginPage && isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // 🔐 Global protection signal - removed to allow page.tsx to handle public tab logic
      // if (!isLoggedIn) return false;

      // 🛡️ Admin protection signal
      if (nextUrl.pathname.startsWith("/admin")) {
        return isLoggedIn ? true : false;
      }

      return true;
    },
  },
  providers,
} satisfies NextAuthConfig;
