import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const GET = async (req: NextRequest, ctx: any) => {
  const url = req.nextUrl;
  if (url.pathname.includes('/callback/')) {
    const params = Object.fromEntries(url.searchParams.entries());
    if (params.error) {
      console.error("[AUTH CALLBACK RAW ERROR]", JSON.stringify(params));
    }
  }
  return handlers.GET(req, ctx);
};

export const POST = async (req: NextRequest, ctx: any) => {
  const ip = getClientIp(req);
  const rateResult = checkRateLimit(ip, 10, 60000, "auth_post");
  if (!rateResult.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "Content-Type": "text/plain",
      },
    });
  }
  return handlers.POST(req, ctx);
};

