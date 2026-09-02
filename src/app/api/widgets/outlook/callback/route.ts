import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error || !code || !state) {
    const message = errorDesc || error || "Authorization was cancelled or failed.";
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444; margin-bottom: 0.5rem;">Authentication Failed</h2>
          <p style="opacity: 0.8; max-width: 500px; margin: 0 auto 1.5rem;">${message}</p>
          <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  interface OAuthState {
    sectionId: string;
    clientId: string;
    clientSecret?: string;
    tenantId?: string;
    timestamp: number;
  }

  let stateObj: OAuthState | null = null;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    stateObj = JSON.parse(decoded) as OAuthState;
  } catch {
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444;">Invalid State</h2>
          <p>The state parameter is invalid or corrupted.</p>
          <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  const { sectionId, clientId, clientSecret, tenantId, timestamp } = stateObj;
  if (!sectionId || !clientId) {
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444;">Missing Required Parameters</h2>
          <p>The state did not contain a valid section ID or client ID.</p>
          <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  // Verify timestamp is within 15 minutes
  if (Date.now() - timestamp > 15 * 60 * 1000) {
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444;">Session Expired</h2>
          <p>Authentication took too long. Please try again from the widget settings.</p>
          <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  // Exchange code for tokens
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const redirectUri = `${proto}://${host}/api/widgets/outlook/callback`;

  const tenant = tenantId || "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const tokenParams = new URLSearchParams();
  tokenParams.append("client_id", clientId);
  if (clientSecret) {
    tokenParams.append("client_secret", clientSecret);
  }
  tokenParams.append("grant_type", "authorization_code");
  tokenParams.append("code", code);
  tokenParams.append("redirect_uri", redirectUri);
  tokenParams.append("scope", "offline_access openid profile User.Read Calendars.Read Calendars.Read.Shared");

  interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }

  let tokenData: TokenResponse | null = null;
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[outlook-callback] Token exchange failed:", tokenRes.status, errBody);
      return new NextResponse(
        `<html>
          <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
            <h2 style="color: #ef4444;">Token Exchange Failed</h2>
            <p style="opacity: 0.8; max-width: 500px; margin: 0 auto 1.5rem;">Microsoft rejected the authorization code: ${errBody}</p>
            <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
          </body>
        </html>`,
        { headers: { "Content-Type": "text/html" }, status: 400 }
      );
    }

    tokenData = (await tokenRes.json()) as TokenResponse;
  } catch (exchangeErr: unknown) {
    const errMsg = exchangeErr instanceof Error ? exchangeErr.message : "Failed to reach Microsoft OAuth endpoint.";
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444;">Connection Error</h2>
          <p>${errMsg}</p>
          <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }

  // Fetch Microsoft Graph Profile for User Information
  let accountEmail = "";
  let accountName = "Outlook Account";
  try {
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (meRes.ok) {
      const meData = await meRes.json();
      accountEmail = meData.mail || meData.userPrincipalName || "";
      accountName = meData.displayName || meData.givenName || accountEmail || "Outlook User";
    }
  } catch (meErr) {
    console.warn("[outlook-callback] Failed to fetch profile from Graph:", meErr);
  }

  // Retrieve current section configuration
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
  });

  if (!section) {
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, sans-serif; padding: 2.5rem; background: #0f172a; color: #f8fafc; text-align: center;">
          <h2 style="color: #ef4444;">Section Not Found</h2>
          <p>The target widget section no longer exists.</p>
          <button onclick="window.close()" style="padding: 0.6rem 1.4rem; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 404 }
    );
  }

  const existingConfig =
    typeof section.widgetConfig === "string"
      ? JSON.parse(section.widgetConfig) || {}
      : section.widgetConfig || {};

  const updatedConfig = {
    ...existingConfig,
    connected: true,
    accountEmail: accountEmail || existingConfig.accountEmail || "Connected",
    accountName: accountName || existingConfig.accountName || "Outlook User",
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
    clientId: clientId || existingConfig.clientId,
    tenantId: tenantId || existingConfig.tenantId,
    clientSecret: clientSecret || existingConfig.clientSecret,
    daysAhead: existingConfig.daysAhead ?? 7,
    selectedCalendarIds: existingConfig.selectedCalendarIds ?? [],
  };

  await prisma.section.update({
    where: { id: sectionId },
    data: { widgetConfig: updatedConfig },
  });

  // Return clean postMessage HTML to close popup and notify widget
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Outlook Connected</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 80vh;
            margin: 0;
            padding: 1.5rem;
            text-align: center;
          }
          .card {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 2.5rem 2rem;
            max-width: 420px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          }
          .icon-wrap {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            margin: 0 auto 1.25rem;
          }
          h2 { margin: 0 0 0.5rem; font-size: 1.4rem; font-weight: 700; color: #fff; }
          p { margin: 0 0 1.5rem; font-size: 0.95rem; color: #94a3b8; line-height: 1.5; }
          .badge {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 8px;
            padding: 0.4rem 0.8rem;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-wrap">✓</div>
          <h2>Connected to Outlook</h2>
          <p>Your Microsoft account has been successfully connected to the widget.</p>
          <div class="badge">${accountName} (${accountEmail || "Active"})</div>
          <p style="font-size: 0.85rem; opacity: 0.6;">This window will close automatically...</p>
        </div>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({
                type: "OUTLOOK_CONNECTED",
                sectionId: ${JSON.stringify(sectionId)},
                accountName: ${JSON.stringify(accountName)},
                accountEmail: ${JSON.stringify(accountEmail)}
              }, "*");
            }
          } catch (e) {
            console.error(e);
          }
          setTimeout(function() {
            window.close();
          }, 1400);
        </script>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
