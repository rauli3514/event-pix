# AUDITORÍA TÉCNICA Y ESTRATÉGICA DEL SISTEMA
## EVENTPIX INTELLIGENCE — SISTEMA DE APRENDIZAJE DE CONTENIDO BASADO EN EVIDENCIA

**Fecha:** 14 de Septiembre de 2026  
**Proyecto:** EventPix Intelligence (`/Users/raulandresgutierrez/Desktop/event-pix`)  
**Estado:** Auditoría Exhaustiva Pre-Implementación  

---

## 1. RESUMEN EJECUTIVO

Se ha realizado una auditoría estructural de todo el repositorio: código fuente frontend, proxy backend en Vite, integraciones con Meta Graph API, servicios de IA (Claude, Gemini, OpenAI), base de datos Supabase, almacenamiento local, componentes del Canvas y generadores de guiones.

El sistema cuenta con **bases funcionales valiosas y reales** (conexión con Meta Graph API, transcripción con Whisper, proveedores de IA y un canvas interactivo). Sin embargo, presentaba **tres vicios críticos de diseño** que explicaban exactamente por qué la IA devolvía respuestas genéricas o desconectadas del negocio:
1. **Invocaciones asíncronas no esperadas (`unawaited Promise`):** La función `loadProfileContext` se invocaba sin `await` al generar guiones y en el chat, entregando a la IA un objeto `Promise` en lugar del contexto de negocio, provocando que todos los atributos de perfil cayeran en valores por defecto.
2. **Fallbacks determinísticos hardcodeados:** Módulos como `DynamicSynthesisEngine` y las ramas de error de `AIProviderService` contenían guiones fijos sobre *"pantallas verticales, cartelería digital y comercios"*, ignorando la temática de los reels conectados si la API de IA fallaba o agotaba cuota.
3. **Métricas sintéticas inventadas:** Cuando Meta no reportaba ciertas estadísticas de un Reel, el sistema fabricaba datos mediante multiplicadores (`likes * 35`, `likes * 0.25`, `curiosity_score: 87`), contaminando el benchmark y confundiendo la detección de patrones ganadores.

---

## 2. ARQUITECTURA ACTUAL

