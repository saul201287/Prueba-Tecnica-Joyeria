import { NextResponse } from "next/server";
import {
  type FunctionDeclaration,
  GoogleGenAI,
} from "@google/genai";
import { supabase } from "@/lib/supabase";

type AssistantAction =
  | {
      type: "apply_filters";
      filters: {
        search?: string;
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        inStock?: boolean;
        sortBy?: "name" | "price" | "stock" | "category";
        sortOrder?: "asc" | "desc";
      };
      openFilters?: boolean;
    }
  | { type: "open_product"; id: string };

type ApiAction =
  | {
      type: "apply_filters";
      openFilters: boolean;
      filters: {
        search: string;
        category: string;
        minPrice: string;
        maxPrice: string;
        inStock: boolean;
        sortBy: "name" | "price" | "stock" | "category";
        sortOrder: "asc" | "desc";
      };
    }
  | { type: "open_product"; id: string };

function parseJsonSafely(text: string): unknown {
  const raw = String(text || "");
  const cleaned = raw
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  const firstJson = extractFirstJsonObject(cleaned);
  const candidate = firstJson || cleaned;

  try {
    return JSON.parse(candidate);
  } catch {
    if (firstJson && firstJson !== candidate) {
      try {
        return JSON.parse(firstJson);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractFirstJsonObject(text: string): string | null {
  const s = String(text || "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractResponseTextFallback(text: string): string | null {
  const s = String(text || "");
  const m = s.match(/"response"\s*:\s*"([^"]*)"/);
  if (!m) return null;
  return m[1];
}

function normalizeNumberString(v: unknown): string {
  if (v === null || v === undefined) return "";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function sanitizeAction(action: AssistantAction | null | undefined): ApiAction | null {
  if (!action || typeof action !== "object") return null;
  if (action.type === "open_product") {
    const openProductAction = action as { type: "open_product"; id: unknown };
    const id = openProductAction.id;
    if (typeof id === "string" && id.trim()) return { type: "open_product", id: id.trim() };
    return null;
  }
  if (action.type === "apply_filters") {
    const filterAction = action as { type: "apply_filters"; filters?: Record<string, unknown>; openFilters?: unknown };
    const f = filterAction.filters || {};
    return {
      type: "apply_filters",
      openFilters: Boolean(filterAction.openFilters ?? true),
      filters: {
        search: typeof f.search === "string" ? f.search : "",
        category: typeof f.category === "string" ? f.category : "",
        minPrice: normalizeNumberString(f.minPrice),
        maxPrice: normalizeNumberString(f.maxPrice),
        inStock: Boolean(f.inStock),
        sortBy: (typeof f.sortBy === "string" && ["name", "price", "stock", "category"].includes(f.sortBy)) ? f.sortBy as "name" | "price" | "stock" | "category" : "name",
        sortOrder: (typeof f.sortOrder === "string" && ["asc", "desc"].includes(f.sortOrder)) ? f.sortOrder as "asc" | "desc" : "asc",
      },
    };
  }
  return null;
}

function normalizeForSearch(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordsFromMessage(message: string): string {
  const lower = normalizeForSearch(message);
  const keep: Array<{ key: string; match: string[] }> = [
    { key: "anillo", match: ["anillo", "anillos"] },
    { key: "collar", match: ["collar", "collares"] },
    { key: "pulsera", match: ["pulsera", "pulseras"] },
    { key: "arete", match: ["arete", "aretes"] },
    { key: "cadena", match: ["cadena", "cadenas"] },
    { key: "oro", match: ["oro"] },
    { key: "dorado", match: ["dorado", "dorada"] },
    { key: "plata", match: ["plata"] },
    { key: "plateado", match: ["plateado", "plateada"] },
    { key: "perla", match: ["perla", "perlas"] },
    { key: "diamante", match: ["diamante", "diamantes"] },
    { key: "esmeralda", match: ["esmeralda", "esmeraldas"] },
    { key: "zafiro", match: ["zafiro", "zafiros"] },
    { key: "rubi", match: ["rubi", "rubies", "rubi"] },
  ];
  const found: string[] = [];
  for (const k of keep) {
    if (k.match.some((m) => lower.includes(m))) found.push(k.key);
  }
  return found.length > 0 ? Array.from(new Set(found)).join(" ") : "";
}

function extractPriceFilters(message: string): { minPrice: string; maxPrice: string } {
  const text = (message || "").toLowerCase();
  let minPrice = "";
  let maxPrice = "";

  const between = text.match(/entre\s+(\d+(?:[\.,]\d+)?)\s+y\s+(\d+(?:[\.,]\d+)?)/);
  if (between) {
    minPrice = between[1].replace(",", ".");
    maxPrice = between[2].replace(",", ".");
    return { minPrice, maxPrice };
  }

  const upTo = text.match(/(?:hasta|menos\s+de|máximo|maximo)\s+(\d+(?:[\.,]\d+)?)/);
  if (upTo) {
    maxPrice = upTo[1].replace(",", ".");
  }

  const from = text.match(/(?:desde|mínimo|minimo|más\s+de|mayor\s+que)\s+(\d+(?:[\.,]\d+)?)/);
  if (from) {
    minPrice = from[1].replace(",", ".");
  }

  return { minPrice, maxPrice };
}

function extractSort(message: string): {
  sortBy: "name" | "price" | "stock" | "category";
  sortOrder: "asc" | "desc";
} {
  const text = (message || "").toLowerCase();
  if (text.includes("más barato") || text.includes("mas barato")) return { sortBy: "price", sortOrder: "asc" };
  if (text.includes("más caro") || text.includes("mas caro")) return { sortBy: "price", sortOrder: "desc" };
  if (text.includes("más stock") || text.includes("mas stock")) return { sortBy: "stock", sortOrder: "desc" };
  return { sortBy: "name", sortOrder: "asc" };
}

function compactProductLine(p: { name: string; price: number; stock: number; category?: string }): string {
  const price = Number.isFinite(p.price) ? `$${p.price}` : "";
  const stock = Number.isFinite(p.stock) ? `(${p.stock} en stock)` : "";
  const cat = p.category ? `• ${p.category}` : "";
  return `${p.name} ${cat} ${price} ${stock}`.replace(/\s+/g, " ").trim();
}

function inferFilterActionFromMessage(message: string): ApiAction | null {
  const m = (message || "").trim();
  if (!m) return null;

  const lower = m.toLowerCase();

  // Define search intent words
  const searchIntentWords = [
    "busca", "buscar", "muéstrame", "muestrame", "quiero", "necesito",
    "tienen", "tienes", "hay", "existen", "dame", "ver"
  ];

  // Define product categories with their variations
  const categories: Record<string, string[]> = {
    "Anillo": ["anillo", "anillos", "sortija", "sortijas"],
    "Collar": ["collar", "collares", "gargantilla", "gargantillas"],
    "Pulsera": ["pulsera", "pulseras", "brazalete", "brazaletes"],
    "Arete": ["arete", "aretes", "pendiente", "pendientes", "aros", "piercing"]
  };

  // Materiales comunes
  const materials = {
    oro: ["oro", "dorado", "dorada", "dorados", "doradas"],
    plata: ["plata", "plateado", "plateada", "plata.925"],
    acero: ["acero", "acero inoxidable", "acero quirúrgico"],
    rodio: ["rodio", "rodinado", "baño de oro"],
    plata_ley: ["plata.925", "plata 925", "plata de ley"]
  };

  // Check if the message contains any search intent
  const hasSearchIntent = searchIntentWords.some(w => lower.includes(w));
  const hasProductTerm = Object.values(categories).some(terms => 
    terms.some(term => lower.includes(term))
  );

  // Extract category
  let category = "";
  for (const [cat, terms] of Object.entries(categories)) {
    if (terms.some(term => lower.includes(term))) {
      category = cat;
      break;
    }
  }

  // Only return null if there's no search intent AND no product term
  if (!hasSearchIntent && !hasProductTerm) return null;

  // Extract price filters with better pattern matching
  let minPrice = "";
  let maxPrice = "";
  
  // Match patterns like "entre $100 y $200" or "de 100 a 200"
  const rangeMatch = lower.match(/(?:entre|de|rango|desde)\s*(?:\$?\s*(\d+))?\s*(?:a|hasta|y|al)\s*(?:\$?\s*(\d+))?/i);
  if (rangeMatch) {
    minPrice = rangeMatch[1] || "";
    maxPrice = rangeMatch[2] || "";
  } else {
    // Match patterns like "menos de $100" or "hasta 100"
    const maxMatch = lower.match(/(?:menos de|hasta|máximo|maximo|precio máximo)\s*(?:\$?\s*(\d+))/i);
    if (maxMatch) {
      maxPrice = maxMatch[1];
    }
    
    // Match patterns like "más de $50" or "desde 50"
    const minMatch = lower.match(/(?:más de|desde|mínimo|minimo|precio mínimo)\s*(?:\$?\s*(\d+))/i);
    if (minMatch) {
      minPrice = minMatch[1];
    }
  }

  // Extract material if mentioned
  let materialFilter = "";
  for (const [mat, terms] of Object.entries(materials)) {
    if (terms.some(term => lower.includes(term))) {
      materialFilter = mat;
      break;
    }
  }

  // Check stock availability with more variations
  const inStock =
    lower.includes("en stock") ||
    lower.includes("disponible") ||
    lower.includes("disponibles") ||
    lower.includes("hay") ||
    lower.includes("existencia") ||
    lower.includes("tienen") ||
    lower.includes("tienes") ||
    lower.includes("disponibilidad");

  // Determine sort order based on user intent
  let sortBy: "name" | "price" | "stock" | "category" = "name";
  let sortOrder: "asc" | "desc" = "asc";

  if (lower.includes("más caro") || lower.includes("mayor precio") || lower.includes("precio alto")) {
    sortBy = "price";
    sortOrder = "desc";
  } else if (lower.includes("más barato") || lower.includes("menor precio") || lower.includes("precio bajo")) {
    sortBy = "price";
    sortOrder = "asc";
  } else if (lower.includes("nuevo") || lower.includes("reciente")) {
    sortBy = "stock";
    sortOrder = "desc";
  } else if (lower.includes("nombre")) {
    sortBy = "name";
    sortOrder = lower.includes("z-a") || lower.includes("za") ? "desc" : "asc";
  }

  // Clean up search query
  let search = m;
  
  // If we have a category match, handle it first
  if (category) {
    const categoryTerms = [category, ...(categories[category as keyof typeof categories] || [])];
    
    // Create a regex pattern to remove the category terms from the search
    const categoryPattern = new RegExp(`\\b(${categoryTerms.join('|')})\\b`, 'gi');
    
    // Remove category terms from the search query
    search = search.replace(categoryPattern, '')
      // Remove common command words
      .replace(/\b(?:busca|buscar|muéstrame|muestrame|quiero|necesito|tienen|tienes|hay|existen|dame|ver|en|de|la|el|los|las|un|una|unos|unas)\b/gi, '')
      // Remove price-related terms
      .replace(/(?:entre|de|a|hasta|y|al|menos de|más de|máximo|maximo|mínimo|minimo|precio|\$|\d+)/gi, '')
      // Clean up extra spaces and punctuation
      .replace(/[¿?¡!.,;:]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // If we removed all text, use the category name as the search term
    if (!search) {
      search = category;
    }
  } else {
    // No category match, just clean up the search query
    search = search
      // Remove common command words
      .replace(/\b(?:busca|buscar|muéstrame|muestrame|quiero|necesito|tienen|tienes|hay|existen|dame|ver|en|de|la|el|los|las|un|una|unos|unas)\b/gi, '')
      // Remove price-related terms
      .replace(/(?:entre|de|a|hasta|y|al|menos de|más de|máximo|maximo|mínimo|minimo|precio|\$|\d+)/gi, '')
      // Clean up extra spaces and punctuation
      .replace(/[¿?¡!.,;:]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // If we have a material filter but no other search terms, include it in the search
  if (materialFilter && !search) {
    search = materialFilter;
  }

  return {
    type: "apply_filters",
    openFilters: true,
    filters: {
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      sortBy,
      sortOrder,
    },
  };
}

async function resolveCategoryIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.id || null;
}

function toSearchTokens(s: string): string[] {
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
    "estoy",
    "busco",
    "buscar",
    "quiero",
    "necesito",
    "puedes",
    "ayudarme",
    "encontrar",
  ]);
  return normalizeForSearch(s)
    .split(" ")
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => t.length >= 2 && !stop.has(t));
}

async function searchProducts(args: {
  query?: string;
  categoryName?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: "name" | "price" | "stock" | "category";
  sortOrder?: "asc" | "desc";
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(6, args.limit ?? 3));
  let q = supabase
    .from("products")
    .select("id, name, description, price, stock, image_url, category_id, categories ( name )")
    .limit(limit);

  const query = (args.query || "").trim();
  if (query) {
    const tokens = toSearchTokens(query).slice(0, 4);
    const used = tokens.length > 0 ? tokens : [normalizeForSearch(query)];
    const clauses: string[] = [];
    for (const t of used) {
      const safe = t.replaceAll("%", "").replaceAll("_", "");
      if (!safe) continue;
      const like = `%${safe}%`;
      clauses.push(`name.ilike.${like}`);
      clauses.push(`description.ilike.${like}`);
    }
    if (clauses.length > 0) q = q.or(clauses.join(","));
  }

  const categoryName = (args.categoryName || "").trim();
  if (categoryName) {
    const catId = await resolveCategoryIdByName(categoryName);
    if (catId) q = q.eq("category_id", catId);
  }

  if (typeof args.minPrice === "number" && Number.isFinite(args.minPrice)) {
    q = q.gte("price", args.minPrice);
  }
  if (typeof args.maxPrice === "number" && Number.isFinite(args.maxPrice)) {
    q = q.lte("price", args.maxPrice);
  }
  if (args.inStock) {
    q = q.gt("stock", 0);
  }

  const sortBy = args.sortBy || "name";
  const sortOrder = args.sortOrder || "asc";
  if (sortBy === "category") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q.order(sortBy, { ascending: sortOrder === "asc" });
  }

  const { data, error } = await q;
  if (error) throw error;

  const items = (data || []).map((p) => {
    const productWithCategories = p as { categories?: { name?: string } | null };
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      stock: Number(p.stock),
      category: productWithCategories.categories?.name || "",
      image_url: p.image_url || "",
    };
  });
  return { items };
}

async function getProductById(args: { id: string }) {
  const id = (args.id || "").trim();
  if (!id) return { product: null };
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, stock, image_url, categories ( name )")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { product: null };
  return {
    product: {
      id: data.id,
      name: data.name,
      description: data.description || "",
      price: Number(data.price),
      stock: Number(data.stock),
      category: (data as { categories?: { name?: string } | null }).categories?.name || "",
      image_url: data.image_url || "",
    },
  };
}

async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return { categories: data || [] };
}

async function getStock(args: { id: string }) {
  const id = (args.id || "").trim();
  if (!id) return { id: "", stock: null };
  const { data, error } = await supabase
    .from("products")
    .select("id, stock")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return { id: data?.id || id, stock: data ? Number(data.stock) : null };
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Configuración faltante" },
        { status: 500 }
      );
    }

    const tools: FunctionDeclaration[] = [
      {
        name: "search_products",
        description:
          "Busca productos del catálogo con filtros. Devuelve pocos resultados resumidos.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            categoryName: { type: "string" },
            minPrice: { type: "number" },
            maxPrice: { type: "number" },
            inStock: { type: "boolean" },
            sortBy: {
              type: "string",
              enum: ["name", "price", "stock", "category"],
            },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
            limit: { type: "number" },
          },
          required: [],
        },
      },
      {
        name: "get_product_by_id",
        description: "Obtiene un producto por id.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_stock",
        description: "Obtiene el stock de un producto por id.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_categories",
        description: "Lista las categorías disponibles.",
        parametersJsonSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    const ai = new GoogleGenAI({ apiKey });

    const system = `Asistente de tienda de joyería. Responde SIEMPRE en JSON: {"response":string,"action"?:object}.
Reglas:
1) Respuesta muy corta (<=40 palabras).
2) Si preguntan por catálogo/precio/stock usa tools.
3) Máximo 3 productos.
4) Si el usuario pide un producto o filtrar/buscar, devuelve action {type:'apply_filters',filters:{search:string,inStock?:boolean,category?:string,minPrice?:string,maxPrice?:string,sortBy?:string,sortOrder?:string},openFilters:true}. Las categorías válidas son: "Anillo", "Arete", "Collar", "Pulsera".
5) No inventes stock/precios.`;

    const contents = [{ role: "user", parts: [{ text: String(message || "") }] }] as any[];

    async function generateWithFallback(ai: GoogleGenAI, contents: any[], system: string, tools: FunctionDeclaration[]) {
      
      const models = [
        "gemini-2.5-flash", 
        "gemini-2.5-pro",      
        "gemini-2.0-flash-lite"
      ];

      let lastError: Error | null = null;

      for (const modelName of models) {
        try {
          const resp = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: system,
              temperature: 0.2,
              maxOutputTokens: 160,
              tools: [{ functionDeclarations: tools }],
            },
          });
          return resp; // Return successful response
        } catch (error: unknown) {
          const err = error as { message?: string; status?: number };
          console.warn(`Error with model ${modelName}:`, err.message);
          lastError = error as Error;
          // If it's a rate limit error (429) or model not found (404), try next model
          if (err.status === 429 || err.status === 404) {
            console.warn(`Trying next model (${modelName} failed with status ${err.status})`);
            continue;
          }
          // For other errors, rethrow
          throw error;
        }
      }

      // If we get here, all models failed
      throw lastError || new Error("Todos los modelos fallaron");
    }

    const callTool = async (name: string, args: Record<string, unknown> | undefined) => {
      if (name === "search_products") return await searchProducts(args || {});
      if (name === "get_product_by_id") {
        const id = typeof args?.id === "string" ? args.id : "";
        return await getProductById({ id });
      }
      if (name === "get_stock") {
        const id = typeof args?.id === "string" ? args.id : "";
        return await getStock({ id });
      }
      if (name === "get_categories") return await getCategories();
      return { error: "Tool no soportada" };
    };

    let lastText = "";
    for (let i = 0; i < 3; i++) {
      const resp = await generateWithFallback(ai, contents, system, tools);

      if (resp.functionCalls && resp.functionCalls.length > 0) {
        for (const fc of resp.functionCalls) {
          const fnName = fc.name;
          if (typeof fnName !== "string" || !fnName) continue;
          const result = await callTool(fnName, fc.args);
          contents.push({ role: "model", parts: [{ functionCall: fc }] } as any);
          contents.push({
            role: "user",
            parts: [{ functionResponse: { name: fnName, response: result } }],
          } as any);
        }
        continue;
      }

      lastText = resp.text || "";
      break;
    }

    const parsed = parseJsonSafely(lastText);
    const obj = (parsed && typeof parsed === "object") ? (parsed as Record<string, unknown>) : null;
    const responseText =
      typeof obj?.response === "string"
        ? obj.response
        : (extractResponseTextFallback(lastText) || "Listo.");
    const action = obj?.action as AssistantAction | undefined;

    let safeAction: ApiAction | null = sanitizeAction(action);

    if (!safeAction) {
      const inferred = inferFilterActionFromMessage(String(message || ""));
      if (inferred) safeAction = inferred;
    }

    // Búsqueda server-side para recomendaciones cuando el filtro no arroja resultados.
    // Esto mejora UX (y reduce tokens) porque respondemos con sugerencias concretas.
    if (safeAction && safeAction.type === "apply_filters") {
      const search = safeAction.filters.search;
      const minPrice = safeAction.filters.minPrice ? Number(safeAction.filters.minPrice) : undefined;
      const maxPrice = safeAction.filters.maxPrice ? Number(safeAction.filters.maxPrice) : undefined;

      let found = await searchProducts({
        query: search,
        categoryName: safeAction.filters.category || undefined,
        minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        inStock: safeAction.filters.inStock,
        sortBy: safeAction.filters.sortBy,
        sortOrder: safeAction.filters.sortOrder,
        limit: 3,
      });

      if (!found.items || found.items.length === 0) {
        // Relajar: usar solo el tipo de producto si existe (anillo/collar/...) y mantener inStock
        const kw = keywordsFromMessage(String(message || ""));
        const typeOnly = kw
          .split(" ")
          .filter((w) => ["anillo", "anillos", "collar", "collares", "pulsera", "pulseras", "arete", "aretes", "cadena", "cadenas"].includes(w))
          .join(" ")
          .trim();

        const relaxedQuery = typeOnly || kw || search;
        found = await searchProducts({
          query: relaxedQuery,
          inStock: true,
          sortBy: "stock",
          sortOrder: "desc",
          limit: 3,
        });

        if (found.items && found.items.length > 0) {
          const lines = found.items.map((p) => compactProductLine(p)).join(" | ");
          const txt = `No encontré exactos. Opciones similares en stock: ${lines}.`;
          // Ajustar el filtro para no dejar el catálogo en 0 (más general)
          safeAction = {
            type: "apply_filters",
            openFilters: true,
            filters: {
              ...safeAction.filters,
              search: relaxedQuery,
              inStock: true,
              minPrice: "",
              maxPrice: "",
              sortBy: "stock",
              sortOrder: "desc",
            },
          };
          return NextResponse.json({ response: txt, action: safeAction });
        }

        // Último fallback: recomendar top en stock sin query
        const any = await searchProducts({ inStock: true, sortBy: "stock", sortOrder: "desc", limit: 3 });
        const lines = (any.items || []).map((p) => compactProductLine(p)).join(" | ");
        const txt = lines
          ? `No encontré coincidencias. Te recomiendo: ${lines}.`
          : "No encontré coincidencias y no hay productos disponibles en este momento.";
        safeAction = {
          type: "apply_filters",
          openFilters: true,
          filters: {
            search: "",
            category: "",
            minPrice: "",
            maxPrice: "",
            inStock: true,
            sortBy: "stock",
            sortOrder: "desc",
          },
        };
        return NextResponse.json({ response: txt, action: safeAction });
      }
    }

    return NextResponse.json({ response: String(responseText || "Listo."), action: safeAction });
  } catch (err: unknown) {
    console.error("Error en la ruta del asistente:", err);
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      {
        error: "Error al procesar la solicitud",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
