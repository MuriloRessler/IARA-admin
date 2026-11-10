import { useState } from 'react';
import { validatePeriod } from '../services/schedule-validation.js';

export function PeriodEditorDialog({ period, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...period });
  const [error, setError] = useState('');
  if (!period) return null;

  const change = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const save = (event) => {
    event.preventDefault();
    const errors = validatePeriod(draft, 0).filter((message) => !(draft.estado !== 'vazio_documento' && message.includes('informe a disciplina') && ['nao_reconhecido', 'parcial'].includes(draft.estado)));
    if (errors.length) { setError(errors[0]); return; }
    const result = onSave(draft);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="period-editor-title">
        <div className="modal-card__header"><div><p className="eyebrow">Conferência individual</p><h3 id="period-editor-title">Editar aula — posição {draft.posicao || 'não informada'}</h3></div><button className="icon-button modal-close" type="button" onClick={onCancel} aria-label="Fechar edição">×</button></div>
        <form className="modal-form" onSubmit={save}>
          <div className="modal-form__grid">
            <label>Início<input type="time" value={draft.inicio || ''} onChange={(event) => change('inicio', event.target.value)} /></label>
            <label>Término<input type="time" value={draft.fim || ''} onChange={(event) => change('fim', event.target.value)} /></label>
            <label>Posição<input type="number" min="1" value={draft.posicao || ''} onChange={(event) => change('posicao', event.target.value ? Number(event.target.value) : null)} /></label>
            <label>Página fonte<input type="number" min="1" value={draft.paginaFonte || ''} onChange={(event) => change('paginaFonte', event.target.value ? Number(event.target.value) : null)} /></label>
          </div>
          <label>Disciplina<input value={draft.disciplina || ''} onChange={(event) => change('disciplina', event.target.value)} /></label>
          <div className="modal-form__grid">
            <label>Professor<input value={draft.professor || ''} onChange={(event) => change('professor', event.target.value)} /></label>
            <label>Sala<input value={draft.sala || ''} onChange={(event) => change('sala', event.target.value)} /></label>
          </div>
          <label>Reconhecimento<select value={draft.estado || 'reconhecido'} onChange={(event) => change('estado', event.target.value)}><option value="reconhecido">Reconhecido</option><option value="vazio_documento">Célula vazia no documento</option><option value="nao_reconhecido">Não reconhecido</option><option value="parcial">Leitura parcial</option></select></label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button" type="submit">Salvar alteração</button></div>
        </form>
      </div>
    </div>
  );
}
