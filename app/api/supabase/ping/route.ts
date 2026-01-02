import { NextResponse } from "next/server";
import { supabase, getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ ok: false, message: "Faltan variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY" }, { status: 500 });
    }

    const { data, error } = await supabase.from("products").select("id").limit(1);

    if (error) {
      console.error("Supabase read error:", error);
      return NextResponse.json({ ok: false, message: "Error leyendo productos", details: error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Lectura OK (anon key)", sample: data?.[0] || null });
  } catch (err) {
    console.error("Ping GET error:", err);
    return NextResponse.json({ ok: false, message: "Error interno" }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    // Insertar un pedido de prueba y luego eliminarlo
    const timestamp = new Date().toISOString();
    const testOrder = {
      customer_name: `ping-test-${timestamp}`,
      customer_email: `ping-${timestamp}@example.com`,
      customer_phone: null,
      total_amount: 0.01,
      status: "pending",
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data: insertData, error: insertError } = await supabaseAdmin.from("orders").insert([testOrder]).select("id").maybeSingle();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json({ ok: false, message: "Error insertando orden de prueba", details: insertError }, { status: 500 });
    }

    const insertedId = insertData?.id;

    // Borrar la orden de prueba (limpiar)
    if (insertedId) {
      const { error: deleteError } = await supabaseAdmin.from("orders").delete().eq("id", insertedId);
      if (deleteError) {
        console.warn("Orden de prueba insertada pero no pudo borrarse:", deleteError);
        // No romper: reportamos la situación
        return NextResponse.json({ ok: true, message: "Insertado pero no se pudo eliminar la orden de prueba", insertedId, cleanup: false });
      }
    }

    return NextResponse.json({ ok: true, message: "Insert y delete OK (service role)", insertedId: insertedId || null });
  } catch (err) {
    console.error("Ping POST error:", err);
    return NextResponse.json({ ok: false, message: "Error interno" }, { status: 500 });
  }
}