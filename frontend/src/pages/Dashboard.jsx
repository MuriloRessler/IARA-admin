import { useEffect, useState } from 'react';
import { ConnectionStatus } from '../components/ConnectionStatus.jsx';
import { FeatureCard } from '../components/FeatureCard.jsx';
import { getHealth } from '../services/api.js';

export function Dashboard() {
  const [connectionStatus, setConnectionStatus] = useState('loading');

  useEffect(() => {
    getHealth()
      .then(() => setConnectionStatus('connected'))
      .catch(() => setConnectionStatus('error'));
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark">IA</div>
        <div>
          <p className="eyebrow">Inteligência Artificial de Resposta e Atendimento</p>
          <h1>IARA</h1>
          <p className="header-subtitle">Gerenciador de Horários</p>
        </div>
        <ConnectionStatus status={connectionStatus} />
      </header>

      <main className="dashboard-content">
        <section className="welcome-section">
          <p className="eyebrow">Painel administrativo</p>
          <h2>Olá, este é o espaço de gestão da IARA.</h2>
          <p>
            Organize os horários escolares com clareza e prepare as informações
            para que o atendimento aos alunos esteja sempre atualizado.
          </p>
        </section>

        <section className="features-section" aria-labelledby="features-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Fluxo de trabalho</p>
              <h2 id="features-title">Gestão de horários</h2>
            </div>
            <span className="section-count">Próximas etapas</span>
          </div>
          <div className="feature-grid">
            <FeatureCard
              icon="↑"
              title="Importar horários"
              description="Envie os arquivos PDF das grades para iniciar a interpretação dos horários."
            />
            <FeatureCard
              icon="✓"
              title="Conferir horários"
              description="Revise as informações identificadas antes de disponibilizá-las para o atendimento."
            />
            <FeatureCard
              icon="↗"
              title="Publicar horários"
              description="Publique as grades validadas para manter as respostas da IARA atualizadas."
            />
          </div>
        </section>
      </main>

      <footer className="app-footer">IARA-admin · Estrutura inicial</footer>
    </div>
  );
}
