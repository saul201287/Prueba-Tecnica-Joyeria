import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type OrderItem = {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
};

type FrontendOrderItem = {
  productId?: string;
  productName: string;
  quantity: number;
  price: number;
};

export async function POST(request: Request) {
  try {
    const { customerName, customerEmail, customerPhone, items } = await request.json();

    if (!customerName || !customerEmail || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Datos de pedido inválidos" }, { status: 400 });
    }

    const totalAmount = items.reduce((sum: number, item: FrontendOrderItem) => sum + (item.price * item.quantity), 0);

    const supabaseAdmin = getSupabaseAdmin();

    const { data: orderData, error: orderError } = await supabaseAdmin.from("orders").insert([
      {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        total_amount: totalAmount,
        status: "pending",
      },
    ]).select("id").maybeSingle();

    if (orderError) {
      console.error("Error al crear pedido:", orderError);
      return NextResponse.json({ error: "Error al crear pedido" }, { status: 500 });
    }

    const orderId = (orderData as { id: string })?.id;

    // Insertar items
    const itemsToInsert = (items as FrontendOrderItem[]).map((it) => ({
      order_id: orderId,
      product_id: it.productId ?? null,
      product_name: it.productName,
      quantity: it.quantity,
      price: it.price,
    }));

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(itemsToInsert);

    if (itemsError) {
      console.error("Error al insertar items:", itemsError);
      return NextResponse.json({ error: "Error al insertar items" }, { status: 500 });
    }

    // Crear notificación para admin
    try {
      await supabaseAdmin.from("notifications").insert([
        {
          type: "new_order",
          payload: {
            orderId,
            customer_name: customerName,
            customer_email: customerEmail,
            total_amount: totalAmount,
            items: itemsToInsert,
          },
        },
      ]);
    } catch (notifyErr) {
      console.error("Error al crear notificación:", notifyErr);
      // No interrumpimos el flujo principal
    }

    // Opcional: enviar email al admin si se configura SENDGRID_API_KEY y ADMIN_EMAIL
    try {
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

      if (SENDGRID_API_KEY && ADMIN_EMAIL) {
        const subject = `Nuevo pedido en la tienda - ${orderId}`;
        const body = `Tienes un nuevo pedido\nCliente: ${customerName} (${customerEmail})\nTotal: ${totalAmount}`;

        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              { to: [{ email: ADMIN_EMAIL }], subject },
            ],
            from: { email: ADMIN_EMAIL },
            content: [{ type: "text/plain", value: body }],
          }),
        });
      }
    } catch (emailErr) {
      console.error("Error enviando email de notificación:", emailErr);
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("Error orders route:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
