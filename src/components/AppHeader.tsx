interface AppHeaderProps {
  subtitle?: string;
}

export function AppHeader({ subtitle }: AppHeaderProps) {
  return (
    <div className="app-header">
      <span className="app-header-brand">Torneo TGA</span>
      {subtitle && <span className="app-header-subtitle">{subtitle}</span>}
    </div>
  );
}
