/**
 * Color por urgencia, compartido entre CountdownRing (hero) y CountdownBar
 * (grilla) para que ambos usen exactamente los mismos umbrales — verde con
 * tiempo de sobra, dorado en la mitad, rojo cerca de agotarse.
 */
export function timerUrgencyColor(remainingSeconds: number, totalSeconds: number): string {
  if (totalSeconds <= 0) return 'var(--gold)';
  const fraction = remainingSeconds / totalSeconds;
  if (fraction <= 0.15) return 'var(--danger)';
  if (fraction <= 0.5) return 'var(--gold)';
  return 'var(--success)';
}
