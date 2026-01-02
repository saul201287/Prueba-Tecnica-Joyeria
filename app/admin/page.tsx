"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import {
  LogOut,
  Package,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  UserPlus,
  Tag,
  Hash,
  FileImage,
  Trash2,
  AlignLeft,
  Filter,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category_id?: string;
  image_url?: string;
  categories?: { name: string };
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    revenue: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error (auth):", error);
        setError("Credenciales inválidas");
        return;
      }

      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Login verification failed:", payload);
        setError(payload?.error || "No autorizado");
        return;
      }

      setIsAuthenticated(true);
    } catch (err: unknown) {
      console.error("Login error (client):", err);
      setError("No se pudo iniciar sesión. Inténtalo de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setOrders([]);
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (*)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const ordersData: Order[] = data || [];
      setOrders(ordersData);

      const totalOrders = ordersData.length;
      const pendingOrders = ordersData.filter(
        (o: Order) => o.status === "pending"
      ).length;
      const completedOrders = ordersData.filter(
        (o: Order) => o.status === "completed"
      ).length;
      const totalRevenue = ordersData.reduce(
        (sum: number, o: Order) => sum + Number(o.total_amount),
        0
      );

      setStats({
        total: totalOrders,
        pending: pendingOrders,
        completed: completedOrders,
        revenue: totalRevenue,
      });
    } catch (err) {
      console.error("Error al cargar pedidos:", err);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      fetchOrders();
    } catch (err) {
      console.error("Error al actualizar pedido:", err);
    }
  };

  type Notification = {
    id: string;
    type: string;
    payload?: { customer_name?: string; total_amount?: number } | null;
    read: boolean;
    created_at: string;
  };

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; created_at?: string }>
  >([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");

  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [filteredAdminProducts, setFilteredAdminProducts] = useState<Product[]>(
    []
  );
  const [adminProductFilters, setAdminProductFilters] = useState({
    search: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    minStock: "",
    maxStock: "",
    sortBy: "name",
    sortOrder: "asc" as "asc" | "desc",
  });
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "0",
    stock: "0",
    category_id: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [productMessage, setProductMessage] = useState("");
  const [showAdminFilters, setShowAdminFilters] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchAdminProducts = async () => {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      const products = data.products || [];
      setAdminProducts(products);
      setFilteredAdminProducts(products);
    } catch (err) {
      console.error("Error fetching admin products:", err);
    }
  };

  // Función para filtrar productos del admin
  const filterAdminProducts = useCallback(() => {
    let filtered = [...adminProducts];

    // Filtro por texto de búsqueda
    if (adminProductFilters.search) {
      const searchLower = adminProductFilters.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.description &&
            p.description.toLowerCase().includes(searchLower)) ||
          (p.categories?.name &&
            p.categories.name.toLowerCase().includes(searchLower))
      );
    }

    // Filtro por categoría
    if (adminProductFilters.category) {
      filtered = filtered.filter(
        (p) => p.category_id === adminProductFilters.category
      );
    }

    // Filtro por precio mínimo
    if (adminProductFilters.minPrice) {
      filtered = filtered.filter(
        (p) => p.price >= Number(adminProductFilters.minPrice)
      );
    }

    // Filtro por precio máximo
    if (adminProductFilters.maxPrice) {
      filtered = filtered.filter(
        (p) => p.price <= Number(adminProductFilters.maxPrice)
      );
    }

    // Filtro por stock mínimo
    if (adminProductFilters.minStock) {
      filtered = filtered.filter(
        (p) => p.stock >= Number(adminProductFilters.minStock)
      );
    }

    // Filtro por stock máximo
    if (adminProductFilters.maxStock) {
      filtered = filtered.filter(
        (p) => p.stock <= Number(adminProductFilters.maxStock)
      );
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (adminProductFilters.sortBy) {
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
        return adminProductFilters.sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return adminProductFilters.sortOrder === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    setFilteredAdminProducts(filtered);
  }, [adminProducts, adminProductFilters]);

  useEffect(() => {
    filterAdminProducts();
  }, [filterAdminProducts]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications((data.notifications || []) as Notification[]);
    } catch (err) {
      console.error("Error notificiaciones:", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const iv = setInterval(fetchNotifications, 20000);
      return () => clearInterval(iv);
    }
  }, [isAuthenticated, fetchNotifications]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
      fetchAdminProducts();
    }
  }, [isAuthenticated]);

  const markNotificationRead = async (id: string) => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (err) {
      console.error("Error marcando notificación:", err);
    }
  };

  function NotificationsBell() {
    const [showDropdown, setShowDropdown] = useState(false);
    const unread = notifications.filter((n) => !n.read).length;

    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-full shadow flex items-center gap-2 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6 text-white">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {showDropdown && notifications.length > 0 && (
          <div className="text-black absolute right-0 mt-2 w-80 bg-white shadow-lg rounded z-50">
            <div className="p-2 border-b font-semibold flex justify-between items-center">
              <span>Notificaciones</span>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.filter((n) => !n.read).length === 0 ? (
                <div className="p-3 text-center text-gray-500 text-sm">
                  No hay notificaciones nuevas
                </div>
              ) : (
                notifications
                  .filter((n) => !n.read)
                  .map((n) => (
                    <div
                      key={n.id}
                      className="p-3 border-b flex justify-between items-start">
                      <div>
                        <div className="text-sm text-black font-medium">
                          {n.type === "new_order" ? "Nuevo Pedido" : n.type}
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                        <div className="text-sm text-black mt-1">
                          {n.payload?.customer_name} — $
                          {n.payload?.total_amount}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          markNotificationRead(n.id);
                          setShowDropdown(false);
                        }}
                        className="text-blue-600 text-sm hover:text-blue-800">
                        Marcar leído
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: name }),
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Signup failed:", payload);
        setError(
          payload?.error ||
            "No se pudo crear la cuenta. Inténtalo de nuevo más tarde."
        );
        return;
      }

      setSuccessMessage(
        "Cuenta creada correctamente. Ya puedes iniciar sesión como administrador."
      );
      setPassword("");
    } catch (err: unknown) {
      console.error("Signup error (client):", err);
      setError("No se pudo crear la cuenta. Inténtalo de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h1 className="text-3xl font-extrabold text-center mb-2 text-black-900">
            Panel de Administración
          </h1>
          <p className="text-center text-sm text-black-600 mb-4">
            Accede con tu cuenta de administrador para gestionar productos,
            pedidos y notificaciones.
          </p>

          <div className="mb-4 text-center inline-flex rounded-lg overflow-hidden border border-gray-200">
            <button
              onClick={() => setIsRegistering(false)}
              className={`px-6 py-2 ${
                !isRegistering
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "bg-white text-black-700"
              }`}>
              <UserPlus className="inline-block mr-2" size={16} /> Iniciar
              Sesión
            </button>
            <button
              onClick={() => setIsRegistering(true)}
              className={`px-6 py-2 ${
                isRegistering
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "bg-white text-black-700"
              }`}>
              <PlusCircle className="inline-block mr-2" size={16} /> Registrarse
            </button>
          </div>

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-100 text-black-800 rounded-lg text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="text-black-700" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="text-red-600" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50">
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="text-red-600" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50">
                {loading ? "Registrando..." : "Registrarse"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-purple-700 to-pink-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-extrabold drop-shadow-sm">
            Panel de Administración - Joyería
          </h1>

          <div className="flex items-center gap-4">
            <NotificationsBell />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition">
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                <Package className="text-purple-600" size={22} />
              </div>
              <div>
                <p className="text-gray-700 text-sm font-medium">
                  Total Pedidos
                </p>
                <p className="text-2xl font-extrabold text-gray-900">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                <Calendar className="text-orange-600" size={22} />
              </div>
              <div>
                <p className="text-gray-700 text-sm font-medium">Pendientes</p>
                <p className="text-2xl font-extrabold text-gray-900">
                  {stats.pending}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                <Package className="text-green-600" size={22} />
              </div>
              <div>
                <p className="text-gray-700 text-sm font-medium">Completados</p>
                <p className="text-2xl font-extrabold text-gray-900">
                  {stats.completed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="text-blue-600" size={22} />
              </div>
              <div>
                <p className="text-gray-700 text-sm font-medium">Ingresos</p>
                <p className="text-2xl font-extrabold text-gray-900">
                  ${stats.revenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-900">
              Pedidos Recientes
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Productos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {order.customer_email}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customer_phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="text-sm text-gray-900">
                          {item.product_name} (x{item.quantity})
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ${order.total_amount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : order.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                        {order.status === "pending"
                          ? "Pendiente"
                          : "Completado"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          updateOrderStatus(order.id, e.target.value)
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-black">
                        <option value="pending">Pendiente</option>
                        <option value="processing">Procesando</option>
                        <option value="completed">Completado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-extrabold text-gray-900 mb-4">
              Categorías
            </h3>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCategoryName) return;
                try {
                  setCategoryMessage("Creando...");
                  const res = await fetch("/api/admin/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newCategoryName }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setNewCategoryName("");
                    setCategoryMessage("Categoría creada");
                    fetchCategories();
                  } else {
                    setCategoryMessage(
                      data?.error || "Error al crear categoría"
                    );
                  }
                } catch (err) {
                  console.error("Error al crear categoría:", err);
                  setCategoryMessage("Error al crear categoría");
                }
                setTimeout(() => setCategoryMessage(""), 2500);
              }}
              className="space-y-3">
              <input
                type="text"
                placeholder="Nombre de la categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex gap-2 items-center">
                <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg">
                  Crear categoría
                </button>
                <div
                  className={`text-sm self-center ${
                    categoryMessage?.includes("creada")
                      ? "text-green-700"
                      : categoryMessage
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                  {categoryMessage}
                </div>
              </div>
            </form>

            <div className="mt-6">
              <h4 className="font-extrabold text-gray-900 mb-2">Lista</h4>
              <ul className="space-y-2 text-sm">
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                    <span className="text-gray-800 font-medium">{c.name}</span>
                    <span className="text-xs text-gray-600">
                      {new Date(
                        c.created_at || Date.now()
                      ).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-extrabold text-gray-900 mb-4">
              Crear Producto
            </h3>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setProductMessage("Creando...");
                  const fd = new FormData();
                  fd.append("name", productForm.name);
                  fd.append("description", productForm.description);
                  fd.append("price", productForm.price);
                  fd.append("stock", productForm.stock);
                  if (productForm.category_id)
                    fd.append("category_id", productForm.category_id);
                  if (imageFile) fd.append("image", imageFile);

                  const res = await fetch("/api/admin/products", {
                    method: "POST",
                    body: fd,
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setProductMessage("Producto creado");
                    setProductForm({
                      name: "",
                      description: "",
                      price: "0",
                      stock: "0",
                      category_id: "",
                    });
                    setImageFile(null);
                    fetchAdminProducts();
                  } else {
                    setProductMessage(data?.error || "Error al crear producto");
                  }
                } catch (err) {
                  setProductMessage(
                    "Error al crear producto: " + err ||
                      "Error al crear producto"
                  );
                }
                setTimeout(() => setProductMessage(""), 3000);
              }}
              className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-black-700">
                  Nombre
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black-400" />
                  <input
                    type="text"
                    placeholder="Ej: Anillo de plata"
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm({ ...productForm, name: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-black-700">
                  Descripción
                </label>
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-black-400" />
                  <textarea
                    placeholder="Materiales, medidas, detalles..."
                    value={productForm.description}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-black-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-black-700">
                    Precio
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black-400" />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={productForm.price}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          price: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-black-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-black-700">
                    Stock
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      placeholder="0"
                      value={productForm.stock}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          stock: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-black-700">
                    Categoría
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black-400" />
                    <select
                      value={productForm.category_id}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          category_id: e.target.value,
                        })
                      }
                      className="w-full appearance-none pl-10 pr-9 py-2 border border-gray-300 rounded-lg text-black-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Imagen
                </label>
                <div className="mt-1">
                  <label
                    htmlFor="product-image"
                    className="group flex items-center justify-between gap-3 w-full cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-gray-200">
                        <FileImage className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {imageFile
                            ? imageFile.name
                            : "Seleccionar imagen (JPG/PNG/WebP)"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {imageFile
                            ? "Listo para subir"
                            : "Click para elegir un archivo"}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">Requerido</span>
                  </label>
                  <input
                    id="product-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setImageFile(e.target.files ? e.target.files[0] : null)
                    }
                    className="sr-only"
                  />
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <button className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-2 rounded-lg hover:from-green-700 hover:to-emerald-600">
                  <PlusCircle className="h-4 w-4" />
                  Crear producto
                </button>
                <div
                  className={`text-sm ${
                    productMessage?.includes("creado")
                      ? "text-green-700"
                      : productMessage
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                  {productMessage}
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Sección separada para la lista de productos */}
        <div className="bg-white rounded-xl shadow-md mt-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-gray-900">
                Gestión de Productos ({filteredAdminProducts.length})
              </h3>
              <button
                onClick={() => setShowAdminFilters(!showAdminFilters)}
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
                  value={adminProductFilters.search}
                  onChange={(e) =>
                    setAdminProductFilters({
                      ...adminProductFilters,
                      search: e.target.value,
                    })
                  }
                  className="text-black w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                />
              </div>
            </div>

            {/* Panel de Filtros */}
            {showAdminFilters && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-black">
                    Filtrar Productos
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAdminProductFilters({
                          search: "",
                          category: "",
                          minPrice: "",
                          maxPrice: "",
                          minStock: "",
                          maxStock: "",
                          sortBy: "name",
                          sortOrder: "asc",
                        })
                      }
                      className="text-sm text-purple-600 hover:text-purple-700 cursor-pointer">
                      Limpiar
                    </button>
                    <button
                      onClick={() => setShowAdminFilters(false)}
                      className="text-gray-500 hover:text-gray-700 cursor-pointer">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Filtro por categoría */}
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Categoría
                    </label>
                    <select
                      value={adminProductFilters.category}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
                          category: e.target.value,
                        })
                      }
                      className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                      <option value="">Todas las categorías</option>
                      {categories.map((c) => (
                        <option value={c.id} key={c.id}>
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
                      value={adminProductFilters.minPrice}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
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
                      value={adminProductFilters.maxPrice}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
                          maxPrice: e.target.value,
                        })
                      }
                      className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  {/* Filtros de stock */}
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Stock mínimo
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={adminProductFilters.minStock}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
                          minStock: e.target.value,
                        })
                      }
                      className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Stock máximo
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      value={adminProductFilters.maxStock}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
                          maxStock: e.target.value,
                        })
                      }
                      className="text-black w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  {/* Ordenamiento */}
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Ordenar por
                    </label>
                    <select
                      value={adminProductFilters.sortBy}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
                          sortBy: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black">
                      <option value="name">Nombre</option>
                      <option value="price">Precio</option>
                      <option value="stock">Stock</option>
                      <option value="category">Categoría</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Orden
                    </label>
                    <select
                      value={adminProductFilters.sortOrder}
                      onChange={(e) =>
                        setAdminProductFilters({
                          ...adminProductFilters,
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
          </div>

          <div className="p-6">
            {storageMessage && (
              <div className="mb-4">
                <span className="text-sm text-gray-500">{storageMessage}</span>
              </div>
            )}

            {/* Lista de productos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAdminProducts.map((p) => (
                <div
                  key={p.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <Image
                      src={p.image_url || "/placeholder.png"}
                      alt={p.name || "Imagen del producto"}
                      width={80}
                      height={80}
                      className="object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {p.name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-1">
                        {p.categories?.name || "Sin categoría"}
                      </p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-green-600">
                          ${p.price}
                        </span>
                        <span className="text-gray-500">Stock: {p.stock}</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm("¿Eliminar producto?")) return;
                          try {
                            const res = await fetch("/api/admin/products", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: p.id }),
                            });
                            const data = await res.json();
                            if (res.ok) fetchAdminProducts();
                            else
                              alert(data?.error || "Error eliminando producto");
                          } catch (err) {
                            console.error("Error deleting product: " + err);
                            alert("Error eliminando producto");
                          }
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-red-600 text-sm hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded">
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredAdminProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No se encontraron productos con los filtros aplicados</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
