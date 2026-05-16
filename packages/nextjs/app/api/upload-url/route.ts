import { NextResponse } from "next/server";
import { pinata } from "@/utils/pinata";

export async function GET() {
  try {
    const url = await pinata.upload.public.createSignedURL({
      expires: 120,
      maxFileSize: 25 * 1024 * 1024, // 25MB
    });
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
