import { formatSeconds } from '../utils/format';

interface CountdownRingProps {
  remainingSeconds: number;
  totalSeconds: number;
  size: number;
  strokeWidth: number;
  showLabel?: boolean;
}

export function CountdownRing({
  remainingSeconds,
  totalSeconds,
  size,
  strokeWidth,
  showLabel = true,
}: CountdownRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const offset = circumference * (1 - fraction);
  const isUrgent = totalSeconds > 0 && fraction <= 0.15;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Tiempo restante">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--track)" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isUrgent ? 'var(--danger)' : 'var(--gold)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      {showLabel && (
        <div
          className="mono"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: size >= 200 ? 'clamp(2.5rem, 8vw, 4.5rem)' : '1.1rem',
          }}
        >
          {formatSeconds(Math.max(0, remainingSeconds))}
        </div>
      )}
    </div>
  );
}
