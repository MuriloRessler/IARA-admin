import { useState } from 'react';
import { getSplitCandidates } from '../services/schedule-rules.js';
import { isValidTime } from '../services/schedule-validation.js';

const blankSlot = () => ({ posicao: '', inicio: '' });

export function PeriodSplitDialog({ period, courseName, onConfirm, onCancel }) {
  const candidates = getSplitCandidates(period, courseName);
  const [selected, setSelected] = useState(() => candidates.map((slot) => slot.posicao));
  const [manualSlots, setManualSlots] = useState(() => [blankSlot(), blankSlot()]);
  const [error, setError] = useState('');
  if (!period) return null;

  const toggle = (position) => setSelected((current) => current.includes(position) ? current.filter((item) => item !== position) : [...current, position]);
  const updateManual = (index, field, value) => setManualSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, [field]: field === 'posicao' && value ? Number(value) : value } : slot));
  const confirm = () => {
    const slots = candidates.length ? candidates.filter((slot) => selected.includes(slot.posicao)) : manualSlots;
    if (slots.length < 2) { setError('Selecione pelo menos duas posições para dividir.'); return; }
    if (slots.some((slot) => !Number.isInteger(Number(slot.posicao)) || !isValidTime(slot.inicio))) {
      setError('Preencha posições e horários de início válidos para todas as células.'); return;
    }
    const result = onConfirm(slots);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="period-split-title">
        <div className="modal-card__header"><div><p className="eyebrow">Conferência estrutural</p><h3 id="period-split-title">Dividir período agrupado</h3></div><button className="icon-button modal-close" type="button" onClick={onCancel} aria-label="Fechar divisão">×</button></div>
        <p className="modal-help">O conteúdo da posição {period.posicao || 'selecionada'} será preservado em células independentes. Confirme apenas as posições comprovadas no documento.</p>
        {candidates.length ? <div className="split-options">{candidates.map((slot) => <label key={slot.posicao} className="split-option"><input type="checkbox" checked={selected.includes(slot.posicao)} onChange={() => toggle(slot.posicao)} /><span><strong>Posição {slot.posicao}</strong><small>Início: {slot.inicio}</small></span></label>)}</div> : <div className="manual-split"><p className="modal-help">Não há estrutura conhecida para este curso. Informe manualmente as posições e horários de início; nenhuma posição será inventada.</p>{manualSlots.map((slot, index) => <div className="modal-form__grid" key={`manual-${index}`}><label>Posição<input type="number" min="1" value={slot.posicao} onChange={(event) => updateManual(index, 'posicao', event.target.value)} /></label><label>Início<input type="time" value={slot.inicio} onChange={(event) => updateManual(index, 'inicio', event.target.value)} /></label></div>)}<button className="text-button" type="button" onClick={() => setManualSlots((current) => [...current, blankSlot()])}>+ Adicionar posição</button></div>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button" type="button" onClick={confirm}>Confirmar divisão</button></div>
      </div>
    </div>
  );
}
