import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Verificar rol en tabla users (se necesita service role para consulta segura)
    try {
      const admin = getSupabaseAdmin();
      const userId = data.user?.id;
      if (!userId) {
        console.error("Login: unable to get user id", { data });
        return NextResponse.json({ error: "No se pudo iniciar sesión. Inténtalo de nuevo más tarde." }, { status: 500 });
      }

      // Ahora la tabla users usa id = auth.users.id
      const { data: userRow, error: userErr } = await admin.from("users").select("role").eq("id", userId).single();
      if (userErr) {
        console.error("Error consultando rol en users:", userErr);
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      if (userRow?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado: debes ser administrador para acceder" }, { status: 403 });
      }

      return NextResponse.json({ success: true, user: data.user, session: data.session });
    } catch (err) {
      console.error("Error verificando rol de admin:", err);
      return NextResponse.json({ error: "Error verificando rol. Configura SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}
