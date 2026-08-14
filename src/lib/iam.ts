import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

function safeEq(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type IamProviderKind =
  | "authentik"       // authentik-pco | authentik-ms | authentik-cc — carries mtcd_person_id
  | "microsoft-entra" // legacy direct Entra — no mtcd_person_id
  | "synology"        // Abraham stack — no mtcd_person_id
  | "credentials"     // dev local admin — no mtcd_person_id
  | "unknown";

export function classifyProvider(providerId: string | undefined | null): IamProviderKind {
  if (!providerId) return "unknown";
  if (providerId.startsWith("authentik-")) return "authentik";
  if (providerId === "microsoft-entra-id") return "microsoft-entra";
  if (providerId === "synology") return "synology";
  if (providerId === "credentials") return "credentials";
  return "unknown";
}

export function extractPidClaims(profile: any): {
  pid: string | null;
  loginSource: string | null;
  pidHistory: Array<{ previous_mtcd_person_id?: string; new_mtcd_person_id?: string }>;
  identities: any;
} {
  if (!profile) return { pid: null, loginSource: null, pidHistory: [], identities: null };
  const pid = typeof profile.mtcd_person_id === "string" && profile.mtcd_person_id ? profile.mtcd_person_id : null;
  const loginSource = typeof profile.mtcd_login_source === "string" ? profile.mtcd_login_source : null;
  const pidHistory = Array.isArray(profile.mtcd_person_id_history) ? profile.mtcd_person_id_history : [];
  const identities = profile.mtcd_identities || null;
  return { pid, loginSource, pidHistory, identities };
}

export async function findExistingUserByIam({
  pid,
  pidHistory = [],
  email,
  db = prisma,
}: {
  pid: string | null;
  pidHistory?: Array<{ previous_mtcd_person_id?: string; new_mtcd_person_id?: string }>;
  email: string | null | undefined;
  db?: any;
}): Promise<{ user: any | null; matchedBy: "pid" | "pid_history" | "email" | null }> {
  // Tier 1: current mtcdPersonId
  if (pid) {
    const u = await db.user.findUnique({ where: { mtcdPersonId: pid } });
    if (u) return { user: u, matchedBy: "pid" };
  }

  // Tier 2: mtcdPersonId matches any previous_mtcd_person_id in history
  if (pid && pidHistory.length > 0) {
    for (const entry of pidHistory) {
      const prev = entry?.previous_mtcd_person_id;
      if (!prev || prev === pid) continue;
      const u = await db.user.findUnique({ where: { mtcdPersonId: prev } });
      if (u) {
        // Migrate: adopt new pid on existing row so future tier-1 lookups match immediately.
        // Only do this if no other row already holds the new pid (uniqueness guard).
        const conflict = await db.user.findUnique({ where: { mtcdPersonId: pid } });
        if (!conflict) {
          const updated = await db.user.update({
            where: { id: u.id },
            data: { mtcdPersonId: pid },
          });
          return { user: updated, matchedBy: "pid_history" };
        }
        console.warn(
          `[iam] pid history match for ${u.email} points to new pid ${pid} but another user row already holds that pid. Falling through to email match.`
        );
      }
    }
  }

  // Tier 3: email match
  if (email) {
    const u = await db.user.findUnique({ where: { email } });
    if (u) return { user: u, matchedBy: "email" };
  }

  return { user: null, matchedBy: null };
}

export async function safeEmailUpdate(newEmail: string, thisUserId: string, db: any = prisma): Promise<{ email?: string }> {
  const conflict = await db.user.findUnique({ where: { email: newEmail } });
  if (conflict && conflict.id !== thisUserId) {
    console.warn(`[iam] email ${newEmail} already used by user ${conflict.id}; keeping existing email on ${thisUserId}`);
    return {};
  }
  return { email: newEmail };
}

export async function getIamApiKey(db: any = prisma): Promise<string> {
  try {
    const settings = await (db as any).globalSettings.findUnique({ where: { id: "global" } });
    if (settings?.iamApiKey) return settings.iamApiKey;
  } catch (e) {}
  return (
    process.env.IAM_API_KEY ||
    process.env.HOME_DASHBOARD_API_KEY ||
    process.env.ADMIN_PORTAL_API_KEY ||
    ""
  );
}

export async function validateIamApiKey(providedKey: string, db: any = prisma): Promise<boolean> {
  const cleanProvided = (providedKey || "").trim();
  if (!cleanProvided) return false;
  const validKey = await getIamApiKey(db);
  if (!validKey) return false;
  return safeEq(cleanProvided, validKey.trim());
}
