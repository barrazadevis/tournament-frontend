import type { Match, Tournament } from '../api/types';

interface BracketViewProps {
  tournament: Tournament;
  teamName: (id: string) => string;
  teamLogo: (id: string) => string | undefined;
}

const COL_WIDTH = 220;
const COL_GAP = 56;
const MATCH_HEIGHT = 64;
const BASE_SPACING = 92;
const TOP_OFFSET = 40;

const AVATAR_COLORS = ['#0a1f44', '#a06e00', '#1f9d55', '#7a3fd6', '#d64545', '#0f7ea6'];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function TeamRow({
  id,
  name,
  logo,
  isWinner,
  isLoser,
}: {
  id: string;
  name: string;
  logo: string | undefined;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div className={`bracket-team-row${isWinner ? ' winner' : ''}${isLoser ? ' loser' : ''}`}>
      {logo ? (
        <span className="bracket-avatar bracket-avatar--logo">{logo}</span>
      ) : (
        <span className="bracket-avatar" style={{ background: avatarColor(id) }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="bracket-team-label">{name}</span>
      {isWinner && <span className="bracket-winner-mark">🏆</span>}
    </div>
  );
}

function PlaceholderRow() {
  return (
    <div className="bracket-team-row">
      <span className="bracket-avatar bracket-avatar--empty">?</span>
      <span className="bracket-team-label">Por definir</span>
    </div>
  );
}

/**
 * Diagrama de llaves progresivo con líneas conectoras reales.
 *
 * Las posiciones se calculan a mano en JS (no vía CSS flexbox) porque las
 * líneas conectoras necesitan coordenadas exactas: con N matches distribuidos
 * uniformemente en una altura H compartida por todas las columnas, el match
 * `k` de una ronda queda automáticamente centrado entre sus dos "padres"
 * (2k, 2k+1) de la ronda anterior — es la misma propiedad matemática de
 * `space-around`, pero calculada explícitamente para poder dibujar las
 * líneas sin adivinar dónde cae cada centro.
 *
 * Las rondas que el backend todavía no generó (sorteo pendiente, ver
 * bracket-advancement.service.ts en el backend) se muestran como casillas
 * "Por definir" — no hay nada real que mostrar ahí todavía.
 */
export function BracketView({ tournament, teamName, teamLogo }: BracketViewProps) {
  if (tournament.rounds.length === 0) return null;

  const round0Count = tournament.rounds[0].matches.length;
  const totalRounds = Math.log2(round0Count * 2);
  const totalHeight = round0Count * BASE_SPACING;
  const totalWidth = totalRounds * COL_WIDTH + (totalRounds - 1) * COL_GAP;

  const boxes: { key: string; x: number; y: number; match: Match | undefined; isChampionSlot: boolean }[] = [];
  const hLines: { key: string; x: number; y: number; width: number }[] = [];
  const vLines: { key: string; x: number; y: number; height: number }[] = [];

  for (let col = 0; col < totalRounds; col++) {
    const n = round0Count / 2 ** col;
    const spacing = totalHeight / n;
    const round = tournament.rounds[col];
    const x = col * (COL_WIDTH + COL_GAP);
    const centers: number[] = [];

    for (let k = 0; k < n; k++) {
      const centerY = spacing * (k + 0.5);
      centers.push(centerY);
      boxes.push({
        key: `${col}-${k}`,
        x,
        y: centerY - MATCH_HEIGHT / 2,
        match: round?.matches[k],
        isChampionSlot: col === totalRounds - 1,
      });
    }

    if (col < totalRounds - 1) {
      for (let k = 0; k < n; k += 2) {
        const y1 = centers[k];
        const y2 = centers[k + 1];
        const midX = x + COL_WIDTH + COL_GAP / 2;
        hLines.push({ key: `h1-${col}-${k}`, x: x + COL_WIDTH, y: y1, width: COL_GAP / 2 });
        hLines.push({ key: `h2-${col}-${k}`, x: x + COL_WIDTH, y: y2, width: COL_GAP / 2 });
        vLines.push({ key: `v-${col}-${k}`, x: midX, y: Math.min(y1, y2), height: Math.abs(y2 - y1) });
        hLines.push({ key: `h3-${col}-${k}`, x: midX, y: (y1 + y2) / 2, width: COL_GAP / 2 });
      }
    }
  }

  return (
    <div className="bracket-wrap">
      <div className="bracket-title">🏆 Llaves del torneo</div>
      <div className="bracket-scroll">
        <div className="bracket-canvas" style={{ width: totalWidth, height: totalHeight + TOP_OFFSET }}>
          {Array.from({ length: totalRounds }, (_, col) => {
            const round = tournament.rounds[col];
            return (
              <div
                key={col}
                className="bracket-col-label"
                style={{ left: col * (COL_WIDTH + COL_GAP), width: COL_WIDTH }}
              >
                {round ? round.name : `Ronda ${col + 1}`}
              </div>
            );
          })}

          {hLines.map((line) => (
            <div
              key={line.key}
              className="bracket-line-h"
              style={{ left: line.x, top: line.y + TOP_OFFSET, width: line.width }}
            />
          ))}
          {vLines.map((line) => (
            <div
              key={line.key}
              className="bracket-line-v"
              style={{ left: line.x, top: line.y + TOP_OFFSET, height: line.height }}
            />
          ))}

          {boxes.map((box) => {
            const match = box.match;
            const isChampion = box.isChampionSlot && !!match?.winnerId;
            return (
              <div
                key={box.key}
                className={`bracket-match${isChampion ? ' bracket-champion' : ''}${!match ? ' bracket-placeholder' : ''}`}
                style={{ left: box.x, top: box.y + TOP_OFFSET, width: COL_WIDTH, height: MATCH_HEIGHT }}
              >
                {match ? (
                  <>
                    <TeamRow
                      id={match.teamAId}
                      name={teamName(match.teamAId)}
                      logo={teamLogo(match.teamAId)}
                      isWinner={match.winnerId === match.teamAId}
                      isLoser={!!match.winnerId && match.winnerId !== match.teamAId}
                    />
                    <TeamRow
                      id={match.teamBId}
                      name={teamName(match.teamBId)}
                      logo={teamLogo(match.teamBId)}
                      isWinner={match.winnerId === match.teamBId}
                      isLoser={!!match.winnerId && match.winnerId !== match.teamBId}
                    />
                  </>
                ) : (
                  <>
                    <PlaceholderRow />
                    <PlaceholderRow />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
