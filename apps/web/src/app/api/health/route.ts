import { NextResponse } from "next/server";
import { PLATFORM_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      application: "orva-web",
      version: PLATFORM_VERSION,
      timestamp: new Date().toISOString()
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
