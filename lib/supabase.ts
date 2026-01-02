import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url || !anonKey) {
  console.warn(
    "⚠️ Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Algunas funcionalidades en el cliente pueden no funcionar correctamente."
  );
}

export const supabase = createClient(url, anonKey);


export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada. Las operaciones administrativas requieren esta clave.");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
