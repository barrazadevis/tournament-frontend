# Torneo TGA — Frontend

Repo independiente del backend (`tournament-domain`). React + Vite + TypeScript.

## Configuración

```bash
cp .env.example .env
# Edita .env si el backend no corre en http://localhost:3000
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Rutas

| Rol | Ruta | Quién la abre |
|---|---|---|
| Equipo (portal) | `/team/:tournamentId` | Cada equipo — se auto-registra y la app los redirige solos |
| Juez | `/judge/:tournamentId` | El profesor |
| Proyector | `/viewer/:tournamentId` | El proyector del salón |

Las rutas `/match/:tournamentId/:matchId/:teamId` y `/qualifying/:tournamentId/:teamId` no
se comparten manualmente — el portal de equipo redirige a ellas solo.

## Notas de arquitectura

- `src/api/client.ts` — fetch REST, usa `VITE_API_URL` del `.env`.
- `src/api/socket.ts` — conexión a los namespaces `/team`, `/judge`, `/viewer`
  del backend (Socket.IO).
- `src/api/types.ts` — tipos que reflejan los contratos JSON del backend.
  Si cambias un DTO o el `TournamentPresenter` en el backend, actualiza aquí.
- React escapa el contenido por defecto (a diferencia de la versión HTML
  vanilla anterior, que necesitaba una función `escapeHtml` manual) — no
  hace falta preocuparse por XSS al renderizar texto de submissions.

## Deploy

Este repo se despliega independiente del backend (ej. Vercel/Netlify para
esto, Render para el backend). Solo necesitas configurar `VITE_API_URL` en
las variables de entorno del hosting para que apunte a la URL pública del
backend — y asegurarte de que el backend tenga CORS habilitado para el
dominio del frontend (ya está habilitado con `origin: '*'`, ajústalo a un
dominio específico en producción si quieres restringirlo).
