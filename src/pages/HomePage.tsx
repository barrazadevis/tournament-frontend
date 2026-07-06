import { useState } from 'react';
import { apiPost, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { useModal } from '../components/ModalProvider';

interface CreatedTournament {
  id: string;
  name: string;
}

export function HomePage() {
  const { alertModal } = useModal();
  const [nameInput, setNameInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [tournament, setTournament] = useState<CreatedTournament | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = nameInput.trim();
    if (!name) {
      await alertModal('Escribe un nombre para el torneo.');
      return;
    }
    setCreating(true);
    try {
      const created = await apiPost<CreatedTournament>('/tournaments', { name });
      setTournament(created);
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo crear el torneo.');
    } finally {
      setCreating(false);
    }
  };

  const links = tournament
    ? {
        team: `${window.location.origin}/team/${tournament.id}`,
        judge: `${window.location.origin}/judge/${tournament.id}`,
        viewer: `${window.location.origin}/viewer/${tournament.id}`,
      }
    : null;

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="screen">
      <AppHeader />

      {!tournament ? (
        <div className="card">
          <h2>Crear un nuevo torneo</h2>
          <label>Nombre del torneo</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Torneo Eliminatorio de Casos - Grupo A"
          />
          <button className="submit-btn" disabled={creating} onClick={handleCreate}>
            Crear torneo
          </button>
        </div>
      ) : (
        <div className="card">
          <h2>"{tournament.name}" creado ✅</h2>
          <p className="hint" style={{ marginBottom: '1.25rem' }}>
            Comparte estos links con cada audiencia:
          </p>

          <LinkRow
            label="Link para los equipos (uno solo para toda la clase)"
            value={links!.team}
            copied={copiedKey === 'team'}
            onCopy={() => copy('team', links!.team)}
          />
          <LinkRow
            label="Panel del juez (tú)"
            value={links!.judge}
            copied={copiedKey === 'judge'}
            onCopy={() => copy('judge', links!.judge)}
          />
          <LinkRow
            label="Proyector del salón"
            value={links!.viewer}
            copied={copiedKey === 'viewer'}
            onCopy={() => copy('viewer', links!.viewer)}
          />

          <a
            className="submit-btn"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            href={links!.judge}
          >
            Ir al panel del juez para registrar equipos e iniciar
          </a>
        </div>
      )}
    </div>
  );
}

function LinkRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input type="text" readOnly value={value} style={{ marginBottom: 0 }} />
        <button className="btn-approve" style={{ whiteSpace: 'nowrap' }} onClick={onCopy}>
          {copied ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
