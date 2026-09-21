import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import fs from "node:fs";
import path from "node:path";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { filename } = await params;

  // Reject anything that isn't a plain filename — no path traversal.
  if (filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filepath = path.join(PHOTOS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const extension = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
  const buffer = fs.readFileSync(filepath);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
