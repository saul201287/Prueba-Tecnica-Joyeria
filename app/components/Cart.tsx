"use client";

import Link from "next/link";
import { useCart } from "./CartContext";

export default function Cart() {
  const { items, updateItem, removeItem, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <p className="text-sm text-gray-600">Tu carrito está vacío</p>
        <Link href="/" className="text-purple-600 mt-2 inline-block">Ver productos</Link>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="font-semibold mb-3">Carrito</h3>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{it.product_name}</div>
              <div className="text-xs text-gray-500">${it.price.toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={(e) => updateItem(idx, Number(e.target.value))}
                className="w-16 p-1 border rounded"
              />
              <button onClick={() => removeItem(idx)} className="text-red-500">Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-lg font-bold">Total: ${total.toFixed(2)}</div>
        <Link href="/checkout" className="bg-purple-600 text-white px-4 py-2 rounded">Pagar</Link>
      </div>
    </div>
  );
}
