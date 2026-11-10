import { useMemo } from 'react';
import { getEffectiveDay, scheduleKey } from '../services/schedule-model.js';
import { validateDay } from '../services/schedule-validation.js';
import { SharedDayDialog } from './SharedDayDialog.jsx';

const statusLabels = {
  com_aulas: 'Com aulas',
  compartilhado: 'Compartilhado',
  sem_aulas: 'Sem aulas confirmado',
  pendente: 'Pendente',
};

export function DaySchedule({ dayDefinition, schedule, schedules, sources, onDayChange, onPeriodChange, onAddPeriod, onRemovePeriod, onShare, onRemoveShare, onReviewDay, onResolveWarning }) {
  const { key: dayKey, label } = dayDefinition;
  const day = schedule.dias[dayKey];
  const currentKey = scheduleKey(schedule.curso, schedule.turma);
  const validationErrors = validateDay(day, schedules, currentKey, dayKey);
  const effective = getEffectiveDay(schedules, currentKey, dayKey);
  const displayedPeriods = day.situacao === 'compartilhado' ? effective.periods : day.periodos;
  const sourceLabel = day.compartilhamento ? `${day.compartilhamento.turma} · ${day.compartilhamento.curso}` : '';
  const periodIds = useMemo(() => new Set(day.periodos.map((period) => period.id)), [day.periodos]);

  const changeStatus = (nextStatus) => {
    if (nextStatus === 'compartilhado') {
      onDayChange(dayKey, { situacao: 'compartilhado', compartilhamento: day.compartilhamento, periodos: day.periodos });
      return;
    }
    onDayChange(dayKey, { situacao: nextStatus, compartilhamento: null, periodos: nextStatus === 'com_aulas' ? day.periodos : [] });
  };

  return (
    <article className={`day-card day-card--${day.situacao}`}>
      <div className="day-card__header">
        <div>
          <h3>{label}</h3>
          <span className={`status-chip status-chip--${day.situacao}`}>{statusLabels[day.situacao]}</span>
          <span className={`review-chip review-chip--${day.revisao === 'nao_revisado' ? 'pending' : 'done'}`}>{day.revisao === 'nao_revisado' ? 'Não revisado' : 'Revisado'}</span>
        </div>
        <label className="field-label field-label--compact" htmlFor={`${dayKey}-status`}>
          Situação
          <select id={`${dayKey}-status`} value={day.situacao} onChange={(event) => changeStatus(event.target.value)}>
            <option value="pendente">Pendente</option>
            <option value="com_aulas">Com aulas</option>
            <option value="sem_aulas">Sem aulas</option>
            <option value="compartilhado">Compartilhado</option>
          </select>
        </label>
      </div>
      {day.situacao === 'compartilhado' ? (
        <>
          <div className="inherited-note">Aulas herdadas de <strong>{sourceLabel || 'uma turma ainda não selecionada'}</strong></div>
          <SharedDayDialog currentSchedule={schedule} dayKey={dayKey} schedules={schedules} sources={sources} onShare={onShare} onRemove={onRemoveShare} />
        </>
      ) : day.situacao === 'sem_aulas' ? (
        <div className="no-classes-note">O administrador confirmou que esta turma não possui aulas neste dia.</div>
      ) : (
        <div className="period-list">
          {day.periodos.map((period, index) => (
            <div className="period-row" key={period.id || `${dayKey}-${index}`}>
              <div className="period-row__time">
                <label htmlFor={`${period.id}-start`}>Início</label>
                <input id={`${period.id}-start`} type="time" value={period.inicio} onChange={(event) => onPeriodChange(dayKey, period.id, 'inicio', event.target.value)} />
                <label htmlFor={`${period.id}-end`}>Término</label>
                <input id={`${period.id}-end`} type="time" value={period.fim} onChange={(event) => onPeriodChange(dayKey, period.id, 'fim', event.target.value)} />
              </div>
              <div className="period-row__fields">
                <label htmlFor={`${period.id}-state`}>Leitura<select id={`${period.id}-state`} value={period.estado || 'reconhecido'} onChange={(event) => onPeriodChange(dayKey, period.id, 'estado', event.target.value)}><option value="reconhecido">Reconhecido</option><option value="vazio_documento">Célula vazia</option><option value="nao_reconhecido">Não reconhecido</option><option value="parcial">Leitura parcial</option></select></label>
                <label htmlFor={`${period.id}-subject`}>Disciplina<input id={`${period.id}-subject`} value={period.disciplina} onChange={(event) => onPeriodChange(dayKey, period.id, 'disciplina', event.target.value)} placeholder="Disciplina" /></label>
                <label htmlFor={`${period.id}-teacher`}>Professor<input id={`${period.id}-teacher`} value={period.professor} onChange={(event) => onPeriodChange(dayKey, period.id, 'professor', event.target.value)} placeholder="Opcional" /></label>
                <label htmlFor={`${period.id}-room`}>Sala<input id={`${period.id}-room`} value={period.sala} onChange={(event) => onPeriodChange(dayKey, period.id, 'sala', event.target.value)} placeholder="Opcional" /></label>
              </div>
              {(period.posicao || period.paginaFonte || period.estado !== 'reconhecido') && <small className="period-source-note">Posição {period.posicao || 'não informada'}{period.paginaFonte ? ` · página ${period.paginaFonte}` : ''} · {period.estado === 'vazio_documento' ? 'célula vazia no PDF' : period.estado === 'nao_reconhecido' ? 'conferência necessária' : period.estado === 'parcial' ? 'leitura parcial' : 'extraído'}</small>}
              <button className="icon-button" type="button" onClick={() => onRemovePeriod(dayKey, period.id)} aria-label={`Remover período ${index + 1}`}>×</button>
            </div>
          ))}
          {day.periodos.length === 0 && <p className="period-empty">Nenhum período registrado. Um dia vazio continuará pendente até ser confirmado.</p>}
          <button className="secondary-button add-period-button" type="button" onClick={() => onAddPeriod(dayKey)}>+ Adicionar período</button>
        </div>
      )}
      {day.situacao === 'compartilhado' && displayedPeriods.length > 0 && (
        <div className="inherited-periods">
          {displayedPeriods.map((period) => <span key={period.id || period.inicio}>{period.inicio} · {period.disciplina}</span>)}
        </div>
      )}
      {validationErrors.length > 0 && <ul className="day-errors">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
      {day.avisos?.length > 0 && <ul className="day-warnings">{day.avisos.map((item) => <li key={item.id}><span>{item.message}</span>{!item.resolvido && <button className="text-button" type="button" onClick={() => onResolveWarning(dayKey, item.id)}>Marcar aviso como conferido</button>}</li>)}</ul>}
      {day.revisao === 'nao_revisado' && <button className="secondary-button review-day-button" type="button" onClick={() => onReviewDay(dayKey)} disabled={validationErrors.length > 0 || day.avisos?.some((item) => !item.resolvido)}>Marcar dia como revisado</button>}
      {day.situacao === 'compartilhado' && effective.error && <span className="visually-hidden">{effective.error}</span>}
      {periodIds.size === 0 && day.situacao === 'com_aulas' && <span className="visually-hidden">Dia sem períodos</span>}
    </article>
  );
}
