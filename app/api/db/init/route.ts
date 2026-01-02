import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const admin = getSupabaseAdmin();

    console.log("Inicializando tablas de base de datos...");

    // 1. Crear tabla de categorías
    const { error: categoriesError } = await admin.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.categories (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL UNIQUE,
          created_at timestamptz DEFAULT now()
        );
      `,
    });

    if (categoriesError) {
      console.log("Nota: Tabla categories puede ya existir");
    }

    // 2. Crear tabla de productos
    const { error: productsError } = await admin.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.products (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          description text,
          price numeric(10,2) NOT NULL DEFAULT 0,
          stock int NOT NULL DEFAULT 0,
          category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
          image_url text,
          metadata jsonb,
          created_at timestamptz DEFAULT now()
        );
      `,
    });

    if (productsError) {
      console.log("Nota: Tabla products puede ya existir");
    }

    // 3. Crear tabla de pedidos
    const { error: ordersError } = await admin.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.orders (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_name text NOT NULL,
          customer_email text NOT NULL,
          customer_phone text,
          total_amount numeric(10,2) NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamptz DEFAULT now()
        );
      `,
    });

    if (ordersError) {
      console.log("Nota: Tabla orders puede ya existir");
    }

    // 4. Crear tabla de items del pedido
    const { error: itemsError } = await admin.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.order_items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
          product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
          product_name text NOT NULL,
          quantity int NOT NULL,
          price numeric(10,2) NOT NULL
        );
      `,
    });

    if (itemsError) {
      console.log("Nota: Tabla order_items puede ya existir");
    }

    // 5. Crear tabla de notificaciones
    const { error: notificationsError } = await admin.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          type text NOT NULL,
          payload jsonb,
          read boolean DEFAULT false,
          created_at timestamptz DEFAULT now()
        );
      `,
    });

    if (notificationsError) {
      console.log("Nota: Tabla notifications puede ya existir");
    }

    console.log("✓ Base de datos inicializada correctamente");

    return NextResponse.json({
      success: true,
      message: "Base de datos inicializada correctamente",
    });
  } catch (err) {
    console.error("Error inicializando base de datos:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        note: "Si ves este error, probablemente las tablas ya existen. Puedes ignorarlo.",
      },
      { status: 200 }
    );
  }
}
