export const MATCH_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Por iniciar', className: 'badge--pending' },
  ACTIVE: { label: 'En curso', className: 'badge--active' },
  AWAITING_JUDGMENT: { label: 'Esperando veredicto', className: 'badge--pending' },
  RESOLVED: { label: 'Terminado', className: 'badge--active' },
};

export function matchStatusBadge(status: string) {
  return MATCH_STATUS_BADGE[status] ?? { label: status, className: 'badge--pending' };
}
