/**
 * Nombre convencional de una ronda según cuántos matches tiene — así ni el
 * profesor lo escribe a mano ni el bracket muestra "Ronda 1/2/3" genérico
 * para las columnas que todavía no existen.
 */
export function roundNameForMatchCount(matchCount: number): string {
  switch (matchCount) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinal';
    case 4:
      return 'Cuartos de Final';
    case 8:
      return 'Octavos de Final';
    case 16:
      return 'Dieciseisavos de Final';
    default:
      return `Ronda de ${matchCount * 2}`;
  }
}
