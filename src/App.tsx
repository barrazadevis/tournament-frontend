import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppNav } from './components/AppNav';
import { ModalProvider } from './components/ModalProvider';
import { HomePage } from './pages/HomePage';
import { ViewerPage } from './pages/ViewerPage';
import { JudgePage } from './pages/JudgePage';
import { TeamPortalPage } from './pages/TeamPortalPage';
import { TeamMatchPage } from './pages/TeamMatchPage';
import { QualifyingTeamPage } from './pages/QualifyingTeamPage';
import { SelectTournamentPage } from './pages/SelectTournamentPage';
import { TeamsListPage } from './pages/TeamsListPage';
import { ManageTournamentsPage } from './pages/ManageTournamentsPage';
import { SettingsPage } from './pages/SettingsPage';

/**
 * Rutas de la app. Cada rol tiene su propio prefijo:
 * - /                      -> inicio: crear torneo y generar los links
 * - /viewer/:tournamentId  -> proyector (solo lectura)
 * - /judge/:tournamentId   -> panel del profesor
 * - /team/:tournamentId    -> portal de equipo (registro + auto-routing)
 * - /match/:tournamentId/:matchId/:teamId -> pantalla de un match (a donde el portal redirige)
 * - /qualifying/:tournamentId/:teamId -> clasificatoria (a donde el portal redirige)
 * - /select-tournament/:destination -> elegir torneo antes de ir a viewer/team (usado por AppNav)
 * - /teams     -> registro global de equipos
 * - /tournaments -> gestionar torneos (renombrar, eliminar, reiniciar, agregar equipos a un DRAFT)
 * - /settings  -> placeholder, pendiente para futuras opciones
 *
 * `AppNav` es un menú persistente (Panel profesor / Panel usuario / Configuración)
 * montado sobre todas las rutas — todavía sin login, así que por ahora es
 * visible para cualquiera que abra la app (se resolverá con auth más adelante).
 */
export function App() {
  return (
    <ModalProvider>
      <BrowserRouter>
        <AppNav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/viewer/:tournamentId" element={<ViewerPage />} />
          <Route path="/judge/:tournamentId" element={<JudgePage />} />
          <Route path="/team/:tournamentId" element={<TeamPortalPage />} />
          <Route path="/match/:tournamentId/:matchId/:teamId" element={<TeamMatchPage />} />
          <Route path="/qualifying/:tournamentId/:teamId" element={<QualifyingTeamPage />} />
          <Route path="/select-tournament/:destination" element={<SelectTournamentPage />} />
          <Route path="/teams" element={<TeamsListPage />} />
          <Route path="/tournaments" element={<ManageTournamentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <p style={{ padding: '2rem', textAlign: 'center' }}>
                Ruta no encontrada. Pide el link correcto a tu profesor.
              </p>
            }
          />
        </Routes>
      </BrowserRouter>
    </ModalProvider>
  );
}
