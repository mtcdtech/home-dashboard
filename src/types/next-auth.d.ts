import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      department?: string | null;
      isAdmin?: boolean;
      canEditContent?: boolean;
      mtcdPersonId?: string | null;
      mtcdIdentitySource?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    department?: string | null;
    isAdmin?: boolean;
    canEditContent?: boolean;
    mtcdPersonId?: string | null;
    mtcdIdentitySource?: string | null;
  }

  interface Profile {
    // Standard OIDC claims already present
    sub?: string;
    name?: string;
    email?: string;
    picture?: string | null;
    // MTCD extensions from the mtcd_person scope mapping
    mtcd_person_id?: string;
    mtcd_login_source?: "microsoft" | "planning_center" | "church_center_otp" | "microsoft_shared";
    mtcd_person_id_history?: Array<{
      previous_mtcd_person_id?: string;
      new_mtcd_person_id?: string;
      reason?: string;
      at?: string;
    }>;
    mtcd_identities?: {
      church_center?: { id?: string; email?: string; name?: string; phone?: string | null } | null;
      planning_center?: Array<{ id?: string; email?: string; name?: string }>;
      microsoft?: Array<{
        object_id?: string;
        upn?: string;
        email?: string;
        display_name?: string;
        department?: string | null;
        job_title?: string | null;
        shared?: boolean;
      }>;
    };
    // Existing Authentik claims we already consume
    groups?: string[];
    department?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    department?: string | null;
    isAdmin?: boolean;
    canEditContent?: boolean;
    mtcdPersonId?: string | null;
    mtcdIdentitySource?: string | null;
  }
}
