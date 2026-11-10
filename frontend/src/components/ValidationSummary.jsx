import { DAYS } from '../services/schedule-model.js';

export function ValidationSummary({ validation, schedule }) {
  const statusCount = DAYS.reduce((count, { key }) => {
    const status = schedule.dias[key].situacao;
    count[status] = (count[status] || 0) + 1;
    return count;
  }, {});

  return (
    <section className="panel-card validation-summary" aria-labelledby="validation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conferência</p>
          <h2 id="validation-title">Status da turma {schedule.turma}</h2>
        </div>
        <span className={`validation-badge ${validation.valid ? 'validation-badge--valid' : 'validation-badge--pending'}`}>
          {validation.valid ? 'Pronta para prévia' : `${validation.errorCount} pendência${validation.errorCount === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="status-grid">
        <span><strong>{statusCount.com_aulas || 0}</strong> dias com aulas</span>
        <span><strong>{statusCount.compartilhado || 0}</strong> compartilhados</span>
        <span><strong>{statusCount.sem_aulas || 0}</strong> sem aulas confirmados</span>
        <span><strong>{statusCount.pendente || 0}</strong> pendentes</span>
      </div>
      {!validation.valid && (
        <ul className="validation-list">
          {validation.issues.map((issue) => <li key={`${issue.day}-${issue.message}`}><strong>{issue.label}:</strong> {issue.message}</li>)}
        </ul>
      )}
    </section>
  );
}
