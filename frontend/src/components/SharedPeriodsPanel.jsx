const keyOf = (entry) => `${entry.curso}::${entry.turma}`;
const dayLabels = { segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira' };

const hasOwnLesson = (period) => Boolean(period
  && period.estado !== 'vazio_documento'
  && (period.disciplina?.trim() || period.professor?.trim() || period.textoOriginal?.trim()));

const countOwnLessons = (schedule) => Object.values(schedule?.dias || {})
  .reduce((total, day) => total + day.periodos.filter(hasOwnLesson).length, 0);

export function SharedPeriodsPanel({ selectedCourse, selectedClass, pairCatalog, sharingSummary, suggestions, conflicts, rawSchedules, onSetSuggestionStatus }) {
  const automaticCount = suggestions.filter((suggestion) => suggestion.status === 'automatico').length;
  const rejectedCount = suggestions.filter((suggestion) => suggestion.status === 'rejeitada').length;

  return (
    <section className="panel-card sharing-panel" aria-labelledby="shared-periods-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Complementação por posição</p><h2 id="shared-periods-title">Aulas compartilhadas</h2></div>
        <span className="panel-note">Automática para pares oficiais</span>
      </div>
      <p>Os 24 pares oficiais do catálogo são reconhecidos automaticamente após a importação. A complementação ocorre somente em células vazias, por dia, posição e início; aulas próprias nunca são substituídas.</p>
      <div className="extraction-diagnostics sharing-summary">
        <span>{sharingSummary.turmasAnalisadas} turma(s) analisada(s)</span>
        <span>{sharingSummary.paresAutomaticos} par(es) automático(s)</span>
        <span>{automaticCount} complemento(s) aplicado(s)</span>
        <span>{rejectedCount} complemento(s) removido(s)</span>
        <span>{sharingSummary.periodosVazios} posição(ões) vazia(s)</span>
      </div>
      {conflicts?.length > 0 && <div className="sharing-conflict" role="status">
        <strong>Parceria manual não oficial encontrada.</strong>
        {conflicts.map((conflict) => <span key={conflict.id}>{conflict.first.curso}: {conflict.first.turma} ↔ {conflict.second.turma}. A regra oficial foi preservada; revise esta parceria manual.</span>)}
      </div>}
      <div className="sharing-pair-list">
        {pairCatalog.map((pair) => {
          const firstSchedule = rawSchedules?.[keyOf(pair.first)];
          const secondSchedule = rawSchedules?.[keyOf(pair.second)];
          const pairSuggestions = suggestions.filter((suggestion) => suggestion.pairId === pair.id);
          const sharedForFirst = pairSuggestions.filter((suggestion) => suggestion.target.turma === pair.first.turma && suggestion.status === 'automatico').length;
          const sharedForSecond = pairSuggestions.filter((suggestion) => suggestion.target.turma === pair.second.turma && suggestion.status === 'automatico').length;
          const firstOwn = countOwnLessons(firstSchedule);
          const secondOwn = countOwnLessons(secondSchedule);
          const available = firstSchedule && secondSchedule;
          return <article className={`sharing-pair ${available ? '' : 'sharing-pair--unavailable'}`} key={pair.id}>
            <div className="sharing-pair__header">
              <strong>{pair.first.curso}: {pair.first.turma}</strong><span>↔</span><strong>{pair.second.turma}</strong>
              <span className={`status-chip status-chip--${available ? 'com_aulas' : 'pendente'}`}>{available ? 'Automático' : 'Aguardando importação'}</span>
            </div>
            <div className="sharing-pair__metrics">
              <span>{pair.first.turma}: {firstOwn} próprias + {sharedForFirst} compartilhadas = {firstOwn + sharedForFirst}</span>
              <span>{pair.second.turma}: {secondOwn} próprias + {sharedForSecond} compartilhadas = {secondOwn + sharedForSecond}</span>
            </div>
            {pairSuggestions.length > 0 && <details className="sharing-suggestions" open={pair.first.turma === selectedClass || pair.second.turma === selectedClass}>
              <summary>{pairSuggestions.filter((suggestion) => suggestion.status === 'automatico').length} complemento(s) automático(s) · {pairSuggestions.length} posição(ões) identificada(s)</summary>
              <ul>{pairSuggestions.map((suggestion) => <li key={suggestion.id}>
                <span>{dayLabels[suggestion.dayKey]} · {suggestion.inicio} · {suggestion.target.turma} ← {suggestion.source.turma} · {suggestion.period.disciplina || 'célula reconhecida'}</span>
                {suggestion.status === 'automatico' && <button className="text-button" type="button" onClick={() => onSetSuggestionStatus([suggestion.id], 'rejeitada')}>Desfazer este complemento</button>}
                {suggestion.status === 'rejeitada' && <span><small>removido</small><button className="text-button" type="button" onClick={() => onSetSuggestionStatus([suggestion.id], 'automatico')}>Restaurar</button></span>}
                {suggestion.status === 'substituida' && <small>substituído manualmente</small>}
              </li>)}</ul>
            </details>}
          </article>;
        })}
      </div>
      <p className="helper-text">A turma 61 3 permanece independente. Editar uma aula compartilhada cria uma substituição local; remover uma complementação permite restaurá-la individualmente.</p>
      <span className="visually-hidden">Turma selecionada: {selectedCourse} {selectedClass}</span>
    </section>
  );
}
