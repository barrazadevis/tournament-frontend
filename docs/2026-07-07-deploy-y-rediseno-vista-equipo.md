# Registro de sesión — Deploy a producción + rediseño de la vista de equipo

**Fecha:** 2026-07-07
**Repos involucrados:** `tournament-domain-backend` (Render) y `tournament-frontend` (Vercel).

Este documento resume lo que se hizo, por qué, y en qué archivo quedó cada
cambio. Pensado para retomar el contexto si se pierde el chat.

---

## 1. Plan de despliegue (bajo costo)

Arquitectura elegida y por qué:

- **Backend → Render**, porque usa Socket.IO con conexiones persistentes
  (WebSockets long-running), lo cual no encaja con funciones serverless
  tipo Vercel/Netlify Functions.
- **Frontend → Vercel**, build estático de Vite, sin necesidad de servidor
  propio.

### Fixes aplicados al backend para poder desplegarlo

Antes de estos cambios, el backend solo estaba pensado para correr en
local con `ts-node`. Archivos tocados en `tournament-domain-backend`:

| Archivo | Cambio | Por qué |
|---|---|---|
| `src/infrastructure/http/main.ts` | `app.listen(process.env.PORT ?? 3000)` | Render asigna el puerto por variable de entorno; estaba hardcodeado en 3000. |
| `package.json` | Agregado `engines.node: ">=22.5.0"` | El backend usa `node:sqlite`, que requiere Node 22.5+ exacto (versiones intermedias de la rama 22 no lo traen). |
| `package.json` | Agregados scripts `build` y `start` | Solo existía `dev` (ts-node). `build` compila con `tsconfig.build.json` y copia `schema.sql` a `dist` (paso extra necesario, ver abajo). `start` corre `node dist/infrastructure/http/main.js`. |
| `tsconfig.build.json` (nuevo) | Build de producción que compila solo `src` (excluye `test/`) | Sin tocar el `tsconfig.json` original, que sigue usando `ts-jest` para los tests. |
| `src/infrastructure/persistence/sqlite/database.ts` | (sin cambios directos, pero se detectó el problema) | `tsc` no copia archivos `.sql`, así que `schema.sql` no llegaba a `dist`. El script de `build` ahora lo copia explícitamente con `fs.copyFileSync`. |

Verificado con: `npm run build` limpio, arranque real del binario compilado
con `PORT` custom, y `npm test` → **88 tests en verde** (sin regresiones).

### Disco persistente (Render)

Decisión: usar disco persistente en vez de aceptar que SQLite se resetee
en cada redeploy.

- **Costo real**: Render exige plan pago para adjuntar disco — mínimo
  **Starter (~$7/mes)** + disco 1GB (~$0.25/mes) ≈ **$7.25/mes total**
  (antes era $0 en el free tier). Bono: el plan Starter tampoco duerme por
  inactividad (a diferencia del free tier), así que de paso se resuelve el
  cold start.
- **Cambio de código**: `src/infrastructure/http/app.module.ts` — la
  conexión a SQLite ahora lee `process.env.DB_PATH ?? join(process.cwd(), 'tournament.db')`
  en vez de una ruta hardcodeada. En local sigue funcionando igual (sin la
  variable); en Render se configura `DB_PATH=/var/data/tournament.db`
  apuntando al disco montado.
- **Pasos en Render**: crear el disco desde la pestaña *Disks* del web
  service (`Name: tournament-data`, `Mount Path: /var/data`, `Size: 1GB`),
  y agregar la env var `DB_PATH` con esa misma ruta.

### Por qué NO se commiteó `tournament.db`

Se consideró y se descartó: el disco free de Render no garantiza
persistencia ni siquiera entre restarts (más allá de los redeploys), así
que commitear el archivo no resuelve nada — solo se volvería a un snapshot
viejo fijo en cada reinicio. Además, un binario SQLite en git no se puede
diffear ni mergear. La solución real fue el disco persistente de Render
(sección anterior). `tournament.db` sigue sin trackear en git.

---

## 2. Problemas encontrados durante el despliegue real (y sus causas)

### 2.1 — 404 en rutas directas del frontend (`/team/...`, `/judge/...`)

**Síntoma:** abrir `https://<dominio>.vercel.app/` funcionaba, pero pegar
directamente un link como `/team/:id` en una pestaña nueva daba
`404: NOT_FOUND`.

**Causa:** el frontend usa `BrowserRouter` (React Router client-side). Al
navegar dentro de la app funciona porque React Router intercepta la
navegación, pero al pedir la URL directamente, Vercel busca un archivo
físico en esa ruta (no existe) y devuelve 404 antes de que React llegue a
cargarse.

**Fix:** se creó `vercel.json` en la raíz de `tournament-frontend`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Esto hace que cualquier ruta no-estática caiga en `index.html`, dejando
que React Router resuelva la URL en el cliente.