### 2.1. Frontend
* **Tecnología:** React 18 SPA con TypeScript, Tailwind CSS, Lucide Icons, Sonner (toasts), Radix UI.
* **Módulo de Inteligencia:** Ubicado en `/intelligence` y `/admin/intelligence` (`src/pages/intelligence/IntelligenceCanvasPage.tsx`).
* **Lienzo (Canvas):** Implementación interactiva en `src/components/intelligence/StrategyCanvas.tsx` con soporte de paneo, zoom, renderizado de nodos arrastrables y cables SVG dinámicos.
* **Componentes Satélite:** `AiChatCardNode` (Card #8), `MetaConnectionPanel`, `ProfileAndAiContextView`, `ReelBreakdownModal`, `UnifiedConnectionsModal`, `TeleprompterModal`, `BusinessSwitcher`.

### 2.2. Backend y Proxy en Desarrollo
No existe un backend tradicional en Node/Express separado; en su lugar, `vite.config.ts` implementa un servidor de middlewares HTTP que actúa como backend de microservicios:
* `/api/instagram-scrape`: Scraping de Reels públicos de Instagram por URL.
* `/api/instagram-transcribe`: Descarga de audio/video con `yt-dlp` y transcripción palabra por palabra con OpenAI Whisper API (`whisper-1`).
* `/api/claude-test` & `/api/claude-messages`: Proxy para Anthropic Claude API que solventa CORS en navegador e inyecta `anthropic-workspace-id`.
* `/api/gemini-generate` & `/api/gemini-test`: Proxy para Google Gemini REST API.

### 2.3. Base de Datos & Capa de Persistencia
* **Supabase PostgreSQL:** Configurado en `src/lib/supabase.ts` apuntando a `https://gbnkkdiysybzhyurdxhe.supabase.co`. Aloja el backend general de EventPix (comercios, pantallas, usuarios, kioscos).
* **Módulo de Inteligencia:** `IntelligenceStorageService.ts` implementa un mecanismo híbrido: intenta consultar la tabla `intelligence_businesses`; si la tabla no existe en Supabase o da error, hace fallback a `localStorage`. En el estado actual, el 95% de la información de inteligencia vive en `localStorage` del navegador con llaves por `businessId`.

---

## 3. MAPA DE COMPONENTES: REALES VS. MOCK / INVENTADOS

| Componente / Funcionalidad | Estado Real | Detalle Técnico |
|---|---|---|
| **Meta Graph API (Instagram)** | **100% REAL** | Conexión OAuth y token manual, lectura de perfil, lectura de Reels de la cuenta (`caption`, `like_count`, `comments_count`, permalink) y métricas de insights (`plays`, `reach`, `saved`, `shares`, `watch_time`). |
| **Transcripción de Audio** | **100% REAL** | `yt-dlp` descarga el Reel y OpenAI Whisper genera la transcripción exacta con marcas de tiempo. |
| **Motores de IA** | **100% REAL** | Anthropic Claude 3.5 Sonnet, Google Gemini 1.5 Flash y OpenAI GPT-4o con selector y failover automático en cascada. |
| **Canvas Visual Interactivo** | **100% REAL** | Paneo, zoom, nodos arrastrables, conexiones visuales SVG y eliminación/agregado de nodos. |
| **Cálculo de Medianas** | **100% REAL** | Cálculo matemático de medianas de cuenta en `AccountBenchmarkService.ts`. |
| **WhatsApp Cloud API** | **100% REAL** | Integrado en `WhatsAppCloudService.ts` (con tokens de Meta). |
| **Métricas Sintéticas en Nodos Reel** | ⚠️ **FABRICADAS** | Si Meta no reporta insights de un Reel, `handleAddReelFromMeta` inventaba reproducciones (`likes * 35`), guardados (`likes * 0.25`) y scores arbitrarios (`curiosity: 87`). |
| **CRM Leads & Chats** | ⚠️ **MOCK LOCAL** | Inicia con datos de `mockCRMData.ts` persistidos en `localStorage`. |
| **Análisis de Competidores** | ⚠️ **MOCK** | Meta API no expone insights privados de cuentas ajenas; los datos de competidores son simulados. |
| **Meta Ads Intelligence** | ⚠️ **MOCK** | Campañas cargadas desde `INITIAL_AD_CAMPAIGNS` (mock), sin conexión a la Marketing API de Meta. |

---

## 4. AUDITORÍA DEL FLUJO DE DATOS Y CONSTRUCCIÓN DE PROMPTS

### 4.1. Cómo se construye un prompt para la IA
Actualmente existen 3 flujos de llamada a IA:
1. **Estrategia y 3 Variantes (`generateEvidenceBasedStrategy`):**
   - Inyecta en el System Prompt las reglas anti-clichés, medianas de la cuenta y patrones ganadores/perdedores detectados.
   - Pide como salida un JSON con Variante A (Patrón Probado), Variante B (Ángulo Alternativo) y Variante C (Apuesta Creativa).
2. **Copiloto Conversacional (`adaptScriptWithChat`):**
   - Recibe la instrucción del usuario, el historial de mensajes de la Card #8, las fuentes conectadas y el formato deseado (`reel_hablado`, `b_roll`, `carrusel`).
3. **Síntesis Histórica de Fusión (`synthesizeReelsToScript`):**
   - Método anterior del nodo de síntesis que combinaba 2 reels en un guion.

---

## 5. DIAGNÓSTICO: ¿POR QUÉ LA IA GENERABA GUIONES GENÉRICOS O INCONEXOS?

La investigación detallada del código reveló 4 fallas concurrentes:

### 5.1. El Bug de la Promesa Asíncrona sin `await`
En `AiChatCardNode.tsx` (línea 164) y en `IntelligenceCanvasPage.tsx` (línea 687):
```typescript
// CÓDIGO ANTERIOR:
const profileContext = IntelligenceStorageService.loadProfileContext(businessId);
```
`loadProfileContext` es una función `async` que devuelve `Promise<UserProfileContext>`. Al no usar `await`, la variable contenía un objeto `Promise` pendiente.  
Cuando `AIProviderService` intentaba leer:
```typescript
const niche = profileContext?.profile?.niche || 'Servicios y Comercios';
const favoriteCta = profileContext?.cta_list?.find(...) || 'Comentá "INFO"...';
```
Como un `Promise` no tiene propiedades `.profile` ni `.cta_list`, evaluaba siempre a `undefined`. **La IA perdía por completo el nicho del negocio, sus reglas de tono y sus CTAs oficiales.**

### 5.2. Fallbacks con Texto Hardcodeado de Cartelería Digital
En `DynamicSynthesisEngine.ts` (líneas 60-100) y `AIProviderService.ts` (líneas 415-430 y 480-495), cuando un llamado de IA fallaba (por ejemplo, por límite de cuota o clave sin saldo), el sistema saltaba a un fallback determinístico que tenía texto fijo:
> *"¿Sabías por qué los locales que más venden ya no usan carteles fijos? ... pantalla vertical ... comentá PANTALLA"*.

Si el usuario conectaba un Reel sobre coches de bebé o pastelería, el fallback inyectaba forzosamente la temática de pantallas digitales.

### 5.3. Contexto por defecto anclado a Coaching / Finanzas
En `IntelligenceStorageService.ts` (línea 432-454), los valores por defecto del perfil incluían frases predeterminadas de coaching:
> *"beaacamposr"*, *"El dinero que no se mueve, no crece"*, *"Riqueza en movimiento"*.

Si un negocio no tenía un perfil explícitamente guardado en `localStorage`, la IA heredaba esas frases financieras.

### 5.4. Fabricación de métricas ficticias
En `IntelligenceCanvasPage.tsx` (línea 336-373), ante métricas no reportadas por la API de Meta, el código calculaba estimaciones con multiplicadores fijos:
```typescript
const views = reel.insights?.plays || Math.max(likes * 35, 140);
const saves = reel.insights?.saved || Math.round(likes * 0.25);
```
Esto creaba un benchmark artificial con datos inventados, distorsionando la detección de qué contenido funcionaba realmente.

---

## 6. DEUDA TÉCNICA Y DUPLICACIONES DETECTADAS

1. **Archivos duplicados en el repositorio:** Existen decenas de archivos con sufijo ` 2.*` creados por sincronización local de macOS (`App 2.tsx`, `Admin 2.tsx`, `Index 2.tsx`, `KioskAI 2.tsx`, `Register 2.tsx`, etc.). Requieren limpieza cuidadosa sin afectar los archivos maestros.
2. **Inconsistencia de tipos en métricas ausentes:** `metrics.views`, `metrics.reach` y `metrics.saves` utilizaban valores numéricos falsos (`0` o estimaciones) en lugar de representar explícitamente el estado `'no_disponible'` cuando Meta no los entrega.
3. **Desacoplamiento de la memoria:** El histórico de experimentos y aprendizajes no estaba consolidado en una entidad unificada (`Business Brain`).

---

## 7. PROPUESTA DE ARQUITECTURA FUTURA: "BUSINESS BRAIN"

La arquitectura debe desacoplar el conocimiento del negocio de los modelos de lenguaje. Claude, Gemini o GPT-4o son únicamente **motores de razonamiento temporales**; la **inteligencia estratégica reside en EventPix**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BUSINESS BRAIN                                 │
│  (Entidad de Memoria Permanente Aislada por Cuenta / Cliente)           │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Identidad de Negocio (Rubro, Misión, Propuesta de Valor, Oferta)    │
│ 2. Audiencia (Dolores, Deseos, Objeciones, Vocabulario)                 │
│ 3. Reglas de Marca (Tono, Reglas Inquebrantables, CTAs Favoritos)       │
│ 4. Content DNA Propio (Patrones Minados de Ganchos, Retención y Cierre) │
│ 5. Benchmark de Medianas (Views, Reach, Saves, Shares, Watch Time)      │
│ 6. Repositorio de Hipótesis (Activas, Validadas, Refutadas)             │
│ 7. Registro de Experimentos (Baseline vs Resultado Real Meta API)       │
│ 8. Memoria Permanente de Aprendizajes (Insights Acumulativos)          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Inyección de Contexto
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI ORCHESTRATION LAYER                              │
│       (Multi-IA: Claude 3.5 Sonnet / Gemini 1.5 / GPT-4o)               │
├─────────────────────────────────────────────────────────────────────────┤
│ - Protocolo Anti-Clichés y Cero Fabricación de Datos                    │
│ - Formulación de Hipótesis con Nivel de Confianza (Baja/Media/Alta)     │
│ - Generación de 3 Variantes de Guion (Probado, Alternativo, Creativo)   │
│ - Explicación Rigurosa: "¿Por qué te recomiendo esto?"                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEARNING LOOP (POST-PUBLICACIÓN)                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Meta API (Resultados) ──► Evaluación vs Mediana ──► Actualización Brain │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. PLAN DE IMPLEMENTACIÓN EN 12 FASES (ORDEN RIGUROSO)

* **FASE 1: Comprensión y normalización estricta de datos**
  * Eliminar toda fabricación de métricas (`likes * 35`, etc.).
  * Tipar explícitamente `'no_disponible'` cuando Meta no entregue insights.
  * Resolver definitivamente el bug de `loadProfileContext` asíncrono.
* **FASE 2: Business Brain persistente**
  * Estructura formal de datos para Identidad, Audiencia, Marca, Reglas y CTAs por cliente, sin datos hardcodeados.
* **FASE 3: Análisis estructurado de Reels**
  * Extracción de gancho, estructura y transcripción sin inventar información.
* **FASE 4: Benchmark interno de medianas puras**
  * Separación rigurosa de Discovery (Views/Reach), Engagement (Likes/Comments), Attention (Watch time) y Commercial Intent (Saves/Shares).
* **FASE 5: Content DNA empírico**
  * Minería de patrones con niveles de confianza basados en cantidad de muestra ($<3$, $3-5$, $\ge 6$).
* **FASE 6: Sistema de Hipótesis**
  * Formulación de hipótesis formales asociadas a evidencia observable.
* **FASE 7: Experimentos**
  * Creación y seguimiento de experimentos con captura de baseline de medianas.
* **FASE 8: Generación de guiones basada en evidencia**
  * Prompting anclado 100% al Business Brain y eliminación de fallbacks con texto hardcodeado.
* **FASE 9: Sincronización post-publicación**
  * Re-sincronización con Meta Graph API al publicar el Reel del experimento.
* **FASE 10: Evaluación automática**
  * Comparación contra el baseline y emisión de veredictos: Validada / Refutada / Inconclusa.
* **FASE 11: Learning Loop permanente**
  * Consolidación de aprendizajes en la memoria del negocio para que sobrevivan a futuras sesiones.
* **FASE 12: Arquitectura MCP / Tools**
  * Exposición de herramientas desacopladas (`get_business_context`, `get_content_dna`, `create_hypothesis`, etc.).

---
*Fin del Reporte de Auditoría. Listo para presentación y autorización antes de iniciar la Fase 1.*
