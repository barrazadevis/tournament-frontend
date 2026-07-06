import { useMemo } from 'react';

interface ChampionCelebrationProps {
  championName: string;
  championLogo?: string;
}

const CONFETTI_COLORS = ['var(--gold)', 'var(--gold-strong)', 'var(--navy)', 'var(--success)', '#ffffff'];
const CONFETTI_COUNT = 60;

/**
 * Pantalla de celebración del campeón: confeti cayendo + revelado en pasos
 * (trofeo -> etiqueta -> nombre). Se usa tanto en JudgePage como en
 * ViewerPage, por eso vive como componente compartido.
 */
export function ChampionCelebration({ championName, championLogo }: ChampionCelebrationProps) {
  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2.5 + Math.random() * 2.5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  );

  return (
    <div className="champion-screen">
      <div className="confetti-layer" aria-hidden="true">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="confetti-piece"
            style={{
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              background: c.color,
              width: c.size,
              height: c.size * 0.4,
            }}
          />
        ))}
      </div>

      <div className="champion-trophy">🏆</div>
      <div className="champion-label">Campeón del torneo</div>
      <div className="champion-name">
        {championLogo && <span className="team-logo-icon">{championLogo}</span>}
        {championName}
      </div>
    </div>
  );
}
