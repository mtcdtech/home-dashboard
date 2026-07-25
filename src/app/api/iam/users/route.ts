import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

function validateApiKey(req: NextRequest): boolean {
  const configuredKey =
    process.env.IAM_API_KEY ||
    process.env.HOME_DASHBOARD_API_KEY ||
    process.env.ADMIN_PORTAL_API_KEY;

  const headerKey = req.headers.get("x-api-key");
  const authHeader = req.headers.get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  const searchKey = req.nextUrl.searchParams.get("api_key");

  const providedKey = (headerKey || bearerKey || searchKey || "").trim();

  if (configuredKey && providedKey) {
    return providedKey === configuredKey.trim();
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const isApiKeyValid = validateApiKey(req);
    const session = await auth();
    const isSessionAdmin = (session?.user as any)?.isAdmin === true;

    if (!isApiKeyValid && !isSessionAdmin) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message:
            "Invalid or missing API key. Pass 'x-api-key' header or 'Bearer' token matching IAM_API_KEY.",
        },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        mtcdPersonId: true,
        mtcdIdentitySource: true,
        mtcdLastSyncedAt: true,
        email: true,
        name: true,
        isAdmin: true,
        canEditContent: true,
        department: true,
        dashboardGroup: true,
        createdAt: true,
        updatedAt: true,
        allowedTabs: { select: { id: true, title: true } },
        allowedSections: { select: { id: true, title: true } },
      },
    });

    const formattedUsers = users.map((u) => {
      const roles: string[] = [];
      if (u.isAdmin) roles.push("admin");
      if (u.canEditContent) roles.push("editor");
      if (roles.length === 0) roles.push("user");

      return {
        id: u.id,
        mtcd_person_id: u.mtcdPersonId,
        mtcd_identity_source: u.mtcdIdentitySource,
        mtcd_last_synced_at: u.mtcdLastSyncedAt?.toISOString() || null,
        email: u.email,
        name: u.name,
        roles,
        is_admin: u.isAdmin,
        can_edit_content: u.canEditContent,
        department: u.department,
        dashboard_group: u.dashboardGroup,
        allowed_tabs: u.allowedTabs.map((t) => ({ id: t.id, title: t.title })),
        allowed_sections: u.allowedSections.map((s) => ({ id: s.id, title: s.title })),
        created_at: u.createdAt.toISOString(),
        updated_at: u.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      app: "home-dashboard",
      version: "1.9.0",
      total: formattedUsers.length,
      users: formattedUsers,
    });
  } catch (error: any) {
    console.error("IAM API Users endpoint error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message || String(error) },
      { status: 500 }
    );
  }
}
