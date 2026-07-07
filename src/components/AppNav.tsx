import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

type MenuKey = 'profesor' | 'usuario' | null;

const PROFESOR_ITEMS = [
  { to: '/', label: 'Crear torneo' },
  { to: '/tournaments', label: 'Ver torneos' },
  { to: '/teams', label: 'Ver equipos' },
];

const USUARIO_ITEMS = [{ to: '/select-tournament/team', label: 'Portal de equipo' }];

const PROFESOR_PREFIXES = ['/', '/judge', '/teams', '/tournaments'];
const USUARIO_PREFIXES = ['/team/', '/match', '/qualifying'];

export function AppNav() {
  const [open, setOpen] = useState<MenuKey>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const { status, user, logout } = useAuth();
  const isAuthenticated = status === 'authenticated';

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => setOpen(null), [location.pathname]);

  const toggle = (key: Exclude<MenuKey, null>) => setOpen((prev) => (prev === key ? null : key));
  const isProfesorActive = PROFESOR_PREFIXES.some((p) => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)));
  const isUsuarioActive = USUARIO_PREFIXES.some((p) => location.pathname.startsWith(p));

  return (
    <nav className="app-nav" ref={navRef}>
      <div className="app-nav-bar">
        <div className="app-nav-left">
          <button type="button" className="app-nav-back" onClick={() => navigate(-1)} aria-label="Volver">
            ← Atrás
          </button>
          <span className="app-nav-brand">Torneo TGA</span>
        </div>

        <div className="app-nav-items">
          {isAuthenticated && (
            <div className="app-nav-menu">
              <button
                type="button"
                className={`app-nav-item${isProfesorActive ? ' current' : ''}${open === 'profesor' ? ' open' : ''}`}
                onClick={() => toggle('profesor')}
              >
                Panel profesor <span className="app-nav-caret">▾</span>
              </button>
              {open === 'profesor' && (
                <div className="app-nav-dropdown">
                  {PROFESOR_ITEMS.map((item) => (
                    <Link key={item.to} to={item.to} className="app-nav-dropdown-item">
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="app-nav-menu">
            <button
              type="button"
              className={`app-nav-item${isUsuarioActive ? ' current' : ''}${open === 'usuario' ? ' open' : ''}`}
              onClick={() => toggle('usuario')}
            >
              Panel usuario <span className="app-nav-caret">▾</span>
            </button>
            {open === 'usuario' && (
              <div className="app-nav-dropdown">
                {USUARIO_ITEMS.map((item) => (
                  <Link key={item.to} to={item.to} className="app-nav-dropdown-item">
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            className={`app-nav-item${location.pathname === '/select-tournament/viewer' ? ' current' : ''}`}
            to="/select-tournament/viewer"
          >
            Ver torneo
          </Link>

          {isAuthenticated && (
            <Link className={`app-nav-item${location.pathname === '/settings' ? ' current' : ''}`} to="/settings">
              Configuración
            </Link>
          )}

          {isAuthenticated ? (
            <button
              type="button"
              className="app-nav-item"
              title={user?.email}
              onClick={() => {
                void logout();
                navigate('/login');
              }}
            >
              Cerrar sesión
            </button>
          ) : (
            <Link className={`app-nav-item${location.pathname === '/login' ? ' current' : ''}`} to="/login">
              Acceso profesor
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
