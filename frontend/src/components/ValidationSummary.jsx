import { DAYS } from '../services/schedule-model.js';

const isReviewMessage = (message) => message.includes('ainda não foi revisado') || message.includes('Dia ainda não foi marcado como revisado');

export function ValidationSummary({ validation, schedule }) {
  const statusCount = DAYS.reduce((count, { key }) => {
    const status = schedule.dias[key].situacao;
    count[status] = (count[status] || 0) + 1;
    return count;
  }, {});
  const blockingIssues = validation.issues.filter((issue) => !isReviewMessage(issue.message));
  const reviewByDay = DAYS.map(({ key, label }) => ({
    key,
    label,
    unreviewedPeriods: schedule.dias[key].periodos?.filter((period) => period.revisao !== 'revisado').length || 0,
    unreviewedDay: schedule.dias[key].revisao !== 'revisado',
  }));
  const unreviewedPeriods = reviewByDay.reduce((total, day) => total + day.unreviewedPeriods, 0);
  const unreviewedDays = reviewByDay.filter((day) => day.unreviewedDay).length;
  const reviewIncomplete = schedule.revisao !== 'revisado' || unreviewedPeriods > 0 || unreviewedDays > 0;

  return (
    <section className="panel-card validation-summary" aria-labelledby="validation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conferência</p>
          <h2 id="validation-title">Status da turma {schedule.turma}</h2>
        </div>
        <span className={`validation-badge ${blockingIssues.length === 0 && !reviewIncomplete ? 'validation-badge--valid' : 'validation-badge--pending'}`}>
          {blockingIssues.length > 0 ? `${blockingIssues.length} erro${blockingIssues.length === 1 ? '' : 's'}` : reviewIncomplete ? 'Revisão incompleta' : 'Pronta para prévia'}
        </span>
      </div>
      <div className="status-grid">
        <span><strong>{statusCount.com_aulas || 0}</strong> dias com aulas</span>
        <span><strong>{statusCount.compartilhado || 0}</strong> compartilhados</span>
        <span><strong>{statusCount.sem_aulas || 0}</strong> sem aulas confirmados</span>
        <span><strong>{statusCount.pendente || 0}</strong> pendentes</span>
      </div>
      {blockingIssues.length > 0 && (
        <ul className="validation-list">
          {blockingIssues.map((issue) => <li key={`${issue.day}-${issue.message}`}><strong>{issue.label}:</strong> {issue.message}</li>)}
        </ul>
      )}
      {reviewIncomplete && <div className="review-summary review-summary--compact">
        <strong>Revisão da turma</strong>
        <p>Esta turma possui períodos ou dias ainda não revisados. Revise individualmente ou aceite o risco na publicação final.</p>
        <details>
          <summary>Ver detalhes da revisão</summary>
          <ul>{reviewByDay.map((day) => <li key={day.key}>{day.label}: {day.unreviewedPeriods} período(s){day.unreviewedDay ? ' e dia não revisado' : ''}.</li>)}</ul>
        </details>
      </div>}
    </section>
  );
}
