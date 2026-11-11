import { useEffect, useState } from 'react';
import { getCellPreview } from '../services/api.js';

export function CellPreviewDialog({ period, file, accessToken, onCancel }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!period?.bbox || !period.paginaFonte || !file) return undefined;
    getCellPreview(file, period.paginaFonte, period.bbox, accessToken).then((url) => { if (active) setImageUrl(url); }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [period, file, accessToken]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  if (!period) return null;
  return <div className="dialog-backdrop" role="presentation"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="cell-preview-title"><div className="modal-card__header"><div><p className="eyebrow">Origem da leitura</p><h3 id="cell-preview-title">Célula da página {period.paginaFonte}</h3></div><button className="icon-button modal-close" type="button" onClick={onCancel} aria-label="Fechar visualização">×</button></div><p className="modal-help">Posição {period.posicao || 'não informada'} · {period.disciplina || 'conteúdo não reconhecido'}</p>{imageUrl ? <img className="cell-preview-image" src={imageUrl} alt={`Recorte da célula da posição ${period.posicao || ''}`} /> : error ? <p className="inline-error" role="alert">{error}</p> : <p className="modal-help" role="status">Carregando recorte da célula…</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onCancel}>Fechar</button></div></div></div>;
}