**Gotcha adicional:** el commit con este fix se había hecho en la rama
`develop` y se pusheó a `origin/develop`, pero el proyecto de Vercel
despliega producción desde `main`. Se hizo *fast-forward merge* de
`develop` a `main` y push (`git checkout main && git merge origin/develop
&& git push origin main`) para que el fix llegara a producción.

### 2.2 — Link de "producción" pedía login de Vercel

**Síntoma:** una de las URLs (con hash tipo
`tournament-frontend-d9uur3oud-....vercel.app`) redirigía al login de
Vercel en vez de mostrar la app.

**Causa:** esa URL era un **deployment de preview** (uno por commit/rama),
y Vercel protege los previews por defecto con "Vercel Authentication".
Cualquiera sin sesión en esa cuenta de Vercel es redirigido al login. No
es un bug, es el comportamiento esperado de un preview.

**Fix / regla operativa:** para la dinámica de clase, **siempre generar y
repartir los links desde el dominio de producción estable**
(`tournament-frontend-ashen.vercel.app`), nunca desde una URL de preview
de una rama. Si en el futuro se necesita que los previews sean públicos,
es: Vercel → Project → **Settings → Deployment Protection** → desactivar
"Vercel Authentication" para Preview, o generar un link de bypass.

---

## 3. Rediseño de la vista de equipo (escribir y enviar solución)

Aplicado a **dos páginas** con el mismo patrón de interacción (ambas
"escribe pseudocódigo y envía"):
- `src/pages/TeamMatchPage.tsx` (`/match/:tournamentId/:matchId/:teamId`)
- `src/pages/QualifyingTeamPage.tsx` (`/qualifying/:tournamentId/:teamId`)

### Layout de dos columnas

Antes: todo en una sola columna angosta (`max-width: 560px`), caso y
editor apilados verticalmente.

Ahora:
- `.team-screen` se amplió a `max-width: 1100px`.
- Nuevo grid `.match-layout` → `.match-info` (columna izquierda, angosta,
  con el enunciado del caso) + `.match-editor` (columna derecha, ocupa el
  resto del ancho, con el textarea).
- Se apila a una sola columna en pantallas `<760px`.
- `.match-info` usa `position: sticky` en pantallas anchas: si la
  solución es larga y hay scroll, el enunciado del caso se mantiene
  visible.

### Editor de la solución

- Tamaño aumentado (`min-height: 560px`, antes 420px).
- **Ya no se puede redimensionar a mano** (`resize: none`) — en su lugar,
  scroll automático en ambos ejes (`overflow: auto`) cuando el contenido
  lo requiere. Para que el scroll horizontal tenga sentido, el texto ya
  no hace *word-wrap* forzado: `white-space: pre` + atributo HTML
  `wrap="off"` en el `<textarea>` (necesario en ambos para que funcione
  de forma consistente entre navegadores).
- Fuente monoespaciada (`var(--font-display)`, o sea `JetBrains Mono`, ya
  definida en el sistema de diseño para el countdown) — mejora la
  legibilidad del pseudocódigo indentado.
- Scrollbar estilizada con los tokens de marca existentes: track en
  `var(--track)`, thumb en `var(--navy-soft)` (oscurece a `var(--navy)`
  en hover), esquinas redondeadas con `var(--radius-sm)`. Cubre
  `::-webkit-scrollbar` (Chrome/Edge/Safari) y `scrollbar-color`/
  `scrollbar-width` (Firefox).

### Botón de envío y hint

- Antes: hint arriba, botón full-width debajo.
- Ahora: fila `.editor-footer` (flex, `justify-content: space-between`) —
  hint a la izquierda (con contador de caracteres en vivo, `content.length`,
  sin estado nuevo) y botón a la derecha, con ancho de contenido en vez de
  estirado. Se apila de nuevo en pantallas `<520px` para no romper mobile.

### Verificación

Se levantó el flujo real (backend + frontend + un torneo de prueba creado
vía API) y se confirmó visualmente en desktop (1440px) y mobile (375px)
con Playwright headless, sin errores de consola. No se dejaron servidores
de prueba corriendo.

---

## 4. Archivos modificados (resumen rápido)

**`tournament-domain-backend`:**
- `src/infrastructure/http/main.ts`
- `src/infrastructure/http/app.module.ts`
- `package.json`
- `tsconfig.build.json` (nuevo)

**`tournament-frontend`:**
- `vercel.json` (nuevo)
- `src/index.css`
- `src/pages/TeamMatchPage.tsx`
- `src/pages/QualifyingTeamPage.tsx`

## 5. Pendientes / a tener en cuenta

- Repetir la verificación end-to-end (WebSocket, countdown en vivo,
  persistencia tras restart) el mismo día del torneo real, no solo al
  desplegar.
- Confirmar en el dashboard de Render que el disco quedó montado y
  `DB_PATH` apunta bien antes de dar por sentada la persistencia.
- Recordar generar los links del torneo siempre desde el dominio de
  producción de Vercel, nunca desde un preview.
