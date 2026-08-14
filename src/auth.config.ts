import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { NextAuthConfig } from "next-auth";

const providers: any[] = [];

// Local Admin credentials provider with bcrypt verification and silent legacy migration
providers.push(
  Credentials({
    id: "credentials",
    name: "Credentials",
    credentials: {
      username: { label: "Username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      console.log("Credentials login attempt for:", credentials?.username);
      try {
        const settings = await (prisma as any).globalSettings.findUnique({
          where: { id: "global" },
        });
        if (settings?.disableLocalAdmin) {
          console.log("Local admin sign-in attempt rejected: disabled by administrator");
          return null;
        }

        const username = typeof credentials?.username === "string" ? credentials.username.trim() : "";
        const inputPassword = typeof credentials?.password === "string" ? credentials.password : "";

        if (username === "admin") {
          let user = await prisma.user.findUnique({
            where: { email: "admin@local.host" },
          });

          // Bootstrap seed if no local admin user exists: create with random bcrypt-hashed password
          if (!user) {
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const initialHash = await bcrypt.hash(randomPassword, 12);
            user = await prisma.user.create({
              data: {
                name: "Local Admin",
                email: "admin@local.host",
                passwordHash: initialHash,
                password: null,
                isAdmin: true,
                department: "IT",
              },
            });
            console.log("================================================================================");
            console.log("[SECURITY] Initial Local Admin account seeded (no default password).");
            console.log(`[SECURITY] Temporary credentials -> Username: admin | Password: ${randomPassword}`);
            console.log("================================================================================");
          }

          if (!inputPassword) return null;

          let isValid = false;

          if (user.passwordHash) {
            isValid = await bcrypt.compare(inputPassword, user.passwordHash);
          } else if (user.password) {
            // Legacy plaintext fallback (transition support)
            if (inputPassword === user.password) {
              isValid = true;
              // Silently upgrade to bcrypt hash and clear legacy plaintext password
              try {
                const upgradedHash = await bcrypt.hash(inputPassword, 12);
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    passwordHash: upgradedHash,
                    password: null,
                  },
                });
                console.log(`[auth] Successfully upgraded legacy password to bcrypt hash for user ${user.email}`);
              } catch (upgradeErr) {
                console.error("[auth] Failed to upgrade legacy password hash:", upgradeErr);
              }
            }
          }

          if (isValid) {
            console.log("Local admin authorized successfully");
            (prisma as any).activityLog
              .create({
                data: {
                  userId: user.id,
                  userName: user.name,
                  type: "login",
                  detail: "via Local Admin Credentials",
                },
              })
              .catch(() => {});
            return user;
          }
        }
      } catch (error) {
        console.error("Local admin authorization failed:", error);
        return null;
      }
      return null;
    },
  })
);

// Generic Authentik OIDC (Personal SSO — abraham16.com)
if (process.env.AUTHENTIK_CLIENT_ID) {
  providers.push({
    id: "authentik",
    name: "Authentik",
    type: "oidc",
    issuer: process.env.AUTHENTIK_ISSUER,
    clientId: process.env.AUTHENTIK_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile email groups", prompt: "login" } },
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

// Authentik OIDC -> Planning Center (auto-redirect via dedicated single-source flow)
if (process.env.AUTHENTIK_PCO_CLIENT_ID) {
  providers.push({
    id: "authentik-pco",
    name: "Planning Center",
    type: "oidc",
    issuer: process.env.AUTHENTIK_PCO_ISSUER,            // https://auth.server.mtcd.org/application/o/home-dashboard-pco/
    clientId: process.env.AUTHENTIK_PCO_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_PCO_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile email groups mtcd_person", prompt: "login" } },
    checks: ["pkce", "state"],
    // Account linking by verified email: trust assumption is that configured IdPs
    // (Authentik/Planning Center/Microsoft/Synology) verify email ownership before issuing claims.
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
    authorization: { params: { scope: "openid profile email groups mtcd_person", prompt: "login" } },
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

// Authentik OIDC -> Church Center (auto-redirect via dedicated single-source flow)
if (process.env.AUTHENTIK_CC_CLIENT_ID) {
  providers.push({
    id: "authentik-cc",
    name: "Church Center",
    type: "oidc",
    issuer: process.env.AUTHENTIK_CC_ISSUER,             // https://auth.server.mtcd.org/application/o/home-dashboard-cc/
    clientId: process.env.AUTHENTIK_CC_CLIENT_ID,
    clientSecret: process.env.AUTHENTIK_CC_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile email groups mtcd_person", prompt: "login" } },
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
      checks: ["pkce", "state"],
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
      checks: ["pkce", "state"],
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
  debug: true,
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
      const isPublicApi =
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname.startsWith("/api/sync") ||
        nextUrl.pathname.startsWith("/api/iam");
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
