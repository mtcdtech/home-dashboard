import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import {
  classifyProvider,
  extractPidClaims,
  findExistingUserByIam,
  safeEmailUpdate,
} from "@/lib/iam";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    ...(process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_CREDENTIALS === "true"
      ? [
          Credentials({
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

                if (credentials?.username === "admin") {
                  let user = await prisma.user.findUnique({
                    where: { email: "admin@local.host" },
                  });
                  const requiredPassword = user?.password || "admin";

                  if (credentials?.password === requiredPassword) {
                    if (!user) {
                      user = await prisma.user.create({
                        data: {
                          name: "Local Admin",
                          email: "admin@local.host",
                          password: "admin",
                          isAdmin: true,
                          department: "IT",
                        },
                      });
                    }
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
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "credentials") return true;

      try {
        console.log(`SignIn check for: ${user.email} Provider: ${account?.provider}`);
        const providerKind = classifyProvider(account?.provider);
        const { pid, loginSource, pidHistory } = extractPidClaims(profile);

        let department = "";
        let isGroupAdmin = false;
        const groups: string[] = (profile?.groups as string[]) || [];

        if (account?.provider === "microsoft-entra-id" && profile) {
          department = (profile as any).department || "";
        } else if (account?.provider === "synology" && profile) {
          isGroupAdmin = groups.includes("administrators");
          department = isGroupAdmin ? "Admin" : "Synology";
          console.log("Synology SSO Sign-in - User:", user.email, "isGroupAdmin:", isGroupAdmin);
        } else if (providerKind === "authentik") {
          isGroupAdmin =
            groups.includes("app-home-dashboard-global-admins") ||
            groups.includes("app-home-dashboard-admins") ||
            groups.includes("Authentik Admins");
          department = "";
        }

        (user as any).department = department;

        if (!user.email && !pid) return true;

        const { user: existingUser, matchedBy } = await findExistingUserByIam({
          pid,
          pidHistory,
          email: user.email,
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

        const iamPayload: any = {};
        if (pid) {
          iamPayload.mtcdPersonId = pid;
          iamPayload.mtcdLastSyncedAt = new Date();
        }
        if (loginSource) {
          iamPayload.mtcdIdentitySource = loginSource;
        }

        let dbUser;
        if (existingUser) {
          dbUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: finalName,
              image: finalImage,
              msName,
              msImage,
              pcoName,
              pcoImage,
              ccName,
              ccImage,
              department,
              ...(department && !existingUser.dashboardGroup ? { dashboardGroup: department } : {}),
              ...(isGroupAdmin ? { isAdmin: true } : {}),
              ...(user.email && user.email !== existingUser.email
                ? await safeEmailUpdate(user.email, existingUser.id)
                : {}),
              ...iamPayload,
            },
          });
        } else {
          if (!user.email) {
            console.error("[iam] No email and no existing user; refusing to create anonymous row");
            return false;
          }
          dbUser = await prisma.user.create({
            data: {
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
              ...iamPayload,
            },
          });

          // Auto-assign workspaces flagged as "push to new users" (for brand-new accounts)
          try {
            const pushTabs = await prisma.tab.findMany({
              where: { pushToNewUsers: true },
              select: { id: true },
            });
            if (pushTabs.length > 0) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { allowedTabs: { connect: pushTabs.map((t) => ({ id: t.id })) } },
              });
              console.log(`Auto-assigned ${pushTabs.length} workspace(s) to new user ${dbUser.id}`);
            }
          } catch (e) {
            console.error("pushToNewUsers failed:", e);
          }
        }

        console.log(
          "User saved — department:",
          department,
          "dashboardGroup:",
          dbUser.dashboardGroup,
          "matchedBy:",
          matchedBy,
          "pid:",
          dbUser.mtcdPersonId
        );
        user.id = dbUser.id;
        user.name = dbUser.name;
        user.image = dbUser.image;
        (user as any).isAdmin = dbUser.isAdmin;
        (user as any).iconSize = dbUser.iconSize;
        (user as any).canEditContent = dbUser.canEditContent;
        (user as any).mtcdPersonId = dbUser.mtcdPersonId;
        (user as any).mtcdIdentitySource = dbUser.mtcdIdentitySource;

        // Log login activity (fire-and-forget)
        (prisma as any).activityLog
          .create({
            data: {
              userId: dbUser.id,
              userName: user.name || user.email,
              type: "login",
              detail: `via ${account?.provider || "SSO"}${matchedBy ? ` (matched=${matchedBy})` : ""}${
                dbUser.mtcdPersonId ? ` pid=${dbUser.mtcdPersonId}` : ""
              }`,
            },
          })
          .catch(() => {});

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
        token.mtcdPersonId = (user as any).mtcdPersonId ?? null;
        token.mtcdIdentitySource = (user as any).mtcdIdentitySource ?? null;

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
        session.user.mtcdPersonId = token.mtcdPersonId ?? null;
        session.user.mtcdIdentitySource = token.mtcdIdentitySource ?? null;
        if (token.name) session.user.name = token.name;
        if (token.picture) session.user.image = token.picture;
        console.log("Session created for:", session.user.email, "isAdmin:", session.user.isAdmin);
      }
      return session;
    },
  },
});
