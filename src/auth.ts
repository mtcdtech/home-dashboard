import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    ...(process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_CREDENTIALS === "true" ? [
      Credentials({
        credentials: {
          username: { label: "Username", type: "text" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          console.log("Credentials login attempt for:", credentials?.username);
          if (credentials?.username === "admin" && credentials?.password === "admin") {
            try {
              let user = await prisma.user.findUnique({ where: { email: "admin@local.host" } });
              if (!user) {
                user = await prisma.user.create({
                  data: {
                    name: "Local Admin",
                    email: "admin@local.host",
                    password: "admin", 
                    isAdmin: true,
                    department: "IT",
                  }
                });
              }
              console.log("Local admin authorized successfully");
              (prisma as any).activityLog.create({
                data: { userId: user.id, userName: user.name, type: "login", detail: "via Local Admin Credentials" }
              }).catch(() => {});
              return user;
            } catch (error) {
              console.error("Local admin authorization failed:", error);
              return null;
            }
          }
          return null;
        }
      })
    ] : [])
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "credentials") return true;
      
      try {
        console.log(`SignIn check for: ${user.email} Provider: ${account?.provider}`);
        
        let department = "";
        let isGroupAdmin = false;
        const groups: string[] = (profile?.groups as string[]) || [];

        if (account?.provider === "microsoft-entra-id" && profile) {
           department = (profile as any).department || "";
        } else if (account?.provider === "synology" && profile) {
           isGroupAdmin = groups.includes("administrators");
           department = isGroupAdmin ? "Admin" : "Synology";
           console.log("Synology SSO Sign-in - User:", user.email, "isGroupAdmin:", isGroupAdmin);
        } else if (account?.provider === "authentik-pco" || account?.provider === "authentik-ms" || account?.provider === "authentik-cc") {
           // Authentik returns groups as an array of names from the property mapping
           isGroupAdmin =
             groups.includes("app-home-dashboard-global-admins") ||
             groups.includes("app-home-dashboard-admins") ||
             groups.includes("Authentik Admins");
           // Department mapping is left blank by default; the existing dashboardGroup
           // upsert logic will fall back to "General" for new users.
           department = "";
        }

        (user as any).department = department;

        if (user.email) {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email }
            });

            let msName = existingUser?.msName || null;
            let msImage = existingUser?.msImage || null;
            let pcoName = existingUser?.pcoName || null;
            let pcoImage = existingUser?.pcoImage || null;
            let ccName = existingUser?.ccName || null;
            let ccImage = existingUser?.ccImage || null;

            if (account?.provider === "authentik-ms") {
              msName = user.name || null;
              msImage = user.image || null;
            } else if (account?.provider === "authentik-pco") {
              pcoName = user.name || null;
              pcoImage = user.image || null;
            } else if (account?.provider === "authentik-cc") {
              ccName = user.name || null;
              ccImage = user.image || null;
            }

            const finalName = msName || pcoName || ccName || user.name;
            const finalImage = msImage || pcoImage || ccImage || user.image;

            const dbUser = await prisma.user.upsert({
              where: { email: user.email },
              update: { 
                name: finalName,
                image: finalImage,
                msName,
                msImage,
                pcoName,
                pcoImage,
                ccName,
                ccImage,
                department,
                ...(department && !existingUser?.dashboardGroup ? { dashboardGroup: department } : {}),
                ...(isGroupAdmin ? { isAdmin: true } : {})
              },
              create: {
                name: finalName,
                email: user.email,
                image: finalImage,
                msName,
                msImage,
                pcoName,
                pcoImage,
                ccName,
                ccImage,
                department,
                dashboardGroup: department || "General",
                isAdmin: isGroupAdmin,
              }
            });
            console.log("User upserted — department:", department, "dashboardGroup:", dbUser.dashboardGroup);
            user.id = dbUser.id;
            user.name = dbUser.name;
            user.image = dbUser.image;
            (user as any).isAdmin = dbUser.isAdmin;
            (user as any).iconSize = dbUser.iconSize;
            (user as any).canEditContent = dbUser.canEditContent;

            // Auto-assign workspaces flagged as "push to new users" (only for brand-new accounts)
            if (!existingUser) {
              try {
                const pushTabs = await prisma.tab.findMany({ where: { pushToNewUsers: true }, select: { id: true } });
                if (pushTabs.length > 0) {
                  await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { allowedTabs: { connect: pushTabs.map(t => ({ id: t.id })) } }
                  });
                  console.log(`Auto-assigned ${pushTabs.length} workspace(s) to new user ${dbUser.id}`);
                }
              } catch (e) { console.error("pushToNewUsers failed:", e); }
            }

            // Log login activity (fire-and-forget)
            (prisma as any).activityLog.create({
              data: { userId: dbUser.id, userName: user.name || user.email, type: "login", detail: `via ${account?.provider || "SSO"}` }
            }).catch(() => {});
        }
        return true;
      } catch (err) {
        console.error("SignIn error:", err);
        return true;
      }
    },
    async jwt({ token, user, account, profile }: any) {
      if (user) {
        console.log("JWT callback - user logged in:", user.email);
        token.id = user.id;
        token.department = (user as any).department;
        token.isAdmin = (user as any).isAdmin;
        token.iconSize = (user as any).iconSize || 48;
        token.canEditContent = (user as any).canEditContent;

        // Finalize admin status for Synology SSO users based on group ID
        if (account?.provider === "synology" && profile) {
          const synologyGroups = (profile as any).groups || [];
          if (synologyGroups.includes("administrators")) {
             console.log("Admin privilege granted to group member:", token.email);
             token.isAdmin = true;
          }
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.department = token.department;
        session.user.isAdmin = token.isAdmin;
        session.user.iconSize = token.iconSize;
        session.user.canEditContent = token.canEditContent;
        if (token.name) session.user.name = token.name;
        if (token.picture) session.user.image = token.picture;
        console.log("Session created for:", session.user.email, "isAdmin:", session.user.isAdmin);
      }
      return session;
    },
  },
});
