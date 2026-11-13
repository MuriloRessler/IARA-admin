import { IaraLogo } from './IaraLogo.jsx';

const navigation = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'import', label: 'Importar horários' },
  { key: 'review', label: 'Conferir horários' },
];

export function AdminLayout({ admin, activeView, onNavigate, onLogout, children }) {
  return (
    <div className="admin-shell">
      <header className="app-header">
        <button className="brand-link" type="button" onClick={() => onNavigate('overview')} aria-label="Ir para a visão geral do IARA-admin">
          <IaraLogo variant="compact" />
        </button>
        <div className="brand-copy">
          <p className="eyebrow">Administração escolar</p>
          <p className="header-subtitle">Gerenciador de Horários</p>
        </div>
        <div className="admin-actions">
          <div className="admin-identity">
            <span>Administrador</span>
            <strong>{admin?.email}</strong>
          </div>
          <button className="logout-button" type="button" onClick={onLogout}>Sair</button>
        </div>
      </header>
      <nav className="admin-nav" aria-label="Navegação principal">
        <div className="admin-nav__inner">
          {navigation.map((item) => (
            <button
              className={`nav-link ${activeView === item.key ? 'nav-link--active' : ''}`}
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
          <span className="nav-future">Publicar horários · Após revisão</span>
        </div>
      </nav>
      <main className="admin-content">{children}</main>
      <footer className="app-footer">IARA-admin · Publicação protegida por confirmação administrativa</footer>
    </div>
  );
}
