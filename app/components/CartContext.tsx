"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type CartItem = {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateItem: (index: number, qty: number) => void;
  removeItem: (index: number) => void;
  clear: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.findIndex((p) => p.product_id === item.product_id && p.product_name === item.product_name);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing].quantity += item.quantity;
        return copy;
      }
      return [...prev, item];
    });
  };

  const updateItem = (index: number, qty: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index].quantity = qty;
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clear = () => setItems([]);

  const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateItem, removeItem, clear, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
