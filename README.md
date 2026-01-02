This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Configuración adicional para la tienda y el asistente de voz (⚙️)

Sigue estos pasos para configurar las integraciones de Supabase, Google AI Studio (Generative) y ElevenLabs:

1. Variables de entorno (archivo `.env` en la raíz del proyecto):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Google Generative AI
# Opciones de autenticación (elige UNA de las dos):
# 1) API Key (rápido, uso limitado):
GOOGLE_API_KEY=tu_google_api_key

# 2) Cuenta de servicio (recomendado para producción):
# - Sube el JSON de la cuenta de servicio a tu servidor y pon su ruta aquí:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# - (alternativa) pega el JSON en la variable (no recomendado para repositorios):
# GOOGLE_SERVICE_ACCOUNT='{"type":"service_account",...}'
# Opcional: GOOGLE_PROJECT_ID=tu_project_id_opcional

# ElevenLabs
ELEVENLABS_API_KEY=tu_elevenlabs_api_key
ELEVENLABS_VOICE_ID=tu_voice_id_preferido

# Opcional: envío de emails (SendGrid)
SENDGRID_API_KEY=tu_sendgrid_api_key
ADMIN_EMAIL=email_del_admin@ejemplo.com
```

2. Crear esquema en Supabase

- Ve al SQL Editor en tu proyecto Supabase y ejecuta `db/supabase_schema.sql` que contiene las tablas `products`, `orders`, `order_items` y ahora también `categories` además de los campos `category_id` e `image_url` en `products`.

- Para almacenar imágenes de producto, crea un bucket de Storage llamado `test`. Puedes crearlo desde la UI de Supabase → Storage → Create bucket, o usar el endpoint admin en el panel: En el Panel de Administración, en la sección Productos pulsa "Crear bucket `test`".

- El registro desde el panel ahora está restringido **solo** a administradores: debes definir la variable de entorno `ADMIN_SIGNUP_SECRET` en tu entorno (una cadena secreta) y pegarla en el campo "Clave de registro" del formulario para crear un usuario con `role = 'admin'` en la tabla `users`. Si no se proporciona la clave o es incorrecta, el servidor rechazará el registro (403).

- Si prefieres hacerlo manualmente con el endpoint de administración, ejecuta (si estás autenticado como admin):

  POST /api/admin/storage
  body: { "name": "test" }

  Esto requiere que esté configurada la variable de entorno `SUPABASE_SERVICE_ROLE_KEY` para que el endpoint pueda crear el bucket con permisos administrativos.

3. Rutas API disponibles

- `POST /api/assistant` → recibir `{ message: string }` y devuelve `{ response: string }` (usa Google Generative AI desde el servidor; requiere `GOOGLE_API_KEY`).

Nota: se usa la API HTTP directa, no es obligatorio instalar bibliotecas adicionales. Si prefieres, puedo cambiar a la librería oficial de Google Generative AI (`@google/generative-ai` o `@google-cloud/generative-ai`) para un manejo más avanzado y autenticación basada en cuentas de servicio.
- `POST /api/tts` → recibir `{ text: string }` y devuelve audio `audio/mpeg` (usa ElevenLabs desde el servidor).
- `POST /api/orders` → crear pedido en la base de datos: `{ customer_name, customer_email, customer_phone, total_amount, items }`.

Ejemplo de curl para probar el asistente:

```bash
curl -X POST http://localhost:3000/api/assistant -H "Content-Type: application/json" -d '{"message":"¿Qué anillos tienen?"}'
```

Ejemplo para TTS (descargará un MP3):

```bash
curl -X POST http://localhost:3000/api/tts -H "Content-Type: application/json" -d '{"text":"Hola, este es un ejemplo"}' --output sample.mp3
```

---

## Prueba de conexión a Supabase (diagnóstico)

- Ruta de diagnóstico: `GET /api/supabase/ping` → verifica lectura pública con la `anon` key.
- Prueba de escritura (usa service role): `POST /api/supabase/ping` → inserta y elimina una orden de prueba usando `SUPABASE_SERVICE_ROLE_KEY`.

Ejemplos:

```bash
# Comprobar lectura (anon):
curl -v http://localhost:3000/api/supabase/ping

# Comprobar inserción/limpieza (service role):
curl -v -X POST http://localhost:3000/api/supabase/ping
```

Si alguno falla, revisa que `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` estén correctamente configurados en `.env` o en las variables del entorno de tu despliegue.

4. Notas de seguridad y despliegue

- Nunca publiques `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY` ni `ELEVENLABS_API_KEY` en el cliente. El código ya usa esos valores sólo en las rutas servidor (`/api/*`).
- Para producción en Vercel: añade las variables en Settings → Environment Variables.

---

Si quieres, puedo seguir y:
- Implementar el flujo de checkout completo y el frontend para agregar productos al carrito ✅
- Añadir protección de rutas en el servidor y roles (por ejemplo sólo `admin` puede ver pedidos) ✅
- Añadir tests o ejemplos de componentes para productos ✅

Dime qué prefieres que implemente a continuación. 🚀
