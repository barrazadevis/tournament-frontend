import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../components/AuthProvider';
import { useModal } from '../components/ModalProvider';

export function LoginPage() {
  const { bootstrap, login } = useAuth();
  const { alertModal } = useModal();
  const navigate = useNavigate();

  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<{ initialized: boolean }>('/auth/status')
      .then((res) => setInitialized(res.initialized))
      .catch(() => setInitialized(true));
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      await alertModal('Completa email y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      if (initialized) {
        await login(email.trim(), password);
      } else {
        await bootstrap(email.trim(), password);
      }
      navigate('/');
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  if (initialized === null) {
    return (
      <div className="screen">
        <AppHeader subtitle="Acceso profesor" />
      </div>
    );
  }

  return (
    <div className="screen">
      <AppHeader subtitle="Acceso profesor" />
      <div className="card">
        <h2>{initialized ? 'Iniciar sesión' : 'Crear tu cuenta de profesor'}</h2>
        {!initialized && (
          <p className="hint" style={{ marginBottom: '1.25rem' }}>
            Todavía no hay ningún usuario registrado — la primera cuenta que crees aquí tendrá acceso al panel
            profesor y a configuración.
          </p>
        )}

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="profesor@colegio.edu"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={initialized ? '' : 'Mínimo 8 caracteres'}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        <button className="submit-btn" disabled={submitting} onClick={handleSubmit}>
          {initialized ? 'Entrar' : 'Crear cuenta y entrar'}
        </button>
      </div>
    </div>
  );
}
