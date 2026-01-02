import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("categories").select("*").order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ categories: data || [] });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("categories").insert({ name }).select().single();
    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (err) {
    console.error("Error creating category:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("categories").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting category:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}