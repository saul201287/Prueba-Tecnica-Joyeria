"use client";

import { useState, useEffect, useMemo } from "react";
import VoiceAssistant from "@/app/components/VoiceAssistant";
import { ShoppingCart, Search, Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";

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

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [productFilters, setProductFilters] = useState({
    search: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    inStock: false,
    sortBy: "name",
    sortOrder: "asc" as "asc" | "desc"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    }
    return [];
  });

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const payload = await res.json();
      if (payload.products) {
        setProducts(payload.products);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // Filtrar productos usando useMemo para evitar re-renders innecesarios
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const toTokens = (s: string) => {
      const stop = new Set([
        "de",
        "del",
        "la",
        "el",
        "los",
        "las",
        "un",
        "una",
        "unos",
        "unas",
        "para",
        "por",
        "que",
        "esta",
        "esta",
        "estoy",
        "busco",
        "buscar",
        "quiero",
        "necesito",
        "puedes",
        "ayudarme",
        "encontrar",
      ]);
      return normalize(s)
        .split(" ")
        .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
        .filter((t) => t.length >= 2 && !stop.has(t));
    };

    // Filtro por texto de búsqueda
    if (productFilters.search) {
      const tokens = toTokens(productFilters.search);
      if (tokens.length > 0) {
        filtered = filtered.filter((p) => {
          const haystack = normalize(
            `${p.name} ${p.description || ""} ${p.categories?.name || ""}`
          );
          return tokens.every((t) => haystack.includes(t));
        });
      }
    }

    // Filtro por categoría
    if (productFilters.category) {
      // Normalizar nombres de categoría para comparación insensible a mayúsculas y acentos
      const normalizeCategory = (cat: string) => 
        cat.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
          
      const targetCategory = normalizeCategory(productFilters.category);
      
      filtered = filtered.filter(p => {
        // Verificar tanto en category como en categories.name
        const categoryName = p.category || p.categories?.name || '';
        return normalizeCategory(categoryName) === targetCategory ||
               normalizeCategory(categoryName).includes(targetCategory) ||
               (p.categories?.name && normalizeCategory(p.categories.name) === targetCategory);
      });
    }

    // Filtro por precio mínimo
    if (productFilters.minPrice) {
      filtered = filtered.filter(p => p.price >= Number(productFilters.minPrice));
    }

    // Filtro por precio máximo
    if (productFilters.maxPrice) {
      filtered = filtered.filter(p => p.price <= Number(productFilters.maxPrice));
    }

    // Filtro por stock disponible
    if (productFilters.inStock) {
      filtered = filtered.filter(p => p.stock > 0);
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (productFilters.sortBy) {
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "stock":
          aValue = a.stock;
          bValue = b.stock;
          break;
        case "category":
          aValue = a.categories?.name || "";
          bValue = b.categories?.name || "";
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return productFilters.sortOrder === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return productFilters.sortOrder === "asc" 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return filtered;
  }, [products, productFilters]);

  useEffect(() => {
    async function load() {
      await fetchProducts();
      await fetchCategories();
    }
    load();
  }, []);

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const orderItems = cart.map((item) => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone,
          items: orderItems,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(
          "¡Pedido realizado con éxito! Nos pondremos en contacto contigo pronto."
        );
        setCart([]);
        setShowCheckout(false);
        setCustomerInfo({ name: "", email: "", phone: "" });
        fetchProducts(); // Actualizar stock
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al procesar el pedido. Intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold">✨ JOYERÍA Elegante</h1>
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative bg-white text-purple-600 px-6 py-3 rounded-full font-semibold hover:bg-purple-50 transition flex items-center gap-2 cursor-pointer">
              <ShoppingCart size={24} />
              Carrito
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Asistente de Voz */}
        <div className="mb-12">
          <VoiceAssistant
            onAction={(action) => {
              if (action.type === "apply_filters") {
                setProductFilters(prev => {
                  const newFilters = {
                    ...prev,
                    ...(action.filters.search !== undefined && { search: action.filters.search }),
                    ...(action.filters.category !== undefined && { category: action.filters.category }),
                    ...(action.filters.minPrice !== undefined && { minPrice: action.filters.minPrice }),
                    ...(action.filters.maxPrice !== undefined && { maxPrice: action.filters.maxPrice }),
                    ...(action.filters.inStock !== undefined && { inStock: action.filters.inStock }),
                    ...(action.filters.sortBy !== undefined && { sortBy: action.filters.sortBy }),
                    ...(action.filters.sortOrder !== undefined && { sortOrder: action.filters.sortOrder }),
                  };
                  return newFilters;
                });
                if (action.openFilters) setShowFilters(true);
              }
              if (action.type === "open_product" && action.id) {
                router.push(`/product/${action.id}`);
              }
            }}
          />
        </div>

        {/* Catálogo de Productos */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-black">
              Nuestros Productos ({filteredProducts.length})
            </h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer text-black">
              <Filter size={20} />
              Filtros
            </button>
          </div>

          {/* Barra de Búsqueda */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={productFilters.search}
                onChange={(e) =>
                  setProductFilters({
                    ...productFilters,
                    search: e.target.value,
                  })
                }
                className="text-black w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
              />
            </div>
          </div>

          {/* Panel de Filtros */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-black">
                  Filtrar Productos
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setProductFilters({
                        search: "",
                        category: "",
                        minPrice: "",
                        maxPrice: "",
                        inStock: false,
                        sortBy: "name",
                        sortOrder: "asc",
                      })
                    }
                    className="text-sm text-purple-600 hover:text-purple-700 cursor-pointer">
                    Limpiar
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-500 hover:text-gray-700 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {/* Filtro por categoría */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Categoría
                  </label>
                  <select
                    value={productFilters.category}
                    onChange={(e) =>
                      setProductFilters({
                        ...productFilters,
                        category: e.target.value,
                      })
                    }
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                    <option value="">Todas las categorías</option>
                    {categories.map((c) => (
                      <option value={c.name} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtros de precio */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Precio mínimo
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={productFilters.minPrice}
                    onChange={(e) =>
                      setProductFilters({
                        ...productFilters,
                        minPrice: e.target.value,
                      })
                    }
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Precio máximo
                  </label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={productFilters.maxPrice}
                    onChange={(e) =>
                      setProductFilters({
                        ...productFilters,
                        maxPrice: e.target.value,
                      })
                    }
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                {/* Filtro de stock */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Disponibilidad
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={productFilters.inStock}
                      onChange={(e) =>
                        setProductFilters({
                          ...productFilters,
                          inStock: e.target.checked,
                        })
                      }
                      className="text-black mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-black">
                      Solo productos en stock
                    </span>
                  </label>
                </div>

                {/* Ordenamiento */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Ordenar por
                  </label>
                  <select
                    value={productFilters.sortBy}
                    onChange={(e) =>
                      setProductFilters({
                        ...productFilters,
                        sortBy: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black">
                    <option value="name">Nombre</option>
                    <option value="price">Precio</option>
                    <option value="category">Categoría</option>
                  </select>
                </div>

                <div>
                  <label className="text-black block text-sm font-medium text-black mb-2">
                    Orden
                  </label>
                  <select
                    value={productFilters.sortOrder}
                    onChange={(e) =>
                      setProductFilters({
                        ...productFilters,
                        sortOrder: e.target.value as "asc" | "desc",
                      })
                    }
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                    <option value="asc">Ascendente</option>
                    <option value="desc">Descendente</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-black text-lg">
                  No se encontraron productos con los filtros seleccionados.
                </p>
                <button
                  onClick={() =>
                    setProductFilters({
                      search: "",
                      category: "",
                      minPrice: "",
                      maxPrice: "",
                      inStock: false,
                      sortBy: "name",
                      sortOrder: "asc",
                    })
                  }
                  className="mt-4 text-purple-600 hover:text-purple-700 underline cursor-pointer">
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => router.push(`/product/${product.id}`)}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1 overflow-hidden cursor-pointer group">
                  <div
                    className={`h-64 flex items-center justify-center bg-center bg-cover group-hover:scale-105 transition-transform duration-300 ${
                      product.image_url
                        ? ""
                        : "bg-gradient-to-br from-purple-200 to-pink-200"
                    }`}
                    style={
                      product.image_url
                        ? { backgroundImage: `url(${product.image_url})` }
                        : {}
                    }>
                    {!product.image_url && <span className="text-6xl">💎</span>}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-2 text-black group-hover:text-purple-600 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-purple-600">
                        ${product.price}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Carrito Modal */}
        {showCart && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-black">Tu Carrito</h2>
                  <button
                    onClick={() => setShowCart(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl">
                    ✕
                  </button>
                </div>

                {cart.length === 0 ? (
                  <p className="text-center text-black py-8">
                    Tu carrito está vacío
                  </p>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center border-b pb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-black">
                              {item.name}
                            </h3>
                            <p className="text-purple-600 font-bold">
                              ${item.price}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">
                              -
                            </button>
                            <span className="font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                              className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">
                              +
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-500 hover:text-red-700 ml-2">
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between text-xl font-bold mb-4">
                        <span className="text-black">Total:</span>
                        <span className="text-purple-600">
                          ${getTotalAmount().toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setShowCart(false);
                          setShowCheckout(true);
                        }}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition">
                        Proceder al Pago
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-black">
                    Finalizar Pedido
                  </h2>
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCheckout} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          phone: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between text-xl font-bold mb-4">
                      <span className="text-black">Total a Pagar:</span>
                      <span className="text-purple-600">
                        ${getTotalAmount().toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition">
                    Confirmar Pedido
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
