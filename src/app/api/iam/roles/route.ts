import { NextRequest, NextResponse } from "next/server";
import { validateIamApiKey } from "@/lib/iam";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const headerKey = req.headers.get("x-api-key");
    const authHeader = req.headers.get("authorization");
    const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    const searchKey = req.nextUrl.searchParams.get("api_key");

    const providedKey = (headerKey || bearerKey || searchKey || "").trim();
    const isApiKeyValid = await validateIamApiKey(providedKey);

    const session = await auth();
    const isSessionAdmin = (session?.user as any)?.isAdmin === true;

    if (!isApiKeyValid && !isSessionAdmin) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message:
            "Invalid or missing API key. Pass 'Authorization: Bearer <key>' or 'x-api-key' header.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      roles: [
        {
          id: "admin",
          name: "Administrator",
          description: "Full access to manage the application dashboard.",
        },
        {
          id: "standard",
          name: "Standard User",
          description: "Standard access to the application dashboard.",
        },
      ],
    });
  } catch (error: any) {
    console.error("IAM API /api/iam/roles error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message || String(error) },
      { status: 500 }
    );
  }
}
