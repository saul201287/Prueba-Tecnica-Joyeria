import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    // traer productos con nombre de categoría
    const { data, error } = await admin
      .from("products")
      .select(`*, categories ( name )`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ products: data || [] });
  } catch (err) {
    console.error("Error fetching admin products:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const name = form.get("name")?.toString();
    const description = form.get("description")?.toString() || null;
    const priceRaw = form.get("price")?.toString();
    const stockRaw = form.get("stock")?.toString();
    const category_id = form.get("category_id")?.toString() || null;
    const image = form.get("image") as File | null;

    if (!name || !priceRaw || !stockRaw) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const price = Number(priceRaw);
    const stock = Number(stockRaw);

    const admin = getSupabaseAdmin();

    let image_url: string | null = null;

    if (image && image instanceof File && image.size > 0) {
      const filename = `${Date.now()}_${image.name}`;
      const path = `products/${filename}`;

      // En el server, transformamos a Buffer para subir
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data: uploadData, error: uploadError } = await admin.storage
        .from("test")
        .upload(path, buffer, { contentType: image.type, upsert: false });

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        return NextResponse.json({ error: "Error al subir la imagen. Asegúrate de tener el bucket 'test' en Supabase." }, { status: 500 });
      }

      // Obtener URL pública
      const { data: publicData } = await admin.storage.from("test").getPublicUrl(path);
      image_url = publicData?.publicUrl || null;
    }

    const { data: productData, error: insertError } = await admin
      .from("products")
      .insert({ name, description, price, stock, category_id, image_url })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting product:", insertError);
      return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
    }

    return NextResponse.json({ product: productData });
  } catch (err) {
    console.error("Error creating product:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const admin = getSupabaseAdmin();

    // obtener producto para eliminar imagen si existe
    const { data: prod, error: fetchError } = await admin.from("products").select("id, image_url").eq("id", id).single();
    if (fetchError) throw fetchError;

    if (prod?.image_url) {
      try {
        const parsed = new URL(prod.image_url);
        // buscar el segmento del bucket en la ruta
        const parts = parsed.pathname.split("/");
        const idx = parts.findIndex((p) => p === "test");
        if (idx >= 0) {
          const path = parts.slice(idx + 1).join("/");
          if (path) {
            const { error: rmError } = await admin.storage.from("test").remove([path]);
            if (rmError) console.warn("Error removing image from storage:", rmError);
          }
        }
      } catch (err) {
        console.warn("Error parsing image URL for removal:", err);
      }
    }

    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting product:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}