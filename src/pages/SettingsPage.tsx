import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { useModal } from '../components/ModalProvider';
import { useAuth } from '../components/AuthProvider';
import type { AuthUser } from '../api/types';

export function SettingsPage() {
  const { alertModal, confirmModal, promptModal } = useModal();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<'users' | 'add'>('users');
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const data = await apiGet<AuthUser[]>('/users');
    setUsers(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    const email = newEmail.trim();
    if (!email || newPassword.length < 8) {
      await alertModal('Escribe un email y una contraseña de al menos 8 caracteres.');
      return;
    }
    setCreating(true);
    try {
      await apiPost('/users', { email, password: newPassword });
      setNewEmail('');
      setNewPassword('');
      await refresh();
      setTab('users');
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo crear el usuario.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditEmail = async (u: AuthUser) => {
    const email = await promptModal('Nuevo email:', { defaultValue: u.email });
    if (!email || email === u.email) return;
    try {
      await apiPatch(`/users/${u.id}`, { email });
      await refresh();
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo actualizar el email.');
    }
  };

  const handleChangePassword = async (u: AuthUser) => {
    const password = await promptModal(`Nueva contraseña para ${u.email} (mínimo 8 caracteres):`);
    if (!password) return;
    if (password.length < 8) {
      await alertModal('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      await apiPatch(`/users/${u.id}`, { password });
      await alertModal('Contraseña actualizada.');
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo actualizar la contraseña.');
    }
  };

  const handleDelete = async (u: AuthUser) => {
    const confirmed = await confirmModal(`¿Eliminar el acceso de "${u.email}" al panel profesor?`, {
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/users/${u.id}`);
      await refresh();
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo eliminar el usuario.');
    }
  };

  return (
    <div className="screen">
      <AppHeader subtitle="Configuración" />

      <div className="card">
        <div className="entry-tabs">
          <button type="button" className={`entry-tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
            Usuarios
          </button>
          <button type="button" className={`entry-tab${tab === 'add' ? ' active' : ''}`} onClick={() => setTab('add')}>
            Agregar profesor
          </button>
        </div>

        {tab === 'users' ? (
          <>
            <p className="hint" style={{ marginBottom: '1.25rem' }}>
              Cualquier usuario aquí puede entrar a Panel profesor y Configuración.
            </p>

            {users === null ? (
              <p>Cargando…</p>
            ) : (
              <div className="tournament-admin-list">
                {users.map((u) => (
                  <div key={u.id} className="tournament-admin-card card">
                    <div className="tournament-admin-top">
                      <div>
                        <div className="tournament-admin-name">
                          {u.email}
                          {currentUser?.id === u.id && ' (tú)'}
                        </div>
                      </div>
                      <div className="tournament-admin-actions">
                        <button className="add-member-btn" onClick={() => handleEditEmail(u)}>
                          Editar email
                        </button>
                        <button className="add-member-btn" onClick={() => handleChangePassword(u)}>
                          Cambiar contraseña
                        </button>
                        <button className="btn-reject" onClick={() => handleDelete(u)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <label>Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="colega@colegio.edu"
            />
            <label>Contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <button className="submit-btn" disabled={creating} onClick={handleCreate}>
              Agregar usuario
            </button>
          </>
        )}
      </div>
    </div>
  );
}
