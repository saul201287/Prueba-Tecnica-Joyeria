"use client";

import { useEffect, useState } from "react";

export function DatabaseInitializer() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // Verificar si ya se inicializó (usando localStorage)
        const hasInitialized = localStorage.getItem("db_initialized");
        if (hasInitialized) {
          console.log("Base de datos ya inicializada");
          setInitialized(true);
          return;
        }

        console.log("Inicializando base de datos...");
        const response = await fetch("/api/db/init", {
          method: "POST",
        });

        const data = await response.json();

        if (data.success) {
          console.log("✓ Base de datos inicializada correctamente");
          localStorage.setItem("db_initialized", "true");
          setInitialized(true);
        } else {
          console.warn("⚠️ Error inicializando base de datos:", data.error);
          setError(data.error);
        }
      } catch (err) {
        console.error("Error al inicializar base de datos:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    initializeDatabase();
  }, []);

  // Este componente no renderiza nada, solo ejecuta la inicialización
  return null;
}
