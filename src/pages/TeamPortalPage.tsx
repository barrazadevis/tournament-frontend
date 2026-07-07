import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { teamStorageKey } from '../utils/teamStorage';
import { TEAM_LOGOS } from '../utils/teamLogos';
import { useModal } from '../components/ModalProvider';
import type { QualifyingRound, Tournament } from '../api/types';

interface StoredTeam {
  teamId: string;
  teamName: string;
}

interface PendingCode {
  teamId: string;
  teamName: string;
  code: string;
}

export function TeamPortalPage() {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const { alertModal } = useModal();
  const [stored, setStored] = useState<StoredTeam | null>(null);
  const [pendingCode, setPendingCode] = useState<PendingCode | null>(null);
  const [tournamentStatus, setTournamentStatus] = useState<Tournament['status'] | null>(null);
  const [mode, setMode] = useState<'new' | 'rejoin'>('new');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [members, setMembers] = useState(['']);
  const [logo, setLogo] = useState(TEAM_LOGOS[0]);
  const [rejoinCodeInput, setRejoinCodeInput] = useState('');
  const [registering, setRegistering] = useState(false);
  const [status, setStatus] = useState<{ icon: string; title: string; detail: string; spinner?: boolean } | null>(
    null,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(teamStorageKey(tournamentId));
    if (raw) setStored(JSON.parse(raw));
  }, [tournamentId]);

  useEffect(() => {
    let cancelled = false;
    apiGet<Tournament>(`/tournaments/${tournamentId}`)
      .then((data) => {
        if (cancelled) return;
        setTournamentStatus(data.status);
        if (data.status !== 'DRAFT') setMode('rejoin');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!stored) return;
    const run = () => checkStatus(stored.teamId).catch(() => {});
    run();
    pollRef.current = setInterval(run, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  const checkStatus = async (teamId: string) => {
    try {
      const qualifying = await apiGet<QualifyingRound>(`/tournaments/${tournamentId}/qualifying-round`);
      if (qualifying.participantTeamIds.includes(teamId)) {
        stopPolling();
        navigate(`/qualifying/${tournamentId}/${teamId}`);
        return;
      }
    } catch {
      // No hay clasificatoria activa — seguimos al bracket.
    }

    const tournament = await apiGet<Tournament>(`/tournaments/${tournamentId}`);

    if (tournament.rounds.length === 0) {
      setStatus({ icon: '⏳', title: 'Esperando al profesor', detail: 'Aún no se ha iniciado el torneo.', spinner: true });
      return;
    }

    const latestRound = tournament.rounds[tournament.rounds.length - 1];
    const match = latestRound.matches.find((m) => m.teamAId === teamId || m.teamBId === teamId);

    if (match) {
      if (match.status !== 'RESOLVED') {
        stopPolling();
        navigate(`/match/${tournamentId}/${match.id}/${teamId}`);
        return;
      }
      if (match.winnerId === teamId) {
        setStatus({
          icon: '🎉',
          title: '¡Ganaron su match!',
          detail: 'Esperando a que el profesor arme la siguiente ronda.',
          spinner: true,
        });
      } else {
        stopPolling();
        setStatus({ icon: '👋', title: 'Quedaron eliminados', detail: 'Gracias por participar. ¡Buen trabajo!' });
      }
      return;
    }

    stopPolling();
    if (tournament.status === 'FINISHED') {
      const finalMatch = latestRound.matches[0];
      if (finalMatch?.winnerId === teamId) {
        setStatus({ icon: '🏆', title: '¡Son los campeones del torneo!', detail: '¡Felicitaciones!' });
      } else {
        setStatus({ icon: '🏁', title: 'El torneo terminó', detail: 'Gracias por participar.' });
      }
    } else {
      setStatus({
        icon: '👋',
        title: 'Quedaron eliminados',
        detail: 'Su equipo no avanzó a esta ronda. ¡Gracias por participar!',
      });
    }
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleRegister = async () => {
    if (tournamentStatus && tournamentStatus !== 'DRAFT') {
      await alertModal('Este torneo ya inició. No se pueden registrar equipos nuevos.');
      return;
    }
    const name = teamNameInput.trim();
    const memberNames = members.map((m) => m.trim()).filter(Boolean);
    if (!name) {
      await alertModal('Escribe el nombre de tu equipo.');
      return;
    }
    if (memberNames.length === 0) {
      await alertModal('Agrega al menos un integrante.');
      return;
    }

    setRegistering(true);
    try {
      const team = await apiPost<{ id: string; name: string; code: string }>('/teams', {
        name,
        memberNames,
        logo,
      });
      setPendingCode({ teamId: team.id, teamName: team.name, code: team.code });
    } catch (error) {
      setRegistering(false);
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo registrar el equipo.');
    }
  };

  const confirmPendingCode = () => {
    if (!pendingCode) return;
    const newStored = { teamId: pendingCode.teamId, teamName: pendingCode.teamName };
    localStorage.setItem(teamStorageKey(tournamentId), JSON.stringify(newStored));
    setPendingCode(null);
    setStored(newStored);
  };

  const handleRejoin = async () => {
    const code = rejoinCodeInput.trim();
    if (!code) {
      await alertModal('Escribe el código de tu equipo.');
      return;
    }

    setRegistering(true);
    try {
      const team = await apiPost<{ id: string; name: string }>('/teams/rejoin', { code });
      const newStored = { teamId: team.id, teamName: team.name };
      localStorage.setItem(teamStorageKey(tournamentId), JSON.stringify(newStored));
      setStored(newStored);
    } catch (error) {
      setRegistering(false);
      await alertModal(
        error instanceof ApiError
          ? 'No encontramos un equipo con ese código. Si es la primera vez que se registran, usa la pestaña "Equipo nuevo".'
          : 'No se pudo buscar el equipo.',
      );
    }
  };

  const handleSwitchTeam = () => {
    localStorage.removeItem(teamStorageKey(tournamentId));
    setStored(null);
    setPendingCode(null);
    setStatus(null);
    setRegistering(false);
    stopPolling();
  };

  if (!tournamentId) {
    return <p style={{ padding: '2rem' }}>Este link no tiene un tournamentId válido.</p>;
  }

  return (
    <div className="screen">
      <AppHeader />

      {pendingCode ? (
        <div className="card">
          <h2>¡Equipo registrado! 🎉</h2>
          <p>
            Este es el <strong>código único</strong> de "{pendingCode.teamName}" — solo ustedes y el profesor lo
            conocen. Anótalo: lo van a necesitar para volver a entrar si cierran esta pantalla o cambian de
            dispositivo.
          </p>
          <div className="team-code-reveal">{pendingCode.code}</div>
          <button className="submit-btn" onClick={confirmPendingCode}>
            Ya lo anoté, continuar
          </button>
        </div>
      ) : !stored ? (
        <div className="card">
          <div className="entry-tabs">
            <button
              type="button"
              className={`entry-tab${mode === 'new' ? ' active' : ''}`}
              onClick={() => setMode('new')}
            >
              Equipo nuevo
            </button>
            <button
              type="button"
              className={`entry-tab${mode === 'rejoin' ? ' active' : ''}`}
              onClick={() => setMode('rejoin')}
            >
              Ya me registré
            </button>
          </div>

          {mode === 'new' && tournamentStatus && tournamentStatus !== 'DRAFT' ? (
            <>
              <h2>Registra a tu equipo</h2>
              <div className="status-banner rejected">
                Este torneo ya inició — no se pueden registrar equipos nuevos. Si ya se habían
                registrado antes, usa la pestaña "Ya me registré".
              </div>
            </>
          ) : mode === 'new' ? (
            <>
              <h2>Registra a tu equipo</h2>
              <label>Nombre del equipo</label>
              <input
                type="text"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                placeholder="Los Refactorizadores"
              />

              <label>Elige un logo para tu equipo</label>
              <div className="logo-picker">
                {TEAM_LOGOS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`logo-option${logo === option ? ' selected' : ''}`}
                    onClick={() => setLogo(option)}
                    aria-label={`Elegir logo ${option}`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <label>Integrantes</label>
              {members.map((member, index) => (
                <div className="member-row" key={index}>
                  <input
                    type="text"
                    value={member}
                    placeholder="Nombre del integrante"
                    onChange={(e) => {
                      const next = [...members];
                      next[index] = e.target.value;
                      setMembers(next);
                    }}
                  />
                </div>
              ))}
              <button className="add-member-btn" type="button" onClick={() => setMembers([...members, ''])}>
                + Agregar integrante
              </button>

              <button className="submit-btn" disabled={registering} onClick={handleRegister}>
                Registrarme
              </button>
            </>
          ) : (
            <>
              <h2>Entra a tu equipo</h2>
              <div className="hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
                Escribe el código único que les mostramos al registrarse — se los mostramos una
                sola vez, y solo su equipo y el profesor lo conocen.
              </div>
              <label>Código de equipo</label>
              <input
                type="text"
                value={rejoinCodeInput}
                onChange={(e) => setRejoinCodeInput(e.target.value.toUpperCase())}
                placeholder="XK7M2P"
                className="team-code-input"
              />

              <button className="submit-btn" disabled={registering} onClick={handleRejoin}>
                Entrar
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="status-screen card">
          <div className="status-icon">{status?.icon ?? '⏳'}</div>
          <div className="status-title">{status?.title ?? 'Buscando tu match…'}</div>
          <div className="status-detail">{status?.detail ?? ''}</div>
          {status?.spinner && <div className="spinner" />}
        </div>
      )}

      <button className="switch-team" onClick={handleSwitchTeam}>
        ¿No eres este equipo? Cambiar
      </button>
    </div>
  );
}
