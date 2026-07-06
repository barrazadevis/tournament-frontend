# Contexto del proyecto — Torneo TGA (Frontend)

## Rol esperado
Actúa como Desarrollador de Software Senior: aplica SOLID, DRY, KISS, YAGNI;
explica el razonamiento antes de codificar; señala trade-offs; prioriza
mantenibilidad sobre cleverness.

## Qué es esto
Frontend de un torneo de eliminación para una dinámica de clase. Repo
independiente del backend (`tournament-domain`, NestJS + Socket.IO,
`http://localhost:3000` en desarrollo). Se comunica vía REST + Socket.IO,
configurado por `VITE_API_URL` en `.env`.

## Por qué React + Vite (no Angular)
Se evaluó explícitamente con el usuario. Angular se descartó por
sobre-ingeniería (YAGNI) para 5 pantallas con estado simple — no hay
ganancia real de "imitar" el DI del backend NestJS en el frontend.

## Estructura
```
src/
├── api/           # client.ts (REST), socket.ts (namespaces), types.ts
├── components/    # CountdownRing (elemento de diseño distintivo)
├── hooks/         # useTeams (resuelve nombres por id)
├── pages/         # Una por rol/ruta (ver tabla abajo)
└── utils/         # formatSeconds
```

## Rutas y roles
| Ruta | Página | Quién la usa |
|---|---|---|
| `/` | `HomePage` | Profesor: crea el torneo, obtiene los 3 links |
| `/judge/:tournamentId` | `JudgePage` | Profesor: inicia torneo, juzga, avanza rondas |
| `/team/:tournamentId` | `TeamPortalPage` | Un solo link para toda la clase — auto-registro + auto-routing |
| `/match/:tournamentId/:matchId/:teamId` | `TeamMatchPage` | A donde el portal redirige (no se comparte manualmente) |
| `/qualifying/:tournamentId/:teamId` | `QualifyingTeamPage` | A donde el portal redirige si hace falta clasificatoria |
| `/viewer/:tournamentId` | `ViewerPage` | Proyector del salón |

Nunca repartas manualmente links de `/match/...` o `/qualifying/...` — el
`TeamPortalPage` los resuelve solo consultando el estado del torneo
(polling cada 4s + WebSocket) y usando `useNavigate()`.

## Decisiones no obvias

1. **`localStorage` por torneo** (`tournament_team_{tournamentId}`): guarda
   `{teamId, teamName}` para que un equipo no tenga que re-registrarse si
   cierra y reabre el link. Esto es un frontend real (no un artifact de
   Claude.ai) — `localStorage` es seguro de usar aquí.

2. **React escapa por defecto.** A diferencia de una versión HTML/JS
   vanilla anterior de este proyecto (que necesitaba una función
   `escapeHtml` manual), JSX escapa el contenido automáticamente. No uses
   `dangerouslySetInnerHTML` para texto de submissions de estudiantes.

3. **`CountdownRing` es controlado por props**, no tiene estado propio de
   tiempo — el padre (`ViewerPage`, `JudgePage`, `TeamMatchPage`) mantiene
   `remainingSeconds` actualizado vía el evento `timer_tick` del socket.

4. **Timer server-side.** El backend es la única fuente de verdad del
   countdown (`MatchTimerService` allá). El frontend solo escucha
   `timer_tick` — no calcula su propio countdown salvo como estimado
   inicial mientras llega el primer tick.

## Testing
Todavía no tiene suite de tests propia (a diferencia del backend, que
tiene 44 tests). Si agregas lógica no trivial aquí, considera si amerita
tests (Vitest + React Testing Library serían la elección natural, aún no
instaladas).

## Estado actual / pendiente
- ✅ Las 6 páginas funcionando, verificado con smoke tests reales
  (backend + frontend corriendo juntos, CORS confirmado).
- ⏳ Deploy (Vercel/Netlify sugerido, no hecho todavía) — falta configurar
  `VITE_API_URL` apuntando al backend en producción.
- ⏳ Sin tests automatizados propios todavía.
