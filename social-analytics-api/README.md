# social-analytics-api

API tipo Socialinsider para analizar perfiles **publicos** de Instagram y TikTok
a partir de su `@handle`, sin pedir contrasenas.

## Como funciona

1. **Ingestion Layer** (`src/providers/`): trae los datos publicos del perfil.
   - Instagram: 3 proveedores intercambiables via `INSTAGRAM_PROVIDER`:
     - `mock` (default): datos de ejemplo deterministas, sin llamadas de red. Sirve para levantar y probar la API sin ninguna credencial.
     - `meta`: Meta Graph API "Business Discovery" (oficial de Meta; requiere que tu propia cuenta sea Business/Creator y solo funciona sobre perfiles Business/Creator publicos).
     - `apify`: actor de Apify (servicio de terceros, de pago).
   - TikTok: `mock` (default) o `apify`, via `TIKTOK_PROVIDER`.
2. **Analytics Engine** (`src/analytics/engine.ts`): calcula `total_followers`,
   `total_posts_periodo`, `posts_per_day`, `engagement_rate` y `top_posts` sobre
   los datos normalizados, sin importar de que proveedor vinieron.
3. **AI Executive Summary** (`src/ai/executiveSummary.ts`): le pide a Claude
   (`claude-opus-5`) un resumen ejecutivo de 2 oraciones a partir de las metricas
   ya calculadas. Si no hay `ANTHROPIC_API_KEY`, devuelve un resumen equivalente
   generado localmente (sin inventar numeros) en vez de fallar.
4. **API REST** (`src/routes/profiles.ts` + `src/server.ts`).

## Instalar y correr

```bash
cd social-analytics-api
npm install
cp .env.example .env   # opcional: agregar ANTHROPIC_API_KEY, credenciales de Meta/Apify
npm run dev            # http://localhost:4000
```

Sin tocar el `.env`, la API ya funciona con datos de ejemplo (`mock`).

## Endpoints

### `POST /api/profiles/analyze`

```bash
curl -X POST http://localhost:4000/api/profiles/analyze \
  -H "Content-Type: application/json" \
  -d '{"username": "shop_plumas", "platform": "instagram"}'
```

Respuesta (201): el `ProfileReport` completo, incluido su `id`.

### `GET /api/profiles/:id`

```bash
curl http://localhost:4000/api/profiles/<id-devuelto-arriba>
```

### `GET /api/profiles`

Lista todos los reportes generados en esta instancia (para debug/demo).

## Cambiar de proveedor de datos

Editar `.env`:

```bash
INSTAGRAM_PROVIDER=meta     # o apify, o mock
META_ACCESS_TOKEN=...
META_IG_BUSINESS_ID=...     # el ID de TU cuenta Business/Creator conectada

# o bien:
INSTAGRAM_PROVIDER=apify
APIFY_TOKEN=...
APIFY_INSTAGRAM_ACTOR_ID=apify~instagram-profile-scraper

TIKTOK_PROVIDER=apify
APIFY_TIKTOK_ACTOR_ID=clockworks~tiktok-scraper
```

**Nota sobre Apify:** los actores de la comunidad cambian su esquema de salida
con el tiempo. Si usas un actor distinto al configurado por defecto, ajusta el
mapeo de campos en `apifyProvider.ts` (Instagram) o `apifyProvider.ts` (TikTok)
segun la documentacion del actor elegido.

## Persistencia

Los reportes se guardan en memoria (`src/storage/reportStore.ts`) mientras el
proceso esta corriendo. Para persistir entre reinicios o compartir entre varias
instancias, reemplazar `ReportStore` por una implementacion respaldada en una
base de datos (misma interfaz: `save`, `getById`, `list`).
