export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Sin iniciar', className: 'badge--pending' },
  QUALIFYING: { label: 'Clasificatoria en curso', className: 'badge--active' },
  IN_PROGRESS: { label: 'En progreso', className: 'badge--active' },
  FINISHED: { label: 'Finalizado', className: 'badge--champion' },
};

export function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? { label: status, className: 'badge--pending' };
}
