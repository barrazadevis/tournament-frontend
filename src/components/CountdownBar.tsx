import { formatSeconds } from '../utils/format';
import { timerUrgencyColor } from '../utils/timerUrgency';

interface CountdownBarProps {
  remainingSeconds: number;
  totalSeconds: number;
  showLabel?: boolean;
}

/**
 * Versión lineal de CountdownRing — pensada para la grilla de varios
 * matches a la vez (ViewerPage): con las barras alineadas, es más fácil
 * comparar de un vistazo quién se está quedando sin tiempo que con varios
 * círculos pequeños dispersos. El círculo sigue reservado para el modo
 * hero (un solo match en pantalla completa).
 */
export function CountdownBar({ remainingSeconds, totalSeconds, showLabel = true }: CountdownBarProps) {
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const color = timerUrgencyColor(remainingSeconds, totalSeconds);

  return (
    <div className="countdown-bar-wrap">
      <div className="countdown-bar-track">
        <div
          className="countdown-bar-fill"
          style={{ width: `${fraction * 100}%`, background: color }}
        />
      </div>
      {showLabel && (
        <div className="countdown-label countdown-bar-label" style={{ color }}>
          {formatSeconds(Math.max(0, remainingSeconds))}
        </div>
      )}
    </div>
  );
}
