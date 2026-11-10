import { useRef, useState } from 'react';
import { parseDraft, serializeDraft } from '../services/drafts.js';

export function DraftControls({ schedules, onImport, hasChanges, onExported, onImported }) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const exportDraft = () => {
    const blob = new Blob([serializeDraft(schedules)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `iara-rascunho-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setError('');
    setMessage('Rascunho exportado. Os dados continuam apenas neste navegador.');
    onExported?.();
  };

  const importDraft = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (hasChanges && !window.confirm('Substituir o rascunho atual? Alterações ainda não exportadas serão perdidas.')) return;
    try {
      const payload = parseDraft(await file.text());
      onImport(payload.schedules);
      setError('');
      setMessage('Rascunho importado e validado localmente.');
      onImported?.();
    } catch (importError) {
      setMessage('');
      setError(importError.message);
    }
  };

  return (
    <section className="draft-controls" aria-label="Rascunhos locais">
      <div>
        <strong>Rascunho local</strong>
        <p>Exporte seu trabalho em JSON ou restaure um rascunho anterior. Nada é enviado ao Supabase.</p>
      </div>
      <div className="draft-actions">
        <button className="secondary-button" type="button" onClick={exportDraft}>Exportar rascunho</button>
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>Importar rascunho</button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importDraft} />
      </div>
      {message && <p className="feedback feedback--success" role="status">{message}</p>}
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
    </section>
  );
}
