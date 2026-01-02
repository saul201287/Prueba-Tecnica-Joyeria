"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, Star, ArrowLeft } from "lucide-react";
import Image from "next/image";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image_url?: string;
  categories?: { name: string };
}

interface CartItem extends Product {
  quantity: number;
}

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  const addToCart = (product: Product, selectedQuantity: number) => {
    const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = existingCart.find((item: CartItem) => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += selectedQuantity;
    } else {
      existingCart.push({ ...product, quantity: selectedQuantity });
    }

    localStorage.setItem('cart', JSON.stringify(existingCart));
    alert(`${selectedQuantity} ${product.name}(s) agregado(s) al carrito`);
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch('/api/products');
        const payload = await res.json();
        if (payload.products) {
          const foundProduct = payload.products.find((p: Product) => p.id === params.id);
          setProduct(foundProduct || null);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-black">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Producto no encontrado</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition cursor-pointer">
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-white hover:text-purple-100 transition cursor-pointer">
            <ArrowLeft size={20} />
            Volver al catálogo
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg overflow-hidden relative">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl">💎</span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">{product.name}</h1>
                <p className="text-sm text-black font-medium">
                  {product.categories?.name || 'Sin categoría'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-2 text-black text-sm">(4.8/5)</span>
              </div>

              <div className="text-4xl font-bold text-black">
                ${product.price}
              </div>

              <p className="text-black leading-relaxed">
                {product.description}
              </p>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-black">Disponibilidad:</span>
                  <span className={`font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
                  </span>
                </div>
              </div>

              {product.stock > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-black font-medium mb-2">Cantidad:</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300 cursor-pointer">
                      -
                    </button>
                    <span className="text-black font-semibold text-lg px-4">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300 cursor-pointer">
                      +
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => addToCart(product, quantity)}
                disabled={product.stock === 0}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition ${
                  product.stock === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                }`}>
                <ShoppingCart className="inline mr-2" size={20} />
                {product.stock === 0 ? 'Producto Agotado' : `Agregar ${quantity} al Carrito`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}