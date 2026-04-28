import { handlers } from "@/auth";
import { NextRequest } from "next/server";

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

export const POST = handlers.POST;
