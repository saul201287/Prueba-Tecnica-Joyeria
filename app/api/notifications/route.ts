import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ notifications: data || [] });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
