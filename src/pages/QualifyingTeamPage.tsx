import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { useTeams } from '../hooks/useTeams';
import { teamStorageKey } from '../utils/teamStorage';
import type { QualifyingRound } from '../api/types';

export function QualifyingTeamPage() {
  const { tournamentId = '', teamId = '' } = useParams();
  const navigate = useNavigate();
  const { teamName } = useTeams();
  const [round, setRound] = useState<QualifyingRound | null>(null);
  const [closed, setClosed] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    try {
      const data = await apiGet<QualifyingRound>(`/tournaments/${tournamentId}/qualifying-round`);
      setRound(data);
      const own = data.submissions.find((s) => s.teamId === teamId);
      if (own && pollRef.current === null) {
        pollRef.current = setInterval(refresh, own.verdict === 'PENDING' ? 3000 : 5000);
      }
    } catch {
      setClosed(true);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  useEffect(() => {
    refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, teamId]);

  const handleSwitchTeam = () => {
    localStorage.removeItem(teamStorageKey(tournamentId));
    navigate(`/team/${tournamentId}`);
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      alert('Escribe tu solución antes de enviar.');
      return;
    }
    setSubmitting(true);
    try {
      await apiPost(`/tournaments/${tournamentId}/qualifying-submissions`, { teamId, content: trimmed });
      await refresh();
    } catch (error) {
      setSubmitting(false);
      alert(error instanceof ApiError ? error.message : 'No se pudo enviar la solución.');
    }
  };

  if (closed) {
    return (
      <div className="team-screen">
        <AppHeader />
        <div className="status-banner won">
          La clasificatoria ya cerró. Si avanzaste, tu profesor te compartirá el link de tu match.
        </div>
        <button className="switch-team" onClick={handleSwitchTeam}>
          ¿No eres este equipo? Cambiar
        </button>
      </div>
    );
  }

  if (!round) return <div className="waiting-screen">Cargando…</div>;

  const ownSubmission = round.submissions.find((s) => s.teamId === teamId);

  return (
    <div className="team-screen">
      <AppHeader />
      <div className="eyebrow">
        <span>
          <strong>{teamName(teamId)}</strong> — Ronda clasificatoria
        </span>
        <span>Avanzan {round.targetQualifierCount} equipos</span>
      </div>

      <div className="rule-note">
        Avanzan los equipos más rápidos con respuesta <strong>correcta</strong>. La velocidad no
        cuenta si el profesor rechaza tu solución.
      </div>

      <div className="case-card card">
        <h2>{round.businessCase.title}</h2>
        <p>{round.businessCase.description}</p>
      </div>

      {!ownSubmission && (
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Estructura repetitiva + pseudocódigo (PSeInt) + justificación de negocio…"
          />
          <div className="hint">Solo tienes un intento. Revisa antes de enviar.</div>
          <button className="submit-btn" disabled={submitting} onClick={handleSubmit}>
            Enviar solución
          </button>
        </div>
      )}

      {ownSubmission?.verdict === 'PENDING' && (
        <div className="status-banner waiting">Solución enviada. Esperando el veredicto del profesor…</div>
      )}
      {ownSubmission?.verdict === 'REJECTED' && (
        <div className="status-banner rejected">Tu solución fue rechazada. No avanzas a la siguiente fase.</div>
      )}
      {ownSubmission?.verdict === 'APPROVED' && (
        <div className="status-banner won">
          Solución aprobada. Esperando a que el profesor cierre la clasificatoria para saber si avanzas.
        </div>
      )}

      <button className="switch-team" onClick={handleSwitchTeam}>
        ¿No eres este equipo? Cambiar
      </button>
    </div>
  );
}
