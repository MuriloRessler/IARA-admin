export function Dashboard({ totalClasses, onNavigate }) {
  return (
    <div className="page-stack">
      <section className="page-intro page-intro--large">
        <p className="eyebrow">Visão geral</p>
        <h2>Gerenciador de Horários</h2>
        <p>Importe um documento, confira manualmente as grades por turma e prepare a prévia que será publicada em uma etapa futura.</p>
      </section>
      <section className="workflow-grid" aria-label="Etapas do gerenciamento">
        <button className="workflow-card workflow-card--active" type="button" onClick={() => onNavigate('import')}>
          <span className="workflow-number">01</span>
          <span><strong>Importar PDF</strong><small>Selecione um documento local para consulta.</small></span>
          <span className="workflow-action">Abrir →</span>
        </button>
        <button className="workflow-card workflow-card--active" type="button" onClick={() => onNavigate('review')}>
          <span className="workflow-number">02</span>
          <span><strong>Conferir horários</strong><small>Edite qualquer turma e valide os dias da semana.</small></span>
          <span className="workflow-action">Abrir →</span>
        </button>
        <button className="workflow-card workflow-card--active" type="button" onClick={() => onNavigate('review')}>
          <span className="workflow-number">03</span>
          <span><strong>Publicar horários</strong><small>Revise as diferenças, baixe o backup e publique após a confirmação.</small></span>
          <span className="workflow-action">Revisar →</span>
        </button>
      </section>
      <section className="overview-note">
        <div className="overview-note__icon">49</div>
        <div><strong>Catálogo local da escola</strong><p>{totalClasses} turmas distribuídas em oito cursos estão disponíveis para conferência.</p></div>
      </section>
    </div>
  );
}
