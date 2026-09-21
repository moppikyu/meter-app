import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

// Photos are stored under data/photos (outside of public/) so they aren't
// served to anyone without a session — see app/api/photos/[filename] for
// the authenticated read path. This is proof/verification storage only;
// nothing here reads or interprets the image (see proposal §8).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "editor") {
    return NextResponse.json(
      { error: "Only the editor account can upload photos" },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo file provided" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }

  const filename = `${crypto.randomUUID()}.${extension}`;
  const filepath = path.join(PHOTOS_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  // Stored relative to data/photos so it works regardless of machine/deploy path.
  return NextResponse.json({ photoPath: filename });
}
