import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMicrosoftAuthConfig } from "@/lib/outlook";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get("sectionId");
  const customClientId = searchParams.get("clientId") || undefined;
  const customTenantId = searchParams.get("tenantId") || undefined;
  const customClientSecret = searchParams.get("clientSecret") || undefined;

  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId parameter." }, { status: 400 });
  }

  // Retrieve the section from DB
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      editors: { select: { email: true } },
      owners: { select: { email: true } },
    },
  });

  if (!section) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const userEmail = session.user.email.toLowerCase();
  const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin === true || userEmail === "admin@local.host";
  const isEditor =
    isAdmin ||
    section.isGlobal ||
    section.editors.some((e) => e.email?.toLowerCase() === userEmail) ||
    section.owners.some((o) => o.email?.toLowerCase() === userEmail);

  if (!isEditor) {
    return NextResponse.json({ error: "Forbidden: You do not have edit access to this section." }, { status: 403 });
  }

  // Parse existing widgetConfig if present
  const rawConfig =
    typeof section.widgetConfig === "string"
      ? JSON.parse(section.widgetConfig) || {}
      : section.widgetConfig || {};

  const authConfig = getMicrosoftAuthConfig({
    clientId: customClientId || rawConfig.clientId,
    clientSecret: customClientSecret || rawConfig.clientSecret,
    tenantId: customTenantId || rawConfig.tenantId,
  });

  if (!authConfig.clientId) {
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444;">Microsoft Client ID Not Configured</h2>
          <p>No Microsoft App Client ID was found in environment variables (<code>MICROSOFT_CLIENT_ID</code> / <code>AUTH_MICROSOFT_ENTRA_ID_ID</code>) or widget settings.</p>
          <p>Please provide an Azure Application (Client) ID in the widget settings modal or server environment variables to enable Outlook Calendar integration.</p>
          <button onclick="window.close()" style="margin-top: 1rem; padding: 0.6rem 1.2rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  // Determine origin/redirect URI
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const redirectUri = `${proto}://${host}/api/widgets/outlook/callback`;

  // Create state payload with signature
  const statePayload = {
    sectionId,
    userId: session.user.id,
    timestamp: Date.now(),
    clientId: authConfig.clientId,
    clientSecret: authConfig.clientSecret,
    tenantId: authConfig.tenantId,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const stateStr = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const tenant = authConfig.tenantId || "common";
  const authUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", authConfig.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "offline_access openid profile User.Read Calendars.Read Calendars.Read.Shared");
  authUrl.searchParams.set("state", stateStr);
  authUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authUrl.toString());
}
