import { useMemo, useState } from 'react';

export function SharedDayDialog({ currentSchedule, dayKey, schedules, sources, onShare, onRemove }) {
  const [sourceKey, setSourceKey] = useState('');
  const [message, setMessage] = useState('');
  const sameCourse = useMemo(() => sources.filter((source) => source.course === currentSchedule.curso), [sources, currentSchedule.curso]);
  const otherCourses = useMemo(() => sources.filter((source) => source.course !== currentSchedule.curso), [sources, currentSchedule.curso]);

  const submit = () => {
    const source = sources.find((candidate) => candidate.key === sourceKey);
    if (!source) {
      setMessage('Selecione uma turma de origem.');
      return;
    }
    if (source.course !== currentSchedule.curso && !window.confirm('A turma escolhida pertence a outro curso. Confirmar esse compartilhamento?')) return;
    const result = onShare(dayKey, source);
    setMessage(result?.error || '');
  };

  return (
    <div className="shared-day-editor">
      <label className="field-label" htmlFor={`shared-source-${dayKey}`}>
        Turma de origem
        <select id={`shared-source-${dayKey}`} value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}>
          <option value="">Selecione uma turma</option>
          {sameCourse.length > 0 && <optgroup label="Mesmo curso">{sameCourse.map((source) => <option key={source.key} value={source.key}>{source.turma}</option>)}</optgroup>}
          {otherCourses.length > 0 && <optgroup label="Outros cursos">{otherCourses.map((source) => <option key={source.key} value={source.key}>{source.turma} · {source.course}</option>)}</optgroup>}
        </select>
      </label>
      <button className="secondary-button" type="button" onClick={submit}>Confirmar compartilhamento</button>
      {currentSchedule.dias[dayKey].compartilhamento && <button className="text-button" type="button" onClick={() => onRemove(dayKey)}>Remover compartilhamento</button>}
      {message && <p className="inline-error" role="alert">{message}</p>}
      <small>As aulas serão exibidas a partir da turma de origem e permanecerão vinculadas no rascunho.</small>
      {currentSchedule.dias[dayKey].compartilhamento && schedules && <span className="shared-current">Vinculado a {currentSchedule.dias[dayKey].compartilhamento.turma}</span>}
    </div>
  );
}
