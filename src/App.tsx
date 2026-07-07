import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppNav } from './components/AppNav';
import { ModalProvider } from './components/ModalProvider';
import { AuthProvider } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
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
import { LoginPage } from './pages/LoginPage';

/**
 * Rutas de la app. Cada rol tiene su propio prefijo:
 * - /                      -> inicio: crear torneo y generar los links
 * - /viewer/:tournamentId  -> proyector (solo lectura)
 * - /judge/:tournamentId   -> panel del profesor
 * - /team/:tournamentId    -> portal de equipo (registro + auto-routing)
 * - /match/:tournamentId/:matchId/:teamId -> pantalla de un match (a donde el portal redirige)
 * - /qualifying/:tournamentId/:teamId -> clasificatoria (a donde el portal redirige)
 * - /select-tournament/:destination -> elegir torneo antes de ir a viewer/team (usado por AppNav)
 * - /teams     -> registro global de equipos (protegida)
 * - /tournaments -> gestionar torneos (renombrar, eliminar, reiniciar, agregar equipos a un DRAFT) (protegida)
 * - /settings  -> gestión de usuarios con acceso al panel (protegida)
 * - /login     -> acceso profesor (bootstrap del primer usuario o login normal)
 *
 * `AppNav` es un menú persistente (Panel profesor / Panel usuario / Configuración)
 * montado sobre todas las rutas. Panel profesor y Configuración requieren
 * sesión (`ProtectedRoute` + `AuthProvider`) — el proyector (`/viewer`) y el
 * portal de equipos siguen públicos a propósito (decisión explícita: el
 * proyector es una pantalla de solo lectura para toda la clase, no una
 * herramienta de gestión).
 */
export function App() {
  return (
    <ModalProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppNav />
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route path="/viewer/:tournamentId" element={<ViewerPage />} />
            <Route
              path="/judge/:tournamentId"
              element={
                <ProtectedRoute>
                  <JudgePage />
                </ProtectedRoute>
              }
            />
            <Route path="/team/:tournamentId" element={<TeamPortalPage />} />
            <Route path="/match/:tournamentId/:matchId/:teamId" element={<TeamMatchPage />} />
            <Route path="/qualifying/:tournamentId/:teamId" element={<QualifyingTeamPage />} />
            <Route path="/select-tournament/:destination" element={<SelectTournamentPage />} />
            <Route
              path="/teams"
              element={
                <ProtectedRoute>
                  <TeamsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournaments"
              element={
                <ProtectedRoute>
                  <ManageTournamentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="*"
              element={
                <p style={{ padding: '2rem', textAlign: 'center' }}>
                  Ruta no encontrada. Pide el link correcto a tu profesor.
                </p>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ModalProvider>
  );
}
