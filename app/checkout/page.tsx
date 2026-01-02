"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/components/CartContext";

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = {
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        total_amount: total,
        items,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear pedido");

      setSuccess("Pedido creado correctamente. Gracias por tu compra!");
      clear();

      // redirigir a página de gracias opcionalmente
      setTimeout(() => router.push("/"), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar el pedido");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded shadow">
          <p className="text-gray-700">No hay items en el carrito.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-2xl bg-white rounded shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Checkout</h2>

        <div className="mb-4">
          <h3 className="font-semibold">Resumen</h3>
          <div className="space-y-2 mt-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <div>{it.product_name} (x{it.quantity})</div>
                <div>${(it.price * it.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-bold">Total: ${total.toFixed(2)}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600">Nombre completo</label>
            <input className="w-full p-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Email</label>
            <input type="email" className="w-full p-2 border rounded" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Teléfono</label>
            <input className="w-full p-2 border rounded" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          {success && <div className="p-3 bg-green-100 text-green-700 rounded">{success}</div>}

          <button disabled={loading} className="w-full py-3 bg-purple-600 text-white rounded">
            {loading ? "Procesando..." : `Pagar $${total.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
