import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    let createdUser: unknown = null;
    try {
      const res = await admin.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name },
        email_confirm: true,
      });
      // El SDK puede devolver resultado en res.data o lanzar. Manejar ambos casos
      createdUser = res?.data || (res as { user?: unknown })?.user || res || null;
      const createErr = (res as { error?: unknown })?.error || null;
      if (createErr) {
        // Log técnico para debugging del equipo
        console.error("Error creating auth user (returned error):", createErr);
        // Mensaje amigable para el usuario
        return NextResponse.json({ error: "No se pudo crear la cuenta. Inténtalo de nuevo más tarde." }, { status: 500 });
      }
    } catch (e: unknown) {
      // Log técnico para debugging del equipo
      console.error("Error creating auth user (thrown):", e);
      // Mensaje amigable para el usuario
      return NextResponse.json({ error: "No se pudo crear la cuenta. Inténtalo de nuevo más tarde." }, { status: 500 });
    }

    const supabaseUserId = (createdUser as { user?: { id?: string } })?.user?.id || (createdUser as { id?: string })?.id || null;

    if (!supabaseUserId) {
      console.error("Signup: created user but no id returned", { createdUser });
      return NextResponse.json({ error: "No se pudo crear la cuenta correctamente. Inténtalo de nuevo más tarde." }, { status: 500 });
    }

    const role = "admin";

    // El trigger ya creó el registro en public.users, solo actualiza el rol
    const { data: updated, error: updateErr } = await admin
      .from("users")
      .update({ role })
      .eq("id", supabaseUserId)
      .select()
      .single();

    if (updateErr) {
      console.error("Error updating user role:", updateErr);
      return NextResponse.json({ error: "La cuenta se creó, pero no se pudo asignar el rol de administrador. Contacta al soporte." }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: (createdUser as { user?: unknown })?.user, record: updated });
  } catch (err) {
    console.error("Error signup admin route:", err);
    return NextResponse.json({ error: "Ocurrió un error al registrarse. Inténtalo de nuevo más tarde." }, { status: 500 });
  }
}