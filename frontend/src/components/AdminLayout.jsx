import { useEffect, useState } from 'react';
import { ConnectionStatus } from './ConnectionStatus.jsx';
import { getHealth } from '../services/api.js';

const navigation = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'import', label: 'Importar horários' },
  { key: 'review', label: 'Conferir horários' },
];

export function AdminLayout({ admin, activeView, onNavigate, onLogout, children }) {
  const [connectionStatus, setConnectionStatus] = useState('loading');

  useEffect(() => {
    getHealth()
      .then(() => setConnectionStatus('connected'))
      .catch(() => setConnectionStatus('error'));
  }, []);

  return (
    <div className="admin-shell">
      <header className="app-header">
        <div className="brand-mark">IA</div>
        <div className="brand-copy">
          <p className="eyebrow">Inteligência Artificial de Resposta e Atendimento</p>
          <h1>IARA</h1>
          <p className="header-subtitle">Gerenciador de Horários</p>
        </div>
        <div className="admin-actions">
          <div className="admin-identity">
            <span>Administrador</span>
            <strong>{admin?.email}</strong>
          </div>
          <button className="logout-button" type="button" onClick={onLogout}>Sair</button>
          <ConnectionStatus status={connectionStatus} />
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
          <span className="nav-future">Publicar horários · Em breve</span>
        </div>
      </nav>
      <main className="admin-content">{children}</main>
      <footer className="app-footer">IARA-admin · Rascunhos locais nesta etapa</footer>
    </div>
  );
}
