import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";

const providers: any[] = [];

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  providers.push(MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: { params: { scope: "openid profile email User.Read" } },
      allowDangerousEmailAccountLinking: true,
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.displayName || profile.name || "",
          email: profile.email || profile.preferred_username,
          image: null,
          department: profile.department || "",
          isAdmin: false, // Default to false, handled in signIn/jwt callbacks
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

      // 🔐 Global protection signal
      if (!isLoggedIn) return false;

      // 🛡️ Admin protection signal
      if (nextUrl.pathname.startsWith("/admin")) {
        return true;
      }

      return true;
    },
  },
  providers,
} satisfies NextAuthConfig;
