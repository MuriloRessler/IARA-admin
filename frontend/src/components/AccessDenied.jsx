import { IaraLogo } from './IaraLogo.jsx';

export function AccessDenied({ onRetry, onLogout, isConnectionError }) {
  return (
    <main className="auth-state-page">
      <div className="auth-state-card">
        <IaraLogo variant="large" className="auth-brand" />
        <p className="eyebrow">IARA-admin</p>
        <h1>{isConnectionError ? 'Não foi possível verificar o acesso' : 'Acesso não autorizado'}</h1>
        <p>{isConnectionError ? 'Verifique a conexão com o backend e tente novamente.' : 'Esta conta não possui autorização para acessar o painel.'}</p>
        <div className="auth-state-actions">
          {isConnectionError && <button className="primary-button" type="button" onClick={onRetry}>Tentar novamente</button>}
          <button className="secondary-button" type="button" onClick={onLogout}>Sair</button>
        </div>
      </div>
    </main>
  );
}
