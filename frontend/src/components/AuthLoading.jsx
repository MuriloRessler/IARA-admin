import { IaraLogo } from './IaraLogo.jsx';

export function AuthLoading({ message = 'Verificando acesso...' }) {
  return (
    <main className="auth-state-page" aria-live="polite">
      <div className="auth-state-card">
        <IaraLogo variant="large" className="auth-brand" />
        <p className="eyebrow">IARA-admin</p>
        <h1>{message}</h1>
        <span className="loading-indicator" aria-hidden="true" />
      </div>
    </main>
  );
}
