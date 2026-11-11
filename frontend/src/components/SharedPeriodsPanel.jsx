import { useMemo, useState } from 'react';

const keyOf = (entry) => `${entry.curso}::${entry.turma}`;
const dayLabels = { segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira' };

export function SharedPeriodsPanel({ courses, selectedCourse, selectedClass, pairCatalog, sharing, sharingSummary, suggestions, onConfirmPair, onResetPair, onSetSuggestionStatus, onUpdateSuggestions }) {
  const [partnerSelections, setPartnerSelections] = useState({});
  const [filterDay, setFilterDay] = useState('');
  const [filterCourse, setFilterCourse] = useState(selectedCourse || '');

  const decisionFor = (pair) => Object.values(sharing.pairDecisions || {}).find((decision) => decision.first && decision.second
    && (keyOf(decision.first) === keyOf(pair.first) || keyOf(decision.second) === keyOf(pair.first)));
  const suggestionsFor = (decision, pair) => suggestions.filter((suggestion) => suggestion.pairId === (decision?.id || pair.id));
  const totalPending = useMemo(() => suggestions.filter((suggestion) => suggestion.status === 'sugerida').length, [suggestions]);

  return (
    <section className="panel-card sharing-panel" aria-labelledby="shared-periods-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Complementação por posição</p><h2 id="shared-periods-title">Aulas compartilhadas</h2></div>
        <span className="panel-note">Aprovação manual</span>
      </div>
      <p>Confirme uma parceira para gerar sugestões somente nas posições vazias. Aulas próprias permanecem intactas e nenhuma sugestão é publicada automaticamente.</p>
      <div className="extraction-diagnostics sharing-summary">
        <span>{sharingSummary.turmasAnalisadas} turma(s) analisada(s)</span>
        <span>{sharingSummary.paresConfirmados} par(es) confirmado(s)</span>
        <span>{sharingSummary.paresPendentes} par(es) pendente(s)</span>
        <span>{totalPending} sugestão(ões) pendente(s)</span>
        <span>{sharingSummary.aceitas} aceita(s)</span>
        <span>{sharingSummary.periodosVazios} posição(ões) vazia(s)</span>
      </div>
      {totalPending > 0 && <div className="sharing-batch-actions">
        <button className="secondary-button" type="button" onClick={() => onSetSuggestionStatus(suggestions.filter((suggestion) => suggestion.status === 'sugerida').map((suggestion) => suggestion.id), 'confirmada')}>Aprovar todas ({totalPending})</button>
        <label className="field-label">Dia<select value={filterDay} onChange={(event) => setFilterDay(event.target.value)}><option value="">Todos</option>{Object.entries(dayLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button className="secondary-button" type="button" disabled={!filterDay} onClick={() => onUpdateSuggestions({ dayKey: filterDay }, 'confirmada')}>Aprovar dia</button>
        <label className="field-label">Curso<select value={filterCourse} onChange={(event) => setFilterCourse(event.target.value)}><option value="">Todos</option>{courses.map((course) => <option key={course.name} value={course.name}>{course.name}</option>)}</select></label>
        <button className="secondary-button" type="button" disabled={!filterCourse} onClick={() => onUpdateSuggestions({ curso: filterCourse }, 'confirmada')}>Aprovar curso</button>
        <label className="field-label">Turma<select value={selectedClass || ''} onChange={() => {}} disabled><option value={selectedClass}>{selectedClass || 'Atual'}</option></select></label>
        <button className="secondary-button" type="button" disabled={!selectedCourse || !selectedClass} onClick={() => onUpdateSuggestions({ curso: selectedCourse, turma: selectedClass }, 'confirmada')}>Aprovar turma atual</button>
        <button className="text-button" type="button" onClick={() => onSetSuggestionStatus(suggestions.filter((suggestion) => suggestion.status === 'sugerida').map((suggestion) => suggestion.id), 'rejeitada')}>Rejeitar pendentes</button>
      </div>}
      <div className="sharing-pair-list">
        {pairCatalog.map((pair) => {
          const decision = decisionFor(pair);
          const currentPartner = partnerSelections[pair.id] || decision?.second?.turma || pair.second.turma;
          const pairSuggestions = suggestionsFor(decision, pair);
          const candidateClasses = courses.find((course) => course.name === pair.first.curso)?.classes || [];
          return <article className="sharing-pair" key={pair.id}>
            <div className="sharing-pair__header"><strong>{pair.first.curso}: {pair.first.turma}</strong><span>↔</span><strong>{decision?.second?.turma || pair.second.turma}</strong><span className={`status-chip status-chip--${decision?.status === 'confirmed' ? 'com_aulas' : 'pendente'}`}>{decision?.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</span></div>
            <div className="sharing-pair__actions">
              <label className="field-label">Turma parceira<select value={currentPartner} onChange={(event) => setPartnerSelections((current) => ({ ...current, [pair.id]: event.target.value }))}>{candidateClasses.filter((classCode) => classCode !== pair.first.turma).map((classCode) => <option key={classCode} value={classCode}>{classCode}</option>)}</select></label>
              <button className="secondary-button" type="button" onClick={() => onConfirmPair(pair.first, { curso: pair.first.curso, turma: currentPartner })}>{decision?.status === 'confirmed' ? 'Alterar parceira' : 'Confirmar parceira'}</button>
              {decision?.status === 'confirmed' && <button className="text-button" type="button" onClick={() => onResetPair(decision)}>Desfazer confirmação</button>}
            </div>
            {pairSuggestions.length > 0 && <details className="sharing-suggestions"><summary>{pairSuggestions.filter((suggestion) => suggestion.status === 'sugerida').length} sugestão(ões) pendente(s) · {pairSuggestions.length} posição(ões) complementável(eis)</summary>
              <ul>{pairSuggestions.map((suggestion) => <li key={suggestion.id}><span>{dayLabels[suggestion.dayKey]} · {suggestion.inicio} · {suggestion.target.turma} ← {suggestion.source.turma} · {suggestion.period.disciplina}</span>{suggestion.status === 'sugerida' ? <span><button className="text-button" type="button" onClick={() => onSetSuggestionStatus([suggestion.id], 'confirmada')}>Aprovar</button><button className="text-button" type="button" onClick={() => onSetSuggestionStatus([suggestion.id], 'rejeitada')}>Rejeitar</button></span> : suggestion.status === 'confirmada' ? <span><small>confirmada</small><button className="text-button" type="button" onClick={() => onSetSuggestionStatus([suggestion.id], 'rejeitada')}>Desfazer</button></span> : <small>{suggestion.status}</small>}</li>)}</ul>
              {pairSuggestions.some((suggestion) => suggestion.status === 'sugerida') && <button className="secondary-button" type="button" onClick={() => onUpdateSuggestions({ pairId: decision?.id || pair.id }, 'confirmada')}>Aprovar este par</button>}
            </details>}
          </article>;
        })}
      </div>
      <p className="helper-text">Turmas sem uma parceira confirmada, como 61 3, não recebem complementação automática.</p>
      <span className="visually-hidden">Turma selecionada: {selectedCourse} {selectedClass}</span>
    </section>
  );
}
