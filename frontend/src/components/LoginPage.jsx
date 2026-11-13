import { useState } from 'react';
import { IaraLogo } from './IaraLogo.jsx';

export function LoginPage({ onSubmit, isSubmitting, configurationError, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(email, password);
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <IaraLogo variant="large" className="login-brand" />
        <p className="eyebrow">IARA · Gerenciador de Horários</p>
        <h1 id="login-title">Acesso administrativo</h1>
        <p className="login-introduction">Entre com a conta autorizada para acessar o painel da IARA.</p>

        {configurationError ? (
          <div className="feedback feedback--warning" role="alert">
            O Supabase ainda não foi configurado. Defina as variáveis de ambiente do frontend para habilitar o login.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="feedback feedback--error" role="alert">
                Não foi possível entrar. Verifique suas credenciais e tente novamente.
              </div>
            )}
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="password">Senha</label>
            <div className="password-field">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
        <p className="restricted-note">Acesso restrito ao administrador autorizado.</p>
      </section>
    </main>
  );
}
