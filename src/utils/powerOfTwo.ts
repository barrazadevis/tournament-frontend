/** Mirror puro de PowerOfTwoMath del backend — solo para calcular etiquetas de ronda en la UI, sin round-trip. */
export function isPowerOfTwo(n: number): boolean {
  return n >= 1 && (n & (n - 1)) === 0;
}

/** La potencia de 2 más cercana hacia abajo (ej. 9 -> 8, 7 -> 4, 16 -> 16). */
export function largestPowerOfTwoLessOrEqual(n: number): number {
  if (n < 1) return 0;
  return 2 ** Math.floor(Math.log2(n));
}

/** Etiquetas de ronda en orden (clasificatoria primero si aplica), para pedir un caso por ronda. */
export function roundLabelsFor(teamCount: number, roundNameForMatchCount: (matchCount: number) => string): string[] {
  if (teamCount < 2) return [];

  const needsQualifying = !isPowerOfTwo(teamCount);
  const bracketSize = needsQualifying ? largestPowerOfTwoLessOrEqual(teamCount) : teamCount;
  const bracketRounds = Math.log2(bracketSize);

  const labels: string[] = [];
  if (needsQualifying) labels.push('Ronda clasificatoria');
  for (let i = 0; i < bracketRounds; i++) {
    labels.push(roundNameForMatchCount(bracketSize / 2 ** (i + 1)));
  }
  return labels;
}
