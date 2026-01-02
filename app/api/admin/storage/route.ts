import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Route to create bucket if not exists (admin only)
export async function POST(request: Request) {
  try {
    const admin = getSupabaseAdmin();
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const { data, error } = await admin.storage.createBucket(name, { public: true });
    if (error) throw error;
    return NextResponse.json({ bucket: data });
  } catch (err) {
    console.error("Error creating bucket:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}